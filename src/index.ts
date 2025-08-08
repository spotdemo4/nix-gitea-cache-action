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

	// Restore cache to tmp
	const restore = await cache.restoreCache(
		["/tmp/nixcache"],
		`nix-store-${core.platform.platform}-${core.platform.arch}-${key}`,
	);

	// If cache was restored, import it
	if (restore) {
		await exec.exec("nix-store --import < /tmp/nixcache");
	}

	core.setOutput("cache-hit", restore ? "true" : "false");
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
