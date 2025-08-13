import * as core from "@actions/core";
import * as exec from "@actions/exec";

export async function getKey(): Promise<string> {
	try {
		// Get cache key from input
		const key = core.getInput("key");
		if (key) return key;

		// Try to get narHash from nixpkgs flake input
		const metadata = await exec.getExecOutput(
			"nix",
			["flake", "metadata", "--json"],
			{
				ignoreReturnCode: true,
			},
		);
		if (metadata.exitCode === 0) {
			const json = JSON.parse(metadata.stdout);
			const rootName: string | undefined =
				json?.locks?.nodes?.root?.inputs?.nixpkgs;
			if (rootName) {
				const narHash: string | undefined =
					json?.locks?.nodes[rootName]?.locked?.narHash;
				if (narHash) {
					return `nix-store-${core.platform.platform}-${core.platform.arch}-${narHash}`;
				}
			}
		}

		// Try to hash flake.lock
		const lockHash = await exec.getExecOutput(
			"nix",
			["hash", "file", "flake.lock"],
			{
				ignoreReturnCode: true,
			},
		);
		if (lockHash.exitCode === 0) {
			const hash = lockHash.stdout.trim();
			if (hash) {
				return `nix-store-${core.platform.platform}-${core.platform.arch}-${hash}`;
			}
		}

		// Fallback if flake.lock is not available
		return `nix-store-${core.platform.platform}-${core.platform.arch}`;
	} catch (error) {
		console.error("Failed to generate cache key:", error);
	}

	return "nix-store-default"; // Default key if all else fails
}
