import { request as http } from "node:http";
import { request as https, type RequestOptions } from "node:https";

export async function requestPromise(
	options: RequestOptions | string | URL,
	secure?: boolean,
): Promise<{
	statusCode: number;
	body: string;
}> {
	return new Promise((resolve, reject) => {
		const request = secure ? https : http;
		let body = "";
		const req = request(options, (res) => {
			res.on("data", (chunk: string) => {
				body += chunk;
			});
			res.on("end", () => {
				resolve({
					statusCode: res.statusCode ?? 500,
					body: body,
				});
			});
		});
		req.on("error", reject);
		req.end();
	});
}
