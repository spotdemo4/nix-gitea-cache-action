import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const index = {
	input: "src/index.ts",
	output: {
		esModule: true,
		file: "dist/index.js",
		format: "es",
		sourcemap: true,
	},
	plugins: [
		typescript(),
		commonjs(),
		json(),
		nodeResolve({ preferBuiltins: true }),
	],
};

const cleanup = {
	input: "src/cleanup.ts",
	output: {
		esModule: true,
		file: "dist/cleanup.js",
		format: "es",
		sourcemap: true,
	},
	plugins: [
		typescript(),
		commonjs(),
		json(),
		nodeResolve({ preferBuiltins: true }),
	],
};

const proxy = {
	input: "src/proxy.ts",
	output: {
		esModule: true,
		file: "dist/proxy.js",
		format: "es",
		sourcemap: true,
	},
	plugins: [
		typescript(),
		commonjs(),
		json(),
		nodeResolve({ preferBuiltins: true }),
	],
};

export default [index, cleanup, proxy];
