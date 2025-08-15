import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

async function main() {
	// Optimise the nix store
	await exec.exec("nix", ["store", "optimise"]);

	// Get size of nix store
	const sizeOutput = await exec.getExecOutput("bash", [
		"-c",
		"nix path-info --json --all | jq 'map(.narSize) | add'",
	]);
	const size = parseInt(sizeOutput.stdout.trim(), 10);
	core.info(`Nix store size: ${size} bytes`);

	// Collect garbage if size exceeds max-size
	const maxSizeInput = core.getInput("max-size") || "5000000000"; // Default to 5GB
	const maxSize = parseInt(maxSizeInput, 10);
	if (size > maxSize) {
		core.info(
			`Nix store size exceeds max-size (${maxSize} bytes). Running garbage collection.`,
		);
		await exec.exec("nix", ["store", "gc"]);
	} else {
		core.info(
			`Nix store size is within limits (${size} bytes <= ${maxSize} bytes). No garbage collection needed.`,
		);
	}

	// Save nix store to cache
	await cache.saveCache(["/tmp/nix-cache"], "nix-store");
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
