import * as core from "@actions/core";
import * as exec from "@actions/exec";

export async function getKey(): Promise<string> {
	try {
		// Get cache key from input
		let key = core.getInput("key");
		if (key) return key;

		// If no key is provided, generate one from flake.lock
		await exec.exec("nix", ["hash", "file", "flake.lock"], {
			listeners: {
				stdout: (data) => {
					key += data.toString().trim();
				},
			},
		});
		if (key) return key;
	} catch (error) {
		console.error("Failed to generate cache key:", error);
	}

	return "";
}
