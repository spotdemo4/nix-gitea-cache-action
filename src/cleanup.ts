import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";

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

	// get size of cache
	let size = 0;
	const du = await exec.getExecOutput("du", ["-sb", "/tmp/nix-cache"], {
		ignoreReturnCode: true,
		silent: true,
	});
	if (du.exitCode === 0) {
		size = parseInt(du.stdout.trim(), 10);
	}
	core.info(`cache size: ${size} bytes`);

	// delete cache if size exceeds max-size
	const max = parseInt(core.getInput("max-size") || "1000000000", 10); // default to 1GB
	if (size > max) {
		core.info(`cache size exceeds max-size (${max} bytes), deleting cache`);
		await io.rmRF("/tmp/nix-cache");
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

	// get hash of cache
	const cacheHash = (
		await exec.getExecOutput("nix", ["hash", "path", "/tmp/nix-cache"], {
			silent: true,
		})
	).stdout.trim();
	core.info(`cache hash: ${cacheHash}`);

	// save cache
	await cache.saveCache(
		["/tmp/nix-cache", "/tmp/.secret-key"],
		`nix-store-${flakeHash}-${cacheHash}`,
	);
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
