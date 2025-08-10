import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { getKey } from "./key.js";

try {
	// Export nix store
	await exec.exec("bash", [
		"-c",
		"nix-store --export $(find /nix/store -maxdepth 1 -name '*-*') > /tmp/nixcache",
	]);

	// Get cache key
	const key = await getKey();

	// Save nix store to cache
	await cache.saveCache(["/tmp/nixcache"], key);
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
