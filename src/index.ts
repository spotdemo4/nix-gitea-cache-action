import * as cache from "@actions/cache";
import * as core from "@actions/core";

async function main() {
	// Restore cache to tmp
	const restore = await cache.restoreCache(["/tmp/nix-cache"], "nix-store");
	core.setOutput("cache-hit", restore ? "true" : "false");
	if (!restore) {
		core.info("Cache not found.");
	}

	// Set nix store path
	core.exportVariable("NIX_CONFIG", "store = /tmp/nix-cache");
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
