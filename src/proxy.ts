import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

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

const server = createServer((req, res) => {
	console.log(`${req.method} ${req.url}`);

	if (!req.url) return;

	// parse URL
	const parsedUrl = URL.parse(`http://${hostname}:${port}${req.url}`);
	if (!parsedUrl) {
		res.writeHead(400, { "Content-Type": "text/plain" });
		res.end("Bad Request");
		return;
	}

	// extract URL path
	const sanitizePath = path
		.normalize(parsedUrl.pathname)
		.replace(/^(\.\.[/\\])+/, "");
	const pathname = path.join(root, sanitizePath);

	if (!existsSync(pathname)) {
		res.writeHead(404, { "Content-Type": "text/plain" });
		res.end("Not Found");
		return;
	}

	// determine content type
	const ext = path.parse(pathname).ext;
	const contentType = mimeTypes[ext] || "application/octet-stream";
	res.writeHead(200, {
		"Content-Type": contentType,
		"Content-Disposition": `attachment; filename="${path.basename(pathname)}"`,
	});

	// stream the file
	const fileStream = createReadStream(pathname);
	fileStream.pipe(res);

	fileStream.on("error", (err) => {
		console.error("Error reading file:", err);
		res.end("Error streaming file");
	});
});

server.listen(port, hostname);
