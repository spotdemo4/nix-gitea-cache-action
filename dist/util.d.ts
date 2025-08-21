import { type RequestOptions } from "node:https";
export declare function requestPromise(options: RequestOptions | string | URL, secure?: boolean): Promise<{
    statusCode: number;
    body: string;
}>;
export declare function formatBytes(bytes: number, decimals?: number): string;
//# sourceMappingURL=util.d.ts.map