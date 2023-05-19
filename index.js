
const Relay = require('./lib/relay')
const RelayPool = require('./lib/relay-pool')
const noble = require('noble-secp256k1')
const crypto = require('crypto')

/**
 * See https://github.com/nostr-protocol/nips/blob/master/01.md for definition of NostREvent
 * @typedef {Object} NostREvent
 * @property {string} id - 32-bytes lowercase hex-encoded sha256 of the serialized event data
 * @property {string} pubkey - 32-bytes lowercase hex-encoded public key of the event creator
 * @property {number} created_at - unix timestamp in seconds
 * @property {number} kind - event kind, see https://github.com/nostr-protocol/nips/blob/master/01.md#basic-event-kinds
 * @property {Array<string[]>} tags
 * @property {string} content
 * @property {string} sig - 64-bytes lowercase hex-encoded schnorr signature of the event id
 */

/**
 * @typedef {Object} NostRDelegation
 * @property {string} pubkey - 32-bytes lowercase hex-encoded public key of the event creator
 * @property {string} publisherPubkey - 32-bytes lowercase hex-encoded public key of the event creator
 * @property {string} conditions - &` separated set of event creation permissions that the delegate is required to adhere to when creating events. eg: `created_at>1669303873&created_at<1674574279&kind=1,7`
 * @property {string} token - 64-bytes lowercase hex-encoded schnorr signature of the delegation commitment
 */

/**
 * Create a signature for an id
 * 
 * @param {string} privkey 
 * @param {string} id 
 */
async function signId(privkey, id) {
	return await noble.schnorr.sign(id, privkey)
}

/**
 * Verify an event
 * 
 * @param {NostREvent} event 
 * @returns true if valid signature, false otherwise
 */
async function verifyEvent(event) {
	return await noble.schnorr.verify(event.sig, event.id, event.pubkey)
}

/**
 * @param {string} txt 
 */
function utf8_encode(txt) {
	if (typeof TextEncoder !== 'undefined' && TextEncoder) {
		const encoder = new TextEncoder()
		return encoder.encode(txt)
	} else {
		const util = require('util');
		const encoder = new util.TextEncoder('utf-8');
		return encoder.encode(txt)
	}
}

/**
 * 
 * Calculate an id from an event
 * 
 * @param {Omit<NostREvent, "id" | "sig">} ev 
 */
async function calculateId(ev) {
	const commit = eventCommitment(ev)
	const sha256 = noble.utils.sha256;
	const buf = utf8_encode(commit);
	return hexEncode(await sha256(buf))
}

/**
 * @param {Omit<NostREvent, "id" | "sig">} ev 
 */
function eventCommitment(ev) {
	const {pubkey,created_at,kind,tags,content} = ev
	return JSON.stringify([0, pubkey, created_at, kind, tags, content])
}

/**
 * @param {string} pk
 * @param {string} conditions 
 */
function delegationCommitment(pk, conditions) {
	return `nostr:delegation:${pk}:${conditions}`
}

/**
 * Sign a delegation string in the form `nostr:delegation:...`.
 * 
 * @param {string} privkey 
 * @param {string} unsigned_token 
 * @returns a signature string called the delegation token
 */
async function signDelegationToken(privkey, unsigned_token) 
{
	const hash = hexEncode(await noble.utils.sha256(unsigned_token))
	return (await signId(privkey, hash))
}

/**
 * Create a delegation. This gives `publisherPubkey` permission to create events
on the `privkey`s behalf subject to `conditions`
 *
 * @param {string} privkey 
 * @param {string} publisherPubkey 
 * @param {NostRDelegation["conditions"]} conditions &` separated set of event creation permissions that the delegate
is required to adhere to when creating events. eg: `created_at>1669303873&created_at<1674574279&kind=1,7` 
 * @returns {Promise<NostRDelegation>}
 */
async function createDelegation(privkey, publisherPubkey, conditions) {
	const pubkey = getPublicKey(privkey)
	const unsigned_token = delegationCommitment(publisherPubkey, conditions)
	const token = await signDelegationToken(privkey, unsigned_token)
	return {pubkey, publisherPubkey, conditions, token}
}

/**
 * @param {NostRDelegation} delegation 
 * @returns {["delegation", string, string, string]}
 */
function createDelegationTag(delegation) {
	const { pubkey, conditions, token } = delegation
	return ["delegation", pubkey, conditions, token]
}

/**
 * @param {Array<string[]>} tags 
 * @param {NostRDelegation} delegation 
 */
function upsert_delegation_tag(tags, delegation)
{
	for (const tag of tags) {
		if (tag.length >= 4 && tag[0] === "delegation") {
			tag[1] = delegation.pubkey
			tag[2] = delegation.conditions
			tag[3] = delegation.token
			return
		}
	}
	tags.push(createDelegationTag(delegation))
}

/**
 * Create a delegated event from {@link delegation}. This is an event posted on behalf
of `delegation.pubkey` subject to `delegation.conditions`.
 *
 * @param {string} publisher_privkey the private key of the delegate, the entity posting on behalf of `delegation.pubkey`
 * @param {NostREvent} ev The event to post as a delegate. The event's `pubkey` will be overridden by the `publisherPubkey`. The delegation tag will be upserted into the tag list.
 * @param {{pubkey: string, conditions: string, token: string}} delegation a delegation in the form returned by {@link createDelegation}
 * @returns 
 */
async function createDelegationEvent(publisher_privkey, ev, delegation) {
	let tags = ev.tags || []

	upsert_delegation_tag(tags, delegation)

	ev.tags = tags
	ev.pubkey = delegation.publisherPubkey
	ev.id = await calculateId(ev)
	ev.sig = await signId(publisher_privkey, ev.id)
	return ev
}

/**
 * Convert 0-15 to 0-F
 * @param {number} val 
 */
function hexChar(val) {
	if (val < 10)
		return String.fromCharCode(48 + val)
	if (val < 16)
		return String.fromCharCode(97 + val - 10)
}

/**
 * @param {Uint8Array} buf 
 */
function hexEncode(buf) {
	let str = ""
	for (let i = 0; i < buf.length; i++) {
		const c = buf[i]
		str += hexChar(c >> 4)
		str += hexChar(c & 0xF)
	}
	return str
}

/**
 * @param {string} str 
 */
function base64_decode(str)
{
	if (typeof Buffer !== 'undefined' && Buffer) {
		return Buffer.from(str, 'base64')
	} else if (typeof atob !== 'undefined' && atob) {
		return atob(str)
	}
	throw new Error("no base64 implementation")
}

/**
 * Encrypt a direct message
 *
 * @param {string} privkey 
 * @param {string} to 
 * @param {string} msg 
 * 
 * @returns encrypted message content
 */
function encryptDm(privkey, to, msg) {
	const shared_point = noble.getSharedSecret(privkey, '02' + to)
	const shared_x = shared_point.substr(2, 64)
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv(
                'aes-256-cbc',
                Buffer.from(shared_x, 'hex'),
		iv
	)

	let encrypted = cipher.update(msg, 'utf8', 'base64');
        encrypted += cipher.final('base64');

	return encrypted + "?iv=" + iv.toString('base64')
}

/**
 * Decrypt a direct message
 * 
 * @param {string} privkey 
 * @param {NostREvent} ev 
 * @returns decrypted message content
 */
function decryptDm(privkey, ev) {
	let [enc, iv] = ev.content.split("?")
	if (!iv || !enc)
		return
	iv = iv.slice(3)
	iv = base64_decode(iv)

	const shared_point = noble.getSharedSecret(privkey, '02' + ev.pubkey)
	const shared_x = shared_point.substr(2, 64)
	const decipher = crypto.createDecipheriv(
                'aes-256-cbc',
                Buffer.from(shared_x, 'hex'),
                iv
	)

	let decrypted = decipher.update(enc, "base64", "utf8")
	decrypted += decipher.final("utf8")

	return decrypted
}

/**
 * Get a public key from a privkey
 *
 * @param {string} privkey 
 */
function getPublicKey(privkey) {
	return noble.schnorr.getPublicKey(privkey)
}

module.exports = {
	Relay,
	RelayPool,
	signId,
	verifyEvent,
	calculateId,
	getPublicKey,
	decryptDm,
	encryptDm,
	delegationCommitment,
	createDelegationTag,
	createDelegationEvent,
	createDelegation,
	signDelegationToken,
	eventCommitment
}

