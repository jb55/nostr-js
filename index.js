const RelayPool = (function nostrlib() {
const WS = typeof WebSocket !== 'undefined' ? WebSocket : require('ws')

function RelayPool(relays, opts)
{
	if (!(this instanceof RelayPool))
		return new RelayPool(relays)

	this.onfn = {}
	this.relays = []

	for (const relay of relays) {
		this.add(relay)
	}

	return this
}

RelayPool.prototype.close = function relayPoolClose() {
	for (const relay of this.relays) {
		relay.close()
	}
}

RelayPool.prototype.on = function relayPoolOn(method, fn) {
	for (const relay of this.relays) {
		this.onfn[method] = fn
		relay.onfn[method] = fn.bind(null, relay)
	}
}

RelayPool.prototype.has = function relayPoolHas(relayUrl) {
	for (const relay of this.relays) {
		if (relay.url === relayUrl)
			return true
	}

	return false
}

RelayPool.prototype.setupHandlers = function relayPoolSetupHandlers()
{
	// setup its message handlers with the ones we have already
	const keys = Object.keys(this.onfn)
	for (const handler of keys) {
		for (const relay of this.relays) {
			relay.onfn[handler] = this.onfn[handler].bind(null, relay)
		}
	}
}

RelayPool.prototype.remove = function relayPoolRemove(url) {
	let i = 0

	for (const relay of this.relays) {
		if (relay.url === url) {
			relay.ws && relay.ws.close()
			this.relays = this.replays.splice(i, 1)
			return true
		}

		i += 1
	}

	return false
}

RelayPool.prototype.subscribe = function relayPoolSubscribe(...args) {
	for (const relay of this.relays) {
		relay.subscribe(...args)
	}
}

RelayPool.prototype.unsubscribe = function relayPoolUnsubscibe(...args) {
	for (const relay of this.relays) {
		relay.unsubscribe(...args)
	}
}

RelayPool.prototype.add = function relayPoolAdd(relay) {
	if (relay instanceof Relay) {
		if (this.has(relay.url))
			return false

		this.relays.push(relay)
		this.setupHandlers()
		return true
	}

	if (this.has(relay))
		return false

	const r = Relay(relay, this.opts)
	this.relays.push(r)
	this.setupHandlers()
	return true
}

RelayPool.prototype.find_relays = function relayPoolFindRelays(relay_ids) {
	if (relay_ids instanceof Relay)
		return [relay_ids]

	if (relay_ids.length === 0)
		return []

	if (!relay_ids[0])
		throw new Error("what!?")

	if (relay_ids[0] instanceof Relay)
		return relay_ids

	return this.relays.reduce((acc, relay) => {
		if (relay_ids.some((rid) => relay.url === rid))
			acc.push(relay)
		return acc
	}, [])
}

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
		console.error(`error thrown during reconnect... trying again in ${n} ms`)
		await sleep(n)
		n *= 1.5
	}
}

Relay.prototype.on = function relayOn(method, fn) {
	this.onfn[method] = fn
}

Relay.prototype.close = function relayClose() {
	if (this.ws) {
		this.manualClose = true
		this.ws.close()
	}
}

Relay.prototype.subscribe = function relay_subscribe(sub_id, ...filters) {
	const tosend = ["REQ", sub_id, ...filters]
	this.ws.send(JSON.stringify(tosend))
}

Relay.prototype.unsubscribe = function relay_unsubscribe(sub_id) {
	const tosend = ["CLOSE", sub_id]
	this.ws.send(JSON.stringify(tosend))
}

function handle_nostr_message(relay, msg)
{
	const data = JSON.parse(msg.data)
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

return RelayPool
})()

if (typeof module !== 'undefined' && module.exports)
	module.exports = RelayPool
