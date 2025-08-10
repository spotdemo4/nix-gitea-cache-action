import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { getKey } from "./key.js";

try {
	// Get cache key
	const key = await getKey();

	// Restore cache to tmp
	const restore = await cache.restoreCache(
		["/tmp/nixcache"],
		`nix-store-${core.platform.platform}-${core.platform.arch}-${key}`,
	);

	// If cache was restored, import it
	if (restore) {
		await exec.exec("bash", ["-c", "nix-store --import < /tmp/nixcache"]);
	}

	core.setOutput("cache-hit", restore ? "true" : "false");
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
