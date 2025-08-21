import { type IncomingMessage } from "node:http";
import { type RequestOptions } from "node:https";
export declare function requestPromise(options: RequestOptions | string | URL, secure?: boolean): Promise<{
    response: IncomingMessage;
    body: Promise<string>;
}>;
export declare function formatBytes(bytes: number, decimals?: number): string;
//# sourceMappingURL=util.d.ts.map