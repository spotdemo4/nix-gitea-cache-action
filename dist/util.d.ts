import { type RequestOptions } from "node:https";
export declare function requestPromise(options: RequestOptions | string | URL, secure?: boolean): Promise<{
    statusCode: number;
    body: string;
}>;
//# sourceMappingURL=util.d.ts.map