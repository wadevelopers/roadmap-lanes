import { afterEach, describe, expect, test } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { serializeAcceptedAlerts } from "../src/acceptedAlerts";
import { alertFingerprint } from "../src/alerts";
import { buildModel } from "../src/buildModel";
import { loadNodeRoadmapData } from "../src/nodeDataSource";
import {
	formatAlertsText,
	validationExitCode,
	validateRoadmapDirectory,
} from "../src/validator";
import type { Alert } from "../src/types";

const tempDirs: string[] = [];

async function tempRoadmap(): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "roadmap-lanes-"));
	tempDirs.push(dir);
	await writeFile(join(dir, "taxonomy.yaml"), "areas: {}\n");
	await writeFile(join(dir, "lanes.yaml"), "lanes:\n  A:\n    queue: []\n");
	return dir;
}

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("CLI validator", () => {
	test("carga frontmatter CRLF y normaliza wikilinks igual que el core", async () => {
		const dir = await tempRoadmap();
		await writeFile(
			join(dir, "A.md"),
			"---\r\nid: A\r\ntype: feat\r\nmaturity: ready\r\nstatus: done\r\nduration: 1\r\n---\r\nDone.\r\n"
		);
		await writeFile(
			join(dir, "B.md"),
			"---\r\nid: B\r\ntype: feat\r\nmaturity: ready\r\nstatus: pending\r\nduration: 2\r\ndepends_on: ['[[folder/A.md|A]]']\r\n---\r\nNext.\r\n"
		);
		await writeFile(join(dir, "lanes.yaml"), "lanes:\n  A:\n    queue: [B]\n");

		const data = await loadNodeRoadmapData(dir);
		const model = buildModel(data);

		expect(model.tasks.get("B")?.depends_on).toEqual(["A"]);
		expect(model.alerts).toEqual([]);
		expect(model.lanes.A.next).toBe("B");
	});

	test("reporta missing-frontmatter y relaciones declaradas como string vacío", async () => {
		const dir = await tempRoadmap();
		await writeFile(
			join(dir, "A.md"),
			[
				"---",
				"id: A",
				"type: feat",
				"maturity: ready",
				"status: pending",
				"duration: 1",
				'parent: ""',
				"depends_on: ['']",
				"absorbs: ['']",
				"---",
				"Body.",
				"",
			].join("\n")
		);
		await writeFile(join(dir, "NOFM.md"), "No frontmatter here.\n");

		const model = buildModel(await loadNodeRoadmapData(dir));

		expect(model.alerts).toContainEqual({
			code: "missing-frontmatter",
			severity: "error",
			taskId: "NOFM",
			params: { file: "NOFM.md" },
		});
		expect(model.alerts.filter((alert) => alert.code === "empty-relation-field")).toEqual([
			{
				code: "empty-relation-field",
				severity: "error",
				taskId: "A",
				params: { id: "A", field: "parent" },
			},
			{
				code: "empty-relation-field",
				severity: "error",
				taskId: "A",
				params: { id: "A", field: "absorbs" },
			},
			{
				code: "empty-relation-field",
				severity: "error",
				taskId: "A",
				params: { id: "A", field: "depends_on" },
			},
		]);
	});

	test("filtra accepted-alerts.yaml y mantiene exit code según strict", async () => {
		const dir = await tempRoadmap();
		await writeFile(
			join(dir, "A.md"),
			[
				"---",
				"id: A",
				"type: feat",
				"maturity: raw",
				"status: pending",
				"duration: 1",
				"---",
				"Body.",
				"",
			].join("\n")
		);
		await writeFile(join(dir, "lanes.yaml"), "lanes:\n  A:\n    queue: [A]\n");

		const expected: Alert = {
			code: "maturity-not-ready-on-next",
			severity: "warning",
			taskId: "A",
			params: { lane: "A", id: "A", maturity: "raw" },
		};
		let result = await validateRoadmapDirectory(dir);
		expect(result.alerts).toEqual([expected]);
		expect(validationExitCode(result.alerts)).toBe(0);
		expect(validationExitCode(result.alerts, true)).toBe(1);
		expect(formatAlertsText(result.alerts)).toContain("A: next task in lane A");

		await writeFile(join(dir, "accepted-alerts.yaml"), serializeAcceptedAlerts([alertFingerprint(expected)]));
		result = await validateRoadmapDirectory(dir);
		expect(result.alerts).toEqual([]);
	});

	test("valida el fixture demo con las dos warnings next-maturity esperadas", async () => {
		const result = await validateRoadmapDirectory(join(process.cwd(), "examples", "demo-app", "roadmap"));
		expect(result.alerts.map((alert) => alert.taskId)).toEqual(["TIME-01", "TIME-06"]);
		expect(result.report.nextByLane).toMatchObject({
			A: "TIME-15",
			B: "TIME-01",
			C: "TIME-06",
			D: "TIME-12",
		});
	});
});
