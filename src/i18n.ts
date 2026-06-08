import { getLanguage } from "obsidian";

const STRINGS = {
	en: {
		openCommand: "Open roadmap lanes board",
		openRibbon: "Open Roadmap Lanes",
		loading: "Loading Roadmap Lanes...",
		errorTitle: "Model errors",
		summary: "Summary",
		tasks: "Tasks",
		lanes: "Lanes",
		overlap: "Lane overlap",
		gates: "Cross-lane gates",
		noOverlap: "No overlap detected.",
		noGates: "No cross-lane gates.",
		next: "Next",
		backlog: "backlog",
		done: "done",
		status: "status",
		lane: "lane",
		waitingFor: "waiting for",
		hours: "h",
		taskCount: "tasks",
	},
	es: {
		openCommand: "Abrir tablero de carriles",
		openRibbon: "Abrir Roadmap Lanes",
		loading: "Cargando Roadmap Lanes...",
		errorTitle: "Errores del modelo",
		summary: "Resumen",
		tasks: "Tareas",
		lanes: "Carriles",
		overlap: "Solape entre carriles",
		gates: "Gates cruzados",
		noOverlap: "No se detectó solape.",
		noGates: "No hay gates cruzados.",
		next: "Próxima",
		backlog: "backlog",
		done: "hecho",
		status: "estado",
		lane: "carril",
		waitingFor: "espera",
		hours: "h",
		taskCount: "tareas",
	},
};

export type TranslationKey = keyof typeof STRINGS.en;
export type Translator = (key: TranslationKey) => string;

export function createTranslator(language = getLanguage()): Translator {
	const table = language.toLowerCase().startsWith("es") ? STRINGS.es : STRINGS.en;
	return (key) => table[key] ?? STRINGS.en[key];
}
