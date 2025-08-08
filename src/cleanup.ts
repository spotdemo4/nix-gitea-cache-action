import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

try {
	// Get cache key
	let key = core.getInput("key");
	if (!key) {
		await exec.exec("nix", ["hash", "file", "flake.lock"], {
			listeners: {
				stdout: (data) => {
					key += data.toString().trim();
				},
			},
		});
	}

	// Export nix store
	await exec.exec(
		"nix-store --export $(find /nix/store -maxdepth 1 -name '*-*') > /tmp/nixcache",
	);

	// Save nix store to cache
	await cache.saveCache(
		["/tmp/nixcache"],
		`nix-store-${core.platform.platform}-${core.platform.arch}-${key}`,
	);
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
