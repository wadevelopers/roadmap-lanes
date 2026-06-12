import {
	MATURITIES,
	STATUSES,
	TYPES,
	type Alert,
	type AlertCode,
	type BuildModelInput,
	type LanesInput,
	type Model,
	type RawTask,
	type Severity,
	type Task,
	type TaskMaturity,
	type TaskStatus,
	type TaskType,
} from "./types";
import { normalizeHoursPerDay } from "./time";

function isType(value: unknown): value is TaskType {
	return typeof value === "string" && TYPES.includes(value as TaskType);
}

function isMaturity(value: unknown): value is TaskMaturity {
	return typeof value === "string" && MATURITIES.includes(value as TaskMaturity);
}

function isStatus(value: unknown): value is TaskStatus {
	return typeof value === "string" && STATUSES.includes(value as TaskStatus);
}

function normalizeStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function normalizeParent(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function parseDurationHours(
	duration: number | string | undefined
): { hours: number | null; invalid: boolean } {
	if (duration === undefined || duration === "") return { hours: null, invalid: false };
	if (typeof duration === "number") {
		return Number.isFinite(duration) && duration >= 0
			? { hours: duration, invalid: false }
			: { hours: null, invalid: true };
	}

	const trimmed = duration.trim();
	if (trimmed.length === 0) return { hours: null, invalid: false };
	if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return { hours: null, invalid: true };

	const hours = Number(trimmed);
	return Number.isFinite(hours) && hours >= 0
		? { hours, invalid: false }
		: { hours: null, invalid: true };
}

function createTask(raw: RawTask): Task | null {
	if (!raw.id) return null;
	return {
		...raw,
		id: raw.id,
		title: raw.title ?? raw.id,
		type: isType(raw.type) ? raw.type : undefined,
		maturity: isMaturity(raw.maturity) ? raw.maturity : undefined,
		status: isStatus(raw.status) ? raw.status : undefined,
		areas: normalizeStringList(raw.areas),
		zones: normalizeStringList(raw.zones),
		parent: normalizeParent(raw.parent),
		absorbs: normalizeStringList(raw.absorbs),
		depends_on: normalizeStringList(raw.depends_on),
		children: [],
		unlocks: [],
		absorbedBy: null,
		isContainer: false,
		durationHours: null,
		effectiveHours: 0,
		blocked: false,
		visualState: "waiting",
		waitingFor: [],
		lane: null,
		position: null,
	};
}

function normalizeLanes(lanes: LanesInput): LanesInput {
	const result: LanesInput = {};
	for (const [id, lane] of Object.entries(lanes)) {
		result[id] = {
			focus: lane.focus ?? "",
			worktree: lane.worktree ?? "",
			queue: normalizeStringList(lane.queue),
		};
	}
	return result;
}

export function buildModel(input: BuildModelInput): Model {
	const alerts: Alert[] = [];
	const alert = (
		code: AlertCode,
		severity: Severity,
		params?: Alert["params"],
		taskId?: string
	) => {
		alerts.push({ code, severity, params, taskId });
	};
	const byId = new Map<string, Task>();
	const rawById = new Map<string, RawTask>();
	const hoursPerDay = normalizeHoursPerDay(input.hoursPerDay);
	const lanes = normalizeLanes(input.lanes);

	for (const raw of input.tasks) {
		if (!raw.id) {
			alert("missing-id", "error", { file: raw._file || "(task without file)" });
			continue;
		}
		if (byId.has(raw.id)) alert("duplicate-id", "error", { id: raw.id }, raw.id);
		const task = createTask(raw);
		if (task) {
			byId.set(task.id, task);
			rawById.set(task.id, raw);
		}
	}

	const validAreas = new Set(Object.keys(input.taxonomy.areas || {}));
	const validZones = new Set<string>();
	for (const area of Object.values(input.taxonomy.areas || {})) {
		for (const zone of area.zones || []) validZones.add(zone);
	}

	const exists = (id: string): boolean => byId.has(id);

	for (const task of byId.values()) {
		const raw = rawById.get(task.id);
		if (raw?.type && !isType(raw.type)) {
			alert("invalid-type", "error", { id: task.id, value: raw.type }, task.id);
		}
		if (raw?.maturity && !isMaturity(raw.maturity)) {
			alert("invalid-maturity", "error", { id: task.id, value: raw.maturity }, task.id);
		}

		for (const area of task.areas) {
			if (!validAreas.has(area)) alert("unknown-area", "warning", { id: task.id, value: area }, task.id);
		}
		for (const zone of task.zones) {
			if (!validZones.has(zone)) alert("unknown-zone", "warning", { id: task.id, value: zone }, task.id);
		}

		if (task.parent && !exists(task.parent)) {
			alert("missing-parent", "error", { id: task.id, ref: task.parent }, task.id);
		}
		for (const dependency of task.depends_on) {
			if (!exists(dependency)) {
				alert("missing-dependency", "error", { id: task.id, ref: dependency }, task.id);
			}
		}
		for (const absorbed of task.absorbs) {
			if (!exists(absorbed)) {
				alert("missing-absorbed", "error", { id: task.id, ref: absorbed }, task.id);
			}
		}

		const duration = parseDurationHours(task.duration);
		if (duration.invalid) {
			alert("invalid-duration", "error", { id: task.id, value: String(task.duration) }, task.id);
		}
		task.durationHours = duration.hours;
	}

	for (const task of byId.values()) {
		if (task.parent && byId.has(task.parent)) byId.get(task.parent)?.children.push(task.id);
		for (const dependency of task.depends_on) {
			if (byId.has(dependency)) byId.get(dependency)?.unlocks.push(task.id);
		}
	}

	const absorbedBy = new Map<string, string>();
	for (const task of byId.values()) {
		for (const absorbed of task.absorbs) {
			if (byId.has(absorbed)) absorbedBy.set(absorbed, task.id);
		}
	}

	for (const task of byId.values()) {
		task.absorbedBy = absorbedBy.get(task.id) || null;
		task.isContainer = task.children.length > 0;
		const raw = rawById.get(task.id);
		if (raw?.status && !isStatus(raw.status)) {
			alert("invalid-status", "error", { id: task.id, value: raw.status }, task.id);
		}
	}

	const effectiveHours = (id: string, seen = new Set<string>()): number => {
		const task = byId.get(id);
		if (!task) return 0;
		if (seen.has(id)) return 0;
		seen.add(id);
		if (!task.isContainer) return task.durationHours ?? 0;
		return task.children.reduce((sum, child) => sum + effectiveHours(child, seen), 0);
	};
	for (const task of byId.values()) task.effectiveHours = effectiveHours(task.id);

	const isDone = (task: Task): boolean =>
		task.isContainer
			? task.children.length > 0 &&
			  task.children.every((child) => {
				  const childTask = byId.get(child);
				  return childTask ? isDone(childTask) : false;
			  })
			: task.status === "done";

	const hasDoneLeaf = (task: Task, seen = new Set<string>()): boolean => {
		if (seen.has(task.id)) return false;
		seen.add(task.id);
		if (!task.isContainer) return task.status === "done";
		return task.children.some((child) => {
			const childTask = byId.get(child);
			return childTask ? hasDoneLeaf(childTask, seen) : false;
		});
	};

	const collectLeaves = (task: Task, seen = new Set<string>()): Task[] => {
		if (seen.has(task.id)) return [];
		seen.add(task.id);
		if (!task.isContainer) return [task];
		return task.children.flatMap((child) => {
			const childTask = byId.get(child);
			return childTask ? collectLeaves(childTask, seen) : [];
		});
	};

	const expandQueue = (queue: string[]): string[] => {
		const out: string[] = [];
		const seen = new Set<string>();
		for (const id of queue) {
			const task = byId.get(id);
			if (!task) continue;
			for (const leaf of collectLeaves(task)) {
				if (seen.has(leaf.id)) continue;
				seen.add(leaf.id);
				out.push(leaf.id);
			}
		}
		return out;
	};

	const blockedMemo = new Map<string, boolean>();
	const isBlocked = (task: Task, seen = new Set<string>()): boolean => {
		if (blockedMemo.has(task.id)) return blockedMemo.get(task.id) ?? false;
		if (seen.has(task.id)) return false;
		seen.add(task.id);
		const blockedByDependency = task.depends_on.some((dependency) => {
			const dep = byId.get(dependency);
			return !dep || !isDone(dep);
		});
		const parent = task.parent ? byId.get(task.parent) : null;
		const blockedByParent = parent ? isBlocked(parent, seen) : false;
		const blocked = blockedByDependency || blockedByParent;
		blockedMemo.set(task.id, blocked);
		return blocked;
	};

	for (const task of byId.values()) {
		task.blocked = isBlocked(task);
	}

	for (const [laneId, lane] of Object.entries(lanes)) {
		for (const [index, id] of (lane.queue || []).entries()) {
			const task = byId.get(id);
			if (!task) {
				alert("missing-lane-task", "error", { lane: laneId, id });
				continue;
			}
			if (task.isContainer) {
				if (task.lane) alert("duplicate-lane", "error", { id, laneA: task.lane, laneB: laneId }, id);
				task.lane = laneId;
				task.position = index;
			}
			for (const leaf of collectLeaves(task)) {
				if (leaf.lane) {
					alert("duplicate-lane", "error", { id: leaf.id, laneA: leaf.lane, laneB: laneId }, leaf.id);
				}
				leaf.lane = laneId;
				leaf.position = index;
			}
		}
	}

	const minMaturity = (leaves: Task[]): TaskMaturity | null => {
		const values = leaves
			.map((leaf) => leaf.maturity)
			.filter((value): value is TaskMaturity => value !== undefined);
		if (values.length === 0) return null;
		return values.reduce((min, value) =>
			MATURITIES.indexOf(value) < MATURITIES.indexOf(min) ? value : min
		);
	};

	const comboDurationBounds = (leaves: Task[]): { sum: number; lowerBound: number } => {
		const sum = leaves.reduce((total, leaf) => total + leaf.effectiveHours, 0);
		const longestTask = leaves.reduce(
			(max, leaf) => Math.max(max, leaf.effectiveHours),
			0
		);
		const byLane = new Map<string, number>();
		for (const leaf of leaves) {
			if (!leaf.lane) continue;
			byLane.set(leaf.lane, (byLane.get(leaf.lane) ?? 0) + leaf.effectiveHours);
		}
		const busiestLane = [...byLane.values()].reduce(
			(max, hours) => Math.max(max, hours),
			0
		);
		return { sum, lowerBound: Math.max(longestTask, busiestLane) };
	};

	for (const task of byId.values()) {
		const raw = rawById.get(task.id);
		if (!task.isContainer) {
			if (raw?.type === "combo") alert("combo-on-leaf", "warning", { id: task.id }, task.id);
			continue;
		}

		const leaves = collectLeaves(task);
		if (raw?.type !== "combo") alert("combo-missing-type", "warning", { id: task.id }, task.id);

		const { sum, lowerBound } = comboDurationBounds(leaves);
		if (task.durationHours === null) {
			alert("combo-missing-duration", "warning", { id: task.id, sum }, task.id);
		} else if (task.durationHours < lowerBound) {
			alert(
				"combo-impossible-duration",
				"error",
				{ id: task.id, declared: task.durationHours, lowerBound },
				task.id
			);
		} else if (task.durationHours > sum) {
			alert(
				"combo-duration-too-high",
				"warning",
				{ id: task.id, declared: task.durationHours, sum },
				task.id
			);
		}

		const derivedMaturity = minMaturity(leaves);
		if (derivedMaturity) {
			if (!raw?.maturity) {
				alert("combo-missing-maturity", "info", { id: task.id, derived: derivedMaturity }, task.id);
			} else if (task.maturity) {
				const declaredRank = MATURITIES.indexOf(task.maturity);
				const derivedRank = MATURITIES.indexOf(derivedMaturity);
				if (declaredRank > derivedRank) {
					alert(
						"combo-maturity-too-high",
						"warning",
						{ id: task.id, declared: task.maturity, derived: derivedMaturity },
						task.id
					);
				} else if (declaredRank < derivedRank) {
					alert(
						"combo-maturity-too-low",
						"info",
						{ id: task.id, declared: task.maturity, derived: derivedMaturity },
						task.id
					);
				}
			}
		}

		const expected = isDone(task) ? "done" : "pending";
		if (!raw?.status) {
			alert("combo-missing-status", "info", { id: task.id, expected }, task.id);
		} else if (task.status) {
			if (task.status === "done" && expected !== "done") {
				alert(
					"combo-falsely-done",
					"warning",
					{ id: task.id, declared: task.status, expected },
					task.id
				);
			} else if (task.status !== "done" && expected === "done") {
				alert(
					"combo-should-be-done",
					"warning",
					{ id: task.id, declared: task.status, expected },
					task.id
				);
			}
		}
	}

	const laneModels: Model["lanes"] = {};
	for (const [laneId, lane] of Object.entries(lanes)) {
		const queue = expandQueue(lane.queue || []);
		const next = queue.find((id) => {
			const task = byId.get(id);
			return task !== undefined && task.status !== "done" && !task.blocked;
		});
		laneModels[laneId] = {
			focus: lane.focus || "",
			worktree: lane.worktree || "",
			queue,
			next: next || null,
		};
	}

	for (const [laneId, lane] of Object.entries(laneModels)) {
		if (!lane.next) continue;
		const task = byId.get(lane.next);
		const raw = rawById.get(lane.next);
		if (!task || (raw?.maturity && !isMaturity(raw.maturity))) continue;
		if (!task.maturity) {
			alert("maturity-missing-on-next", "warning", { lane: laneId, id: lane.next }, lane.next);
		} else if (task.maturity !== "ready") {
			alert(
				"maturity-not-ready-on-next",
				"warning",
				{ lane: laneId, id: task.id, maturity: task.maturity },
				task.id
			);
		}
	}

	const nextByLane = new Set<string>();
	for (const lane of Object.values(laneModels)) {
		if (lane.next) nextByLane.add(lane.next);
	}

	const waitingMemo = new Map<string, string[]>();
	const waitingForTask = (task: Task, seen = new Set<string>()): string[] => {
		if (waitingMemo.has(task.id)) return waitingMemo.get(task.id) ?? [];
		if (seen.has(task.id)) return [];
		seen.add(task.id);
		const waitingFor = task.depends_on.filter((dependency) => {
			const dep = byId.get(dependency);
			return !dep || !isDone(dep);
		});
		const parent = task.parent ? byId.get(task.parent) : null;
		for (const id of parent ? waitingForTask(parent, seen) : []) {
			if (!waitingFor.includes(id)) waitingFor.push(id);
		}
		waitingMemo.set(task.id, waitingFor);
		return waitingFor;
	};

	for (const task of byId.values()) {
		task.waitingFor = waitingForTask(task);
		if (task.isContainer) {
			task.visualState = isDone(task)
				? "done"
				: hasDoneLeaf(task)
					? "in-progress"
					: task.blocked
						? "out-of-turn"
						: "waiting";
		} else if (task.status === "done") {
			task.visualState = "done";
		} else if (task.blocked) {
			task.visualState = "out-of-turn";
		} else if (nextByLane.has(task.id)) {
			task.visualState = "next";
		} else {
			task.visualState = "waiting";
		}
	}

	const laneZones: Record<string, string[]> = {};
	for (const laneId of Object.keys(laneModels)) {
		const zones = new Set<string>();
		for (const id of laneModels[laneId].queue) {
			const task = byId.get(id);
			if (task && task.status !== "done") {
				for (const zone of task.zones) zones.add(zone);
			}
		}
		laneZones[laneId] = [...zones];
	}

	const laneIds = Object.keys(lanes);
	const laneOverlaps: Model["laneOverlaps"] = [];
	for (let i = 0; i < laneIds.length; i++) {
		for (let j = i + 1; j < laneIds.length; j++) {
			const aId = laneIds[i];
			const bId = laneIds[j];
			const a = new Set(laneZones[aId]);
			const b = new Set(laneZones[bId]);
			const common = [...a].filter((zone) => b.has(zone));
			const minSize = Math.min(a.size, b.size) || 1;
			laneOverlaps.push({
				a: aId,
				b: bId,
				common,
				pct: Math.round((common.length / minSize) * 100),
			});
		}
	}

	const crossLaneGates: Model["crossLaneGates"] = [];
	for (const task of byId.values()) {
		for (const dependency of task.depends_on) {
			const dep = byId.get(dependency);
			if (dep && task.lane && dep.lane && task.lane !== dep.lane) {
				const fromDone = isDone(task);
				const toDone = isDone(dep);
				if (fromDone && toDone) continue;
				crossLaneGates.push({
					from: task.id,
					fromLane: task.lane,
					to: dependency,
					toLane: dep.lane,
					state: fromDone ? "rework" : toDone ? "ready" : "waiting",
				});
			}
		}
	}

	return {
		projectName: input.projectName,
		tasks: byId,
		lanes: laneModels,
		taxonomy: input.taxonomy,
		hoursPerDay,
		laneZones,
		laneOverlaps,
		crossLaneGates,
		alerts,
	};
}
