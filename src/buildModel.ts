import {
	ESTADOS,
	MADUREZ,
	TIPOS,
	type BuildModelInput,
	type CarrilesInput,
	type EstadoTarea,
	type MadurezTarea,
	type Modelo,
	type RawTarea,
	type Tarea,
	type TipoTarea,
} from "./types";

const DEFAULT_HORAS_POR_DIA = 8;

function isTipo(value: unknown): value is TipoTarea {
	return typeof value === "string" && TIPOS.includes(value as TipoTarea);
}

function isMadurez(value: unknown): value is MadurezTarea {
	return typeof value === "string" && MADUREZ.includes(value as MadurezTarea);
}

function isEstado(value: unknown): value is EstadoTarea {
	return typeof value === "string" && ESTADOS.includes(value as EstadoTarea);
}

function normalizeStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function normalizePadre(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

export function parseDuracionHoras(
	duracion: string | undefined,
	horasPorDia = DEFAULT_HORAS_POR_DIA
): { horas: number | null; error: string | null } {
	if (!duracion) return { horas: null, error: null };
	const match = duracion.trim().match(/^(\d+(?:\.\d+)?)([dh])$/);
	if (!match) return { horas: null, error: `duracion inválida '${duracion}'` };

	const cantidad = Number(match[1]);
	if (!Number.isFinite(cantidad) || cantidad < 0) {
		return { horas: null, error: `duracion inválida '${duracion}'` };
	}

	return { horas: match[2] === "d" ? cantidad * horasPorDia : cantidad, error: null };
}

function createTarea(raw: RawTarea): Tarea | null {
	if (!raw.id) return null;
	return {
		...raw,
		id: raw.id,
		titulo: raw.titulo ?? raw.id,
		tipo: isTipo(raw.tipo) ? raw.tipo : undefined,
		madurez: isMadurez(raw.madurez) ? raw.madurez : undefined,
		estado: isEstado(raw.estado) ? raw.estado : undefined,
		areas: normalizeStringList(raw.areas),
		zonas: normalizeStringList(raw.zonas),
		padre: normalizePadre(raw.padre),
		absorbe: normalizeStringList(raw.absorbe),
		depende_de: normalizeStringList(raw.depende_de),
		hijos: [],
		desbloquea: [],
		absorbidaPor: null,
		esContenedor: false,
		duracionHoras: null,
		horasEfectivas: 0,
		bloqueado: false,
		estadoVisual: "en-espera",
		esperaIds: [],
		carril: null,
		posicion: null,
	};
}

function normalizeCarriles(carriles: CarrilesInput): CarrilesInput {
	const result: CarrilesInput = {};
	for (const [id, carril] of Object.entries(carriles)) {
		result[id] = {
			foco: carril.foco ?? "",
			worktree: carril.worktree ?? "",
			cola: normalizeStringList(carril.cola),
		};
	}
	return result;
}

export function buildModel(input: BuildModelInput): Modelo {
	const errores: string[] = [];
	const porId = new Map<string, Tarea>();
	const horasPorDia = input.horasPorDia ?? DEFAULT_HORAS_POR_DIA;
	const carriles = normalizeCarriles(input.carriles);

	for (const raw of input.tareas) {
		if (!raw.id) {
			errores.push(`${raw._archivo || "(tarea sin archivo)"}: falta 'id'`);
			continue;
		}
		if (porId.has(raw.id)) errores.push(`id duplicado: ${raw.id}`);
		const tarea = createTarea(raw);
		if (tarea) porId.set(tarea.id, tarea);
	}

	const areasValidas = new Set(Object.keys(input.taxonomia.areas || {}));
	const zonasValidas = new Set<string>();
	for (const area of Object.values(input.taxonomia.areas || {})) {
		for (const zona of area.zonas || []) zonasValidas.add(zona);
	}

	const existe = (id: string): boolean => porId.has(id);

	for (const t of porId.values()) {
		const raw = input.tareas.find((item) => item.id === t.id);
		if (raw?.tipo && !isTipo(raw.tipo)) errores.push(`${t.id}: tipo inválido '${raw.tipo}'`);
		if (raw?.madurez && !isMadurez(raw.madurez)) {
			errores.push(`${t.id}: madurez inválida '${raw.madurez}'`);
		}

		for (const area of t.areas) {
			if (!areasValidas.has(area)) errores.push(`${t.id}: área desconocida '${area}'`);
		}
		for (const zona of t.zonas) {
			if (!zonasValidas.has(zona)) errores.push(`${t.id}: zona desconocida '${zona}'`);
		}

		if (t.padre && !existe(t.padre)) errores.push(`${t.id}: padre inexistente '${t.padre}'`);
		for (const d of t.depende_de) {
			if (!existe(d)) errores.push(`${t.id}: depende_de inexistente '${d}'`);
		}
		for (const ab of t.absorbe) {
			if (!existe(ab)) errores.push(`${t.id}: absorbe inexistente '${ab}'`);
		}

		const duracion = parseDuracionHoras(t.duracion, horasPorDia);
		if (duracion.error) errores.push(`${t.id}: ${duracion.error}`);
		t.duracionHoras = duracion.horas;
	}

	for (const t of porId.values()) {
		if (t.padre && porId.has(t.padre)) porId.get(t.padre)?.hijos.push(t.id);
		for (const d of t.depende_de) {
			if (porId.has(d)) porId.get(d)?.desbloquea.push(t.id);
		}
	}

	const absorbidaPor = new Map<string, string>();
	for (const t of porId.values()) {
		for (const ab of t.absorbe) {
			if (porId.has(ab)) absorbidaPor.set(ab, t.id);
		}
	}

	for (const t of porId.values()) {
		t.absorbidaPor = absorbidaPor.get(t.id) || null;
		t.esContenedor = t.hijos.length > 0;
		const raw = input.tareas.find((item) => item.id === t.id);
		if (!t.esContenedor && raw?.estado && !isEstado(raw.estado)) {
			errores.push(`${t.id}: estado inválido '${raw.estado}' (sólo pendiente | hecho)`);
		}
	}

	const horasEfectivas = (id: string, visto = new Set<string>()): number => {
		const t = porId.get(id);
		if (!t) return 0;
		if (t.duracionHoras != null) return t.duracionHoras;
		if (visto.has(id)) return 0;
		visto.add(id);
		return t.hijos.reduce((sum, h) => sum + horasEfectivas(h, visto), 0);
	};
	for (const t of porId.values()) t.horasEfectivas = horasEfectivas(t.id);

	for (const t of porId.values()) {
		t.bloqueado = t.depende_de.some((d) => {
			const dep = porId.get(d);
			return !dep || dep.estado !== "hecho";
		});
	}

	for (const [carrilId, c] of Object.entries(carriles)) {
		for (const [i, id] of (c.cola || []).entries()) {
			const t = porId.get(id);
			if (!t) {
				errores.push(`carril ${carrilId}: tarea inexistente '${id}' en la cola`);
				continue;
			}
			if (t.carril) errores.push(`${id}: aparece en dos carriles (${t.carril} y ${carrilId})`);
			t.carril = carrilId;
			t.posicion = i;
		}
	}

	const carrilesModel: Modelo["carriles"] = {};
	for (const [carrilId, c] of Object.entries(carriles)) {
		const cola = (c.cola || []).filter((id) => porId.has(id));
		const proximo = cola.find((id) => {
			const t = porId.get(id);
			return t !== undefined && t.estado !== "hecho" && !t.bloqueado;
		});
		carrilesModel[carrilId] = {
			foco: c.foco || "",
			worktree: c.worktree || "",
			cola,
			proximo: proximo || null,
		};
	}

	const proximoDe = new Set<string>();
	for (const c of Object.values(carrilesModel)) {
		if (c.proximo) proximoDe.add(c.proximo);
	}

	const estaHecho = (t: Tarea): boolean =>
		t.esContenedor
			? t.hijos.length > 0 &&
			  t.hijos.every((h) => {
				  const hijo = porId.get(h);
				  return hijo ? estaHecho(hijo) : false;
			  })
			: t.estado === "hecho";

	for (const t of porId.values()) {
		t.esperaIds = t.depende_de.filter((d) => {
			const dep = porId.get(d);
			return !dep || dep.estado !== "hecho";
		});

		if (t.esContenedor) {
			const hijos = t.hijos.map((h) => porId.get(h)).filter((h): h is Tarea => h !== undefined);
			const hechos = hijos.filter((h) => estaHecho(h)).length;
			t.estadoVisual =
				hijos.length > 0 && hechos === hijos.length
					? "hecho"
					: hechos > 0
						? "en-curso"
						: "en-espera";
		} else if (t.estado === "hecho") {
			t.estadoVisual = "hecho";
		} else if (t.bloqueado) {
			t.estadoVisual = "fuera-de-turno";
		} else if (proximoDe.has(t.id)) {
			t.estadoVisual = "proximo";
		} else {
			t.estadoVisual = "en-espera";
		}
	}

	const zonasDeCarril: Record<string, string[]> = {};
	for (const carrilId of Object.keys(carriles)) {
		const zonas = new Set<string>();
		for (const id of carriles[carrilId].cola || []) {
			const t = porId.get(id);
			if (t && t.estado !== "hecho") {
				for (const zona of t.zonas) zonas.add(zona);
			}
		}
		zonasDeCarril[carrilId] = [...zonas];
	}

	const idsCarriles = Object.keys(carriles);
	const solapeCarriles: Modelo["solapeCarriles"] = [];
	for (let i = 0; i < idsCarriles.length; i++) {
		for (let j = i + 1; j < idsCarriles.length; j++) {
			const aId = idsCarriles[i];
			const bId = idsCarriles[j];
			const a = new Set(zonasDeCarril[aId]);
			const b = new Set(zonasDeCarril[bId]);
			const comunes = [...a].filter((zona) => b.has(zona));
			const minTam = Math.min(a.size, b.size) || 1;
			solapeCarriles.push({
				a: aId,
				b: bId,
				comunes,
				pct: Math.round((comunes.length / minTam) * 100),
			});
		}
	}

	const gatesCruzados: Modelo["gatesCruzados"] = [];
	for (const t of porId.values()) {
		for (const d of t.depende_de) {
			const dep = porId.get(d);
			if (dep && t.carril && dep.carril && t.carril !== dep.carril) {
				gatesCruzados.push({
					de: t.id,
					carrilDe: t.carril,
					aQue: d,
					carrilA: dep.carril,
					abierto: dep.estado !== "hecho",
				});
			}
		}
	}

	return {
		tareas: porId,
		carriles: carrilesModel,
		taxonomia: input.taxonomia,
		horasPorDia,
		zonasDeCarril,
		solapeCarriles,
		gatesCruzados,
		errores,
	};
}
