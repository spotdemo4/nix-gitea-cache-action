import {
	createReadStream,
	createWriteStream,
	existsSync,
	mkdirSync,
} from "node:fs";
import { createServer } from "node:http";
import { request } from "node:https";
import path from "node:path";
import * as exec from "@actions/exec";

const root = "/tmp/nix-cache";
const hostname = "127.0.0.1";
const port = 5001;
const mimeTypes: Record<string, string> = {
	".nar": "application/x-nix-nar",
	".nar.xz": "application/x-nix-nar+x-xz",
	".narinfo": "application/x-nix-narinfo",
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".png": "image/png",
	".jpg": "image/jpg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".wav": "audio/wav",
	".mp4": "video/mp4",
	".woff": "application/font-woff",
	".ttf": "application/font-ttf",
	".eot": "application/vnd.ms-fontobject",
	".otf": "application/font-otf",
	".wasm": "application/wasm",
};
const substituters = (
	await exec.getExecOutput("nix", ["config", "show", "substituters"], {
		silent: true,
	})
).stdout
	.split(" ")
	.map((s) => s.trim());

const server = createServer(async (req, res) => {
	if (!req.url) return;

	switch (req.method) {
		case "GET":
		case "HEAD": {
			// check if any substituter has the requested path
			for (const substituter of substituters) {
				// check if substituter contains path
				const suburl = new URL(req.url, substituter);
				const subreq = await fetch(suburl, {
					method: "HEAD",
				});
				if (!subreq.ok) continue;

				// if HEAD request, return status
				if (req.method === "HEAD") {
					res.writeHead(subreq.status);
					res.end();
					return;
				}

				console.log("<-", suburl.href);

				// if substituter contains path, pipe request to it
				delete req.headers.host;
				delete req.headers.referer;
				const proxy = request(
					{
						hostname: suburl.hostname,
						port: 443,
						path: req.url,
						method: req.method,
						headers: req.headers,
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
					console.error("Proxy error:", err);
					res.writeHead(502, { "Content-Type": "text/plain" });
					res.end("Bad Gateway");
				});
				// request -> substituter
				req.pipe(proxy, {
					end: true,
				});

				return;
			}

			// check if requested path exists locally
			const localPath = path.join(root, req.url);
			if (!existsSync(localPath)) {
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end("Not Found");
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
				console.error("Error reading file:", err);
				res.end("Error streaming file");
			});
			fileStream.pipe(res);

			break;
		}

		case "PUT": {
			// handle file upload
			const localPath = path.join(root, req.url);

			// ensure directory exists
			const dir = path.dirname(localPath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}

			// create write stream
			console.log("->", localPath);
			const fileStream = createWriteStream(localPath, {
				flags: "w+",
				encoding: "binary",
			});

			// pipe request to file
			req.pipe(fileStream);
			fileStream.on("finish", () => {
				res.writeHead(201, { "Content-Type": "text/plain" });
				res.end("Created");
			});
		}
	}
});

console.log(`Starting server at http://${hostname}:${port}`);
server.listen(port, hostname);
