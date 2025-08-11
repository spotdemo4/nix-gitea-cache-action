import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as glob from "@actions/glob";
import { getKey } from "./key.js";

async function main() {
	// Get cache key
	const key = await getKey();

	// Restore cache to tmp
	const restore = await cache.restoreCache(["/tmp/nix-cache"], key);
	core.setOutput("cache-hit", restore ? "true" : "false");
	if (!restore) {
		core.info("Cache not found, proceeding without restoring.");
		return;
	}

	// Get all nar files in the cache directory
	const globber = await glob.create("/tmp/nix-cache/*.narinfo");
	const narFiles = await globber.glob();

	// If no nar files found, exit early
	if (narFiles.length === 0) {
		core.info("No nar files found in the cache, exiting.");
		return;
	}

	// Log the number of nar files found
	core.info(`Found ${narFiles.length} nar files in the cache.`);

	// Import all nar files from the cache
	// Necessary until https://github.com/NixOS/nix/issues/9052 is resolved
	for (const narFile of narFiles) {
		await exec.exec("nix", [
			"copy",
			narFile,
			"--from",
			"file:///tmp/nix-cache",
			"--no-check-sigs",
			"--offline",
		]);
	}
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
