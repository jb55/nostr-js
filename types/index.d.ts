/**
 * See https://github.com/nostr-protocol/nips/blob/master/01.md for definition of NostREvent
 */
export type NostREvent = {
    /**
     * - 32-bytes lowercase hex-encoded sha256 of the serialized event data
     */
    id: string;
    /**
     * - 32-bytes lowercase hex-encoded public key of the event creator
     */
    pubkey: string;
    /**
     * - unix timestamp in seconds
     */
    created_at: number;
    /**
     * - event kind, see https://github.com/nostr-protocol/nips/blob/master/01.md#basic-event-kinds
     */
    kind: number;
    tags: Array<string[]>;
    content: string;
    /**
     * - 64-bytes lowercase hex-encoded schnorr signature of the event id
     */
    sig: string;
};
export type NostRDelegation = {
    /**
     * - 32-bytes lowercase hex-encoded public key of the event creator
     */
    pubkey: string;
    /**
     * - 32-bytes lowercase hex-encoded public key of the event creator
     */
    publisherPubkey: string;
    /**
     * - &` separated set of event creation permissions that the delegate is required to adhere to when creating events. eg: `created_at>1669303873&created_at<1674574279&kind=1,7`
     */
    conditions: string;
    /**
     * - 64-bytes lowercase hex-encoded schnorr signature of the delegation commitment
     */
    token: string;
};
import Relay = require("./lib/relay");
import RelayPool = require("./lib/relay-pool");
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
export function signId(privkey: string, id: string): Promise<string>;
/**
 * Verify an event
 *
 * @param {NostREvent} event
 * @returns true if valid signature, false otherwise
 */
export function verifyEvent(event: NostREvent): Promise<boolean>;
/**
 *
 * Calculate an id from an event
 *
 * @param {Omit<NostREvent, "id" | "sig">} ev
 */
export function calculateId(ev: Omit<NostREvent, "id" | "sig">): Promise<string>;
/**
 * Get a public key from a privkey
 *
 * @param {string} privkey
 */
export function getPublicKey(privkey: string): string;
/**
 * Decrypt a direct message
 *
 * @param {string} privkey
 * @param {NostREvent} ev
 * @returns decrypted message content
 */
export function decryptDm(privkey: string, ev: NostREvent): any;
/**
 * Encrypt a direct message
 *
 * @param {string} privkey
 * @param {string} to
 * @param {string} msg
 *
 * @returns encrypted message content
 */
export function encryptDm(privkey: string, to: string, msg: string): string;
/**
 * @param {string} pk
 * @param {string} conditions
 */
export function delegationCommitment(pk: string, conditions: string): string;
/**
 * @param {NostRDelegation} delegation
 * @returns {["delegation", string, string, string]}
 */
export function createDelegationTag(delegation: NostRDelegation): ["delegation", string, string, string];
/**
 * Create a delegated event from {@link delegation}. This is an event posted on behalf
of `delegation.pubkey` subject to `delegation.conditions`.
 *
 * @param {string} publisher_privkey the private key of the delegate, the entity posting on behalf of `delegation.pubkey`
 * @param {NostREvent} ev The event to post as a delegate. The event's `pubkey` will be overridden by the `publisherPubkey`. The delegation tag will be upserted into the tag list.
 * @param {{pubkey: string, conditions: string, token: string}} delegation a delegation in the form returned by {@link createDelegation}
 * @returns
 */
export function createDelegationEvent(publisher_privkey: string, ev: NostREvent, delegation: {
    pubkey: string;
    conditions: string;
    token: string;
}): Promise<NostREvent>;
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
export function createDelegation(privkey: string, publisherPubkey: string, conditions: NostRDelegation["conditions"]): Promise<NostRDelegation>;
/**
 * Sign a delegation string in the form `nostr:delegation:...`.
 *
 * @param {string} privkey
 * @param {string} unsigned_token
 * @returns a signature string called the delegation token
 */
export function signDelegationToken(privkey: string, unsigned_token: string): Promise<string>;
/**
 * @param {Omit<NostREvent, "id" | "sig">} ev
 */
export function eventCommitment(ev: Omit<NostREvent, "id" | "sig">): string;
export { Relay, RelayPool };
