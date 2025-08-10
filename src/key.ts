import * as core from "@actions/core";
import * as exec from "@actions/exec";

export async function getKey(): Promise<string> {
	try {
		// Get cache key from input
		const key = core.getInput("key");
		if (key) return key;

		// If no key is provided, generate one from flake.lock hash
		let hash = "";
		await exec.exec("nix", ["hash", "file", "flake.lock"], {
			listeners: {
				stdout: (data) => {
					hash += data.toString().trim();
				},
			},
		});
		if (hash) {
			return `nix-store-${core.platform.platform}-${core.platform.arch}-${hash}`;
		}

		// Fallback if flake.lock is not available
		return `nix-store-${core.platform.platform}-${core.platform.arch}`;
	} catch (error) {
		console.error("Failed to generate cache key:", error);
	}

	return "nix-store-default"; // Default key if all else fails
}
