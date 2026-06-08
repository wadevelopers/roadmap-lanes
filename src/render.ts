import type { Modelo, Tarea } from "./types";
import type { Translator } from "./i18n";

function formatHours(hours: number): string {
	return Number.isInteger(hours) ? `${hours}` : `${hours.toFixed(1)}`;
}

function sortedTasks(modelo: Modelo): Tarea[] {
	return [...modelo.tareas.values()].sort((a, b) => {
		if (a.carril && b.carril && a.carril !== b.carril) return a.carril.localeCompare(b.carril);
		if (a.carril && b.carril && a.posicion !== b.posicion) {
			return (a.posicion ?? 0) - (b.posicion ?? 0);
		}
		if (a.carril && !b.carril) return -1;
		if (!a.carril && b.carril) return 1;
		return a.id.localeCompare(b.id);
	});
}

function renderErrors(root: HTMLElement, modelo: Modelo, t: Translator): void {
	if (modelo.errores.length === 0) return;
	const section = root.createEl("section", { cls: "rl-section rl-errors" });
	section.createEl("h3", { text: t("errorTitle") });
	const list = section.createEl("ul");
	for (const error of modelo.errores) list.createEl("li", { text: error });
}

function renderSummary(root: HTMLElement, modelo: Modelo, t: Translator): void {
	const section = root.createEl("section", { cls: "rl-section rl-summary" });
	section.createEl("h3", { text: t("summary") });
	const stats = section.createEl("div", { cls: "rl-stat-grid" });
	stats.createEl("div", { text: `${modelo.tareas.size} ${t("taskCount")}` });
	stats.createEl("div", { text: `${Object.keys(modelo.carriles).length} ${t("lanes").toLowerCase()}` });
	stats.createEl("div", { text: `${modelo.gatesCruzados.length} ${t("gates").toLowerCase()}` });
	stats.createEl("div", { text: `${modelo.solapeCarriles.length} ${t("overlap").toLowerCase()}` });
}

function renderLanes(root: HTMLElement, modelo: Modelo, t: Translator): void {
	const section = root.createEl("section", { cls: "rl-section" });
	section.createEl("h3", { text: t("lanes") });
	const list = section.createEl("div", { cls: "rl-lane-list" });
	for (const [id, carril] of Object.entries(modelo.carriles)) {
		const item = list.createEl("article", { cls: "rl-lane" });
		item.createEl("h4", { text: `${id} · ${carril.foco}` });
		item.createEl("p", {
			text: `${t("next")}: ${carril.proximo || "-"}`,
		});
		item.createEl("p", { text: carril.cola.join(" -> ") || "-" });
	}
}

function renderOverlap(root: HTMLElement, modelo: Modelo, t: Translator): void {
	const section = root.createEl("section", { cls: "rl-section" });
	section.createEl("h3", { text: t("overlap") });
	if (modelo.solapeCarriles.length === 0) {
		section.createEl("p", { cls: "rl-muted", text: t("noOverlap") });
		return;
	}
	const list = section.createEl("ul", { cls: "rl-compact-list" });
	for (const solape of modelo.solapeCarriles) {
		list.createEl("li", {
			text: `${solape.a}-${solape.b}: ${solape.pct}% (${solape.comunes.join(", ") || "-"})`,
		});
	}
}

function renderGates(root: HTMLElement, modelo: Modelo, t: Translator): void {
	const section = root.createEl("section", { cls: "rl-section" });
	section.createEl("h3", { text: t("gates") });
	if (modelo.gatesCruzados.length === 0) {
		section.createEl("p", { cls: "rl-muted", text: t("noGates") });
		return;
	}
	const list = section.createEl("ul", { cls: "rl-compact-list" });
	for (const gate of modelo.gatesCruzados) {
		list.createEl("li", {
			text: `${gate.de} (${gate.carrilDe}) -> ${gate.aQue} (${gate.carrilA}) · ${
				gate.abierto ? "open" : "closed"
			}`,
		});
	}
}

function renderTasks(root: HTMLElement, modelo: Modelo, t: Translator): void {
	const section = root.createEl("section", { cls: "rl-section" });
	section.createEl("h3", { text: t("tasks") });
	const table = section.createEl("table", { cls: "rl-task-table" });
	const head = table.createEl("thead").createEl("tr");
	for (const label of ["ID", t("status"), t("lane"), "h", t("waitingFor")]) {
		head.createEl("th", { text: label });
	}
	const body = table.createEl("tbody");
	for (const task of sortedTasks(modelo)) {
		const row = body.createEl("tr");
		row.createEl("td", { text: task.id });
		row.createEl("td", { text: task.estadoVisual });
		row.createEl("td", { text: task.carril || t("backlog") });
		row.createEl("td", { text: `${formatHours(task.horasEfectivas)}${t("hours")}` });
		row.createEl("td", { text: task.esperaIds.join(", ") || "-" });
	}
}

export function renderModel(root: HTMLElement, modelo: Modelo, t: Translator): void {
	root.empty();
	root.addClass("roadmap-lanes-view");
	root.createEl("h2", { text: "Roadmap Lanes" });
	renderErrors(root, modelo, t);
	renderSummary(root, modelo, t);
	renderLanes(root, modelo, t);
	renderOverlap(root, modelo, t);
	renderGates(root, modelo, t);
	renderTasks(root, modelo, t);
}

export function renderLoading(root: HTMLElement, t: Translator): void {
	root.empty();
	root.addClass("roadmap-lanes-view");
	root.createEl("h2", { text: "Roadmap Lanes" });
	root.createEl("p", { cls: "rl-muted", text: t("loading") });
}
