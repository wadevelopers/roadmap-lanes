import { MarkdownRenderer, type App, type Component } from "obsidian";

import { FILTERABLE_TYPES, MATURITIES, type Alert, type Model, type Severity, type Task } from "./types";
import { formatAlert, type TranslationKey, type Translator } from "./messages";
import {
	DETAIL_PANEL_MAX_WIDTH,
	DETAIL_PANEL_MIN_WIDTH,
	normalizeDetailPanelWidth,
} from "./settings";
import {
	DEFAULT_BOARD_MODE,
	cardTimePresentation,
	defaultHoursPerLineForHoursPerDay,
	formatDurationBadge,
	formatDurationDetail,
	normalizeHoursPerLine,
	timeCardHeight,
	type BoardMode,
	type CardLayoutSettings,
} from "./time";

interface RenderContext {
	app: App;
	component: Component;
	root: HTMLElement;
	model: Model;
	t: Translator;
	detailPanelWidth: number;
	boardMode: BoardMode;
	hoursPerLine: number;
	cardLayout: CardLayoutSettings;
	detailHistory: string[];
	setDetailPanelWidth?: (width: number) => void;
	setBoardMode?: (mode: BoardMode) => void;
	isAlertAccepted?: (alert: Alert) => boolean;
	acceptAlert?: (alert: Alert) => void | Promise<void>;
}

export interface RenderModelOptions {
	detailPanelWidth?: number;
	boardMode?: BoardMode;
	hoursPerLine?: number;
	compactTypes?: boolean;
	highlightWaiting?: boolean;
	filterState?: FilterState;
	setDetailPanelWidth?: (width: number) => void;
	setBoardMode?: (mode: BoardMode) => void;
	isAlertAccepted?: (alert: Alert) => boolean;
	acceptAlert?: (alert: Alert) => void | Promise<void>;
}

export interface FilterState {
	text: string;
	types: Set<string>;
	maturity: Set<string>;
	columns: Set<string>;
	coordCollapsed: Set<string>;
}

interface VisualStatePresentation {
	className: "done" | "blocked" | "next" | "in-progress" | "free";
	text: string;
}

interface Filters {
	text: string;
	types: Set<string>;
	maturity: Set<string>;
	columns: Set<string>;
	columnOrderIds: string[];
	columnCapacity: number;
	columnControl?: CheckboxDropdownController;
}

interface CheckboxDropdownItem {
	id: string;
	label: string;
}

interface CheckboxDropdownController {
	update(checked: Set<string>, disabled?: Set<string>): void;
}

interface CheckboxDropdownOptions {
	checked?: () => Set<string>;
	disabled?: () => Set<string>;
}

interface TaskPath {
	task: Task;
	ancestors: Task[];
}

const BOARD_MIN_COLUMN_WIDTH_PX = 240;
const BOARD_COLUMN_GAP_PX = 12;
const BOARD_HORIZONTAL_PADDING_PX = 32;
const DETAIL_PANEL_VIEWPORT_MARGIN_PX = 32;
const CARD_GAP_PX = 8;
const TIME_ONE_LINE_CARD_HEIGHT_PX = 28;
const ORDER_CARD_HEIGHT_PX = 96;
const columnResizeObservers = new WeakMap<HTMLElement, ResizeObserver>();

type CardIcon = "raw" | "draft" | "ready" | "absorbs" | "overlap";
type DetailIcon = "arrow-left" | "x";

interface CardIconShape {
	path: string;
	fillRule?: "evenodd";
}

const SVG_NS = "http://www.w3.org/2000/svg";
const CARD_ICON_VIEWBOX = "0 0 220 220";

const CARD_ICONS: Record<CardIcon, CardIconShape> = {
	raw: { fillRule: "evenodd", path: "m65.21 130.22c-1.1 3.45-3.39 12.69-5.1 20.53-1.71 7.84-3.11 15.15-3.11 16.25 0 1.78 0.47 1.93 4.25 1.4 2.34-0.33 12.13-2.58 21.75-5 9.63-2.43 17.73-4.64 18-4.92 0.28-0.29-1.29-2.42-3.48-4.75-2.2-2.33-8.72-9.1-14.5-15.05-5.79-5.95-11.71-11.7-13.17-12.78l-2.64-1.96zm-33.71-92.13c-2.88 0.49-6.7 2.1-9 3.78-2.2 1.62-5.8 5.49-8 8.6l-4 5.67v130.36c4.11 6.97 7.04 10.54 9.15 12.42 2.12 1.89 5.76 4.25 8.1 5.25 3.98 1.71 8.19 1.81 68 1.58l63.75-0.25c6.97-4.13 10.16-6.6 11.58-8.16 1.42-1.56 3.67-4.64 5-6.84 2.41-3.99 2.42-4.12 2.68-36.5 0.23-29.88 0.11-32.65-1.5-34.28-0.97-0.99-2.44-1.79-3.26-1.79-0.83 0-2.4 0.96-3.5 2.14-1.88 2.01-2.03 3.89-2.5 31.78-0.46 27.12-0.67 29.98-2.5 33.52-1.1 2.13-3.58 5.05-5.5 6.5l-3.5 2.63c-100.46 0.44-122.89 0.18-124.5-0.47-1.38-0.56-4.08-2.62-6-4.58-3.2-3.26-3.56-4.24-4.18-11.26-0.38-4.23-0.71-31.32-0.75-60.19-0.04-35.53 0.3-53.8 1.05-56.5 0.61-2.2 2.06-5.18 3.23-6.63 1.17-1.44 3.7-3.41 5.63-4.38 3.08-1.53 8.02-1.83 39.73-2.37 30.18-0.52 36.48-0.87 37.85-2.12 1.11-1.02 1.44-2.38 1.04-4.25-0.37-1.67-1.59-3.15-3.1-3.75-1.52-0.61-15.79-0.96-36.25-0.88-18.57 0.06-36 0.5-38.75 0.97zm81.49 37.4l-39.49 39.5c24.8 24.91 33.23 33.01 34.75 34.08l2.75 1.93c54.43-53.86 71.98-71.64 74.11-74.25l3.89-4.75c-27.52-27.94-35.73-36.04-36.01-36.03-0.28 0.02-18.28 17.8-40 39.52zm60.51-58.98c-1.65 0.8-5.25 3.72-8 6.49l-5 5.02c24.8 24.89 33.26 33.1 34.81 34.3l2.82 2.18c7.41-7.83 10.27-12.18 11.32-15 1.62-4.37 1.69-5.51 0.57-9-0.9-2.79-4.05-6.77-10.4-13.16-5.02-5.04-10.81-9.87-12.87-10.75-2.07-0.88-5.22-1.58-7-1.57-1.79 0.01-4.6 0.68-6.25 1.49z" },
	draft: { fillRule: "evenodd", path: "m108.5 7.06c6.6-0.04 15.94 0.6 20.75 1.43 4.81 0.83 12.46 2.87 17 4.54 4.54 1.67 11.18 4.65 14.75 6.63 3.57 1.97 8.97 5.51 12 7.85 3.03 2.34 8.21 7.12 11.53 10.62 3.32 3.5 7.67 8.62 9.67 11.37 2 2.75 5.44 8.6 7.65 13 2.21 4.4 5.19 12.05 6.62 17 1.44 4.95 3.12 13.5 3.75 19 0.87 7.54 0.86 12.34-0.01 19.5-0.64 5.22-1.87 12.2-2.74 15.5-0.88 3.3-2.95 9.38-4.62 13.5-1.66 4.13-3.89 8.74-4.94 10.25-1.05 1.51-3.15 3.38-4.66 4.14-1.51 0.76-5 1.7-7.75 2.08-2.75 0.38-6.24 1.33-7.75 2.11-1.52 0.79-3.63 3.32-4.73 5.67-1.74 3.75-1.98 6.45-2.02 41.75h-126l-0.02-18.75c-0.02-16.55-0.26-19.25-2-23-1.26-2.7-3.17-4.84-5.23-5.87-1.79-0.9-5.27-1.83-7.75-2.08-2.47-0.25-5.62-1.15-7-2-1.37-0.85-3.31-2.51-4.3-3.68-0.98-1.16-2.93-4.59-4.31-7.62-1.39-3.03-3.58-9.1-4.86-13.5-1.29-4.4-2.88-12.5-3.53-18-0.88-7.38-0.92-12.62-0.13-20 0.58-5.5 2.2-13.94 3.59-18.75 1.4-4.81 4.18-12.01 6.17-16 2-3.99 5.15-9.61 7-12.5 1.86-2.89 6.68-8.74 10.74-13 4.05-4.26 10.68-10.05 14.75-12.87 4.06-2.81 9.41-6.14 11.88-7.39 2.47-1.25 7.42-3.39 11-4.74 3.58-1.36 10.33-3.29 15-4.29 5.33-1.14 12.98-1.85 20.5-1.9zm-3.92 133.19c-1.4 1.24-6.4 9-11.12 17.25-7.14 12.48-8.49 15.5-8 18 0.32 1.65 1.71 4.13 3.09 5.5 2.49 2.49 2.56 2.5 21.55 2.5h19.06c5.48-6.28 5.99-7.62 5.55-10-0.3-1.65-4.18-9.3-8.62-17-4.43-7.7-9.19-15.01-10.57-16.25-1.4-1.25-3.82-2.25-5.46-2.25-1.63 0-4.07 1-5.48 2.25zm38.42-51.73c-2.47 0.76-6.49 3.09-8.93 5.18-2.46 2.11-5.45 6.02-6.74 8.8-1.61 3.48-2.31 6.82-2.3 11 0 3.3 0.56 7.76 1.24 9.92 0.67 2.15 3.03 5.93 5.23 8.38 2.2 2.46 5.8 5.37 8 6.48 2.2 1.1 6.7 2.24 10 2.53 4.44 0.39 7.3 0.04 11-1.34 2.75-1.02 6.76-3.46 8.91-5.42 2.15-1.95 4.95-5.8 6.24-8.55 1.68-3.6 2.34-6.82 2.35-11.5 0.02-5.15-0.55-7.63-2.74-11.93-1.52-2.99-4.56-6.95-6.76-8.8-2.2-1.85-6.25-4.02-9-4.82-2.75-0.81-6.57-1.43-8.5-1.39-1.93 0.04-5.53 0.7-8 1.46zm-83-0.01c-2.47 0.75-6.53 3.12-9 5.26-2.58 2.23-5.44 5.99-6.7 8.81-1.24 2.8-2.27 7.29-2.38 10.42-0.1 3.03 0.44 7.49 1.2 9.92 0.76 2.43 3.18 6.43 5.38 8.88 2.2 2.46 5.8 5.38 8 6.49 2.24 1.12 6.86 2.22 10.5 2.48 5.35 0.4 7.46 0.06 11.9-1.89 3.05-1.35 7.07-4.23 9.25-6.63 2.12-2.34 4.52-5.82 5.35-7.75 0.83-1.94 1.51-6.5 1.51-10.25 0.01-5.41-0.54-7.83-2.75-12.18-1.52-2.99-4.56-6.94-6.76-8.77-2.2-1.84-6.03-4.01-8.5-4.83-2.47-0.82-6.3-1.46-8.5-1.41-2.2 0.04-6.03 0.69-8.5 1.45z" },
	ready: { path: "m103.21 24.25c-2.72 5.09-6.66 12.4-8.77 16.25-2.1 3.85-5.77 10.6-8.16 15-2.39 4.4-5.56 10.34-7.06 13.2-2.13 4.07-3.37 5.34-5.72 5.81-1.65 0.34-7.72 1.46-13.5 2.5-5.78 1.03-15.45 2.83-21.5 3.99-6.05 1.15-14.6 2.76-19 3.57-4.4 0.8-8.38 1.79-8.84 2.2-0.47 0.4-0.47 1.48 0 2.39 0.46 0.91 3.95 4.96 7.75 9 3.8 4.04 10.55 11.18 15 15.87 4.45 4.69 11.24 11.83 15.09 15.86l7 7.34c-1.84 15.71-3.75 30.62-5.44 43.27-1.69 12.65-3.06 23.34-3.06 23.75 0 0.41 0.68 0.75 1.5 0.75 0.83 0 7.24-2.75 14.25-6.12 7.01-3.36 16.13-7.69 20.25-9.61 4.13-1.92 11.66-5.46 16.75-7.88 5.09-2.41 9.59-4.4 10-4.42 0.41-0.01 5.25 2.18 10.75 4.86 5.5 2.69 12.25 5.92 15 7.17 2.75 1.25 11.53 5.38 19.5 9.17 7.97 3.79 15.18 6.88 16 6.87 1.25-0.01 1.37-1 0.75-5.78-0.41-3.17-1.64-12.51-2.74-20.76-1.09-8.25-2.73-20.63-3.64-27.5-1.01-7.67-1.3-13.13-0.76-14.13 0.49-0.9 7.9-9 16.47-18 8.56-9 18.46-19.46 22-23.23 3.53-3.77 6.42-7.37 6.42-8 0-0.67-5.56-2.21-13.5-3.75-7.43-1.43-20.25-3.84-28.5-5.35-8.25-1.52-17.18-3.27-19.84-3.9-4.11-0.97-5.18-1.75-7.08-5.14-1.23-2.2-5.41-9.85-9.29-17-3.87-7.15-8.5-15.7-10.28-19-1.77-3.3-4.75-8.81-6.62-12.25-1.86-3.44-4.03-6.25-4.82-6.25-0.78 0-3.65 4.16-6.36 9.25z" },
	absorbs: { fillRule: "evenodd", path: "m120.75 9.08c8.39-0.05 15.91 0.48 20.5 1.45 3.99 0.84 9.95 2.47 13.25 3.62 3.3 1.15 9.15 3.66 13 5.57 3.85 1.91 9.7 5.39 13 7.74 3.3 2.34 9.05 7.36 12.78 11.15 5.39 5.48 6.77 7.51 6.74 9.89-0.03 2.58-4.04 7.01-28.51 31.5-15.67 15.68-28.48 29.17-28.47 30 0.01 0.83 0.9 2.85 1.97 4.5 1.07 1.65 13.88 14.93 28.47 29.5 22.94 22.91 26.52 26.91 26.52 29.5 0 2.43-1.47 4.41-7.75 10.45-4.26 4.09-10.68 9.32-14.25 11.62-3.57 2.29-8.75 5.3-11.5 6.69-2.75 1.38-9.05 3.86-14 5.51-5.12 1.71-13.74 3.57-20 4.31-8.78 1.05-13.17 1.07-21.75 0.12-5.91-0.66-14.46-2.38-19-3.82-4.54-1.44-11.4-4.2-15.25-6.13-3.85-1.94-9.7-5.33-13-7.54-3.3-2.2-9.83-7.88-14.52-12.61-4.93-4.98-10.73-12.18-13.77-17.1-2.88-4.68-6.64-11.88-8.34-16-1.71-4.12-3.94-11.32-4.96-16-1.31-5.96-1.87-12.54-1.87-22 0-9.46 0.56-16.04 1.87-22 1.02-4.67 3.34-12.1 5.15-16.5 1.8-4.4 5.12-11.02 7.36-14.72 2.24-3.69 6.61-9.9 9.7-13.8 3.09-3.9 8.49-9.27 12-11.93 3.51-2.67 9.3-6.62 12.88-8.78 3.58-2.16 10.1-5.41 14.5-7.22 4.4-1.81 11.6-4.1 16-5.08q8-1.8 21.25-1.89zm-2.63 26.89c-1.31 0.46-3.74 2.34-5.39 4.18-1.66 1.84-3.4 4.36-3.87 5.6-0.47 1.24-0.85 4.39-0.84 7q0.02 4.75 2.39 8.75c1.31 2.2 4.11 5 6.23 6.22 2.56 1.47 5.54 2.22 8.86 2.22 3.53 0.01 6.25-0.71 9.25-2.46 2.87-1.68 4.89-3.86 6.24-6.73 1.09-2.34 1.99-5.94 2-8 0-2.06-0.47-4.99-1.05-6.5-0.59-1.51-2.28-4.04-3.75-5.62-1.48-1.58-4.15-3.5-5.94-4.25-1.79-0.76-5.16-1.35-7.5-1.32-2.34 0.04-5.32 0.44-6.63 0.91z" },
	overlap: { fillRule: "evenodd", path: "m84.69 8c34.6 0 63.85 22.92 73.4 54.41 31.49 9.55 54.41 38.8 54.41 73.4 0 42.36-34.33 76.69-76.69 76.69-34.6 0-63.85-22.92-73.4-54.41-31.49-9.55-54.41-38.8-54.41-73.4 0-42.36 34.33-76.69 76.69-76.69zm76.54 71.96l0.11 2.25 0.04 2.48c0 42.35-34.34 76.69-76.69 76.69q-2.38-0.01-4.72-0.15c9.65 21.2 31.03 35.93 55.84 35.93 33.89 0 61.35-27.46 61.35-61.35 0-24.81-14.73-46.19-35.93-55.85zm-76.54-56.62c-33.89 0-61.35 27.46-61.35 61.35 0 24.81 14.73 46.19 35.93 55.85l-0.11-2.25-0.04-2.48c0-42.35 34.34-76.68 76.69-76.68q2.38 0 4.72 0.14c-9.65-21.2-31.03-35.93-55.84-35.93z" },
};

function appendDetailIcon(parent: HTMLElement, icon: DetailIcon): void {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("class", "rl-detail-icon");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "2");
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");
	svg.setAttribute("aria-hidden", "true");

	const appendLine = (x1: string, y1: string, x2: string, y2: string) => {
		const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
		line.setAttribute("x1", x1);
		line.setAttribute("y1", y1);
		line.setAttribute("x2", x2);
		line.setAttribute("y2", y2);
		svg.appendChild(line);
	};

	if (icon === "arrow-left") {
		appendLine("19", "12", "5", "12");
		const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
		polyline.setAttribute("points", "12 19 5 12 12 5");
		svg.appendChild(polyline);
	} else {
		appendLine("18", "6", "6", "18");
		appendLine("6", "6", "18", "18");
	}

	parent.appendChild(svg);
}

function visualStatePresentation(task: Task, t: Translator): VisualStatePresentation {
	switch (task.visualState) {
		case "done":
			return { className: "done", text: t("stateDone") };
		case "out-of-turn":
			return { className: "blocked", text: `${t("stateWaitingFor")} ${task.waitingFor.join(", ")}` };
		case "next":
			return { className: "next", text: t("stateNext") };
		case "in-progress":
			return { className: "in-progress", text: t("stateInProgress") };
		default:
			return { className: "free", text: t("stateWaiting") };
	}
}

function overlapLevel(pct: number): 0 | 1 | 2 | 3 {
	if (pct <= 25) return 0;
	if (pct <= 50) return 1;
	if (pct <= 75) return 2;
	return 3;
}

function laneOverlapPct(model: Model, a: string | null, b: string | null): number {
	if (!a || !b) return 0;
	const overlap = model.laneOverlaps.find(
		(item) => (item.a === a && item.b === b) || (item.a === b && item.b === a)
	);
	return overlap?.pct ?? 0;
}

function collisionsFor(model: Model, task: Task): Task[] {
	if (!task.lane || task.status === "done" || task.zones.length === 0) return [];
	const zones = new Set(task.zones);
	return [...model.tasks.values()].filter(
		(other) =>
			other.id !== task.id &&
			other.lane !== null &&
			other.lane !== task.lane &&
			other.status !== "done" &&
			other.zones.some((zone) => zones.has(zone))
	);
}

function overlapFor(model: Model, task: Task): { tasks: Task[]; pct: number } | null {
	const tasks = collisionsFor(model, task);
	if (tasks.length === 0) return null;
	return {
		tasks,
		pct: Math.max(...tasks.map((item) => laneOverlapPct(model, task.lane, item.lane))),
	};
}

function buildCardIcon(shape: CardIconShape): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("viewBox", CARD_ICON_VIEWBOX);
	svg.setAttribute("fill", "currentColor");
	if (shape.fillRule) svg.setAttribute("fill-rule", shape.fillRule);
	svg.setAttribute("aria-hidden", "true");
	const path = document.createElementNS(SVG_NS, "path");
	path.setAttribute("d", shape.path);
	svg.appendChild(path);
	return svg;
}

function renderCardIcon(parent: HTMLElement, icon: CardIcon, title: string): void {
	const span = parent.createEl("span", {
		cls: "rl-meta-icon",
		attr: { "aria-label": title },
	});
	span.appendChild(buildCardIcon(CARD_ICONS[icon]));
}

function taskHours(task: Task): number {
	return task.durationHours ?? task.effectiveHours;
}

function formatDurationFromHours(hours: number, model: Model): string {
	return formatDurationBadge(hours, model.hoursPerDay);
}

function formatDuration(task: Task, model: Model): string {
	return formatDurationFromHours(taskHours(task), model);
}

function formatDurationTooltipFromHours(hours: number, model: Model): string {
	return formatDurationDetail(hours, model.hoursPerDay);
}

function formatDurationTooltip(task: Task, model: Model): string {
	return formatDurationTooltipFromHours(taskHours(task), model);
}

function searchText(task: Task): string {
	return [
		task.id,
		task.title,
		task.type,
		task.maturity,
		task.visualState,
		...task.areas,
		...task.zones,
	].join(" ").toLowerCase();
}

function isVisibleTask(task: Task, filters: Filters): boolean {
	const matchesText = filters.text.length === 0 || searchText(task).includes(filters.text);
	const matchesType = filters.types.size === 0 || (task.type !== undefined && filters.types.has(task.type));
	const matchesMaturity =
		filters.maturity.size === MATURITIES.length ||
		(task.maturity !== undefined && filters.maturity.has(task.maturity));
	return matchesText && matchesType && matchesMaturity;
}

function columnOrder(model: Model): string[] {
	return ["backlog", ...Object.keys(model.lanes), "done"];
}

export function createDefaultFilterState(columnIds: string[] = []): FilterState {
	return {
		text: "",
		types: new Set(),
		maturity: new Set(MATURITIES),
		columns: new Set(columnIds),
		coordCollapsed: new Set(),
	};
}

function filterStateForColumns(state: FilterState | undefined, columnIds: string[]): FilterState {
	const fallback = createDefaultFilterState(columnIds);
	if (!state) return fallback;
	const available = new Set(columnIds);
	const validTypes = new Set<string>(FILTERABLE_TYPES);
	const validMaturity = new Set<string>(MATURITIES);
	state.types = new Set([...state.types].filter((type) => validTypes.has(type)));
	state.maturity = new Set([...state.maturity].filter((item) => validMaturity.has(item)));
	if (state.maturity.size === 0) state.maturity = new Set(MATURITIES);
	state.columns = new Set([...state.columns].filter((column) => available.has(column)));
	if (state.columns.size === 0) state.columns = new Set(columnIds);
	if (!state.coordCollapsed) state.coordCollapsed = new Set();
	return state;
}

function columnLabel(id: string, ctx: RenderContext): string {
	if (id === "backlog") return ctx.t("backlog");
	if (id === "done") return ctx.t("done");
	return id;
}

function columnVisibilityState(filters: Filters): { visible: Set<string>; disabled: Set<string> } {
	const visible = new Set<string>();
	const capacity = Math.max(0, filters.columnCapacity);
	for (const id of filters.columnOrderIds) {
		if (!filters.columns.has(id)) continue;
		if (visible.size >= capacity) break;
		visible.add(id);
	}

	const disabled = new Set<string>();
	const atCapacity = capacity > 0 && visible.size >= capacity;
	for (const id of filters.columnOrderIds) {
		if (visible.has(id)) continue;
		if (filters.columns.has(id) || atCapacity) disabled.add(id);
	}

	return { visible, disabled };
}

function readRootPixelVar(root: HTMLElement, name: string, fallback: number): number {
	const value = getComputedStyle(root).getPropertyValue(name).trim();
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function readCardLayout(root: HTMLElement): CardLayoutSettings {
	return {
		oneLineCardHeight: readRootPixelVar(
			root,
			"--rl-time-one-line-card-height",
			TIME_ONE_LINE_CARD_HEIGHT_PX
		),
		cardGap: readRootPixelVar(root, "--rl-card-gap", CARD_GAP_PX),
		orderCardHeight: readRootPixelVar(root, "--rl-order-card-height", ORDER_CARD_HEIGHT_PX),
	};
}

function calculateColumnCapacity(root: HTMLElement): number {
	const minWidth = readRootPixelVar(root, "--rl-board-min-column-width", BOARD_MIN_COLUMN_WIDTH_PX);
	const gap = readRootPixelVar(root, "--rl-board-gap", BOARD_COLUMN_GAP_PX);
	const horizontalPadding = readRootPixelVar(
		root,
		"--rl-board-horizontal-padding",
		BOARD_HORIZONTAL_PADDING_PX
	);
	const availableWidth = Math.max(0, root.clientWidth - horizontalPadding);
	return Math.max(1, Math.floor((availableWidth + gap) / (minWidth + gap)));
}

function updateColumnCapacity(root: HTMLElement, filters: Filters): boolean {
	const next = Math.min(filters.columnOrderIds.length, calculateColumnCapacity(root));
	if (filters.columnCapacity === next) return false;
	filters.columnCapacity = next;
	return true;
}

function setupResponsiveColumns(ctx: RenderContext, filters: Filters): void {
	columnResizeObservers.get(ctx.root)?.disconnect();
	updateColumnCapacity(ctx.root, filters);

	if (typeof ResizeObserver === "undefined") return;

	const observer = new ResizeObserver(() => {
		if (updateColumnCapacity(ctx.root, filters)) applyFilters(ctx.root, filters);
	});
	observer.observe(ctx.root);
	columnResizeObservers.set(ctx.root, observer);
	ctx.component.register(() => observer.disconnect());
}

function ancestorChain(model: Model, task: Task): Task[] {
	const chain: Task[] = [];
	const visited = new Set<string>([task.id]);
	let current = task;
	while (current.parent) {
		if (visited.has(current.parent)) break;
		visited.add(current.parent);
		const parent = model.tasks.get(current.parent);
		if (!parent?.isContainer) break;
		chain.unshift(parent);
		current = parent;
	}
	return chain;
}

function hierarchyKey(model: Model, task: Task): string {
	return [...ancestorChain(model, task).map((ancestor) => ancestor.id), task.id].join("\u0000");
}

function leavesByHierarchy(model: Model, a: Task, b: Task): number {
	return hierarchyKey(model, a).localeCompare(hierarchyKey(model, b));
}

function collectLeaves(model: Model, task: Task, visited = new Set<string>()): Task[] {
	if (visited.has(task.id)) return [];
	visited.add(task.id);
	if (!task.isContainer) return [task];
	return task.children.flatMap((id) => {
		const child = model.tasks.get(id);
		return child ? collectLeaves(model, child, visited) : [];
	});
}

function expandLaneItems(model: Model, queue: string[]): Task[] {
	const out: Task[] = [];
	const seen = new Set<string>();
	for (const taskId of queue) {
		const task = model.tasks.get(taskId);
		if (!task) continue;
		for (const leaf of collectLeaves(model, task)) {
			if (leaf.absorbedBy || leaf.status === "done" || seen.has(leaf.id)) continue;
			seen.add(leaf.id);
			out.push(leaf);
		}
	}
	return out;
}

function taskPaths(model: Model, tasks: Task[]): TaskPath[] {
	return tasks.map((task) => ({ task, ancestors: ancestorChain(model, task) }));
}

function renderDetailStateLine(parent: HTMLElement, task: Task, t: Translator): void {
	const status = visualStatePresentation(task, t);
	parent.createEl("div", {
		cls: `rl-card-state rl-state-${status.className}`,
		text: status.text,
	});
}

function renderCard(ctx: RenderContext, parent: HTMLElement, task: Task, filters: Filters): HTMLElement {
	const status = visualStatePresentation(task, ctx.t);
	const presentation = cardTimePresentation(
		taskHours(task),
		{
			hoursPerDay: ctx.model.hoursPerDay,
			hoursPerLine: ctx.hoursPerLine,
		},
		ctx.cardLayout,
		ctx.boardMode
	);
	const card = parent.createEl("article", {
		cls: `rl-card rl-state-${status.className}`,
		attr: {
			"data-task-id": task.id,
			"data-search": searchText(task),
			"data-type": task.type || "",
			"data-maturity": task.maturity || "",
			"data-visible": isVisibleTask(task, filters) ? "true" : "false",
		},
	});
	card.style.height = `${presentation.height}px`;

	const head = card.createEl("div", {
		cls: "rl-card-row rl-card-head",
		attr: { "data-row-index": "1", "data-row-visible": presentation.visibleRows >= 1 ? "true" : "false" },
	});
	const idGroup = head.createEl("div", {
		cls: "rl-id-group",
		attr: { "aria-label": task.id, "aria-label-position": "top" },
	});
	idGroup.createEl("span", { cls: "rl-task-id", text: task.id });
	if (task.type) idGroup.createEl("span", { cls: `rl-type rl-type-${task.type}`, text: task.type });
	head.createEl("span", {
		cls: "rl-duration",
		text: presentation.durationBadge,
		attr: {
			"aria-label": presentation.durationDetail,
			"aria-label-position": "top",
		},
	});

	card.createEl("div", {
		cls: "rl-card-row rl-card-title",
		text: task.title,
		attr: {
			"data-row-index": "2",
			"data-row-visible": presentation.visibleRows >= 2 ? "true" : "false",
			"aria-label": task.title,
			"aria-label-position": "top",
		},
	});

	const meta = card.createEl("div", {
		cls: "rl-card-row rl-card-meta",
		attr: { "data-row-index": "3", "data-row-visible": presentation.visibleRows >= 3 ? "true" : "false" },
	});
	if (task.maturity) renderCardIcon(meta, task.maturity, `${ctx.t("maturity")}: ${task.maturity}`);
	if (task.absorbs.length > 0) {
		renderCardIcon(meta, "absorbs", ctx.t("absorbs"));
		meta.createEl("span", { cls: "rl-meta-ids", text: task.absorbs.join(", ") });
	}
	const overlap = overlapFor(ctx.model, task);
	if (overlap) {
		const showLane = Object.keys(ctx.model.lanes).length > 2;
		const overlapText = overlap.tasks
			.map((item) => {
				const pct = laneOverlapPct(ctx.model, task.lane, item.lane);
				return `${item.id}${showLane ? ` (${item.lane || "-"})` : ""} ${pct}%`;
			})
			.join(", ");
		renderCardIcon(meta, "overlap", `${ctx.t("overlap")}: ${overlapText}`);
		const ids = meta.createEl("span", { cls: "rl-meta-ids" });
		overlap.tasks.forEach((item, index) => {
			if (index > 0) ids.append(document.createTextNode(", "));
			const pct = laneOverlapPct(ctx.model, task.lane, item.lane);
			ids.createEl("span", {
				cls: `rl-overlap-${overlapLevel(pct)}`,
				text: `${item.id}${showLane ? ` (${item.lane || "-"})` : ""}`,
			});
		});
	}

	card.createEl("div", {
		cls: `rl-card-row rl-card-state rl-state-${status.className}`,
		text: status.text,
		attr: { "data-row-index": "4", "data-row-visible": presentation.visibleRows >= 4 ? "true" : "false" },
	});
	card.addEventListener("click", () => {
		void openDetail(ctx, task);
	});
	return card;
}

function renderContainerBlock(
	ctx: RenderContext,
	parent: HTMLElement,
	containerTask: Task,
	paths: TaskPath[],
	depth: number,
	filters: Filters
): void {
	const visibleItems = paths.filter((path) => isVisibleTask(path.task, filters));
	const block = parent.createEl("div", {
		cls: "rl-container-block",
		attr: { "data-visible": visibleItems.length > 0 ? "true" : "false" },
	});
	const status = visualStatePresentation(containerTask, ctx.t);
	const label = `${containerTask.id} · ${containerTask.title} · ${formatDuration(containerTask, ctx.model)}`;
	const bar = block.createEl("button", {
		cls: `rl-container-bar rl-state-${status.className}`,
		attr: { type: "button", title: label },
	});
	bar.createEl("span", { cls: "rl-container-bar-text", text: label });
	bar.addEventListener("click", () => {
		void openDetail(ctx, containerTask);
	});
	const children = block.createEl("div", { cls: "rl-container-children" });
	renderTaskPaths(ctx, children, paths, depth + 1, filters);
}

function renderTaskPaths(
	ctx: RenderContext,
	parent: HTMLElement,
	paths: TaskPath[],
	depth: number,
	filters: Filters
): void {
	for (let i = 0; i < paths.length; ) {
		const container = paths[i].ancestors[depth] ?? null;
		if (!container) {
			renderCard(ctx, parent, paths[i].task, filters);
			i++;
			continue;
		}

		const group: TaskPath[] = [];
		while (i < paths.length && paths[i].ancestors[depth]?.id === container.id) {
			group.push(paths[i]);
			i++;
		}
		renderContainerBlock(ctx, parent, container, group, depth, filters);
	}
}

function renderColumn(
	ctx: RenderContext,
	board: HTMLElement,
	id: string,
	title: string,
	meta: string,
	items: Task[],
	filters: Filters,
	tooltip?: string
): void {
	const column = board.createEl("section", {
		cls: "rl-column",
		attr: {
			"data-column-id": id,
			"data-visible": filters.columns.has(id) ? "true" : "false",
		},
	});
	const head = column.createEl("header", { cls: "rl-column-head" });
	if (tooltip) {
		head.setAttribute("aria-label", tooltip);
		head.setAttribute("aria-label-position", "top");
	}
	head.createEl("h3", { text: title });
	head.createEl("span", { text: meta });

	const body = column.createEl("div", { cls: "rl-column-body" });
	const paths = taskPaths(ctx.model, items);
	renderTaskPaths(ctx, body, paths, 0, filters);
	if (paths.length === 0) body.createEl("p", { cls: "rl-empty-column", text: ctx.t("noCards") });
}

type CoordCount = { n: number; color: string };

function coordCounts(pairs: Array<[number, string]>): CoordCount[] {
	return pairs.filter(([n]) => n > 0).map(([n, color]) => ({ n, color }));
}

function renderCoordBlock(
	ctx: RenderContext,
	section: HTMLElement,
	key: string,
	title: string,
	extraClass: string,
	counts: CoordCount[],
	collapsed: Set<string>,
	renderItems: (body: HTMLElement) => void
): void {
	const block = section.createEl("div", {
		cls: `rl-coord-block${extraClass ? ` ${extraClass}` : ""}`,
	});
	block.classList.toggle("rl-coord-block--collapsed", collapsed.has(key));

	const head = block.createEl("div", { cls: "rl-coord-head" });
	head.createEl("h3", { text: title });
	const right = head.createEl("div", { cls: "rl-coord-head-right" });
	if (counts.length > 0) {
		const counter = right.createEl("span", { cls: "rl-coord-count" });
		counts.forEach((count, index) => {
			if (index > 0) counter.createEl("span", { cls: "rl-coord-count-sep", text: "·" });
			counter.createEl("span", { cls: `rl-count-${count.color}`, text: String(count.n) });
		});
	}
	const toggle = right.createEl("button", {
		cls: "rl-coord-toggle",
		text: collapsed.has(key) ? "▼" : "▲",
		attr: { type: "button", "aria-label": ctx.t("toggleSection") },
	});

	renderItems(block.createEl("div", { cls: "rl-coord-body" }));

	toggle.addEventListener("click", () => {
		const next = !block.classList.contains("rl-coord-block--collapsed");
		block.classList.toggle("rl-coord-block--collapsed", next);
		toggle.textContent = next ? "▼" : "▲";
		if (next) collapsed.add(key);
		else collapsed.delete(key);
	});
}

function renderCoordination(ctx: RenderContext, parent: HTMLElement, collapsed: Set<string>): void {
	const section = parent.createEl("section", { cls: "rl-coordination" });

	const overlaps = ctx.model.laneOverlaps.filter((item) => item.pct > 0 && item.common.length > 0);
	const overlapLevels = [0, 0, 0, 0];
	for (const item of overlaps) overlapLevels[overlapLevel(item.pct)] += 1;
	renderCoordBlock(
		ctx,
		section,
		"overlap",
		ctx.t("overlap"),
		"",
		coordCounts([
			[overlapLevels[3], "red"],
			[overlapLevels[2], "orange"],
			[overlapLevels[1], "yellow"],
			[overlapLevels[0], "green"],
		]),
		collapsed,
		(body) => {
			if (overlaps.length === 0) {
				body.createEl("p", { cls: "rl-muted", text: ctx.t("noOverlap") });
				return;
			}
			for (const item of overlaps) {
				const row = body.createEl("div", {
					cls: `rl-coord-item rl-overlap-border-${overlapLevel(item.pct)}`,
				});
				row.createEl("span", { text: `${item.a} <-> ${item.b}` });
				row.createEl("strong", { text: `${item.pct}%` });
				row.createEl("span", { text: item.common.join(", ") || "-" });
			}
		}
	);

	const gates = ctx.model.crossLaneGates;
	const gateStates = { rework: 0, waiting: 0, ready: 0 };
	for (const gate of gates) gateStates[gate.state] += 1;
	renderCoordBlock(
		ctx,
		section,
		"gates",
		ctx.t("gates"),
		"",
		coordCounts([
			[gateStates.rework, "red"],
			[gateStates.waiting, "orange"],
			[gateStates.ready, "green"],
		]),
		collapsed,
		(body) => {
			if (gates.length === 0) {
				body.createEl("p", { cls: "rl-muted", text: ctx.t("noGates") });
				return;
			}
			for (const gate of gates) {
				const label =
					gate.state === "rework"
						? ctx.t("gateRework")
						: gate.state === "ready"
							? ctx.t("gateReady")
							: ctx.t("gateWaiting");
				body.createEl("div", {
					cls: `rl-coord-item rl-gate-${gate.state}`,
					text: `${gate.from} (${gate.fromLane}) -> ${gate.to} (${gate.toLane}) · ${label}`,
				});
			}
		}
	);

	const alerts = ctx.model.alerts.filter(
		(alert) => alert.severity === "error" || !ctx.isAlertAccepted?.(alert)
	);
	const severity = countBySeverity(alerts);
	renderCoordBlock(
		ctx,
		section,
		"alerts",
		ctx.t("alertsTitle"),
		"rl-alerts",
		coordCounts([
			[severity.error, "red"],
			[severity.warning, "orange"],
			[severity.info, "blue"],
		]),
		collapsed,
		(body) => renderAlertItems(ctx, body, alerts)
	);
}

function applyFilters(root: HTMLElement, filters: Filters): void {
	let visibleCards = 0;
	const columnState = columnVisibilityState(filters);
	const board = root.querySelector(".rl-board") as HTMLElement | null;
	board?.style.setProperty("--rl-visible-column-count", `${Math.max(1, columnState.visible.size)}`);

	const cards = Array.from(root.querySelectorAll(".rl-card")) as HTMLElement[];
	for (const card of cards) {
		const search = card.dataset.search || "";
		const type = card.dataset.type || "";
		const maturity = card.dataset.maturity || "";
		const visible =
			(!filters.text || search.includes(filters.text)) &&
			(filters.types.size === 0 || filters.types.has(type)) &&
			(filters.maturity.size === MATURITIES.length || filters.maturity.has(maturity));
		card.dataset.visible = visible ? "true" : "false";
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
		column.dataset.visible = id && columnState.visible.has(id) ? "true" : "false";
	}
	for (const card of cards) {
		const column = card.closest(".rl-column") as HTMLElement | null;
		if (card.dataset.visible === "true" && column?.dataset.visible === "true") visibleCards++;
	}
	filters.columnControl?.update(columnState.visible, columnState.disabled);

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

function renderBoardModeToggle(ctx: RenderContext, parent: HTMLElement): void {
	const group = parent.createEl("div", { cls: "rl-mode-toggle", attr: { role: "group" } });
	const modes: Array<{ mode: BoardMode; label: TranslationKey }> = [
		{ mode: "time", label: "boardModeTime" },
		{ mode: "order", label: "boardModeOrder" },
	];
	for (const item of modes) {
		const active = ctx.boardMode === item.mode;
		const button = group.createEl("button", {
			cls: `rl-mode-button ${active ? "is-active" : ""}`,
			text: ctx.t(item.label),
			attr: {
				type: "button",
				"aria-pressed": active ? "true" : "false",
			},
		});
		button.addEventListener("click", () => {
			if (ctx.boardMode === item.mode) return;
			if (!ctx.setBoardMode) return;
			button.disabled = true;
			ctx.setBoardMode(item.mode);
		});
	}
}

function closeCheckboxDropdowns(root: HTMLElement, except?: HTMLElement): void {
	const panels = Array.from(root.querySelectorAll(".rl-check-panel")) as HTMLElement[];
	for (const panel of panels) {
		if (except && panel === except) continue;
		panel.hidden = true;
		const button = panel.parentElement?.querySelector(".rl-check-button") as HTMLButtonElement | null;
		button?.setAttribute("aria-expanded", "false");
	}
}

function renderCheckboxDropdown(
	ctx: RenderContext,
	parent: HTMLElement,
	dropdownId: string,
	label: string,
	items: CheckboxDropdownItem[],
	selected: Set<string>,
	onChange: () => void,
	options: CheckboxDropdownOptions = {}
): CheckboxDropdownController {
	const wrap = parent.createEl("div", {
		cls: "rl-check-dd",
		attr: { "data-rl-check-dd": dropdownId, "data-label": label },
	});
	const button = wrap.createEl("button", {
		cls: "rl-check-button",
		attr: { type: "button", "aria-haspopup": "true", "aria-expanded": "false" },
	});
	const panel = wrap.createEl("div", { cls: "rl-check-panel" });
	panel.hidden = true;
	const checkboxes = new Map<string, HTMLInputElement>();
	const labels = new Map<string, HTMLElement>();

	const currentChecked = () => options.checked?.() ?? selected;
	const currentDisabled = () => options.disabled?.() ?? new Set<string>();
	const updateState = (checked: Set<string>, disabled: Set<string> = new Set()) => {
		let checkedCount = 0;
		for (const item of items) {
			const checkbox = checkboxes.get(item.id);
			const option = labels.get(item.id);
			if (!checkbox || !option) continue;
			const isChecked = checked.has(item.id);
			const isDisabled = disabled.has(item.id);
			checkbox.checked = isChecked;
			checkbox.disabled = isDisabled;
			option.classList.toggle("is-disabled", isDisabled);
			option.setAttribute("aria-disabled", isDisabled ? "true" : "false");
			if (isChecked) checkedCount++;
		}
		button.textContent = `${label} (${checkedCount})`;
	};

	button.addEventListener("click", () => {
		const willOpen = panel.hidden;
		closeCheckboxDropdowns(ctx.root, panel);
		panel.hidden = !willOpen;
		button.setAttribute("aria-expanded", willOpen ? "true" : "false");
	});

	for (const item of items) {
		const option = panel.createEl("label", { cls: "rl-check-item" });
		const checkbox = option.createEl("input", {
			attr: { type: "checkbox", value: item.id },
		}) as HTMLInputElement;
		checkboxes.set(item.id, checkbox);
		labels.set(item.id, option);
		option.createEl("span", { text: item.label });
		checkbox.addEventListener("change", () => {
			if (checkbox.checked) selected.add(item.id);
			else selected.delete(item.id);
			onChange();
			updateState(currentChecked(), currentDisabled());
		});
	}

	updateState(currentChecked(), currentDisabled());
	return { update: updateState };
}

function renderFilters(ctx: RenderContext, parent: HTMLElement, filters: Filters): void {
	const bar = parent.createEl("section", { cls: "rl-filters" });
	if (ctx.root.dataset.checkDropdownListener !== "true") {
		ctx.root.dataset.checkDropdownListener = "true";
		ctx.root.addEventListener("click", (event) => {
			const target = event.target as HTMLElement | null;
			if (!target?.closest(".rl-check-dd")) closeCheckboxDropdowns(ctx.root);
		});
	}

	const search = bar.createEl("input", {
		cls: "rl-search",
		attr: {
			type: "search",
			placeholder: ctx.t("searchPlaceholder"),
		},
	});
	search.value = filters.text;
	search.addEventListener("input", () => {
		filters.text = search.value.toLowerCase().trim();
		applyFilters(ctx.root, filters);
	});

	renderBoardModeToggle(ctx, bar);

	const typeGroup = bar.createEl("div", { cls: "rl-filter-group" });
	for (const type of FILTERABLE_TYPES) {
		const button = renderFilterButton(typeGroup, type.toUpperCase(), type, filters.types.has(type));
		button.classList.add(`rl-filter-type-${type}`);
		button.addEventListener("click", () => {
			if (filters.types.has(type)) filters.types.delete(type);
			else filters.types.add(type);
			button.classList.toggle("is-active", filters.types.has(type));
			applyFilters(ctx.root, filters);
		});
	}

	renderCheckboxDropdown(
		ctx,
		bar,
		"maturity",
		ctx.t("maturity"),
		MATURITIES.map((item) => ({ id: item, label: item })),
		filters.maturity,
		() => applyFilters(ctx.root, filters)
	);

	filters.columnControl = renderCheckboxDropdown(
		ctx,
		bar,
		"columns",
		ctx.t("columns"),
		filters.columnOrderIds.map((column) => ({
			id: column,
			label: columnLabel(column, ctx),
		})),
		filters.columns,
		() => applyFilters(ctx.root, filters),
		{
			checked: () => columnVisibilityState(filters).visible,
			disabled: () => columnVisibilityState(filters).disabled,
		}
	);

	bar.createEl("span", { cls: "rl-filter-count" });
}

function countBySeverity(alerts: Alert[]): Record<Severity, number> {
	const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
	for (const alert of alerts) counts[alert.severity]++;
	return counts;
}

function renderAlertItems(ctx: RenderContext, body: HTMLElement, alerts: Alert[]): void {
	if (alerts.length === 0) {
		body.createEl("p", { cls: "rl-muted", text: ctx.t("noAlerts") });
		return;
	}
	const order: Severity[] = ["error", "warning", "info"];
	const sorted = [...alerts].sort(
		(a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)
	);
	for (const alert of sorted) {
		const item = body.createEl("div", {
			cls: `rl-coord-item rl-alert-item rl-alert-${alert.severity}`,
		});
		item.createEl("span", { cls: "rl-alert-text", text: formatAlert(alert, ctx.t) });
		const canAccept = alert.severity !== "error" && ctx.acceptAlert !== undefined;
		if (canAccept) {
			const actions = item.createEl("div", { cls: "rl-alert-actions" });
			const accept = actions.createEl("button", {
				cls: "rl-alert-btn",
				text: ctx.t("alertAccept"),
				attr: { type: "button" },
			});
			accept.addEventListener("click", () => {
				accept.disabled = true;
				void ctx.acceptAlert?.(alert);
			});
		}
	}
}

function renderBoard(ctx: RenderContext, parent: HTMLElement, filters: Filters): void {
	const board = parent.createEl("section", { cls: "rl-board" });
	const backlog = [...ctx.model.tasks.values()]
		.filter((task) => !task.isContainer && !task.lane && !task.absorbedBy && task.status !== "done")
		.sort((a, b) => leavesByHierarchy(ctx.model, a, b));
	renderColumn(ctx, board, "backlog", ctx.t("backlog"), `${backlog.length}`, backlog, filters);

	for (const [id, lane] of Object.entries(ctx.model.lanes)) {
		const items = expandLaneItems(ctx.model, lane.queue);
		const duration = items.reduce((sum, task) => sum + task.effectiveHours, 0);
		renderColumn(
			ctx,
			board,
			id,
			`${ctx.t("lanePrefix")} ${id} · ${lane.worktree || "-"}`,
			`${items.length} · ${formatDurationFromHours(duration, ctx.model)}`,
			items,
			filters,
			lane.focus
		);
	}

	const done = [...ctx.model.tasks.values()]
		.filter((task) => !task.isContainer && !task.absorbedBy && task.status === "done")
		.sort((a, b) => leavesByHierarchy(ctx.model, a, b));
	renderColumn(ctx, board, "done", ctx.t("done"), `${done.length}`, done, filters);
}

function openLinkedDetail(ctx: RenderContext, current: Task, id: string): void {
	const target = ctx.model.tasks.get(id);
	if (!target || target.id === current.id) return;
	ctx.detailHistory.push(current.id);
	void openDetail(ctx, target, { keepHistory: true });
}

function openPreviousDetail(ctx: RenderContext): void {
	while (ctx.detailHistory.length > 0) {
		const previousId = ctx.detailHistory.pop();
		const previous = previousId ? ctx.model.tasks.get(previousId) : null;
		if (previous) {
			void openDetail(ctx, previous, { keepHistory: true });
			return;
		}
	}
}

function renderTaskIdLink(ctx: RenderContext, parent: HTMLElement, current: Task, id: string): void {
	if (!ctx.model.tasks.has(id) || id === current.id) {
		parent.createEl("code", { text: id });
		return;
	}
	const link = parent.createEl("a", {
		cls: "rl-detail-task-link",
		text: id,
		attr: { href: "#" },
	});
	link.addEventListener("click", (event) => {
		event.preventDefault();
		openLinkedDetail(ctx, current, id);
	});
}

function renderRelation(ctx: RenderContext, parent: HTMLElement, current: Task, label: string, ids: string[]): void {
	if (ids.length === 0) return;
	const row = parent.createEl("div", { cls: "rl-detail-rel" });
	row.createEl("span", { text: label });
	const values = row.createEl("div");
	for (const id of ids) renderTaskIdLink(ctx, values, current, id);
}

function clampDetailPanelWidth(width: number): number {
	const viewportMax = Math.max(
		DETAIL_PANEL_MIN_WIDTH,
		window.innerWidth - DETAIL_PANEL_VIEWPORT_MARGIN_PX
	);
	const max = Math.min(DETAIL_PANEL_MAX_WIDTH, viewportMax);
	return normalizeDetailPanelWidth(Math.min(max, Math.max(DETAIL_PANEL_MIN_WIDTH, width)));
}

function setDetailPanelWidth(panel: HTMLElement, width: number): void {
	panel.style.setProperty("--rl-detail-panel-width", `${clampDetailPanelWidth(width)}px`);
}

function setupDetailPanelResize(ctx: RenderContext, panel: HTMLElement): void {
	const handle = panel.createEl("div", {
		cls: "rl-detail-resizer",
		attr: {
			role: "separator",
			"aria-label": ctx.t("resizeDetailPanel"),
			title: ctx.t("resizeDetailPanel"),
		},
	});
	let currentWidth = clampDetailPanelWidth(ctx.detailPanelWidth);
	setDetailPanelWidth(panel, currentWidth);

	const onPointerMove = (event: PointerEvent) => {
		currentWidth = clampDetailPanelWidth(window.innerWidth - event.clientX);
		setDetailPanelWidth(panel, currentWidth);
	};

	const stopResize = () => {
		panel.classList.remove("is-resizing", "is-resize-hover");
		document.body.classList.remove("rl-detail-resizing");
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", stopResize);
		window.removeEventListener("pointercancel", stopResize);
		ctx.detailPanelWidth = currentWidth;
		ctx.setDetailPanelWidth?.(currentWidth);
	};

	handle.addEventListener("pointerdown", (event) => {
		event.preventDefault();
		panel.classList.add("is-resizing", "is-resize-hover");
		document.body.classList.add("rl-detail-resizing");
		handle.setPointerCapture(event.pointerId);
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", stopResize);
		window.addEventListener("pointercancel", stopResize);
	});
	handle.addEventListener("mouseenter", () => panel.classList.add("is-resize-hover"));
	handle.addEventListener("mouseleave", () => {
		if (!panel.classList.contains("is-resizing")) panel.classList.remove("is-resize-hover");
	});
}

async function openDetail(
	ctx: RenderContext,
	task: Task,
	options: { keepHistory?: boolean } = {}
): Promise<void> {
	if (!options.keepHistory) ctx.detailHistory = [];
	const existing = ctx.root.querySelector<HTMLElement>(".rl-detail-layer");
	existing?.remove();

	const layer = ctx.root.createEl("div", { cls: "rl-detail-layer" });
	const backdrop = layer.createEl("button", {
		cls: "rl-detail-backdrop",
		attr: { type: "button", "aria-label": ctx.t("close") },
	});
	const panel = layer.createEl("aside", { cls: "rl-detail-panel" });
	setupDetailPanelResize(ctx, panel);
	const head = panel.createEl("header", { cls: "rl-detail-head" });
	const titleGroup = head.createEl("div", { cls: "rl-detail-title-group" });
	const back = titleGroup.createEl("button", {
		cls: "rl-detail-nav-button",
		attr: {
			type: "button",
			"aria-label": ctx.t("detailBack"),
			title: ctx.t("detailBack"),
		},
	});
	appendDetailIcon(back, "arrow-left");
	back.disabled = ctx.detailHistory.length === 0;
	back.addEventListener("click", () => openPreviousDetail(ctx));
	const titleWrap = titleGroup.createEl("div", { cls: "rl-detail-title-id" });
	titleWrap.createEl("span", { cls: "rl-task-id", text: task.id });
	if (task.type) titleWrap.createEl("span", { cls: `rl-type rl-type-${task.type}`, text: task.type });
	const close = head.createEl("button", {
		cls: "rl-detail-close",
		attr: { type: "button", "aria-label": ctx.t("close") },
	});
	appendDetailIcon(close, "x");

	panel.createEl("h2", { text: task.title });
	renderDetailStateLine(panel, task, ctx.t);

	const meta = panel.createEl("dl", { cls: "rl-detail-meta" });
	const addMeta = (label: string, value: string) => {
		meta.createEl("dt", { text: label });
		meta.createEl("dd", { text: value });
	};
	addMeta(ctx.t("status"), task.status || "-");
	addMeta(ctx.t("maturity"), task.maturity || "-");
	addMeta(ctx.t("duration"), formatDurationTooltip(task, ctx.model));
	addMeta(ctx.t("lane"), task.lane || ctx.t("backlog"));
	addMeta(ctx.t("areas"), task.areas.join(", ") || "-");
	addMeta(ctx.t("zones"), task.zones.join(", ") || "-");

	const relations = [
		{ label: ctx.t("parent"), ids: task.parent ? [task.parent] : [] },
		{ label: ctx.t("children"), ids: task.children },
		{ label: ctx.t("dependsOn"), ids: task.depends_on },
		{ label: ctx.t("unlocks"), ids: task.unlocks },
		{ label: ctx.t("absorbs"), ids: task.absorbs },
		{ label: ctx.t("absorbedBy"), ids: task.absorbedBy ? [task.absorbedBy] : [] },
	].filter((relation) => relation.ids.length > 0);
	if (relations.length > 0) {
		const rels = panel.createEl("section", { cls: "rl-detail-relations" });
		for (const relation of relations) renderRelation(ctx, rels, task, relation.label, relation.ids);
	}

	const collisions = collisionsFor(ctx.model, task);
	if (collisions.length > 0) {
		const box = panel.createEl("section", { cls: "rl-detail-overlap" });
		box.createEl("h3", { text: ctx.t("overlapWith") });
		for (const item of collisions) {
			const common = item.zones.filter((zone) => task.zones.includes(zone));
			const row = box.createEl("p", {
				cls: `rl-overlap-${overlapLevel(laneOverlapPct(ctx.model, task.lane, item.lane))}`,
			});
			renderTaskIdLink(ctx, row, task, item.id);
			row.appendText(` (${item.lane}) · ${common.join(", ")}`);
		}
	}

	const body = panel.createEl("section", { cls: "rl-detail-body markdown-rendered" });
	if (task.body) {
		await MarkdownRenderer.render(ctx.app, task.body, body, task._file || "", ctx.component);
	} else {
		body.createEl("p", { cls: "rl-muted", text: ctx.t("noBody") });
	}

	const closeLayer = () => layer.remove();
	backdrop.addEventListener("click", closeLayer);
	close.addEventListener("click", closeLayer);
}

export function renderModel(
	root: HTMLElement,
	model: Model,
	t: Translator,
	app: App,
	component: Component,
	options: RenderModelOptions = {}
): void {
	root.empty();
	root.addClass("roadmap-lanes-view");
	root.toggleClass("rl-compact-types", options.compactTypes === true);
	root.toggleClass("rl-highlight-waiting", options.highlightWaiting === true);
	root.dataset.visibleLabel = t("visible");
	root.dataset.modelReady = "true";
	const boardMode = options.boardMode ?? DEFAULT_BOARD_MODE;
	const hoursPerLine = normalizeHoursPerLine(
		options.hoursPerLine ?? defaultHoursPerLineForHoursPerDay(model.hoursPerDay),
		model.hoursPerDay
	);
	const cardLayout = readCardLayout(root);
	root.dataset.boardMode = boardMode;
	root.style.setProperty(
		"--rl-day-height",
		`${timeCardHeight(model.hoursPerDay / hoursPerLine, cardLayout)}px`
	);

	const ctx: RenderContext = {
		app,
		component,
		root,
		model,
		t,
		detailPanelWidth: normalizeDetailPanelWidth(options.detailPanelWidth),
		boardMode,
		hoursPerLine,
		cardLayout,
		detailHistory: [],
		setDetailPanelWidth: options.setDetailPanelWidth,
		setBoardMode: options.setBoardMode,
		isAlertAccepted: options.isAlertAccepted,
		acceptAlert: options.acceptAlert,
	};
	const columnOrderIds = columnOrder(model);
	const filterState = filterStateForColumns(options.filterState, columnOrderIds);
	const filters: Filters = {
		text: filterState.text,
		types: filterState.types,
		maturity: filterState.maturity,
		columns: filterState.columns,
		columnOrderIds,
		columnCapacity: columnOrderIds.length,
	};

	const header = root.createEl("header", { cls: "rl-topbar" });
	const title = header.createEl("div");
	title.createEl("h2", { text: "Roadmap Lanes" });
	const tasks = [...model.tasks.values()];
	const totalContainers = tasks.filter((task) => task.isContainer).length;
	const totalTasks = tasks.filter((task) => !task.isContainer && !task.absorbedBy).length;
	const projectName = model.projectName || "Roadmap Lanes";
	title.createEl("p", {
		cls: "rl-muted",
		text: `${t("project")} ${projectName} · ${totalTasks} ${t("taskCount")} + ${totalContainers} ${t("containers")}`,
	});

	renderFilters(ctx, root, filters);
	renderCoordination(ctx, root, filterState.coordCollapsed);
	renderBoard(ctx, root, filters);
	setupResponsiveColumns(ctx, filters);
	applyFilters(root, filters);
}

export function renderLoading(root: HTMLElement, t: Translator): void {
	root.empty();
	root.addClass("roadmap-lanes-view");
	root.createEl("h2", { text: "Roadmap Lanes" });
	root.createEl("p", { cls: "rl-muted", text: t("loading") });
}
