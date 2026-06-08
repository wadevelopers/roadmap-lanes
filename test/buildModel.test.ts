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
				duracion: "2d",
				areas: ["back"],
				zonas: ["Z1"],
			},
			{ id: "T2", tipo: "FT", estado: "pendiente", duracion: "3d", depende_de: ["T1"] },
			{ id: "T3", tipo: "DT", estado: "pendiente", duracion: "4h", depende_de: ["T2"] },
			{ id: "E", tipo: "FT" },
			{ id: "H1", tipo: "FT", estado: "pendiente", duracion: "2d", padre: "E" },
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

function loadDemo(): BuildModelInput {
	const dir = join(process.cwd(), "examples", "demo-app");
	const tareasDir = join(dir, "tareas");
	const tareas = readdirSync(tareasDir)
		.filter((file) => file.endsWith(".md"))
		.sort()
		.map((file): RawTarea => {
			const { fm, body } = splitFrontmatter(readFileSync(join(tareasDir, file), "utf8"), file);
			const data = (yaml.load(fm) as Record<string, unknown> | undefined) || {};
			return {
				...data,
				padre: normalizeRelation(data.padre)[0] || null,
				absorbe: normalizeRelation(data.absorbe),
				depende_de: normalizeRelation(data.depende_de),
				cuerpo: body,
				_archivo: `tareas/${file}`,
			};
		});

	const taxonomia = yaml.load(readFileSync(join(dir, "taxonomia.yaml"), "utf8"));
	const carrilesYaml = yaml.load(readFileSync(join(dir, "carriles.yaml"), "utf8")) as {
		carriles?: BuildModelInput["carriles"];
	};

	return {
		tareas,
		taxonomia: (taxonomia as BuildModelInput["taxonomia"]) || { areas: {} },
		carriles: carrilesYaml.carriles || {},
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

	test("detecta tipo inválido y referencia inexistente", () => {
		const datos = datosBase();
		datos.tareas.push({ id: "X", tipo: "NOPE", depende_de: ["FANTASMA"] });
		const m = buildModel(datos);
		expect(m.errores.some((error) => error.includes("tipo inválido 'NOPE'"))).toBe(true);
		expect(m.errores.some((error) => error.includes("depende_de inexistente 'FANTASMA'"))).toBe(true);
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
		datos.tareas.push({ id: "H2", tipo: "FT", estado: "pendiente", duracion: "1d", padre: "E" });
		const m = buildModel(datos);
		expect(m.tareas.get("E")?.estadoVisual).toBe("en-curso");
	});

	test("rechaza estado en-curso escrito en una hoja", () => {
		const datos = datosBase();
		datos.tareas.push({ id: "X", tipo: "FT", estado: "en-curso" });
		const m = buildModel(datos);
		expect(m.errores.some((error) => error.includes("estado inválido 'en-curso'"))).toBe(true);
	});

	test("rechaza duracion sin unidad", () => {
		const datos = datosBase();
		datos.tareas.push({ id: "X", tipo: "FT", estado: "pendiente", duracion: "2" });
		const m = buildModel(datos);
		expect(m.errores.some((error) => error.includes("duracion inválida '2'"))).toBe(true);
	});

	test("fixture demo-app: válido y con derivaciones esperadas", () => {
		const m = buildModel(loadDemo());
		expect(m.errores).toEqual([]);
		expect(m.tareas.get("DT-020")?.bloqueado).toBe(true);
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
			de: "DT-020",
			aQue: "FT-002",
			carrilDe: "B",
			carrilA: "A",
			abierto: true,
		});

		const s = m.solapeCarriles.find((item) => item.a === "A" && item.b === "B");
		expect(s).toBeDefined();
		expect(s?.comunes).toEqual(["CheckoutService"]);
		expect(s?.pct).toBe(50);
	});
});
