import { readFileSync } from "node:fs";
import * as cache from "@actions/cache";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";
import { formatBytes, requestPromise } from "./util.js";

async function main() {
	// make sure caching is available
	if (!cache.isFeatureAvailable()) {
		core.warning("cache is not available");
		return;
	}

	// get flake hash from state
	const flakeHash = core.getState("flakeHash");
	if (!flakeHash) {
		core.warning("flake hash not found, not saving cache");
		return;
	}

	// get public key from state
	const publicKey = core.getState("publicKey");
	if (!publicKey) {
		core.warning("public key hash not found, not saving cache");
		return;
	}

	// get size of cache
	let size = 0;
	const du = await exec.getExecOutput("du", ["-sb", "/tmp/nix-cache"], {
		ignoreReturnCode: true,
		silent: true,
	});
	if (du.exitCode === 0) {
		size = parseInt(du.stdout.trim(), 10);
	}
	core.info(`cache size: ${formatBytes(size)}`);

	// delete cache if size exceeds max-size
	const max = parseInt(core.getInput("max-size") || "1000000000", 10); // default to 1GB
	if (size > max) {
		core.info(`${formatBytes(size)} > max ${formatBytes(max)}, deleting cache`);
		await io.rmRF("/tmp/nix-cache");
	}

	// optimise
	await exec.exec("nix", ["store", "optimise"]);

	// sign
	core.info("signing");
	await exec.exec(
		"nix",
		["store", "sign", "--key-file", "/tmp/.secret-key", "--all"],
		{ silent: true },
	);

	// verify
	core.info("verifying");
	await exec.exec(
		"nix",
		[
			"store",
			"verify",
			"--repair",
			"--trusted-public-keys",
			publicKey,
			"--all",
		],
		{
			silent: true,
		},
	);

	// have proxy server load in substituters so cached paths are not added
	core.info("loading substituters");
	const subUpdate = await requestPromise({
		method: "POST",
		host: "127.0.0.1",
		port: 5001,
		path: "/substituters",
		timeout: 5000,
	});
	if (!subUpdate.response.statusCode || subUpdate.response.statusCode > 299) {
		core.warning("failed to load substituters");
	} else {
		const substituters = JSON.parse(await subUpdate.body) as string[];
		core.info(`substituters: ${substituters.join(", ")}`);
	}

	// add to cache
	core.info("adding to cache");
	const copy = await exec.exec(
		"nix",
		[
			"copy",
			"--to",
			"http://127.0.0.1:5001?compression=zstd&parallel-compression=true",
			"--keep-going",
			"--all",
		],
		{
			ignoreReturnCode: true,
		},
	);
	if (copy !== 0) {
		core.warning(`failed to copy some store paths (exit code ${copy})`);
	}

	// get hash of cache
	const cacheHash = (
		await exec.getExecOutput(
			"nix",
			["hash", "path", "--type", "sha256", "/tmp/nix-cache"],
			{
				silent: true,
			},
		)
	).stdout
		.trim()
		.split("sha256-")[1];
	core.info(`cache hash: ${cacheHash}`);

	// save cache
	await cache.saveCache(
		["/tmp/nix-cache", "/tmp/.secret-key"],
		`nix-store-${flakeHash}-${cacheHash}`,
	);

	// close proxy server
	const proxyPID = core.getState("proxyPID");
	if (proxyPID) {
		core.info("stopping proxy server");
		process.kill(parseInt(proxyPID, 10));
	}

	// print proxy errors if they exist
	const stdout = readFileSync("/tmp/out.log", "utf8").trim();
	if (stdout) {
		core.info("proxy server output:");
		core.info(stdout);
	}
	const stderr = readFileSync("/tmp/err.log", "utf8").trim();
	if (stderr) {
		core.warning("proxy server errors:");
		core.info(stderr);
	}
}

try {
	await main();
} catch (error) {
	if (error instanceof Error) core.setFailed(error.message);
}
