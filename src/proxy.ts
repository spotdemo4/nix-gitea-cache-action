import { exec } from "node:child_process";
import {
	createReadStream,
	createWriteStream,
	existsSync,
	mkdirSync,
} from "node:fs";
import { createServer } from "node:http";
import { request } from "node:https";
import path from "node:path";
import { promisify } from "node:util";
import { requestPromise } from "./util.js";

const execPromise = promisify(exec);

const root = "/tmp/nix-cache";
const hostname = "127.0.0.1";
const port = 5001;
const mimeTypes: Record<string, string> = {
	".nar": "application/x-nix-nar",
	".nar.xz": "application/x-xz",
	".nar.zst": "application/zstd",
	".narinfo": "application/x-nix-narinfo",
};
let substituters: string[] = [];

const server = createServer(async (req, res) => {
	try {
		if (!req.url) return;
		const localPath = path.join(root, req.url);

		switch (req.method) {
			case "GET":
			case "HEAD": {
				// delete host & referer headers
				delete req.headers.host;
				delete req.headers.referer;

				// check if any substituter has the requested path
				for (const substituter of substituters) {
					const substituterURL = new URL(req.url, substituter);
					const head = await requestPromise(
						{
							hostname: substituterURL.hostname,
							port: 443,
							path: req.url,
							method: "HEAD",
							headers: req.headers,
							timeout: 5000,
						},
						true,
					);
					if (head.statusCode > 299) continue;

					// if HEAD request, just return status
					if (req.method === "HEAD") {
						res.writeHead(head.statusCode);
						res.end();
						return;
					}

					console.log("<-", substituterURL.href);

					// if substituter contains path, pipe request to it
					const proxy = request(
						{
							hostname: substituterURL.hostname,
							port: 443,
							path: req.url,
							method: req.method,
							headers: req.headers,
							timeout: 5000,
						},
						(proxyRes) => {
							res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
							// substituter -> response
							proxyRes.pipe(res, {
								end: true,
							});
						},
					);
					proxy.on("error", (err) => {
						console.error("proxy error:", err);
						res.writeHead(502, { "Content-Type": "text/plain" });
						res.end("bad gateway");
					});
					// request -> substituter
					req.pipe(proxy, {
						end: true,
					});

					return;
				}

				// else check if requested path exists locally
				if (!existsSync(localPath)) {
					res.writeHead(404, { "Content-Type": "text/plain" });
					res.end("not found");
					return;
				}

				console.log("<-", localPath);

				// determine content type
				const ext = path.parse(localPath).ext;
				const contentType = mimeTypes[ext] || "application/octet-stream";
				res.writeHead(200, {
					"Content-Type": contentType,
					"Content-Disposition": `attachment; filename="${path.basename(localPath)}"`,
				});

				// pipe the file to response
				const fileStream = createReadStream(localPath);
				fileStream.on("error", (err) => {
					console.error("error streaming file:", err);
					res.end("error streaming file");
				});
				fileStream.pipe(res);

				break;
			}

			case "PUT": {
				// ensure directory exists
				const dir = path.dirname(localPath);
				if (!existsSync(dir)) {
					mkdirSync(dir, { recursive: true });
				}

				console.log("->", localPath);

				// create write stream
				const fileStream = createWriteStream(localPath, {
					flags: "w+",
					encoding: "binary",
				});

				// pipe request to file
				fileStream.on("finish", () => {
					res.writeHead(201, { "Content-Type": "text/plain" });
					res.end("created");
				});
				req.pipe(fileStream);

				break;
			}

			case "POST": {
				if (req.url !== "/substituters") {
					res.writeHead(404, { "Content-Type": "text/plain" });
					res.end("not found");
					return;
				}

				// update substitutors
				substituters = (
					await execPromise("nix config show substituters")
				).stdout
					.split(" ")
					.map((s) => s.trim());
				console.log("substituters:", substituters.join(", "));
				res.writeHead(200, { "Content-Type": "text/plain" });
				res.end(JSON.stringify(substituters));

				break;
			}
		}
	} catch (err) {
		console.error("error handling request:", err);
		res.writeHead(500, { "Content-Type": "text/plain" });
		res.end("internal server error");
	}
});

console.log(`starting server at http://${hostname}:${port}`);
server.listen(port, hostname);
