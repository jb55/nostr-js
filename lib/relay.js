const WS = typeof WebSocket !== 'undefined' ? WebSocket : require('ws')

Relay.prototype.wait_connected = async function relay_wait_connected() {
	let retry = 1000
	while (true) {
		if (this.ws.readyState !== 1) {
			await sleep(retry)
			retry *= 1.5
		}
		else {
			return
		}
	}
}

/**
 * @classdesc Connect to a relay server and subscribe to events.
 * @param {string} relay 
 * @param {{reconnect?: boolean}} [opts] 
 * @class Relay
 */
function Relay(relay, opts={})
{
	if (!(this instanceof Relay))
		return new Relay(relay, opts)

	this.url = relay
	this.opts = opts

	if (opts.reconnect == null)
		opts.reconnect = true

	const me = this
	me.onfn = {}

	init_websocket(me)
		.catch(e => {
			if (me.onfn.error)
				me.onfn.error(e)
		})

	return this
}

/**
 * @param {Relay} me 
 * @returns {Promise<Relay>}
 */
function init_websocket(me) {
	return new Promise((resolve, reject) => {
		const ws = me.ws = new WS(me.url);

		let resolved = false
		ws.onmessage = (m) => {
			handle_nostr_message(me, m)
			if (me.onfn.message)
				me.onfn.message(m)
		}
		ws.onclose = (e) => {
			if (me.onfn.close)
				me.onfn.close(e)
			if (me.reconnecting)
				return reject(new Error("close during reconnect"))
			if (!me.manualClose && me.opts.reconnect)
				reconnect(me)
		}
		ws.onerror = (e) => {
			if (me.onfn.error)
				me.onfn.error(e)
			if (me.reconnecting)
				return reject(new Error("error during reconnect"))
			if (me.opts.reconnect)
				reconnect(me)
		}
		ws.onopen = (e) => {
			if (me.onfn.open)
				me.onfn.open(e)

			if (resolved) return

			resolved = true
			resolve(me)
		}
	});
}

/**
 * @param {number} ms 
 * @returns {Promise<void>}
 */
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 
 * @param {Relay} me 
 */
async function reconnect(me)
{
	let n = 100
	try {
		me.reconnecting = true
		await init_websocket(me)
		me.reconnecting = false
	} catch {
		//console.error(`error thrown during reconnect... trying again in ${n} ms`)
		await sleep(n)
		n *= 1.5
	}
}

/**
 * 
 * @param {"message"|"close"|"error"|"open"|"ok"|"event"|"eose"|"notice"} method 
 * @param {(...data: any[]) => unknown} fn 
 * @returns 
 */
Relay.prototype.on = function relayOn(method, fn) {
	this.onfn[method] = fn
	return this
}

Relay.prototype.close = function relayClose() {
	if (this.ws) {
		this.manualClose = true
		this.ws.close()
	}
}

/**
 * @param {string} sub_id 
 * @param {string | string[]} filters 
 */
Relay.prototype.subscribe = function relay_subscribe(sub_id, filters) {
	if (Array.isArray(filters))
		this.send(["REQ", sub_id, ...filters])
	else
		this.send(["REQ", sub_id, filters])
}

/**
 * @param {string} sub_id 
 */
Relay.prototype.unsubscribe = function relay_unsubscribe(sub_id) {
	this.send(["CLOSE", sub_id])
}

/**
 * 
 * @param {unknown} data 
 */
Relay.prototype.send = async function relay_send(data) {
	await this.wait_connected()
	this.ws.send(JSON.stringify(data))
}

/**
 * @param {Relay} relay 
 * @param {{data: unknown[]}} msg 
 */
function handle_nostr_message(relay, msg)
{
	let data
	try {
		data = JSON.parse(msg.data)
	} catch (e) {
		console.error("handle_nostr_message", e)
		return
	}
	if (data.length >= 2) {
		switch (data[0]) {
		case "EVENT":
			if (data.length < 3)
				return
			return relay.onfn.event && relay.onfn.event(data[1], data[2])
		case "EOSE":
			return relay.onfn.eose && relay.onfn.eose(data[1])
		case "NOTICE":
			return relay.onfn.notice && relay.onfn.notice(...data.slice(1))
		case "OK":
			return relay.onfn.ok && relay.onfn.ok(...data.slice(1))
		}
	}
}

module.exports = Relay
