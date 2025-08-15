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

	// Get nix conf
	const nixConfOutput = await exec.getExecOutput("nix", ["config", "show"]);
	const nixConf = nixConfOutput.stdout
		.trim()
		.split("\n")
		.map((line) => line.trim());
	core.info(`Nix configuration: ${nixConf.join("\n")}`);

	// Create conf for nix daemon
	const nixDaemonConf = nixConf.map((line) => {
		if (line.startsWith("store =")) {
			return "store = /tmp/nix-cache";
		}
	});

	// Create conf for nix clients
	const nixClientConf = nixConf.map((line) => {
		if (line.startsWith("store =")) {
			return "store = unix:///tmp/nix-socket";
		}
	});

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
			`NIX_DAEMON_SOCKET_PATH=/tmp/nix-socket NIX_CONFIG="${nixDaemonConf.join("\n")}" nix daemon`,
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
	// if (!restore) {
	// 	core.info("Copying nix store to daemon.");
	// 	await exec.exec("nix", [
	// 		"copy",
	// 		"--all",
	// 		"--to",
	// 		"unix:///tmp/nix-socket",
	// 		"--no-check-sigs",
	// 	]);
	// }

	// // Verify nix store
	// await exec.exec("nix-store", [
	// 	"--verify",
	// 	"--check-contents",
	// 	"--repair",
	// 	"--store",
	// 	"unix:///tmp/nix-socket",
	// ]);

	// Prefetch local flake?
	// await exec.exec("nix", [
	// 	"flake",
	// 	"prefetch",
	// 	"--store",
	// 	"unix:///tmp/nix-socket",
	// ]);

	// // Archive local flake??
	// await exec.exec("nix", [
	// 	"flake",
	// 	"archive",
	// 	"--to",
	// 	"unix:///tmp/nix-socket",
	// ]);

	// const metadata = await exec.getExecOutput("nix", [
	// 	"flake",
	// 	"metadata",
	// 	"--json",
	// 	"--store",
	// 	"unix:///tmp/nix-socket",
	// ]);
	// core.info(`Nix metadata: ${metadata.stdout.trim()}`);

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
	core.exportVariable("NIX_CONFIG", nixClientConf.join("\n"));
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
