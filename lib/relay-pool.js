
const Relay = require('./relay')

/**
 * @class RelayPool
 * @classdesc Connect to a pool of relays. You should use this instead of `Relay` directly.
 * @param {string[]} relays 
 * @param {{reconnect?: boolean} | undefined} opts 
 * 
 * @example ```
const relays = [`wss://relay1.com`, `wss://relay2.com`]
const pool = RelayPool(relays, {reconnect: false})
```
 */
function RelayPool(relays, opts)
{
	if (!(this instanceof RelayPool))
		return new RelayPool(relays, opts)

	this.onfn = {}
	/**
	 * @type {Relay[]}
	 */
	this.relays = []
	this.opts = opts

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

/**
 * @param {"message"|"close"|"error"|"open"|"ok"|"event"|"eose"|"notice"} method 
 * @param {(relay: Relay, ...data: any[]) => unknown} fn 
 * @returns 
 */
RelayPool.prototype.on = function relayPoolOn(method, fn) {
	for (const relay of this.relays) {
		this.onfn[method] = fn
		relay.onfn[method] = fn.bind(null, relay)
	}
	return this
}

/**
 * @param {string} relayUrl 
 */
RelayPool.prototype.has = function relayPoolHas(relayUrl) {
	for (const relay of this.relays) {
		if (relay.url === relayUrl)
			return true
	}

	return false
}

/**
 * 
 * @param {unknown} payload 
 * @param {string[] | undefined} relay_ids 
 */
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

/**
 * @param {string} url 
 */
RelayPool.prototype.remove = function relayPoolRemove(url) {
	let i = 0

	for (const relay of this.relays) {
		if (relay.url === url) {
			relay.ws && relay.ws.close()
			this.relays = this.relays.splice(i, 1)
			return true
		}

		i += 1
	}

	return false
}

/**
 * @param {string} sub_id 
 * @param {string | string[]} filters 
 * @param {string[]} relay_ids 
 */
RelayPool.prototype.subscribe = function relayPoolSubscribe(sub_id, filters, relay_ids) {
	const relays = relay_ids ? this.find_relays(relay_ids) : this.relays
	for (const relay of relays) {
		relay.subscribe(sub_id, filters)
	}
}

/**
 * 
 * @param {string} sub_id 
 * @param {string[] | undefined} relay_ids unscubscribe from all relays if undefined 
 */
RelayPool.prototype.unsubscribe = function relayPoolUnsubscibe(sub_id, relay_ids) {
	const relays = relay_ids ? this.find_relays(relay_ids) : this.relays
	for (const relay of relays) {
		relay.unsubscribe(sub_id)
	}
}

/**
 * @param {Relay | string} relay 
 * @returns {boolean} true if relay was added, false if it already exists
 */
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

/**
 * 
 * @param {string[]} relay_ids 
 * @returns {Relay[]}
 */
RelayPool.prototype.find_relays = function relayPoolFindRelays(relay_ids) {
	if (relay_ids instanceof Relay)
		return [relay_ids]

	if (relay_ids.length === 0)
		return []

	if (!relay_ids[0])
		throw new TypeError("Empty array passed to find_relays")

	return [].concat(
		relay_ids.filter(relay => relay instanceof Relay), 
		this.relays.reduce((acc, relay) => {
			if (relay_ids.some((rid) => relay.url === rid))
				acc.push(relay)
			return acc
		}, [])
	)
}

module.exports = RelayPool
