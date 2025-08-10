import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { getKey } from "./key.js";

try {
	// Get cache key
	const key = await getKey();

	// Export nix store
	await exec.exec("bash", [
		"-c",
		"nix-store --export $(find /nix/store -maxdepth 1 -name '*-*') > /tmp/nixcache",
	]);

	// Save nix store to cache
	await cache.saveCache(
		["/tmp/nixcache"],
		`nix-store-${core.platform.platform}-${core.platform.arch}-${key}`,
	);
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
