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
		req.on("timeout", () => {
			req.destroy(); // destroy the request if a timeout occurs
			reject(new Error("request timed out"));
		});
		req.on("error", (err) => {
			reject(err);
		});
		req.end();
	});
}

export function formatBytes(bytes: number, decimals = 2) {
	if (!+bytes) return "0 Bytes";

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = [
		"Bytes",
		"KiB",
		"MiB",
		"GiB",
		"TiB",
		"PiB",
		"EiB",
		"ZiB",
		"YiB",
	];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}
