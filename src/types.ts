export const TIPOS = ["FT", "DT", "INFRA", "COMBO"] as const;
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

export type Severidad = "error" | "warning" | "info";

export type CodigoAlerta =
	| "falta-id"
	| "id-duplicado"
	| "tipo-invalido"
	| "madurez-invalida"
	| "estado-invalido"
	| "duracion-invalida"
	| "padre-inexistente"
	| "depende-inexistente"
	| "absorbe-inexistente"
	| "carril-tarea-inexistente"
	| "doble-carril"
	| "area-desconocida"
	| "zona-desconocida"
	| "combo-tipo-faltante"
	| "combo-en-hoja"
	| "combo-duracion-imposible"
	| "combo-duracion-mayor"
	| "combo-duracion-faltante"
	| "combo-madurez-mayor"
	| "combo-madurez-menor"
	| "combo-madurez-faltante"
	| "combo-estado-deberia-hecho"
	| "combo-estado-falso-hecho"
	| "combo-estado-faltante";

export interface Alerta {
	codigo: CodigoAlerta;
	severidad: Severidad;
	tareaId?: string;
	params?: Record<string, string | number | boolean>;
}

export interface RawTarea {
	id?: string;
	titulo?: string;
	tipo?: string;
	madurez?: string;
	estado?: string;
	duracion?: number | string;
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
	zones?: string[];
}

export interface Taxonomia {
	areas?: Record<string, TaxonomiaArea>;
}

export interface CarrilInput {
	foco?: string;
	focus?: string;
	worktree?: string;
	cola?: string[];
	queue?: string[];
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
	projectName?: string;
}

export interface Modelo {
	projectName?: string;
	tareas: Map<string, Tarea>;
	carriles: Record<string, CarrilModel>;
	taxonomia: Taxonomia;
	horasPorDia: number;
	zonasDeCarril: Record<string, string[]>;
	solapeCarriles: SolapeCarriles[];
	gatesCruzados: GateCruzado[];
	alertas: Alerta[];
}
