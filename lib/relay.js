const WS = typeof WebSocket !== 'undefined' ? WebSocket : require('ws')

Relay.prototype.wait_connected = async function relay_wait_connected(data) {
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

	return this
}

function init_websocket(me) {
	const ws = me.ws = new WS(me.url);
	return new Promise((resolve, reject) => {
		let resolved = false
		ws.onmessage = (m) => { handle_nostr_message(me, m) }
		ws.onclose = () => {
			if (me.onfn.close)
				me.onfn.close()
			if (me.reconnecting)
				return reject(new Error("close during reconnect"))
			if (!me.manualClose && me.opts.reconnect)
				reconnect(me)
		}
		ws.onerror = () => {
			if (me.onfn.error)
				me.onfn.error()
			if (me.reconnecting)
				return reject(new Error("error during reconnect"))
			if (me.opts.reconnect)
				reconnect(me)
		}
		ws.onopen = () => {
			if (me.onfn.open)
				me.onfn.open()

			if (resolved) return

			resolved = true
			resolve(me)
		}
	});
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function reconnect(me)
{
	const reconnecting = true
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

Relay.prototype.on = function relay_on(method, fn) {
	this.onfn[method] = fn
}

Relay.prototype.close = function relay_on() {
	if (this.ws) {
		this.manualClose = true
		this.ws.close()
	}
}

Relay.prototype.subscribe = function relay_subscribe(sub_id, filters) {
	if (Array.isArray(filters))
		this.send(["REQ", sub_id, ...filters])
	else
		this.send(["REQ", sub_id, filters])
}

Relay.prototype.unsubscribe = function relay_unsubscribe(sub_id) {
	this.send(["CLOSE", sub_id])
}

Relay.prototype.send = async function relay_send(data) {
	await this.wait_connected()
	this.ws.send(JSON.stringify(data))
}

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
		}
	}
}

module.exports = Relay
