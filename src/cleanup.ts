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

	// optimise
	await exec.exec("nix", ["store", "optimise"]);

	// sign
	await exec.exec("nix", [
		"store",
		"sign",
		"--all",
		"--key-file",
		"/tmp/.secret-key",
	]);

	// get public key
	const publicKey = (
		await exec.getExecOutput(
			"bash",
			["-c", "cat /tmp/.secret-key | nix key convert-secret-to-public"],
			{
				silent: true,
			},
		)
	).stdout.trim();

	// verify
	core.info("verifying nix store");
	await exec.exec(
		"nix",
		[
			"store",
			"verify",
			"--all",
			"--repair",
			"--trusted-public-keys",
			publicKey,
		],
		{
			silent: true,
		},
	);

	// get size of cache
	let size = 0;
	const du = await exec.getExecOutput("du", ["-sb", "/tmp/nix-cache"], {
		ignoreReturnCode: true,
	});
	if (du.exitCode === 0) {
		size = parseInt(du.stdout.trim(), 10);
	}
	core.info(`nix cache size: ${size} bytes`);

	// purge if size exceeds max-size
	const max = parseInt(core.getInput("max-size") || "5000000000", 10); // default to 5GB
	if (size > max) {
		core.info(`nix store size exceeds max-size (${max} bytes), purging...`);

		// purge cache
		await io.rmRF("/tmp/nix-cache");
	}

	// copy to cache
	await exec.exec(
		"nix",
		["copy", "--all", "--to", "file:///tmp/nix-cache", "--keep-going"],
		{
			ignoreReturnCode: true,
		},
	);

	// save cache
	await cache.saveCache(["/tmp/nix-cache", "/tmp/.secret-key"], "nix-store");
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
