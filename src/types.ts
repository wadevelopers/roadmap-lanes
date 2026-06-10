export const TYPES = ["feat", "maint", "infra", "combo"] as const;
export const FILTERABLE_TYPES = ["feat", "maint", "infra"] as const;
export const MATURITIES = ["raw", "draft", "ready"] as const;
export const STATUSES = ["pending", "done"] as const;

export type TaskType = (typeof TYPES)[number];
export type TaskMaturity = (typeof MATURITIES)[number];
export type TaskStatus = (typeof STATUSES)[number];
export type VisualState = "done" | "out-of-turn" | "next" | "waiting" | "in-progress";

export type Severity = "error" | "warning" | "info";

export type AlertCode =
	| "missing-id"
	| "duplicate-id"
	| "invalid-type"
	| "invalid-maturity"
	| "invalid-status"
	| "invalid-duration"
	| "missing-parent"
	| "missing-dependency"
	| "missing-absorbed"
	| "missing-lane-task"
	| "duplicate-lane"
	| "unknown-area"
	| "unknown-zone"
	| "combo-missing-type"
	| "combo-on-leaf"
	| "combo-impossible-duration"
	| "combo-duration-too-high"
	| "combo-missing-duration"
	| "combo-maturity-too-high"
	| "combo-maturity-too-low"
	| "combo-missing-maturity"
	| "combo-should-be-done"
	| "combo-falsely-done"
	| "combo-missing-status";

export interface Alert {
	code: AlertCode;
	severity: Severity;
	taskId?: string;
	params?: Record<string, string | number | boolean>;
}

export interface RawTask {
	id?: string;
	title?: string;
	type?: string;
	maturity?: string;
	status?: string;
	duration?: number | string;
	areas?: string[];
	zones?: string[];
	parent?: string | null;
	absorbs?: string[];
	depends_on?: string[];
	body?: string;
	_file?: string;
}

export interface Task extends RawTask {
	id: string;
	title: string;
	type?: TaskType;
	maturity?: TaskMaturity;
	status?: TaskStatus;
	areas: string[];
	zones: string[];
	parent: string | null;
	absorbs: string[];
	depends_on: string[];
	children: string[];
	unlocks: string[];
	absorbedBy: string | null;
	isContainer: boolean;
	durationHours: number | null;
	effectiveHours: number;
	blocked: boolean;
	visualState: VisualState;
	waitingFor: string[];
	lane: string | null;
	position: number | null;
}

export interface TaxonomyArea {
	zones?: string[];
}

export interface Taxonomy {
	areas?: Record<string, TaxonomyArea>;
}

export interface LaneInput {
	focus?: string;
	worktree?: string;
	queue?: string[];
}

export type LanesInput = Record<string, LaneInput>;

export interface LaneModel {
	focus: string;
	worktree: string;
	queue: string[];
	next: string | null;
}

export interface LaneOverlap {
	a: string;
	b: string;
	common: string[];
	pct: number;
}

export interface CrossLaneGate {
	from: string;
	fromLane: string;
	to: string;
	toLane: string;
	open: boolean;
}

export interface BuildModelInput {
	tasks: RawTask[];
	taxonomy: Taxonomy;
	lanes: LanesInput;
	hoursPerDay?: number;
	projectName?: string;
}

export interface Model {
	projectName?: string;
	tasks: Map<string, Task>;
	lanes: Record<string, LaneModel>;
	taxonomy: Taxonomy;
	hoursPerDay: number;
	laneZones: Record<string, string[]>;
	laneOverlaps: LaneOverlap[];
	crossLaneGates: CrossLaneGate[];
	alerts: Alert[];
}
