import { spawn } from "node:child_process";
import path from "node:path";
import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

async function main() {
	// make sure caching is available
	if (!cache.isFeatureAvailable()) {
		core.warning("Cache action is not available");
		return;
	}

	// print nix version
	const versionOutput = await exec.getExecOutput("nix", ["--version"]);
	core.info(`Nix version: ${versionOutput.stdout.trim()}`);

	// restore cache to tmp
	const restore = await cache.restoreCache(
		["/tmp/nix-cache", "/tmp/privkey.pem", "/tmp/pubkey.pem"],
		"nix-store",
	);
	core.setOutput("cache-hit", restore ? "true" : "false");
	if (!restore) {
		core.info("Cache not found. Generating keypair.");

		// generate keypair
		await exec.exec("nix-store", [
			"--generate-binary-cache-key",
			"simple.cache.action-1",
			"/tmp/privkey.pem",
			"/tmp/pubkey.pem",
		]);

		return;
	}

	// Create nix daemon
	const daemon = spawn("node", [path.join(__dirname, "proxy.js")], {
		detached: true,
		stdio: "ignore",
	});
	daemon.unref();
	core.info("proxy server starting...");

	// Wait for the proxy server to start
	let ping = 1;
	while (ping !== 0) {
		ping = await exec.exec(
			"nix",
			["store", "info", "--store", "http://127.0.0.1:5001"],
			{ ignoreReturnCode: true, silent: true },
		);
		if (ping !== 0) {
			core.info("Waiting for daemon to start...");
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}

	// get public key
	const pubkey = (
		await exec.getExecOutput("cat", ["/tmp/pubkey.pem"])
	).stdout.trim();

	// get substituters and trusted keys
	const substituters = (
		await exec.getExecOutput("nix", ["config", "show", "substituters"], {
			ignoreReturnCode: true,
		})
	).stdout
		.trim()
		.split(" ");
	const trustedKeys = (
		await exec.getExecOutput("nix", ["config", "show", "trusted-public-keys"], {
			ignoreReturnCode: true,
		})
	).stdout
		.trim()
		.split(" ");

	// add cache as a substituter
	core.exportVariable(
		"NIX_CONFIG",
		`
			substituters = http://127.0.0.1:5001 ${substituters.join(" ")}
			trusted-public-keys = ${pubkey} ${trustedKeys.join(" ")}
		`,
	);
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
