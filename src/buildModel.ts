import {
	ESTADOS,
	MADUREZ,
	TIPOS,
	type Alerta,
	type BuildModelInput,
	type CarrilesInput,
	type CodigoAlerta,
	type EstadoTarea,
	type MadurezTarea,
	type Modelo,
	type RawTarea,
	type Severidad,
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
			foco: carril.foco ?? carril.focus ?? "",
			worktree: carril.worktree ?? "",
			cola: normalizeStringList(carril.cola ?? carril.queue),
		};
	}
	return result;
}

export function buildModel(input: BuildModelInput): Modelo {
	const alertas: Alerta[] = [];
	const alerta = (
		codigo: CodigoAlerta,
		severidad: Severidad,
		params?: Alerta["params"],
		tareaId?: string
	) => {
		alertas.push({ codigo, severidad, params, tareaId });
	};
	const porId = new Map<string, Tarea>();
	const horasPorDia = input.horasPorDia ?? DEFAULT_HORAS_POR_DIA;
	const carriles = normalizeCarriles(input.carriles);

	for (const raw of input.tareas) {
		if (!raw.id) {
			alerta("falta-id", "error", { archivo: raw._archivo || "(tarea sin archivo)" });
			continue;
		}
		if (porId.has(raw.id)) alerta("id-duplicado", "error", { id: raw.id }, raw.id);
		const tarea = createTarea(raw);
		if (tarea) porId.set(tarea.id, tarea);
	}

	const areasValidas = new Set(Object.keys(input.taxonomia.areas || {}));
	const zonasValidas = new Set<string>();
	for (const area of Object.values(input.taxonomia.areas || {})) {
		for (const zona of area.zonas || area.zones || []) zonasValidas.add(zona);
	}

	const existe = (id: string): boolean => porId.has(id);

	for (const t of porId.values()) {
		const raw = input.tareas.find((item) => item.id === t.id);
		if (raw?.tipo && !isTipo(raw.tipo)) alerta("tipo-invalido", "error", { id: t.id, valor: raw.tipo }, t.id);
		if (raw?.madurez && !isMadurez(raw.madurez)) {
			alerta("madurez-invalida", "error", { id: t.id, valor: raw.madurez }, t.id);
		}

		for (const area of t.areas) {
			if (!areasValidas.has(area)) alerta("area-desconocida", "warning", { id: t.id, valor: area }, t.id);
		}
		for (const zona of t.zonas) {
			if (!zonasValidas.has(zona)) alerta("zona-desconocida", "warning", { id: t.id, valor: zona }, t.id);
		}

		if (t.padre && !existe(t.padre)) alerta("padre-inexistente", "error", { id: t.id, ref: t.padre }, t.id);
		for (const d of t.depende_de) {
			if (!existe(d)) alerta("depende-inexistente", "error", { id: t.id, ref: d }, t.id);
		}
		for (const ab of t.absorbe) {
			if (!existe(ab)) alerta("absorbe-inexistente", "error", { id: t.id, ref: ab }, t.id);
		}

		const duracion = parseDuracionHoras(t.duracion, horasPorDia);
		if (duracion.error) alerta("duracion-invalida", "error", { id: t.id, valor: String(t.duracion) }, t.id);
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
			alerta("estado-invalido", "error", { id: t.id, valor: raw.estado }, t.id);
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

	const estaHecho = (t: Tarea): boolean =>
		t.esContenedor
			? t.hijos.length > 0 &&
			  t.hijos.every((h) => {
				  const hijo = porId.get(h);
				  return hijo ? estaHecho(hijo) : false;
			  })
			: t.estado === "hecho";

	const algunaHojaHecha = (t: Tarea, visto = new Set<string>()): boolean => {
		if (visto.has(t.id)) return false;
		visto.add(t.id);
		if (!t.esContenedor) return t.estado === "hecho";
		return t.hijos.some((h) => {
			const hijo = porId.get(h);
			return hijo ? algunaHojaHecha(hijo, visto) : false;
		});
	};

	const collectLeaves = (t: Tarea, visto = new Set<string>()): Tarea[] => {
		if (visto.has(t.id)) return [];
		visto.add(t.id);
		if (!t.esContenedor) return [t];
		return t.hijos.flatMap((h) => {
			const hijo = porId.get(h);
			return hijo ? collectLeaves(hijo, visto) : [];
		});
	};

	const expandQueue = (queue: string[]): string[] => {
		const out: string[] = [];
		const seen = new Set<string>();
		for (const id of queue) {
			const t = porId.get(id);
			if (!t) continue;
			for (const leaf of collectLeaves(t)) {
				if (seen.has(leaf.id)) continue;
				seen.add(leaf.id);
				out.push(leaf.id);
			}
		}
		return out;
	};

	const bloqueoMemo = new Map<string, boolean>();
	const estaBloqueado = (t: Tarea, visto = new Set<string>()): boolean => {
		if (bloqueoMemo.has(t.id)) return bloqueoMemo.get(t.id) ?? false;
		if (visto.has(t.id)) return false;
		visto.add(t.id);
		const bloqueadoPorDependencia = t.depende_de.some((d) => {
			const dep = porId.get(d);
			return !dep || !estaHecho(dep);
		});
		const padre = t.padre ? porId.get(t.padre) : null;
		const bloqueadoPorPadre = padre ? estaBloqueado(padre, visto) : false;
		const bloqueado = bloqueadoPorDependencia || bloqueadoPorPadre;
		bloqueoMemo.set(t.id, bloqueado);
		return bloqueado;
	};

	for (const t of porId.values()) {
		t.bloqueado = estaBloqueado(t);
	}

	for (const [carrilId, c] of Object.entries(carriles)) {
		for (const [i, id] of (c.cola || []).entries()) {
			const t = porId.get(id);
			if (!t) {
				alerta("carril-tarea-inexistente", "error", { carril: carrilId, id });
				continue;
			}
			if (t.esContenedor) {
				if (t.carril) alerta("doble-carril", "error", { id, carrilA: t.carril, carrilB: carrilId }, id);
				t.carril = carrilId;
				t.posicion = i;
			}
			for (const leaf of collectLeaves(t)) {
				if (leaf.carril) {
					alerta("doble-carril", "error", { id: leaf.id, carrilA: leaf.carril, carrilB: carrilId }, leaf.id);
				}
				leaf.carril = carrilId;
				leaf.posicion = i;
			}
		}
	}

	const carrilesModel: Modelo["carriles"] = {};
	for (const [carrilId, c] of Object.entries(carriles)) {
		const cola = expandQueue(c.cola || []);
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

	const esperaMemo = new Map<string, string[]>();
	const esperaDe = (t: Tarea, visto = new Set<string>()): string[] => {
		if (esperaMemo.has(t.id)) return esperaMemo.get(t.id) ?? [];
		if (visto.has(t.id)) return [];
		visto.add(t.id);
		const espera = t.depende_de.filter((d) => {
			const dep = porId.get(d);
			return !dep || !estaHecho(dep);
		});
		const padre = t.padre ? porId.get(t.padre) : null;
		for (const id of padre ? esperaDe(padre, visto) : []) {
			if (!espera.includes(id)) espera.push(id);
		}
		esperaMemo.set(t.id, espera);
		return espera;
	};

	for (const t of porId.values()) {
		t.esperaIds = esperaDe(t);
		if (t.esContenedor) {
			t.estadoVisual = estaHecho(t)
				? "hecho"
				: algunaHojaHecha(t)
					? "en-curso"
					: t.bloqueado
						? "fuera-de-turno"
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
	for (const carrilId of Object.keys(carrilesModel)) {
		const zonas = new Set<string>();
		for (const id of carrilesModel[carrilId].cola) {
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
					abierto: !estaHecho(dep),
				});
			}
		}
	}

	return {
		projectName: input.projectName,
		tareas: porId,
		carriles: carrilesModel,
		taxonomia: input.taxonomia,
		horasPorDia,
		zonasDeCarril,
		solapeCarriles,
		gatesCruzados,
		alertas,
	};
}
