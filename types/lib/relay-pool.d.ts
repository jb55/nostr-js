export = RelayPool;
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
declare function RelayPool(relays: string[], opts: {
    reconnect?: boolean;
} | undefined): RelayPool;
declare class RelayPool {
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
    constructor(relays: string[], opts: {
        reconnect?: boolean;
    } | undefined);
    onfn: {};
    /**
     * @type {Relay[]}
     */
    relays: Relay[];
    opts: {
        reconnect?: boolean;
    };
    close(): void;
    /**
     * @param {"message"|"close"|"error"|"open"|"ok"|"event"|"eose"|"notice"} method
     * @param {(relay: Relay, ...data: any[]) => unknown} fn
     * @returns
     */
    on(method: "message" | "close" | "error" | "open" | "ok" | "event" | "eose" | "notice", fn: (relay: Relay, ...data: any[]) => unknown): RelayPool;
    /**
     * @param {string} relayUrl
     */
    has(relayUrl: string): boolean;
    /**
     *
     * @param {unknown} payload
     * @param {string[] | undefined} relay_ids
     */
    send(payload: unknown, relay_ids: string[] | undefined): void;
    setupHandlers(): void;
    /**
     * @param {string} url
     */
    remove(url: string): boolean;
    /**
     * @param {string} sub_id
     * @param {string | string[]} filters
     * @param {string[]} relay_ids
     */
    subscribe(sub_id: string, filters: string | string[], relay_ids: string[]): void;
    /**
     *
     * @param {string} sub_id
     * @param {string[] | undefined} relay_ids unscubscribe from all relays if undefined
     */
    unsubscribe(sub_id: string, relay_ids: string[] | undefined): void;
    /**
     * @param {Relay | string} relay
     * @returns {boolean} true if relay was added, false if it already exists
     */
    add(relay: Relay | string): boolean;
    /**
     *
     * @param {string[]} relay_ids
     * @returns {Relay[]}
     */
    find_relays(relay_ids: string[]): Relay[];
}
import Relay = require("./relay");
