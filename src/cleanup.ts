import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

async function main() {
	// optimise
	await exec.exec("nix", ["store", "optimise"]);

	// sign
	await exec.exec("nix", [
		"store",
		"sign",
		"--all",
		"--key-file",
		"/tmp/privkey.pem",
	]);

	// verify
	await exec.exec("nix", ["store", "verify", "--all", "--repair"]);

	// get size of cache
	const sizeOutput = await exec.getExecOutput("du", ["-sb", "/tmp/nix-cache"]);
	const size = parseInt(sizeOutput.stdout.trim(), 10);
	core.info(`Nix cache size: ${size} bytes`);

	// collect garbage if size exceeds max-size
	const maxSizeInput = core.getInput("max-size") || "5000000000"; // default to 5GB
	const maxSize = parseInt(maxSizeInput, 10);
	if (size > maxSize) {
		core.info(
			`Nix store size exceeds max-size (${maxSize} bytes). Running garbage collection.`,
		);

		// run garbage collection
		await exec.exec("rm", ["-rf", "/tmp/nix-cache/*"]);
	}

	// copy to cache
	await exec.exec(
		"nix",
		[
			"copy",
			"--all",
			"--to",
			"file:///tmp/nix-cache",
			"--no-check-sigs",
			"--keep-going",
		],
		{
			ignoreReturnCode: true,
		},
	);

	// save cache
	await cache.saveCache(
		["/tmp/nix-cache", "/tmp/privkey.pem", "/tmp/pubkey.pem"],
		"nix-store",
	);
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
