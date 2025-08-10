import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { getKey } from "./key.js";

async function main() {
	// Optimise the nix store
	await exec.exec("nix", ["store", "optimise"]);

	// Export nix store
	await exec.exec("nix", ["copy", "--all", "--to", "file:///tmp/nix-cache"]);

	// Get cache key
	const key = await getKey();

	// Save nix store to cache
	await cache.saveCache(["/tmp/nix-cache"], key);
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
