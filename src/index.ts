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
	await exec.exec("bash", [
		"-c",
		"nohup NIX_DAEMON_SOCKET_PATH=/tmp/nix-socket nix daemon --store /tmp/nix-cache &",
	]);

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
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
