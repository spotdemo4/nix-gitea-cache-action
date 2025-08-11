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

	const badPaths: string[] = [];
	while (true) {
		// If cache was restored, import it
		const out = await exec.getExecOutput("nix", [
			"copy",
			"--all",
			"--from",
			"file:///tmp/nix-cache",
			"--no-check-sigs",
		]);

		if (out.exitCode === 0) break;

		// If the path is not valid, retry
		// Necessary until https://github.com/NixOS/nix/issues/9052 is resolved
		const badPath = out.stderr.match(/path '(.+)' is not valid/)?.at(1);
		if (!badPath) {
			core.warning("Failed to import cache, but no bad path found. Exiting.");
			return;
		}

		if (badPaths.includes(badPath)) {
			core.warning(`'${badPath}' is not valid, but already retried. Exiting.`);
			return;
		}

		badPaths.push(badPath);
		core.warning(`'${badPath}' is not valid, retrying...`);
		await exec.exec("nix", [
			"copy",
			badPath,
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
