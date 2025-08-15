import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";

async function main() {
	// make sure caching is available
	if (!cache.isFeatureAvailable()) {
		core.warning("Cache action is not available");
		return;
	}

	// print nix version
	const versionOutput = await exec.getExecOutput("nix", ["--version"]);
	core.info(`Nix version: ${versionOutput.stdout.trim()}`);

	// restore cache to tmp
	const restore = await cache.restoreCache(
		["/tmp/nix-cache", "/tmp/privkey.pem", "/tmp/pubkey.pem"],
		"nix-store",
	);
	core.setOutput("cache-hit", restore ? "true" : "false");
	if (!restore) {
		core.info("Cache not found. Generating keypair.");

		// generate keypair
		await exec.exec("nix-store", [
			"--generate-binary-cache-key",
			"simple.cache.action-1",
			"/tmp/privkey.pem",
			"/tmp/pubkey.pem",
		]);
	}

	// get public key
	const pubkey = await exec.getExecOutput("cat", ["/tmp/pubkey.pem"]);
	core.info(`Public key: ${pubkey.stdout.trim()}`);

	// add cache as a substituter
	core.exportVariable(
		"NIX_CONFIG",
		`
			extra-substituters = file:///tmp/nix-cache
			extra-trusted-public-keys = simple.cache.action-1:${pubkey.stdout.trim()}
		`,
	);
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
