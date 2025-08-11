import * as fs from "node:fs";
import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as glob from "@actions/glob";
import { getKey } from "./key.js";

async function main() {
	// Get cache key
	const key = await getKey();

	// Restore cache to tmp
	const restore = await cache.restoreCache(["/tmp/nix-cache"], key);
	core.setOutput("cache-hit", restore ? "true" : "false");
	if (!restore) {
		core.info("Cache not found, proceeding without restoring.");
		return;
	}

	// Get all nar files in the cache directory
	// This is necessary until https://github.com/NixOS/nix/issues/9052 is resolved
	const globber = await glob.create("/tmp/nix-cache/*.narinfo");
	const narFiles = await globber.glob();

	// If no nar files found, exit early
	if (narFiles.length === 0) {
		core.info("No nar files found in the cache, exiting.");
		return;
	}

	core.info(`Found ${narFiles.length} nar files in the cache.`);

	// Get all paths in each nar file
	const paths = new Set<string>();
	for (const narFile of narFiles) {
		const path = await getStorePath(narFile);
		if (path) {
			paths.add(path);
		}
	}

	core.info(`Found ${paths.size} unique store paths in the cache.`);

	// Copy each path from the cache
	const out = await exec.getExecOutput(
		"nix",
		[
			"copy",
			"--from",
			"file:///tmp/nix-cache",
			"--no-check-sigs",
			"--offline",
			...paths,
		],
		{
			ignoreReturnCode: true,
		},
	);

	if (out.exitCode !== 0) {
		core.warning("Failed to copy some paths from the cache");
	}
}

async function getStorePath(pathToFile: string) {
	const fileContent = fs.readFileSync(pathToFile, "utf-8");
	const storePath = fileContent.match(/^StorePath: (.+)$/m)?.at(1);
	if (storePath) {
		return storePath;
	}
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
