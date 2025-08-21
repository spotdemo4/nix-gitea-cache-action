import { type RequestOptions, request } from "node:https";

export async function requestPromise(
	options: RequestOptions | string | URL,
): Promise<{
	statusCode: number;
	body: string;
}> {
	return new Promise((resolve, reject) => {
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
