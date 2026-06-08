import { MarkdownRenderer, type App, type Component } from "obsidian";

import type { Modelo, Tarea } from "./types";
import type { Translator } from "./i18n";

interface RenderContext {
	app: App;
	component: Component;
	root: HTMLElement;
	modelo: Modelo;
	t: Translator;
}

interface EstadoPresentacion {
	clase: "hecho" | "bloqueado" | "proximo" | "en-curso" | "libre";
	texto: string;
}

interface Filtros {
	texto: string;
	tipos: Set<string>;
	madurez: Set<string>;
	columnas: Set<string>;
}

const TIPOS = ["FT", "DT", "INFRA"];
const MADUREZ = ["nota", "esqueleto", "ejecutable"];

function formatHours(hours: number): string {
	return Number.isInteger(hours) ? `${hours}` : `${hours.toFixed(1)}`;
}

function formatDurationFromHours(hours: number, modelo: Modelo): string {
	const days = hours / modelo.horasPorDia;
	if (days >= 1) {
		const formatted = Number.isInteger(days) ? `${days}` : `${days.toFixed(1)}`;
		return `${formatted}d`;
	}
	return `${formatHours(hours)}h`;
}

function formatDuration(task: Tarea, modelo: Modelo): string {
	return formatDurationFromHours(task.horasEfectivas, modelo);
}

function estadoVisual(task: Tarea, t: Translator): EstadoPresentacion {
	switch (task.estadoVisual) {
		case "hecho":
			return { clase: "hecho", texto: t("stateDone") };
		case "fuera-de-turno":
			return { clase: "bloqueado", texto: `${t("stateWaitingFor")} ${task.esperaIds.join(", ")}` };
		case "proximo":
			return { clase: "proximo", texto: t("stateNext") };
		case "en-curso":
			return { clase: "en-curso", texto: t("stateInProgress") };
		default:
			return { clase: "libre", texto: t("stateWaiting") };
	}
}

function nivelSolape(pct: number): 0 | 1 | 2 | 3 {
	if (pct <= 25) return 0;
	if (pct <= 50) return 1;
	if (pct <= 75) return 2;
	return 3;
}

function pctCarriles(modelo: Modelo, a: string | null, b: string | null): number {
	if (!a || !b) return 0;
	const solape = modelo.solapeCarriles.find(
		(item) => (item.a === a && item.b === b) || (item.a === b && item.b === a)
	);
	return solape?.pct ?? 0;
}

function colisionesDe(modelo: Modelo, task: Tarea): Tarea[] {
	if (!task.carril || task.zonas.length === 0) return [];
	const zonas = new Set(task.zonas);
	return [...modelo.tareas.values()].filter(
		(other) =>
			other.id !== task.id &&
			other.carril !== null &&
			other.carril !== task.carril &&
			other.estado !== "hecho" &&
			other.zonas.some((zona) => zonas.has(zona))
	);
}

function solapeDe(modelo: Modelo, task: Tarea): { tareas: Tarea[]; pct: number } | null {
	const tareas = colisionesDe(modelo, task);
	if (tareas.length === 0) return null;
	return {
		tareas,
		pct: Math.max(...tareas.map((item) => pctCarriles(modelo, task.carril, item.carril))),
	};
}

function alturaCard(task: Tarea, modelo: Modelo): number {
	if (task.esContenedor) return 96;
	const dayHeight = 96;
	const gap = 10;
	const days = Math.max(0.25, task.horasEfectivas / modelo.horasPorDia);
	const whole = Math.floor(days);
	const fraction = days - whole;
	const fractionRows = fraction > 0 ? Math.max(1, Math.ceil(fraction * 4)) : 0;
	const fullRows = whole * 4 + fractionRows;
	const dayGaps = Math.max(0, Math.ceil(days) - 1) * gap;
	return Math.max(32, fullRows * (dayHeight / 4) + dayGaps);
}

function searchText(task: Tarea): string {
	return [
		task.id,
		task.titulo,
		task.tipo,
		task.madurez,
		task.estadoVisual,
		...task.areas,
		...task.zonas,
	].join(" ").toLowerCase();
}

function isVisibleTask(task: Tarea, filtros: Filtros): boolean {
	const matchesText = filtros.texto.length === 0 || searchText(task).includes(filtros.texto);
	const matchesTipo = filtros.tipos.size === 0 || (task.tipo !== undefined && filtros.tipos.has(task.tipo));
	const matchesMadurez =
		filtros.madurez.size === 0 || (task.madurez !== undefined && filtros.madurez.has(task.madurez));
	return matchesText && matchesTipo && matchesMadurez;
}

function hojasPorPadre(a: Tarea, b: Tarea): number {
	return (a.padre || a.id).localeCompare(b.padre || b.id) || a.id.localeCompare(b.id);
}

function bloques(modelo: Modelo, hojas: Tarea[]): Array<{ cont: Tarea | null; items: Tarea[] }> {
	const out: Array<{ cont: Tarea | null; items: Tarea[] }> = [];
	for (let i = 0; i < hojas.length; ) {
		const current = hojas[i];
		const padre = current.padre ? modelo.tareas.get(current.padre) ?? null : null;
		if (padre?.esContenedor) {
			const items: Tarea[] = [];
			while (i < hojas.length && hojas[i].padre === current.padre) {
				items.push(hojas[i]);
				i++;
			}
			out.push({ cont: padre, items });
		} else {
			out.push({ cont: null, items: [current] });
			i++;
		}
	}
	return out;
}

function renderEstadoLine(parent: HTMLElement, task: Tarea, t: Translator): void {
	const estado = estadoVisual(task, t);
	parent.createEl("div", {
		cls: `rl-card-state rl-state-${estado.clase}`,
		text: estado.texto,
	});
}

function renderCard(ctx: RenderContext, parent: HTMLElement, task: Tarea, filtros: Filtros): HTMLElement {
	const estado = estadoVisual(task, ctx.t);
	const card = parent.createEl("article", {
		cls: `rl-card rl-state-${estado.clase}`,
		attr: {
			"data-task-id": task.id,
			"data-search": searchText(task),
			"data-tipo": task.tipo || "",
			"data-madurez": task.madurez || "",
			"data-visible": isVisibleTask(task, filtros) ? "true" : "false",
		},
	});
	card.style.minHeight = `${alturaCard(task, ctx.modelo)}px`;

	const head = card.createEl("div", { cls: "rl-card-head" });
	head.createEl("span", { cls: "rl-task-id", text: task.id });
	if (task.tipo) head.createEl("span", { cls: `rl-type rl-type-${task.tipo}`, text: task.tipo });
	head.createEl("span", { cls: "rl-duration", text: formatDuration(task, ctx.modelo) });

	card.createEl("div", { cls: "rl-card-title", text: task.titulo });

	const meta = card.createEl("div", { cls: "rl-card-meta" });
	if (task.madurez) meta.createEl("span", { cls: "rl-maturity", text: task.madurez });
	if (task.absorbe.length > 0) {
		meta.createEl("span", {
			cls: "rl-absorbs",
			text: `${ctx.t("absorbs").toLowerCase()} ${task.absorbe.join(", ")}`,
		});
	}
	const solape = solapeDe(ctx.modelo, task);
	if (solape) {
		meta.createEl("span", {
			cls: `rl-overlap-pill rl-solape-${nivelSolape(solape.pct)}`,
			text: solape.tareas.map((item) => item.id).join(", "),
		});
	}

	renderEstadoLine(card, task, ctx.t);
	card.addEventListener("click", () => {
		void openDetail(ctx, task);
	});
	return card;
}

function renderContainerBlock(ctx: RenderContext, parent: HTMLElement, cont: Tarea, items: Tarea[], filtros: Filtros): void {
	const visibleItems = items.filter((item) => isVisibleTask(item, filtros));
	const block = parent.createEl("div", {
		cls: "rl-container-block",
		attr: { "data-visible": visibleItems.length > 0 ? "true" : "false" },
	});
	const estado = estadoVisual(cont, ctx.t);
	const bar = block.createEl("button", {
		cls: `rl-container-bar rl-state-${estado.clase}`,
		text: `${cont.id} · ${cont.titulo} · ${formatDurationFromHours(
			items.reduce((sum, item) => sum + item.horasEfectivas, 0),
			ctx.modelo
		)}`,
		attr: { type: "button" },
	});
	bar.addEventListener("click", () => {
		void openDetail(ctx, cont);
	});
	const children = block.createEl("div", { cls: "rl-container-children" });
	for (const item of items) renderCard(ctx, children, item, filtros);
}

function renderColumn(
	ctx: RenderContext,
	board: HTMLElement,
	id: string,
	title: string,
	meta: string,
	items: Tarea[],
	filtros: Filtros,
	tooltip?: string
): void {
	const column = board.createEl("section", {
		cls: "rl-column",
		attr: {
			"data-column-id": id,
			"data-visible": filtros.columnas.has(id) ? "true" : "false",
		},
	});
	if (tooltip) column.setAttribute("title", tooltip);
	const head = column.createEl("header", { cls: "rl-column-head" });
	head.createEl("h3", { text: title });
	head.createEl("span", { text: meta });

	const body = column.createEl("div", { cls: "rl-column-body" });
	const grouped = bloques(ctx.modelo, items);
	for (const group of grouped) {
		if (group.cont) renderContainerBlock(ctx, body, group.cont, group.items, filtros);
		else renderCard(ctx, body, group.items[0], filtros);
	}
	if (grouped.length === 0) body.createEl("p", { cls: "rl-empty-column", text: ctx.t("noCards") });
}

function renderCoordination(ctx: RenderContext, parent: HTMLElement): void {
	const section = parent.createEl("section", { cls: "rl-coordination" });
	const overlap = section.createEl("div", { cls: "rl-coord-block" });
	overlap.createEl("h3", { text: ctx.t("overlap") });
	if (ctx.modelo.solapeCarriles.length === 0) {
		overlap.createEl("p", { cls: "rl-muted", text: ctx.t("noOverlap") });
	} else {
		for (const item of ctx.modelo.solapeCarriles) {
			const row = overlap.createEl("div", {
				cls: `rl-coord-item rl-solape-border-${nivelSolape(item.pct)}`,
			});
			row.createEl("span", { text: `${item.a} <-> ${item.b}` });
			row.createEl("strong", { text: `${item.pct}%` });
			row.createEl("span", { text: item.comunes.join(", ") || "-" });
		}
	}

	const gates = section.createEl("div", { cls: "rl-coord-block" });
	gates.createEl("h3", { text: ctx.t("gates") });
	if (ctx.modelo.gatesCruzados.length === 0) {
		gates.createEl("p", { cls: "rl-muted", text: ctx.t("noGates") });
	} else {
		for (const gate of ctx.modelo.gatesCruzados) {
			gates.createEl("div", {
				cls: `rl-coord-item ${gate.abierto ? "rl-gate-open" : "rl-gate-closed"}`,
				text: `${gate.de} (${gate.carrilDe}) -> ${gate.aQue} (${gate.carrilA}) · ${
					gate.abierto ? ctx.t("open") : ctx.t("closed")
				}`,
			});
		}
	}
}

function applyFilters(root: HTMLElement, filtros: Filtros): void {
	let visibleCards = 0;
	const cards = Array.from(root.querySelectorAll(".rl-card")) as HTMLElement[];
	for (const card of cards) {
		const search = card.dataset.search || "";
		const tipo = card.dataset.tipo || "";
		const madurez = card.dataset.madurez || "";
		const visible =
			(!filtros.texto || search.includes(filtros.texto)) &&
			(filtros.tipos.size === 0 || filtros.tipos.has(tipo)) &&
			(filtros.madurez.size === 0 || filtros.madurez.has(madurez));
		card.dataset.visible = visible ? "true" : "false";
		if (visible) visibleCards++;
	}
	const blocks = Array.from(root.querySelectorAll(".rl-container-block")) as HTMLElement[];
	for (const block of blocks) {
		const blockCards = Array.from(block.querySelectorAll(".rl-card")) as HTMLElement[];
		const anyVisible = blockCards.some((card) => card.dataset.visible === "true");
		block.dataset.visible = anyVisible ? "true" : "false";
	}
	const columns = Array.from(root.querySelectorAll(".rl-column")) as HTMLElement[];
	for (const column of columns) {
		const id = column.dataset.columnId;
		column.dataset.visible = id && filtros.columnas.has(id) ? "true" : "false";
	}
	const count = root.querySelector(".rl-filter-count") as HTMLElement | null;
	if (count) count.textContent = `${visibleCards} ${root.dataset.visibleLabel || "visible"}`;
}

function renderFilterButton(parent: HTMLElement, label: string, value: string, active: boolean): HTMLButtonElement {
	return parent.createEl("button", {
		cls: `rl-filter-chip ${active ? "is-active" : ""}`,
		text: label,
		attr: { type: "button", "data-value": value },
	});
}

function renderFilters(ctx: RenderContext, parent: HTMLElement, filtros: Filtros): void {
	const filters = parent.createEl("section", { cls: "rl-filters" });
	const search = filters.createEl("input", {
		cls: "rl-search",
		attr: {
			type: "search",
			placeholder: ctx.t("searchPlaceholder"),
		},
	});
	search.addEventListener("input", () => {
		filtros.texto = search.value.toLowerCase().trim();
		applyFilters(ctx.root, filtros);
	});

	const typeGroup = filters.createEl("div", { cls: "rl-filter-group" });
	for (const tipo of TIPOS) {
		const button = renderFilterButton(typeGroup, tipo, tipo, false);
		button.addEventListener("click", () => {
			if (filtros.tipos.has(tipo)) filtros.tipos.delete(tipo);
			else filtros.tipos.add(tipo);
			button.classList.toggle("is-active", filtros.tipos.has(tipo));
			applyFilters(ctx.root, filtros);
		});
	}

	const maturity = filters.createEl("select", { cls: "rl-select" });
	maturity.createEl("option", { text: `${ctx.t("maturity")}: ${ctx.t("all")}`, value: "" });
	for (const item of MADUREZ) maturity.createEl("option", { text: item, value: item });
	maturity.addEventListener("change", () => {
		filtros.madurez.clear();
		if (maturity.value) filtros.madurez.add(maturity.value);
		applyFilters(ctx.root, filtros);
	});

	const columns = filters.createEl("div", { cls: "rl-filter-group" });
	const columnIds = ["backlog", ...Object.keys(ctx.modelo.carriles), "hecho"];
	for (const column of columnIds) {
		const label = column === "hecho" ? ctx.t("done") : column === "backlog" ? ctx.t("backlog") : column;
		const button = renderFilterButton(columns, label, column, true);
		button.addEventListener("click", () => {
			if (filtros.columnas.has(column)) filtros.columnas.delete(column);
			else filtros.columnas.add(column);
			button.classList.toggle("is-active", filtros.columnas.has(column));
			applyFilters(ctx.root, filtros);
		});
	}

	filters.createEl("span", { cls: "rl-filter-count" });
}

function renderErrors(ctx: RenderContext, parent: HTMLElement): void {
	const section = parent.createEl("section", {
		cls: `rl-errors ${ctx.modelo.errores.length > 0 ? "has-errors" : ""}`,
	});
	section.createEl("h3", { text: ctx.t("errorTitle") });
	if (ctx.modelo.errores.length === 0) {
		section.createEl("p", { text: ctx.t("validationOk") });
		return;
	}
	const list = section.createEl("ul");
	for (const error of ctx.modelo.errores) list.createEl("li", { text: error });
}

function renderBoard(ctx: RenderContext, parent: HTMLElement, filtros: Filtros): void {
	const board = parent.createEl("section", { cls: "rl-board" });
	const backlog = [...ctx.modelo.tareas.values()]
		.filter((task) => !task.esContenedor && !task.carril && !task.absorbidaPor && task.estado !== "hecho")
		.sort(hojasPorPadre);
	renderColumn(ctx, board, "backlog", ctx.t("backlog"), `${backlog.length}`, backlog, filtros);

	for (const [id, lane] of Object.entries(ctx.modelo.carriles)) {
		const items = lane.cola
			.map((taskId) => ctx.modelo.tareas.get(taskId))
			.filter((task): task is Tarea => task !== undefined && task.estado !== "hecho");
		const duration = items.reduce((sum, task) => sum + task.horasEfectivas, 0);
		renderColumn(
			ctx,
			board,
			id,
			`${ctx.t("lanePrefix")} ${id} · ${lane.worktree || "-"}`,
			`${items.length} · ${formatDurationFromHours(duration, ctx.modelo)}`,
			items,
			filtros,
			lane.foco
		);
	}

	const done = [...ctx.modelo.tareas.values()]
		.filter((task) => !task.esContenedor && task.estado === "hecho")
		.sort(hojasPorPadre);
	renderColumn(ctx, board, "hecho", ctx.t("done"), `${done.length}`, done, filtros);
}

function renderRelation(parent: HTMLElement, label: string, ids: string[]): void {
	if (ids.length === 0) return;
	const row = parent.createEl("div", { cls: "rl-detail-rel" });
	row.createEl("span", { text: label });
	const values = row.createEl("div");
	for (const id of ids) values.createEl("code", { text: id });
}

async function openDetail(ctx: RenderContext, task: Tarea): Promise<void> {
	const existing = ctx.root.querySelector<HTMLElement>(".rl-detail-layer");
	existing?.remove();

	const layer = ctx.root.createEl("div", { cls: "rl-detail-layer" });
	const backdrop = layer.createEl("button", {
		cls: "rl-detail-backdrop",
		attr: { type: "button", "aria-label": ctx.t("close") },
	});
	const panel = layer.createEl("aside", { cls: "rl-detail-panel" });
	const head = panel.createEl("header", { cls: "rl-detail-head" });
	const titleWrap = head.createEl("div");
	titleWrap.createEl("span", { cls: "rl-task-id", text: task.id });
	if (task.tipo) titleWrap.createEl("span", { cls: `rl-type rl-type-${task.tipo}`, text: task.tipo });
	const close = head.createEl("button", {
		cls: "rl-detail-close",
		text: "x",
		attr: { type: "button", "aria-label": ctx.t("close") },
	});

	panel.createEl("h2", { text: task.titulo });
	renderEstadoLine(panel, task, ctx.t);

	const meta = panel.createEl("dl", { cls: "rl-detail-meta" });
	const addMeta = (label: string, value: string) => {
		meta.createEl("dt", { text: label });
		meta.createEl("dd", { text: value });
	};
	if (!task.esContenedor) {
		addMeta(ctx.t("status"), task.estado || "-");
		addMeta(ctx.t("maturity"), task.madurez || "-");
	}
	addMeta(ctx.t("duration"), formatDuration(task, ctx.modelo));
	addMeta(ctx.t("lane"), task.carril || ctx.t("backlog"));
	addMeta(ctx.t("areas"), task.areas.join(", ") || "-");
	addMeta(ctx.t("zones"), task.zonas.join(", ") || "-");

	const rels = panel.createEl("section", { cls: "rl-detail-relations" });
	renderRelation(rels, ctx.t("parent"), task.padre ? [task.padre] : []);
	renderRelation(rels, ctx.t("children"), task.hijos);
	renderRelation(rels, ctx.t("dependsOn"), task.depende_de);
	renderRelation(rels, ctx.t("unlocks"), task.desbloquea);
	renderRelation(rels, ctx.t("absorbs"), task.absorbe);
	renderRelation(rels, ctx.t("absorbedBy"), task.absorbidaPor ? [task.absorbidaPor] : []);

	const collisions = colisionesDe(ctx.modelo, task);
	if (collisions.length > 0) {
		const box = panel.createEl("section", { cls: "rl-detail-overlap" });
		box.createEl("h3", { text: ctx.t("overlapWith") });
		for (const item of collisions) {
			const comunes = item.zonas.filter((zona) => task.zonas.includes(zona));
			box.createEl("p", {
				cls: `rl-solape-${nivelSolape(pctCarriles(ctx.modelo, task.carril, item.carril))}`,
				text: `${item.id} (${item.carril}) · ${comunes.join(", ")}`,
			});
		}
	}

	const body = panel.createEl("section", { cls: "rl-detail-body markdown-rendered" });
	if (task.cuerpo) {
		await MarkdownRenderer.render(ctx.app, task.cuerpo, body, task._archivo || "", ctx.component);
	} else {
		body.createEl("p", { cls: "rl-muted", text: ctx.t("noBody") });
	}

	const closeLayer = () => layer.remove();
	backdrop.addEventListener("click", closeLayer);
	close.addEventListener("click", closeLayer);
}

export function renderModel(
	root: HTMLElement,
	modelo: Modelo,
	t: Translator,
	app: App,
	component: Component
): void {
	root.empty();
	root.addClass("roadmap-lanes-view");
	root.dataset.visibleLabel = t("visible");
	root.dataset.modelReady = "true";

	const ctx: RenderContext = { app, component, root, modelo, t };
	const filtros: Filtros = {
		texto: "",
		tipos: new Set(),
		madurez: new Set(),
		columnas: new Set(["backlog", ...Object.keys(modelo.carriles), "hecho"]),
	};

	const header = root.createEl("header", { cls: "rl-topbar" });
	const title = header.createEl("div");
	title.createEl("h2", { text: "Roadmap Lanes" });
	title.createEl("p", {
		cls: "rl-muted",
		text: `${modelo.tareas.size} ${t("taskCount")} · ${Object.keys(modelo.carriles).length} ${t("lanes").toLowerCase()}`,
	});

	renderFilters(ctx, root, filtros);
	renderErrors(ctx, root);
	renderCoordination(ctx, root);
	renderBoard(ctx, root, filtros);
	applyFilters(root, filtros);
}

export function renderLoading(root: HTMLElement, t: Translator): void {
	root.empty();
	root.addClass("roadmap-lanes-view");
	root.createEl("h2", { text: "Roadmap Lanes" });
	root.createEl("p", { cls: "rl-muted", text: t("loading") });
}
