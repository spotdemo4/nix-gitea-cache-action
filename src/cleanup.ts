import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

async function main() {
	// optimise
	await exec.exec("nix", ["store", "optimise"]);

	// verify
	await exec.exec("nix", [
		"store",
		"verify",
		"--all",
		"--no-trust",
		"--repair",
	]);

	const nixconf = await exec.getExecOutput("nix", ["config", "show"]);
	core.info(`Nix config: ${nixconf.stdout.trim()}`);

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
	await cache.saveCache(["/tmp/nix-cache"], "nix-store");
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
