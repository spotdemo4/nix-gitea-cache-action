import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

async function main() {
	// make sure caching is available
	if (!cache.isFeatureAvailable()) {
		core.warning("cache is not available");
		return;
	}

	// get flake hash from state
	const flakeHash = core.getState("flakeHash");
	if (!flakeHash) {
		core.warning("flake hash not found, not saving cache");
		return;
	}

	// get public key from state
	const publicKey = core.getState("publicKey");
	if (!publicKey) {
		core.warning("public key hash not found, not saving cache");
		return;
	}

	// optimise
	await exec.exec("nix", ["store", "optimise"]);

	// sign
	core.info("signing");
	await exec.exec(
		"nix",
		["store", "sign", "--key-file", "/tmp/.secret-key", "--all"],
		{ silent: true },
	);

	// verify
	core.info("verifying");
	await exec.exec(
		"nix",
		[
			"store",
			"verify",
			"--repair",
			"--trusted-public-keys",
			publicKey,
			"--all",
		],
		{
			silent: true,
		},
	);

	// add to cache
	core.info("adding to cache");
	const copy = await exec.exec(
		"nix",
		["copy", "--to", "http://127.0.0.1:5001", "--keep-going", "--all"],
		{
			ignoreReturnCode: true,
		},
	);
	if (copy !== 0) {
		core.warning(`failed to copy some store paths (exit code ${copy})`);
	}

	// save cache
	await cache.saveCache(
		["/tmp/nix-cache", "/tmp/.secret-key"],
		`nix-store-${flakeHash}-${Date.now()}`,
	);
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
