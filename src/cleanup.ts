import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

async function main() {
	// Unset substitutions
	core.exportVariable("NIX_CONFIG", "");

	const nixconf = await exec.getExecOutput("nix", ["config", "show"]);
	core.info(`Nix config: ${nixconf.stdout.trim()}`);

	// Get size of cache
	const sizeOutput = await exec.getExecOutput("du", ["-sb", "/tmp/nix-cache"]);
	const size = parseInt(sizeOutput.stdout.trim(), 10);
	core.info(`Nix cache size: ${size} bytes`);

	// Collect garbage if size exceeds max-size
	const maxSizeInput = core.getInput("max-size") || "5000000000"; // Default to 5GB
	const maxSize = parseInt(maxSizeInput, 10);
	if (size > maxSize) {
		core.info(
			`Nix store size exceeds max-size (${maxSize} bytes). Running garbage collection.`,
		);

		// Run garbage collection
		await exec.exec("rm", ["-rf", "/tmp/nix-cache/*"]);
	}

	// Copy to cache
	await exec.exec("nix", [
		"copy",
		"--all",
		"--to",
		"file:///tmp/nix-cache",
		"--no-check-sigs",
		"--offline",
	]);

	// Save cache
	await cache.saveCache(["/tmp/nix-cache"], "nix-store");
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
