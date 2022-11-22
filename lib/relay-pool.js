
const Relay = require('./relay')

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
	return this
}

RelayPool.prototype.has = function relayPoolHas(relayUrl) {
	for (const relay of this.relays) {
		if (relay.url === relayUrl)
			return true
	}

	return false
}

RelayPool.prototype.send = function relayPoolSend(payload, relay_ids) {
	const relays = relay_ids ? this.find_relays(relay_ids) : this.relays
	for (const relay of relays) {
		relay.send(payload)
	}
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

RelayPool.prototype.subscribe = function relayPoolSubscribe(sub_id, filters, relay_ids) {
	const relays = relay_ids ? this.find_relays(relay_ids) : this.relays
	for (const relay of relays) {
		relay.subscribe(sub_id, filters)
	}
}

RelayPool.prototype.unsubscribe = function relayPoolUnsubscibe(sub_id, relay_ids) {
	const relays = relay_ids ? this.find_relays(relay_ids) : this.relays
	for (const relay of relays) {
		relay.unsubscribe(sub_id)
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

module.exports = RelayPool
