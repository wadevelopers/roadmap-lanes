import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";

import { buildModel } from "../src/buildModel";
import type { BuildModelInput, RawTarea } from "../src/types";

function datosBase(): BuildModelInput {
	return {
		taxonomia: { areas: { back: { zonas: ["Z1"] } } },
		carriles: { A: { foco: "", worktree: "", cola: ["T1", "T2"] } },
		tareas: [
			{
				id: "T1",
				tipo: "FT",
				estado: "hecho",
				duracion: 16,
				areas: ["back"],
				zonas: ["Z1"],
			},
			{ id: "T2", tipo: "FT", estado: "pendiente", duracion: 24, depende_de: ["T1"] },
			{ id: "T3", tipo: "DT", estado: "pendiente", duracion: 4, depende_de: ["T2"] },
			{ id: "E", tipo: "COMBO", estado: "pendiente", madurez: "ejecutable", duracion: 16 },
			{
				id: "H1",
				tipo: "FT",
				estado: "pendiente",
				madurez: "ejecutable",
				duracion: 16,
				padre: "E",
			},
		],
		horasPorDia: 8,
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
	const tareas = listMarkdownFiles(roadmapDir)
		.sort()
		.map((file): RawTarea => {
			const { fm, body } = splitFrontmatter(readFileSync(join(roadmapDir, file), "utf8"), file);
			const data = (yaml.load(fm) as Record<string, unknown> | undefined) || {};
			return {
				...data,
				padre: normalizeRelation(data.padre)[0] || null,
				absorbe: normalizeRelation(data.absorbe),
				depende_de: normalizeRelation(data.depende_de),
				cuerpo: body,
				_archivo: `roadmap/${file}`,
			};
		});

	const taxonomia = yaml.load(readFileSync(join(roadmapDir, "taxonomy.yaml"), "utf8"));
	const lanesYaml = yaml.load(readFileSync(join(roadmapDir, "lanes.yaml"), "utf8")) as {
		lanes?: BuildModelInput["carriles"];
		carriles?: BuildModelInput["carriles"];
	};

	return {
		tareas,
		taxonomia: (taxonomia as BuildModelInput["taxonomia"]) || { areas: {} },
		carriles: lanesYaml.lanes || lanesYaml.carriles || {},
		horasPorDia: 8,
	};
}

describe("buildModel", () => {
	test("una dependencia hecha no bloquea; una pendiente sí", () => {
		const m = buildModel(datosBase());
		expect(m.tareas.get("T2")?.bloqueado).toBe(false);
		expect(m.tareas.get("T3")?.bloqueado).toBe(true);
	});

	test("desbloquea es la inversa de depende_de", () => {
		const m = buildModel(datosBase());
		expect(m.tareas.get("T1")?.desbloquea).toEqual(["T2"]);
		expect(m.tareas.get("T2")?.desbloquea).toEqual(["T3"]);
	});

	test("proximo del carril = primera tarea libre", () => {
		const m = buildModel(datosBase());
		expect(m.carriles.A.proximo).toBe("T2");
	});

	test("contenedor: hijos, esContenedor y horas derivadas de hijos", () => {
		const m = buildModel(datosBase());
		const e = m.tareas.get("E");
		expect(e?.hijos).toEqual(["H1"]);
		expect(e?.esContenedor).toBe(true);
		expect(e?.horasEfectivas).toBe(16);
	});

	test("un contenedor en la cola se expande a sus hojas ejecutables", () => {
		const datos = datosBase();
		datos.carriles.A.cola = ["E"];
		const m = buildModel(datos);
		expect(m.carriles.A.cola).toEqual(["H1"]);
		expect(m.carriles.A.proximo).toBe("H1");
		expect(m.tareas.get("E")?.carril).toBe("A");
		expect(m.tareas.get("H1")?.carril).toBe("A");
	});

	test("detecta tipo inválido y referencia inexistente", () => {
		const datos = datosBase();
		datos.tareas.push({ id: "X", tipo: "NOPE", depende_de: ["FANTASMA"] });
		const m = buildModel(datos);
		expect(m.alertas.some((a) => a.codigo === "tipo-invalido" && a.params?.valor === "NOPE")).toBe(true);
		expect(
			m.alertas.some((a) => a.codigo === "depende-inexistente" && a.params?.ref === "FANTASMA")
		).toBe(true);
	});

	test("estado visual derivado: hoja y contenedor", () => {
		const m = buildModel(datosBase());
		expect(m.tareas.get("T1")?.estadoVisual).toBe("hecho");
		expect(m.tareas.get("T2")?.estadoVisual).toBe("proximo");
		expect(m.tareas.get("T3")?.estadoVisual).toBe("fuera-de-turno");
		expect(m.tareas.get("T3")?.esperaIds).toEqual(["T2"]);
		expect(m.tareas.get("E")?.estadoVisual).toBe("en-espera");
		expect(m.tareas.get("H1")?.estadoVisual).toBe("en-espera");
	});

	test("contenedor en-curso = algunos hijos hechos pero no todos", () => {
		const datos = datosBase();
		const h1 = datos.tareas.find((tarea) => tarea.id === "H1");
		if (h1) h1.estado = "hecho";
		datos.tareas.push({
			id: "H2",
			tipo: "FT",
			estado: "pendiente",
			madurez: "ejecutable",
			duracion: 8,
			padre: "E",
		});
		const m = buildModel(datos);
		expect(m.tareas.get("E")?.estadoVisual).toBe("en-curso");
	});

	test("en-curso se propaga por combos anidados", () => {
		const datos = datosBase();
		datos.tareas.push({ id: "GC", tipo: "COMBO", estado: "pendiente", madurez: "ejecutable", duracion: 16 });
		datos.tareas.push({ id: "MID", tipo: "COMBO", estado: "pendiente", madurez: "ejecutable", duracion: 16, padre: "GC" });
		datos.tareas.push({ id: "L1", tipo: "FT", estado: "hecho", madurez: "ejecutable", duracion: 8, padre: "MID" });
		datos.tareas.push({ id: "L2", tipo: "FT", estado: "pendiente", madurez: "ejecutable", duracion: 8, padre: "MID" });
		const m = buildModel(datos);
		expect(m.tareas.get("MID")?.estadoVisual).toBe("en-curso");
		expect(m.tareas.get("GC")?.estadoVisual).toBe("en-curso");
	});

	test("una dependencia contra contenedor espera a que todos sus hijos estén hechos", () => {
		const datos = datosBase();
		datos.carriles.A.cola = ["T4"];
		datos.tareas.push({ id: "T4", tipo: "FT", estado: "pendiente", duracion: 8, depende_de: ["E"] });
		datos.tareas.push({ id: "C2", tipo: "COMBO", estado: "pendiente", duracion: 8, depende_de: ["E"] });
		datos.tareas.push({ id: "C2-H1", tipo: "DT", estado: "pendiente", duracion: 8, padre: "C2" });
		let m = buildModel(datos);
		expect(m.tareas.get("T4")?.bloqueado).toBe(true);
		expect(m.tareas.get("T4")?.esperaIds).toEqual(["E"]);
		expect(m.tareas.get("C2")?.estadoVisual).toBe("fuera-de-turno");
		expect(m.tareas.get("C2-H1")?.bloqueado).toBe(true);
		expect(m.tareas.get("C2-H1")?.esperaIds).toEqual(["E"]);

		const h1 = datos.tareas.find((tarea) => tarea.id === "H1");
		if (h1) h1.estado = "hecho";
		m = buildModel(datos);
		expect(m.tareas.get("T4")?.bloqueado).toBe(false);
		expect(m.tareas.get("T4")?.esperaIds).toEqual([]);
		expect(m.tareas.get("C2")?.estadoVisual).toBe("en-espera");
		expect(m.tareas.get("C2-H1")?.bloqueado).toBe(false);
	});

	test("rechaza estado en-curso escrito en una hoja", () => {
		const datos = datosBase();
		datos.tareas.push({ id: "X", tipo: "FT", estado: "en-curso" });
		const m = buildModel(datos);
		expect(
			m.alertas.some((a) => a.codigo === "estado-invalido" && a.params?.valor === "en-curso")
		).toBe(true);
	});

	test("acepta duracion numérica y rechaza con sufijo", () => {
		const datos = datosBase();
		datos.tareas.push({ id: "X", tipo: "FT", estado: "pendiente", duracion: 16 });
		datos.tareas.push({ id: "Y", tipo: "FT", estado: "pendiente", duracion: "2d" });
		const m = buildModel(datos);
		expect(m.alertas.some((a) => a.codigo === "duracion-invalida" && a.params?.id === "X")).toBe(false);
		expect(
			m.alertas.some((a) => a.codigo === "duracion-invalida" && a.params?.valor === "2d")
		).toBe(true);
	});

	test("severidad: referencias rotas = error, taxonomía desconocida = warning", () => {
		const datos = datosBase();
		datos.tareas.push({
			id: "X",
			tipo: "FT",
			estado: "pendiente",
			duracion: 8,
			padre: "FANTASMA",
			areas: ["inexistente"],
			zonas: ["ZX"],
		});
		const m = buildModel(datos);
		const sev = (codigo: string) => m.alertas.find((a) => a.codigo === codigo)?.severidad;
		expect(sev("padre-inexistente")).toBe("error");
		expect(sev("area-desconocida")).toBe("warning");
		expect(sev("zona-desconocida")).toBe("warning");
	});

	test("valida contrato COMBO básico", () => {
		const datos = datosBase();
		const e = datos.tareas.find((tarea) => tarea.id === "E");
		const h1 = datos.tareas.find((tarea) => tarea.id === "H1");
		if (e) e.tipo = "FT";
		if (h1) h1.tipo = "COMBO";
		const m = buildModel(datos);

		expect(m.alertas.some((a) => a.codigo === "combo-tipo-faltante" && a.tareaId === "E")).toBe(true);
		expect(m.alertas.some((a) => a.codigo === "combo-en-hoja" && a.tareaId === "H1")).toBe(true);
	});

	test("valida duración de COMBO con cota física y paralelismo", () => {
		const imposible = datosBase();
		const e = imposible.tareas.find((tarea) => tarea.id === "E");
		if (e) e.duracion = 8;
		let m = buildModel(imposible);
		expect(
			m.alertas.some((a) => a.codigo === "combo-duracion-imposible" && a.severidad === "error")
		).toBe(true);

		const mayor = datosBase();
		const eMayor = mayor.tareas.find((tarea) => tarea.id === "E");
		if (eMayor) eMayor.duracion = 24;
		m = buildModel(mayor);
		expect(
			m.alertas.some((a) => a.codigo === "combo-duracion-mayor" && a.severidad === "warning")
		).toBe(true);

		const paralelo: BuildModelInput = {
			taxonomia: { areas: {} },
			carriles: { A: { cola: ["L1"] }, B: { cola: ["L2"] } },
			tareas: [
				{ id: "C", tipo: "COMBO", estado: "pendiente", madurez: "ejecutable", duracion: 16 },
				{ id: "L1", tipo: "FT", estado: "pendiente", madurez: "ejecutable", duracion: 16, padre: "C" },
				{ id: "L2", tipo: "FT", estado: "pendiente", madurez: "ejecutable", duracion: 16, padre: "C" },
			],
		};
		m = buildModel(paralelo);
		expect(m.alertas.some((a) => a.codigo === "combo-duracion-imposible")).toBe(false);
		expect(m.alertas.some((a) => a.codigo === "combo-duracion-mayor")).toBe(false);
	});

	test("valida madurez y estado declarados en COMBO", () => {
		const datos = datosBase();
		const h1 = datos.tareas.find((tarea) => tarea.id === "H1");
		if (h1) h1.madurez = "nota";
		let m = buildModel(datos);
		expect(
			m.alertas.some((a) => a.codigo === "combo-madurez-mayor" && a.params?.derivada === "nota")
		).toBe(true);

		if (h1) {
			h1.madurez = "ejecutable";
			h1.estado = "hecho";
		}
		m = buildModel(datos);
		expect(
			m.alertas.some((a) => a.codigo === "combo-estado-deberia-hecho" && a.params?.esperado === "hecho")
		).toBe(true);
	});

	test("fixture demo-app: válido y con derivaciones esperadas", () => {
		const m = buildModel(loadDemo());
		expect(m.alertas).toEqual([]);
		expect(m.tareas.get("DT-020")?.bloqueado).toBe(false);
		expect(m.tareas.get("FT-002")?.bloqueado).toBe(false);
		expect(m.carriles.A.proximo).toBe("FT-002");
		expect(m.carriles.B.proximo).toBe("DT-011");
		expect(m.tareas.get("EPIC-100")?.horasEfectivas).toBe(64);
		expect(m.tareas.get("DT-010")?.horasEfectivas).toBe(40);
		expect(m.tareas.get("DT-005")?.absorbidaPor).toBe("FT-002");
		expect(m.tareas.get("FT-001")?.desbloquea).toContain("FT-002");
	});

	test("fixture demo-app: gates cruzados y solape entre carriles", () => {
		const m = buildModel(loadDemo());
		expect(m.gatesCruzados).toHaveLength(1);
		expect(m.gatesCruzados[0]).toEqual({
			de: "DT-011",
			aQue: "FT-001",
			carrilDe: "B",
			carrilA: "A",
			abierto: false,
		});

		const s = m.solapeCarriles.find((item) => item.a === "A" && item.b === "B");
		expect(s).toBeDefined();
		expect(s?.comunes).toEqual(["CheckoutService"]);
		expect(s?.pct).toBe(33);
	});
});
