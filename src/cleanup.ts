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

	// Get current system closure
	const closure = await exec.getExecOutput(
		"find /nix/store -maxdepth 1 -name '*-*'",
	);
	const paths = closure.stdout.trim().replace(/\n/g, " ");

	// Export nix store
	await exec.exec(`nix-store --export ${paths} > /tmp/nixcache`);

	// Save nix store to cache
	await cache.saveCache(
		["/tmp/nixcache"],
		`nix-store-${core.platform.platform}-${core.platform.arch}-${key}`,
	);
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
