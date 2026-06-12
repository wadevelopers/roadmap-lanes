import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";

import { buildModel } from "../src/buildModel";
import type { BuildModelInput, RawTask } from "../src/types";

function baseData(): BuildModelInput {
	return {
		taxonomy: { areas: { back: { zones: ["Z1"] } } },
		lanes: { A: { focus: "", worktree: "", queue: ["T1", "T2"] } },
		tasks: [
			{
				id: "T1",
				type: "feat",
				status: "done",
				duration: 16,
				areas: ["back"],
				zones: ["Z1"],
			},
			{ id: "T2", type: "feat", status: "pending", maturity: "ready", duration: 24, depends_on: ["T1"] },
			{ id: "T3", type: "maint", status: "pending", duration: 4, depends_on: ["T2"] },
			{ id: "E", type: "combo", status: "pending", maturity: "ready", duration: 16 },
			{
				id: "H1",
				type: "feat",
				status: "pending",
				maturity: "ready",
				duration: 16,
				parent: "E",
			},
		],
		hoursPerDay: 8,
	};
}

function splitFrontmatter(raw: string, file: string): { fm: string; body: string } {
	const lines = raw.split(/\r?\n/);
	if (lines[0]?.trim() !== "---") throw new Error(`${file}: falta frontmatter`);
	const end = lines.indexOf("---", 1);
	if (end === -1) throw new Error(`${file}: frontmatter sin cierre`);
	return {
		fm: lines.slice(1, end).join("\n"),
		body: lines.slice(end + 1).join("\n").trim(),
	};
}

function normalizeWikilink(value: string): string {
	const match = value.match(/^\[\[([^|\]#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/);
	const link = match ? match[1] : value;
	const basename = link.replace(/\.md$/i, "").split("/").pop();
	return basename || link;
}

function normalizeRelation(value: unknown): string[] {
	const values = Array.isArray(value) ? value : value ? [value] : [];
	return values
		.filter((item): item is string => typeof item === "string" && item.length > 0)
		.map(normalizeWikilink);
}

function listMarkdownFiles(dir: string, prefix = ""): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
		const absolute = join(dir, entry.name);
		if (entry.isDirectory()) return listMarkdownFiles(absolute, relative);
		return entry.isFile() && entry.name.endsWith(".md") ? [relative] : [];
	});
}

function loadDemo(): BuildModelInput {
	const dir = join(process.cwd(), "examples", "demo-app");
	const roadmapDir = join(dir, "roadmap");
	const tasks = listMarkdownFiles(roadmapDir)
		.sort()
		.map((file): RawTask => {
			const { fm, body } = splitFrontmatter(readFileSync(join(roadmapDir, file), "utf8"), file);
			const data = (yaml.load(fm) as Record<string, unknown> | undefined) || {};
			return {
				...data,
				parent: normalizeRelation(data.parent)[0] || null,
				absorbs: normalizeRelation(data.absorbs),
				depends_on: normalizeRelation(data.depends_on),
				body,
				_file: `roadmap/${file}`,
			};
		});

	const taxonomy = yaml.load(readFileSync(join(roadmapDir, "taxonomy.yaml"), "utf8"));
	const lanesYaml = yaml.load(readFileSync(join(roadmapDir, "lanes.yaml"), "utf8")) as {
		lanes?: BuildModelInput["lanes"];
	};

	return {
		tasks,
		taxonomy: (taxonomy as BuildModelInput["taxonomy"]) || { areas: {} },
		lanes: lanesYaml.lanes || {},
		hoursPerDay: 8,
	};
}

describe("buildModel", () => {
	test("una dependencia hecha no bloquea; una pendiente sí", () => {
		const m = buildModel(baseData());
		expect(m.tasks.get("T2")?.blocked).toBe(false);
		expect(m.tasks.get("T3")?.blocked).toBe(true);
	});

	test("unlocks es la inversa de depends_on", () => {
		const m = buildModel(baseData());
		expect(m.tasks.get("T1")?.unlocks).toEqual(["T2"]);
		expect(m.tasks.get("T2")?.unlocks).toEqual(["T3"]);
	});

	test("proximo del carril = primera tarea libre", () => {
		const m = buildModel(baseData());
		expect(m.lanes.A.next).toBe("T2");
	});

	test("alerta si la próxima tarea del carril no está ready", () => {
		for (const maturity of ["raw", "draft"] as const) {
			const datos = baseData();
			const next = datos.tasks.find((tarea) => tarea.id === "T2");
			if (next) next.maturity = maturity;

			const m = buildModel(datos);
			expect(m.alerts).toContainEqual({
				code: "maturity-not-ready-on-next",
				severity: "warning",
				taskId: "T2",
				params: { lane: "A", id: "T2", maturity },
			});
		}
	});

	test("alerta si la próxima tarea del carril no declara maturity", () => {
		const datos = baseData();
		const next = datos.tasks.find((tarea) => tarea.id === "T2");
		if (next) delete next.maturity;

		const m = buildModel(datos);
		expect(m.alerts).toContainEqual({
			code: "maturity-missing-on-next",
			severity: "warning",
			taskId: "T2",
			params: { lane: "A", id: "T2" },
		});

		if (next) next.maturity = "";
		const empty = buildModel(datos);
		expect(empty.alerts).toContainEqual({
			code: "maturity-missing-on-next",
			severity: "warning",
			taskId: "T2",
			params: { lane: "A", id: "T2" },
		});
	});

	test("no duplica invalid-maturity en la próxima tarea", () => {
		const datos = baseData();
		const next = datos.tasks.find((tarea) => tarea.id === "T2");
		if (next) next.maturity = "nope";

		const m = buildModel(datos);
		expect(m.alerts.filter((a) => a.code === "invalid-maturity")).toHaveLength(1);
		expect(m.alerts.some((a) => a.code === "maturity-not-ready-on-next")).toBe(false);
		expect(m.alerts.some((a) => a.code === "maturity-missing-on-next")).toBe(false);
	});

	test("no alerta por maturity en tareas que no son la próxima del carril ni están en backlog", () => {
		const datos = baseData();
		datos.lanes.A.queue = ["T1", "T2", "T3"];
		const nonNext = datos.tasks.find((tarea) => tarea.id === "T3");
		if (nonNext) nonNext.maturity = "raw";
		datos.tasks.push({ id: "B1", type: "feat", status: "pending", maturity: "draft", duration: 8 });

		const m = buildModel(datos);
		expect(m.lanes.A.next).toBe("T2");
		expect(m.alerts.some((a) => a.code === "maturity-not-ready-on-next")).toBe(false);
		expect(m.alerts.some((a) => a.code === "maturity-missing-on-next")).toBe(false);
	});

	test("en una queue con combo evalúa la maturity de la hoja next", () => {
		const datos = baseData();
		datos.lanes.A.queue = ["E"];
		const combo = datos.tasks.find((tarea) => tarea.id === "E");
		const leaf = datos.tasks.find((tarea) => tarea.id === "H1");
		if (combo) combo.maturity = "ready";
		if (leaf) leaf.maturity = "draft";

		const m = buildModel(datos);
		expect(m.lanes.A.next).toBe("H1");
		expect(m.alerts).toContainEqual({
			code: "maturity-not-ready-on-next",
			severity: "warning",
			taskId: "H1",
			params: { lane: "A", id: "H1", maturity: "draft" },
		});
	});

	test("contenedor: children, isContainer y horas derivadas de children", () => {
		const m = buildModel(baseData());
		const e = m.tasks.get("E");
		expect(e?.children).toEqual(["H1"]);
		expect(e?.isContainer).toBe(true);
		expect(e?.effectiveHours).toBe(16);
	});

	test("un contenedor en la queue se expande a sus hojas ejecutables", () => {
		const datos = baseData();
		datos.lanes.A.queue = ["E"];
		const m = buildModel(datos);
		expect(m.lanes.A.queue).toEqual(["H1"]);
		expect(m.lanes.A.next).toBe("H1");
		expect(m.tasks.get("E")?.lane).toBe("A");
		expect(m.tasks.get("H1")?.lane).toBe("A");
	});

	test("detecta type inválido y referencia inexistente", () => {
		const datos = baseData();
		datos.tasks.push({ id: "X", type: "NOPE", depends_on: ["FANTASMA"] });
		const m = buildModel(datos);
		expect(m.alerts.some((a) => a.code === "invalid-type" && a.params?.value === "NOPE")).toBe(true);
		expect(
			m.alerts.some((a) => a.code === "missing-dependency" && a.params?.ref === "FANTASMA")
		).toBe(true);
	});

	test("status visual derivado: hoja y contenedor", () => {
		const m = buildModel(baseData());
		expect(m.tasks.get("T1")?.visualState).toBe("done");
		expect(m.tasks.get("T2")?.visualState).toBe("next");
		expect(m.tasks.get("T3")?.visualState).toBe("out-of-turn");
		expect(m.tasks.get("T3")?.waitingFor).toEqual(["T2"]);
		expect(m.tasks.get("E")?.visualState).toBe("waiting");
		expect(m.tasks.get("H1")?.visualState).toBe("waiting");
	});

	test("contenedor en-curso = algunos children hechos pero no todos", () => {
		const datos = baseData();
		const h1 = datos.tasks.find((tarea) => tarea.id === "H1");
		if (h1) h1.status = "done";
		datos.tasks.push({
			id: "H2",
			type: "feat",
			status: "pending",
			maturity: "ready",
			duration: 8,
			parent: "E",
		});
		const m = buildModel(datos);
		expect(m.tasks.get("E")?.visualState).toBe("in-progress");
	});

	test("en-curso se propaga por combos anidados", () => {
		const datos = baseData();
		datos.tasks.push({ id: "GC", type: "combo", status: "pending", maturity: "ready", duration: 16 });
		datos.tasks.push({ id: "MID", type: "combo", status: "pending", maturity: "ready", duration: 16, parent: "GC" });
		datos.tasks.push({ id: "L1", type: "feat", status: "done", maturity: "ready", duration: 8, parent: "MID" });
		datos.tasks.push({ id: "L2", type: "feat", status: "pending", maturity: "ready", duration: 8, parent: "MID" });
		const m = buildModel(datos);
		expect(m.tasks.get("MID")?.visualState).toBe("in-progress");
		expect(m.tasks.get("GC")?.visualState).toBe("in-progress");
	});

	test("una dependencia contra contenedor espera a que todos sus children estén hechos", () => {
		const datos = baseData();
		datos.lanes.A.queue = ["T4"];
		datos.tasks.push({ id: "T4", type: "feat", status: "pending", duration: 8, depends_on: ["E"] });
		datos.tasks.push({ id: "C2", type: "combo", status: "pending", duration: 8, depends_on: ["E"] });
		datos.tasks.push({ id: "C2-H1", type: "maint", status: "pending", duration: 8, parent: "C2" });
		let m = buildModel(datos);
		expect(m.tasks.get("T4")?.blocked).toBe(true);
		expect(m.tasks.get("T4")?.waitingFor).toEqual(["E"]);
		expect(m.tasks.get("C2")?.visualState).toBe("out-of-turn");
		expect(m.tasks.get("C2-H1")?.blocked).toBe(true);
		expect(m.tasks.get("C2-H1")?.waitingFor).toEqual(["E"]);

		const h1 = datos.tasks.find((tarea) => tarea.id === "H1");
		if (h1) h1.status = "done";
		m = buildModel(datos);
		expect(m.tasks.get("T4")?.blocked).toBe(false);
		expect(m.tasks.get("T4")?.waitingFor).toEqual([]);
		expect(m.tasks.get("C2")?.visualState).toBe("waiting");
		expect(m.tasks.get("C2-H1")?.blocked).toBe(false);
	});

	test("rechaza status en-curso escrito en una hoja", () => {
		const datos = baseData();
		datos.tasks.push({ id: "X", type: "feat", status: "in-progress" });
		const m = buildModel(datos);
		expect(
			m.alerts.some((a) => a.code === "invalid-status" && a.params?.value === "in-progress")
		).toBe(true);
	});

	test("acepta duration numérica y rechaza con sufijo", () => {
		const datos = baseData();
		datos.tasks.push({ id: "X", type: "feat", status: "pending", duration: 16 });
		datos.tasks.push({ id: "Y", type: "feat", status: "pending", duration: "2d" });
		const m = buildModel(datos);
		expect(m.alerts.some((a) => a.code === "invalid-duration" && a.params?.id === "X")).toBe(false);
		expect(
			m.alerts.some((a) => a.code === "invalid-duration" && a.params?.value === "2d")
		).toBe(true);
	});

	test("severidad: referencias rotas = error, taxonomía desconocida = warning", () => {
		const datos = baseData();
		datos.tasks.push({
			id: "X",
			type: "feat",
			status: "pending",
			duration: 8,
			parent: "FANTASMA",
			areas: ["inexistente"],
			zones: ["ZX"],
		});
		const m = buildModel(datos);
		const severityOf = (code: string) => m.alerts.find((a) => a.code === code)?.severity;
		expect(severityOf("missing-parent")).toBe("error");
		expect(severityOf("unknown-area")).toBe("warning");
		expect(severityOf("unknown-zone")).toBe("warning");
	});

	test("valida contrato COMBO básico", () => {
		const datos = baseData();
		const e = datos.tasks.find((tarea) => tarea.id === "E");
		const h1 = datos.tasks.find((tarea) => tarea.id === "H1");
		if (e) e.type = "feat";
		if (h1) h1.type = "combo";
		const m = buildModel(datos);

		expect(m.alerts.some((a) => a.code === "combo-missing-type" && a.taskId === "E")).toBe(true);
		expect(m.alerts.some((a) => a.code === "combo-on-leaf" && a.taskId === "H1")).toBe(true);
	});

	test("valida duración de COMBO con cota física y paralelismo", () => {
		const imposible = baseData();
		const e = imposible.tasks.find((tarea) => tarea.id === "E");
		if (e) e.duration = 8;
		let m = buildModel(imposible);
		expect(
			m.alerts.some((a) => a.code === "combo-impossible-duration" && a.severity === "error")
		).toBe(true);

		const mayor = baseData();
		const eMayor = mayor.tasks.find((tarea) => tarea.id === "E");
		if (eMayor) eMayor.duration = 24;
		m = buildModel(mayor);
		expect(
			m.alerts.some((a) => a.code === "combo-duration-too-high" && a.severity === "warning")
		).toBe(true);

		const paralelo: BuildModelInput = {
			taxonomy: { areas: {} },
			lanes: { A: { queue: ["L1"] }, B: { queue: ["L2"] } },
			tasks: [
				{ id: "C", type: "combo", status: "pending", maturity: "ready", duration: 16 },
				{ id: "L1", type: "feat", status: "pending", maturity: "ready", duration: 16, parent: "C" },
				{ id: "L2", type: "feat", status: "pending", maturity: "ready", duration: 16, parent: "C" },
			],
		};
		m = buildModel(paralelo);
		expect(m.alerts.some((a) => a.code === "combo-impossible-duration")).toBe(false);
		expect(m.alerts.some((a) => a.code === "combo-duration-too-high")).toBe(false);
	});

	test("valida maturity y status declarados en COMBO", () => {
		const datos = baseData();
		const h1 = datos.tasks.find((tarea) => tarea.id === "H1");
		if (h1) h1.maturity = "raw";
		let m = buildModel(datos);
		expect(
			m.alerts.some((a) => a.code === "combo-maturity-too-high" && a.params?.derived === "raw")
		).toBe(true);

		if (h1) {
			h1.maturity = "ready";
			h1.status = "done";
		}
		m = buildModel(datos);
		expect(
			m.alerts.some((a) => a.code === "combo-should-be-done" && a.params?.expected === "done")
		).toBe(true);
	});

	test("fixture demo-app: centrado en escala horaria y con alerts next esperadas", () => {
		const m = buildModel(loadDemo());
		expect(m.alerts).toEqual([
			{
				code: "maturity-not-ready-on-next",
				severity: "warning",
				taskId: "TIME-01",
				params: { lane: "B", id: "TIME-01", maturity: "raw" },
			},
			{
				code: "maturity-not-ready-on-next",
				severity: "warning",
				taskId: "TIME-06",
				params: { lane: "C", id: "TIME-06", maturity: "draft" },
			},
		]);
		const leaves = [...m.tasks.values()].filter((task) => !task.isContainer);
		const combos = [...m.tasks.values()].filter((task) => task.isContainer);
		expect(leaves).toHaveLength(16);
		expect(combos.map((task) => task.id).sort()).toEqual([
			"COMBO-BACKLOG",
			"COMBO-MEDIUM",
			"COMBO-SHORT",
			"COMBO-SHORT-LOW",
		]);
		const durations = leaves
			.map((task) => task.durationHours)
			.sort((a, b) => (a ?? 0) - (b ?? 0));
		expect(durations).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
		expect(m.lanes.A.queue).toEqual(["TIME-15", "TIME-13"]);
		expect(m.lanes.B.queue).toEqual([
			"TIME-01",
			"TIME-02",
			"TIME-03",
			"TIME-04",
			"TIME-05",
			"TIME-08",
			"TIME-14",
		]);
		expect(m.lanes.C.queue).toEqual(["TIME-06", "TIME-10", "TIME-07"]);
		expect(m.lanes.D.queue).toEqual(["TIME-12", "TIME-16"]);
		expect(m.tasks.get("TIME-14")?.status).toBe("done");
		expect(m.tasks.get("TIME-16")?.status).toBe("done");
		expect(m.lanes.A.next).toBe("TIME-15");
		expect(m.lanes.B.next).toBe("TIME-01");
		expect(m.lanes.C.next).toBe("TIME-06");
		expect(m.lanes.D.next).toBe("TIME-12");
		expect(m.tasks.get("COMBO-SHORT")?.children).toEqual(["COMBO-SHORT-LOW", "TIME-04", "TIME-05"]);
		expect(m.tasks.get("COMBO-SHORT-LOW")?.children).toEqual(["TIME-01", "TIME-02", "TIME-03"]);
		expect(m.tasks.get("COMBO-BACKLOG")?.children).toEqual(["TIME-11", "TIME-12", "TIME-13", "TIME-14"]);
		expect(m.tasks.get("COMBO-SHORT")?.effectiveHours).toBe(15);
		expect(m.tasks.get("COMBO-MEDIUM")?.effectiveHours).toBe(16);
		expect(m.tasks.get("COMBO-SHORT")?.maturity).toBe("raw");
		expect(m.tasks.get("COMBO-MEDIUM")?.maturity).toBe("draft");
		expect(m.tasks.get("COMBO-BACKLOG")?.maturity).toBe("draft");
		expect(m.tasks.get("TIME-15")?.absorbs).toEqual(["TIME-09"]);
		expect(m.tasks.get("TIME-09")?.absorbedBy).toBe("TIME-15");
		expect(m.tasks.get("TIME-08")?.absorbs).toEqual(["TIME-11"]);
		expect(m.tasks.get("TIME-11")?.absorbedBy).toBe("TIME-08");
	});

	test("fixture demo-app: gates, solapes y absorciones variados", () => {
		const m = buildModel(loadDemo());
		expect(m.crossLaneGates).toEqual([
			{ from: "TIME-06", fromLane: "C", to: "TIME-14", toLane: "B", state: "ready" },
			{ from: "TIME-08", fromLane: "B", to: "TIME-15", toLane: "A", state: "waiting" },
			{ from: "TIME-10", fromLane: "C", to: "TIME-05", toLane: "B", state: "waiting" },
			{ from: "TIME-13", fromLane: "A", to: "TIME-05", toLane: "B", state: "waiting" },
			{ from: "TIME-16", fromLane: "D", to: "TIME-10", toLane: "C", state: "rework" },
		]);
		// TIME-16 -> TIME-14 (ambos done) queda oculto
		expect(
			m.crossLaneGates.some((gate) => gate.from === "TIME-16" && gate.to === "TIME-14")
		).toBe(false);
		expect(m.laneOverlaps).toHaveLength(6);
		expect(m.laneOverlaps).toEqual([
			{ a: "A", b: "B", common: ["checkout"], pct: 25 },
			{ a: "A", b: "C", common: ["checkout", "reporting"], pct: 50 },
			{ a: "A", b: "D", common: ["checkout", "billing", "reporting", "search"], pct: 100 },
			{ a: "B", b: "C", common: ["checkout", "api", "auth"], pct: 75 },
			{ a: "B", b: "D", common: ["checkout"], pct: 25 },
			{ a: "C", b: "D", common: ["checkout", "reporting"], pct: 50 },
		]);
	});
});
