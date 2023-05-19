export = Relay;
/**
 * @classdesc Connect to a relay server and subscribe to events.
 * @param {string} relay
 * @param {{reconnect?: boolean} | undefined} opts
 * @class Relay
 */
declare function Relay(relay: string, opts?: {
    reconnect?: boolean;
} | undefined): Relay;
declare class Relay {
    /**
     * @classdesc Connect to a relay server and subscribe to events.
     * @param {string} relay
     * @param {{reconnect?: boolean} | undefined} opts
     * @class Relay
     */
    constructor(relay: string, opts?: {
        reconnect?: boolean;
    } | undefined);
    url: string;
    opts: {
        reconnect?: boolean;
    };
    onfn: {};
    wait_connected(): Promise<void>;
    /**
     *
     * @param {"message"|"close"|"error"|"open"|"ok"|"event"|"eose"|"notice"} method
     * @param {(...data: any[]) => unknown} fn
     * @returns
     */
    on(method: "message" | "close" | "error" | "open" | "ok" | "event" | "eose" | "notice", fn: (...data: any[]) => unknown): Relay;
    close(): void;
    manualClose: boolean;
    /**
     * @param {string} sub_id
     * @param {string | string[]} filters
     */
    subscribe(sub_id: string, filters: string | string[]): void;
    /**
     * @param {string} sub_id
     */
    unsubscribe(sub_id: string): void;
    /**
     *
     * @param {unknown} data
     */
    send(data: unknown): Promise<void>;
}
/**
 *
 * @param {Relay} me
 */
declare function reconnect(me: Relay): Promise<void>;
