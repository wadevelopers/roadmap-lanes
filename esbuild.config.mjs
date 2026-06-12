import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const banner = `/*
Roadmap Lanes — plugin de Obsidian.
main.js es GENERADO por esbuild desde main.ts. No editar a mano.
*/`;

const prod = process.argv[2] === "production";

const common = {
	bundle: true,
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	minify: prod,
};

const pluginContext = await esbuild.context({
	...common,
	banner: { js: banner },
	entryPoints: ["main.ts"],
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtins,
	],
	outfile: "main.js",
});

const validateContext = await esbuild.context({
	...common,
	entryPoints: ["validate.ts"],
	platform: "node",
	external: builtins,
	outfile: "validate.js",
});

if (prod) {
	await Promise.all([pluginContext.rebuild(), validateContext.rebuild()]);
	await Promise.all([pluginContext.dispose(), validateContext.dispose()]);
	process.exit(0);
} else {
	await Promise.all([pluginContext.watch(), validateContext.watch()]);
}
