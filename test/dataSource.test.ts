import { describe, expect, test } from "vitest";
import type { App } from "obsidian";

import { loadRoadmapData } from "../src/dataSource";
import { hasExplicitEmptyRelation, normalizeRelationValue } from "../src/relations";

function createFreshReadApp(files: Record<string, string>): App {
	const paths = Object.keys(files).sort((a, b) => a.localeCompare(b));
	const read = async (path: string): Promise<string> => {
		const value = files[path];
		if (value === undefined) throw new Error(`missing test file: ${path}`);
		return value;
	};

	return {
		vault: {
			adapter: {
				read,
				list: async (path: string) => {
					const prefix = path ? `${path}/` : "";
					const directFiles: string[] = [];
					const folders = new Set<string>();

					for (const file of paths) {
						if (!file.startsWith(prefix)) continue;
						const rest = file.slice(prefix.length);
						if (!rest) continue;
						const parts = rest.split("/");
						if (parts.length === 1) directFiles.push(file);
						else folders.add(`${prefix}${parts[0]}`);
					}

					return {
						files: directFiles.sort((a, b) => a.localeCompare(b)),
						folders: [...folders].sort((a, b) => a.localeCompare(b)),
					};
				},
			},
			cachedRead: async () => {
				throw new Error("freshRead must not call vault.cachedRead");
			},
			getMarkdownFiles: () => {
				throw new Error("freshRead must not call vault.getMarkdownFiles");
			},
			getName: () => "Fresh Vault",
		},
		metadataCache: {
			getFileCache: () => {
				throw new Error("freshRead must not call metadataCache.getFileCache");
			},
		},
	} as unknown as App;
}

describe("loadRoadmapData freshRead", () => {
	test("lista y lee notas desde adapter sin usar cachés de Obsidian", async () => {
		const app = createFreshReadApp({
			"roadmap/lanes.yaml": "lanes:\n  A:\n    queue: [B]\n",
			"roadmap/taxonomy.yaml": "areas: {}\n",
			"roadmap/A.md": "---\nid: A\ntype: feat\nstatus: done\nduration: 1\n---\nA body.\n",
			"roadmap/nested/B.md":
				"---\nid: B\ntype: feat\nmaturity: ready\nstatus: pending\nduration: 2\ndepends_on: ['[[A]]']\n---\nFresh body.\n",
		});

		const data = await loadRoadmapData(app, { roadmapFolder: "roadmap", freshRead: true });

		expect(data.projectName).toBe("Fresh Vault");
		expect(data.tasks.map((task) => task.id).sort()).toEqual(["A", "B"]);
		expect(data.tasks.find((task) => task.id === "B")?.depends_on).toEqual(["A"]);
		expect(data.tasks.find((task) => task.id === "B")?.body).toBe("Fresh body.");
		expect(data.lanes.A.queue).toEqual(["B"]);
	});
});

describe("relation normalization", () => {
	test("normaliza wikilinks parseados por YAML como arrays anidados", () => {
		expect(normalizeRelationValue([[["folder/A.md"]], ["[[B]]"]])).toEqual(["A", "B"]);
		expect(hasExplicitEmptyRelation([[[""]]])).toBe(true);
	});
});
