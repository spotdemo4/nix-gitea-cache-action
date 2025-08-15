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
		core.info("Cache not found. Creating initial store.");

		// Export nix store
		await exec.exec("nix", [
			"copy",
			"--all",
			"--to",
			"/tmp/nix-cache",
			"--no-check-sigs",
		]);
	}

	// Verify nix store integrity
	const verify = await exec.exec("nix", [
		"store",
		"verify",
		"--all",
		"--no-trust",
		"--store",
		"/tmp/nix-cache",
	]);
	if (verify !== 0) {
		core.warning("Nix store verification failed. Attempting repair.");

		const repair = await exec.exec("nix", [
			"store",
			"repair",
			"--all",
			"--store",
			"/tmp/nix-cache",
		]);
		if (repair !== 0) {
			throw new Error("Nix store verification and repair failed");
		}
	}

	// Bind mount the cache
	await exec.exec("mount", ["--bind", "/tmp/nix-cache/nix", "/nix"]);

	// Set nix store path
	core.exportVariable("NIX_CONFIG", "store = /tmp/nix-cache");
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
