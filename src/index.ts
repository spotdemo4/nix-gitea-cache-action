import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

async function main() {
	// Make sure caching is available
	if (!cache.isFeatureAvailable()) {
		core.warning("Cache action is not available");
		return;
	}

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

	// Set nix store path
	core.exportVariable("NIX_CONFIG", "store = /tmp/nix-cache");
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
