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
			{ id: "T2", type: "feat", status: "pending", duration: 24, depends_on: ["T1"] },
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

	test("fixture demo-app: válido y con derivaciones esperadas", () => {
		const m = buildModel(loadDemo());
		expect(m.alerts).toEqual([]);
		expect(m.tasks.get("DT-020")?.blocked).toBe(false);
		expect(m.tasks.get("FT-002")?.blocked).toBe(false);
		expect(m.lanes.A.next).toBe("FT-002");
		expect(m.lanes.B.next).toBe("DT-011");
		expect(m.tasks.get("EPIC-100")?.effectiveHours).toBe(64);
		expect(m.tasks.get("DT-010")?.effectiveHours).toBe(40);
		expect(m.tasks.get("DT-005")?.absorbedBy).toBe("FT-002");
		expect(m.tasks.get("FT-001")?.unlocks).toContain("FT-002");
	});

	test("fixture demo-app: gates cruzados y solape entre lanes", () => {
		const m = buildModel(loadDemo());
		expect(m.crossLaneGates).toHaveLength(1);
		expect(m.crossLaneGates[0]).toEqual({
			from: "DT-011",
			to: "FT-001",
			fromLane: "B",
			toLane: "A",
			open: false,
		});

		const s = m.laneOverlaps.find((item) => item.a === "A" && item.b === "B");
		expect(s).toBeDefined();
		expect(s?.common).toEqual(["CheckoutService"]);
		expect(s?.pct).toBe(33);
	});
});
