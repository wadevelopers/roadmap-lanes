export const TIPOS = ["FT", "DT", "INFRA"] as const;
export const MADUREZ = ["nota", "esqueleto", "ejecutable"] as const;
export const ESTADOS = ["pendiente", "hecho"] as const;
export const ESTADOS_VISUALES = [
	"hecho",
	"fuera-de-turno",
	"proximo",
	"en-espera",
	"en-curso",
] as const;

export type TipoTarea = (typeof TIPOS)[number];
export type MadurezTarea = (typeof MADUREZ)[number];
export type EstadoTarea = (typeof ESTADOS)[number];
export type EstadoVisual = (typeof ESTADOS_VISUALES)[number];

export interface RawTarea {
	id?: string;
	titulo?: string;
	tipo?: string;
	madurez?: string;
	estado?: string;
	duracion?: string;
	areas?: string[];
	zonas?: string[];
	padre?: string | null;
	absorbe?: string[];
	depende_de?: string[];
	cuerpo?: string;
	_archivo?: string;
}

export interface Tarea extends RawTarea {
	id: string;
	titulo: string;
	tipo?: TipoTarea;
	madurez?: MadurezTarea;
	estado?: EstadoTarea;
	areas: string[];
	zonas: string[];
	padre: string | null;
	absorbe: string[];
	depende_de: string[];
	hijos: string[];
	desbloquea: string[];
	absorbidaPor: string | null;
	esContenedor: boolean;
	duracionHoras: number | null;
	horasEfectivas: number;
	bloqueado: boolean;
	estadoVisual: EstadoVisual;
	esperaIds: string[];
	carril: string | null;
	posicion: number | null;
}

export interface TaxonomiaArea {
	zonas?: string[];
}

export interface Taxonomia {
	areas?: Record<string, TaxonomiaArea>;
}

export interface CarrilInput {
	foco?: string;
	worktree?: string;
	cola?: string[];
}

export type CarrilesInput = Record<string, CarrilInput>;

export interface CarrilModel {
	foco: string;
	worktree: string;
	cola: string[];
	proximo: string | null;
}

export interface SolapeCarriles {
	a: string;
	b: string;
	comunes: string[];
	pct: number;
}

export interface GateCruzado {
	de: string;
	carrilDe: string;
	aQue: string;
	carrilA: string;
	abierto: boolean;
}

export interface BuildModelInput {
	tareas: RawTarea[];
	taxonomia: Taxonomia;
	carriles: CarrilesInput;
	horasPorDia?: number;
}

export interface Modelo {
	tareas: Map<string, Tarea>;
	carriles: Record<string, CarrilModel>;
	taxonomia: Taxonomia;
	horasPorDia: number;
	zonasDeCarril: Record<string, string[]>;
	solapeCarriles: SolapeCarriles[];
	gatesCruzados: GateCruzado[];
	errores: string[];
}
