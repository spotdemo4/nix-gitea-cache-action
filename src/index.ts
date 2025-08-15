import { spawn } from "node:child_process";
import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

async function main() {
	// Make sure caching is available
	if (!cache.isFeatureAvailable()) {
		core.warning("Cache action is not available");
		return;
	}

	// Print nix version
	const versionOutput = await exec.getExecOutput("nix", ["--version"]);
	core.info(`Nix version: ${versionOutput.stdout.trim()}`);

	// Restore cache to tmp
	const restore = await cache.restoreCache(["/tmp/nix-cache"], "nix-store");
	core.setOutput("cache-hit", restore ? "true" : "false");
	if (!restore) {
		core.info("Cache not found.");
	}

	// Create nix daemon
	const daemon = spawn(
		"bash",
		[
			"-c",
			"NIX_DAEMON_SOCKET_PATH=/tmp/nix-socket nix daemon --store /tmp/nix-cache",
		],
		{ detached: true, stdio: "ignore" },
	);
	daemon.unref();
	core.info("Nix daemon starting...");

	// Wait for the daemon to start
	let ping = 1;
	while (ping !== 0) {
		ping = await exec.exec(
			"nix",
			["store", "info", "--store", "unix:///tmp/nix-socket"],
			{ ignoreReturnCode: true },
		);
		if (ping !== 0) {
			core.info("Waiting for Nix daemon to start...");
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}

	// Copy nix store to daemon
	if (!restore) {
		core.info("Copying nix store to daemon.");
		await exec.exec("nix", [
			"copy",
			"--all",
			"--to",
			"unix:///tmp/nix-socket",
			"--no-check-sigs",
		]);
	}

	// Verify nix store
	await exec.exec("nix-store", [
		"--verify",
		"--check-contents",
		"--repair",
		"--store",
		"unix:///tmp/nix-socket",
	]);

	// Delete old cache
	//await exec.exec("rm", ["-rf", "~/.cache/nix"]);

	// Verify nix store integrity
	// const verify = await exec.exec("nix", [
	// 	"store",
	// 	"verify",
	// 	"--all",
	// 	"--no-trust",
	// 	"--store",
	// 	"/tmp/nix-cache",
	// ]);
	// if (verify !== 0) {
	// 	core.warning("Nix store verification failed. Attempting repair.");

	// 	const repair = await exec.exec("nix", [
	// 		"store",
	// 		"repair",
	// 		"--all",
	// 		"--store",
	// 		"/tmp/nix-cache",
	// 	]);
	// 	if (repair !== 0) {
	// 		throw new Error("Nix store verification and repair failed");
	// 	}
	// }

	// Set nix store path
	core.exportVariable("NIX_CONFIG", "store = unix:///tmp/nix-socket");
	// core.exportVariable("NIX_STORE_DIR", "/tmp/nix-cache/nix/store");
	// core.exportVariable("NIX_STATE_DIR", "/tmp/nix-cache/nix/var/nix");
	// core.exportVariable("NIX_LOG_DIR", "/tmp/nix-cache/nix/var/log/nix");

	// const currentDir = await exec.getExecOutput("ls", ["-la", "."]);
	// core.info(`Current directory: ${currentDir.stdout.trim()}`);
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
