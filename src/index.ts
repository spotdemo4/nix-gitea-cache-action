import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
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

	// If cache was restored, import it
	await exec.exec("nix", [
		"copy",
		"--all",
		"--from",
		"file:///tmp/nix-cache",
		"--no-check-sigs",
	]);
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
