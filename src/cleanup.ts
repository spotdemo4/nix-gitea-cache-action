import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

type StorePath = {
	ca: string | null;
	deriver: string;
	narHash: string;
	narSize: number;
	references: string[];
	registrationTime: number;
	signatures: string[];
	ultimate: boolean;
};

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

	// get store paths
	core.info("getting store paths");
	const storePaths: Map<string, StorePath> = new Map(
		Object.entries(
			JSON.parse(
				(
					await exec.getExecOutput("nix", ["path-info", "--all", "--json"], {
						silent: true,
					})
				).stdout,
			),
		),
	);

	// filter out paths not built locally
	core.info("filtering store paths not built locally");
	const local = new Map<string, StorePath>();
	for (const [path, info] of storePaths) {
		if (!info.ultimate) continue;
		local.set(path, info);
	}

	// if no local paths, nothing to do
	if (local.size === 0) {
		core.info("no local store paths found, nothing to do");
		return;
	}

	// sign
	core.info("signing");
	await exec.exec(
		"nix",
		["store", "sign", "--key-file", "/tmp/.secret-key", ...local.keys()],
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
			...local.keys(),
		],
		{
			silent: true,
		},
	);

	// copy to cache
	const copy = await exec.exec(
		"nix",
		[
			"copy",
			"--to",
			"file:///tmp/nix-cache",
			"--no-recursive",
			"--keep-going",
			...local.keys(),
		],
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
