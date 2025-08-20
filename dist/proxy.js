import { exec } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, createWriteStream, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { request } from 'node:https';
import path from 'node:path';
import { promisify } from 'node:util';

const execPromise = promisify(exec);
async function requestPromise(options) {
    return new Promise((resolve, reject) => {
        let body = "";
        const req = request(options, (res) => {
            res.on("data", (chunk) => {
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
const root = "/tmp/nix-cache";
const hostname = "127.0.0.1";
const port = 5001;
const mimeTypes = {
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
const substituters = (await execPromise("nix config show substituters")).stdout
    .split(" ")
    .map((s) => s.trim());
console.log("substituters:", substituters);
// ensure the root directory exists
if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
}
// ensure nix-cache-info exists
if (!existsSync(path.join(root, "nix-cache-info"))) {
    const info = await requestPromise("https://cache.nixos.org/nix-cache-info");
    if (info.statusCode > 299) {
        throw new Error("Failed to fetch nix-cache-info");
    }
    writeFileSync(path.join(root, "nix-cache-info"), info.body);
}
const server = createServer(async (req, res) => {
    try {
        if (!req.url)
            return;
        const localPath = path.join(root, req.url);
        switch (req.method) {
            case "GET":
            case "HEAD": {
                // delete host & referer headers
                delete req.headers.host;
                delete req.headers.referer;
                // check if any substituter has the requested path
                for (const substituter of substituters) {
                    // check if substituter contains path
                    const substituterURL = new URL(req.url, substituter);
                    const head = await requestPromise({
                        hostname: substituterURL.hostname,
                        port: 443,
                        path: req.url,
                        method: "HEAD",
                        headers: req.headers,
                    });
                    if (head.statusCode > 299)
                        continue;
                    // if HEAD request, return status
                    if (req.method === "HEAD") {
                        res.writeHead(head.statusCode);
                        res.end();
                        return;
                    }
                    console.log("<-", substituterURL.href);
                    // if substituter contains path, pipe request to it
                    const proxy = request({
                        hostname: substituterURL.hostname,
                        port: 443,
                        path: req.url,
                        method: req.method,
                        headers: req.headers,
                    }, (proxyRes) => {
                        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
                        // substituter -> response
                        proxyRes.pipe(res, {
                            end: true,
                        });
                    });
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
    }
    catch (err) {
        console.error("Error handling request:", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
    }
});
console.log(`starting server at http://${hostname}:${port}`);
server.listen(port, hostname);
//# sourceMappingURL=proxy.js.map
