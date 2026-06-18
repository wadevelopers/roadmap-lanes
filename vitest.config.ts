import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
	resolve: {
		alias: {
			obsidian: resolve(__dirname, "test/obsidianMock.ts"),
		},
	},
	test: {
		exclude: ["**/node_modules/**", "**/.git/**", "**/.obsidian/**"],
	},
});
