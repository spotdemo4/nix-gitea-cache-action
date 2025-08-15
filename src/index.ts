import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

async function main() {
	// make sure caching is available
	if (!cache.isFeatureAvailable()) {
		core.warning("cache is not available");
		return;
	}

	// print nix version
	const version = (
		await exec.getExecOutput("nix", ["--version"])
	).stdout.trim();
	core.info(`nix version: ${version}`);

	// restore cache to tmp
	const restore = await cache.restoreCache(
		["/tmp/nix-cache", "/tmp/.secret-key"],
		"nix-store",
	);
	core.setOutput("cache-hit", restore ? "true" : "false");
	if (!restore) {
		core.info("cache not found, generating keypair...");

		// generate store secret key
		const secretKey = (
			await exec.getExecOutput(
				"nix",
				["key", "generate-secret", "--key-name", "simple.cache.action-1"],
				{ silent: true },
			)
		).stdout.trim();

		// write to file
		writeFileSync("/tmp/.secret-key", secretKey);

		return;
	}

	// create HTTP binary cache proxy server
	core.info("starting binary cache proxy server");
	const proxy = spawn("node", ["./dist/proxy.js"], {
		detached: true,
		stdio: "ignore",
	});
	proxy.unref();

	// wait for the proxy server to start
	let ping = 1;
	while (ping !== 0) {
		ping = await exec.exec(
			"nix",
			["store", "info", "--store", "http://127.0.0.1:5001"],
			{ ignoreReturnCode: true, silent: true },
		);
		if (ping !== 0) {
			core.info("waiting for proxy server to start...");
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}

	// get public key
	const publicKey = (
		await exec.getExecOutput(
			"bash",
			["-c", "cat /tmp/.secret-key | nix key convert-secret-to-public"],
			{
				silent: true,
			},
		)
	).stdout.trim();

	// add cache as a substituter
	core.exportVariable(
		"NIX_CONFIG",
		`
			extra-substituters = http://127.0.0.1:5001?priority=10
			extra-trusted-public-keys = ${publicKey}
		`,
	);
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
