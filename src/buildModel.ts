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
	duracion: number | string | undefined
): { horas: number | null; invalida: boolean } {
	if (duracion === undefined || duracion === "") return { horas: null, invalida: false };
	if (typeof duracion === "number") {
		return Number.isFinite(duracion) && duracion >= 0
			? { horas: duracion, invalida: false }
			: { horas: null, invalida: true };
	}

	const trimmed = duracion.trim();
	if (trimmed.length === 0) return { horas: null, invalida: false };
	if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return { horas: null, invalida: true };

	const horas = Number(trimmed);
	return Number.isFinite(horas) && horas >= 0
		? { horas, invalida: false }
		: { horas: null, invalida: true };
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
	const rawPorId = new Map<string, RawTarea>();
	const horasPorDia = input.horasPorDia ?? DEFAULT_HORAS_POR_DIA;
	const carriles = normalizeCarriles(input.carriles);

	for (const raw of input.tareas) {
		if (!raw.id) {
			alerta("falta-id", "error", { archivo: raw._archivo || "(tarea sin archivo)" });
			continue;
		}
		if (porId.has(raw.id)) alerta("id-duplicado", "error", { id: raw.id }, raw.id);
		const tarea = createTarea(raw);
		if (tarea) {
			porId.set(tarea.id, tarea);
			rawPorId.set(tarea.id, raw);
		}
	}

	const areasValidas = new Set(Object.keys(input.taxonomia.areas || {}));
	const zonasValidas = new Set<string>();
	for (const area of Object.values(input.taxonomia.areas || {})) {
		for (const zona of area.zonas || area.zones || []) zonasValidas.add(zona);
	}

	const existe = (id: string): boolean => porId.has(id);

	for (const t of porId.values()) {
		const raw = rawPorId.get(t.id);
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

		const duracion = parseDuracionHoras(t.duracion);
		if (duracion.invalida) alerta("duracion-invalida", "error", { id: t.id, valor: String(t.duracion) }, t.id);
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
		const raw = rawPorId.get(t.id);
		if (raw?.estado && !isEstado(raw.estado)) {
			alerta("estado-invalido", "error", { id: t.id, valor: raw.estado }, t.id);
		}
	}

	const horasEfectivas = (id: string, visto = new Set<string>()): number => {
		const t = porId.get(id);
		if (!t) return 0;
		if (visto.has(id)) return 0;
		visto.add(id);
		if (!t.esContenedor) return t.duracionHoras ?? 0;
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

	const minMadurez = (leaves: Tarea[]): MadurezTarea | null => {
		const values = leaves
			.map((leaf) => leaf.madurez)
			.filter((value): value is MadurezTarea => value !== undefined);
		if (values.length === 0) return null;
		return values.reduce((min, value) =>
			MADUREZ.indexOf(value) < MADUREZ.indexOf(min) ? value : min
		);
	};

	const duracionCombo = (leaves: Tarea[]): { suma: number; cota: number } => {
		const suma = leaves.reduce((sum, leaf) => sum + leaf.horasEfectivas, 0);
		const tareaMasLarga = leaves.reduce(
			(max, leaf) => Math.max(max, leaf.horasEfectivas),
			0
		);
		const porCarril = new Map<string, number>();
		for (const leaf of leaves) {
			if (!leaf.carril) continue;
			porCarril.set(leaf.carril, (porCarril.get(leaf.carril) ?? 0) + leaf.horasEfectivas);
		}
		const carrilMasCargado = [...porCarril.values()].reduce(
			(max, horas) => Math.max(max, horas),
			0
		);
		return { suma, cota: Math.max(tareaMasLarga, carrilMasCargado) };
	};

	for (const t of porId.values()) {
		const raw = rawPorId.get(t.id);
		if (!t.esContenedor) {
			if (raw?.tipo === "COMBO") alerta("combo-en-hoja", "warning", { id: t.id }, t.id);
			continue;
		}

		const leaves = collectLeaves(t);
		if (raw?.tipo !== "COMBO") alerta("combo-tipo-faltante", "warning", { id: t.id }, t.id);

		const { suma, cota } = duracionCombo(leaves);
		if (t.duracionHoras === null) {
			alerta("combo-duracion-faltante", "warning", { id: t.id, suma }, t.id);
		} else if (t.duracionHoras < cota) {
			alerta(
				"combo-duracion-imposible",
				"error",
				{ id: t.id, declarada: t.duracionHoras, cota },
				t.id
			);
		} else if (t.duracionHoras > suma) {
			alerta(
				"combo-duracion-mayor",
				"warning",
				{ id: t.id, declarada: t.duracionHoras, suma },
				t.id
			);
		}

		const derivadaMadurez = minMadurez(leaves);
		if (derivadaMadurez) {
			if (!raw?.madurez) {
				alerta("combo-madurez-faltante", "info", { id: t.id, derivada: derivadaMadurez }, t.id);
			} else if (t.madurez) {
				const declaradaRank = MADUREZ.indexOf(t.madurez);
				const derivadaRank = MADUREZ.indexOf(derivadaMadurez);
				if (declaradaRank > derivadaRank) {
					alerta(
						"combo-madurez-mayor",
						"warning",
						{ id: t.id, declarada: t.madurez, derivada: derivadaMadurez },
						t.id
					);
				} else if (declaradaRank < derivadaRank) {
					alerta(
						"combo-madurez-menor",
						"info",
						{ id: t.id, declarada: t.madurez, derivada: derivadaMadurez },
						t.id
					);
				}
			}
		}

		const esperado = estaHecho(t) ? "hecho" : "pendiente";
		if (!raw?.estado) {
			alerta("combo-estado-faltante", "info", { id: t.id, esperado }, t.id);
		} else if (t.estado) {
			if (t.estado === "hecho" && esperado !== "hecho") {
				alerta(
					"combo-estado-falso-hecho",
					"warning",
					{ id: t.id, declarado: t.estado, esperado },
					t.id
				);
			} else if (t.estado !== "hecho" && esperado === "hecho") {
				alerta(
					"combo-estado-deberia-hecho",
					"warning",
					{ id: t.id, declarado: t.estado, esperado },
					t.id
				);
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
