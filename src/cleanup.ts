import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

async function main() {
	// Optimise the nix store
	await exec.exec("nix", ["store", "optimise"]);

	// Save nix store to cache
	await cache.saveCache(["/tmp/nix-cache"], "nix-store");
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
