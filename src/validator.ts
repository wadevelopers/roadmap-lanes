import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
	ACCEPTED_ALERTS_FILENAME,
	parseAcceptedAlertsYaml,
} from "./acceptedAlerts";
import { alertFingerprint } from "./alerts";
import { buildModel } from "./buildModel";
import { createTranslatorForLanguage, formatAlert } from "./messages";
import { loadNodeRoadmapData } from "./nodeDataSource";
import { formatDurationBadge } from "./time";
import type { Alert, CrossLaneGate, LaneOverlap, Model, Severity, Task } from "./types";

export type ValidatorLanguage = "en" | "es";

export interface ValidateRoadmapOptions {
	strict?: boolean;
	report?: boolean;
	json?: boolean;
	lang?: ValidatorLanguage;
	hoursPerDay?: number;
}

export interface RoadmapReport {
	nextByLane: Record<string, string | null>;
	crossLaneGates: CrossLaneGate[];
	laneOverlaps: LaneOverlap[];
	counts: {
		backlog: number;
		done: number;
		lanes: Record<string, number>;
	};
}

export interface ValidateRoadmapResult {
	model: Model;
	alerts: Alert[];
	report: RoadmapReport;
	diagnostics: string[];
}

async function readAcceptedFingerprints(roadmapDir: string): Promise<{ fingerprints: Set<string>; diagnostics: string[] }> {
	const path = join(roadmapDir, ACCEPTED_ALERTS_FILENAME);
	try {
		const raw = await readFile(path, "utf8");
		const parsed = parseAcceptedAlertsYaml(raw, path);
		return {
			fingerprints: parsed.fingerprints,
			diagnostics: parsed.warning ? [parsed.warning] : [],
		};
	} catch {
		return { fingerprints: new Set(), diagnostics: [] };
	}
}

function isVisibleBacklogTask(task: Task): boolean {
	return !task.isContainer && !task.lane && !task.absorbedBy && task.status !== "done";
}

function isVisibleDoneTask(task: Task): boolean {
	return !task.isContainer && !task.absorbedBy && task.status === "done";
}

function buildReport(model: Model): RoadmapReport {
	const tasks = [...model.tasks.values()];
	const lanes: Record<string, number> = {};
	for (const [id, lane] of Object.entries(model.lanes)) lanes[id] = lane.queue.length;
	return {
		nextByLane: Object.fromEntries(
			Object.entries(model.lanes).map(([id, lane]) => [id, lane.next])
		),
		crossLaneGates: model.crossLaneGates,
		laneOverlaps: model.laneOverlaps,
		counts: {
			backlog: tasks.filter(isVisibleBacklogTask).length,
			done: tasks.filter(isVisibleDoneTask).length,
			lanes,
		},
	};
}

export async function validateRoadmapDirectory(
	roadmapDir: string,
	options: ValidateRoadmapOptions = {}
): Promise<ValidateRoadmapResult> {
	const data = await loadNodeRoadmapData(roadmapDir, { hoursPerDay: options.hoursPerDay });
	const model = buildModel(data);
	const accepted = await readAcceptedFingerprints(roadmapDir);
	const alerts = model.alerts.filter(
		(alert) => alert.severity === "error" || !accepted.fingerprints.has(alertFingerprint(alert))
	);
	return {
		model,
		alerts,
		report: buildReport(model),
		diagnostics: accepted.diagnostics,
	};
}

export function validationExitCode(alerts: Alert[], strict = false): number {
	return alerts.some((alert) => alert.severity === "error" || (strict && alert.severity === "warning"))
		? 1
		: 0;
}

function alertId(alert: Alert): string {
	const id = alert.taskId ?? alert.params?.id ?? alert.params?.file;
	return id === undefined ? "-" : String(id);
}

function severityRank(severity: Severity): number {
	return severity === "error" ? 0 : severity === "warning" ? 1 : 2;
}

export function formatAlertsText(alerts: Alert[], language: ValidatorLanguage = "en"): string {
	const t = createTranslatorForLanguage(language);
	if (alerts.length === 0) return t("noAlerts");
	return [...alerts]
		.sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
		.map((alert) => `${alert.severity.toUpperCase()} ${alertId(alert)} ${formatAlert(alert, t)}`)
		.join("\n");
}

function durationForTask(model: Model, id: string | null, hoursPerDay?: number): string {
	if (!id) return "-";
	const task = model.tasks.get(id);
	if (!task) return id;
	const hours = task.effectiveHours;
	if (hoursPerDay) return `${id} (${hours}h, ${formatDurationBadge(hours, hoursPerDay)})`;
	return `${id} (${hours}h)`;
}

export function formatReportText(
	model: Model,
	report: RoadmapReport,
	options: { hoursPerDay?: number } = {}
): string {
	const lines: string[] = ["Report", "Next by lane:"];
	for (const [lane, next] of Object.entries(report.nextByLane)) {
		lines.push(`  ${lane}: ${durationForTask(model, next, options.hoursPerDay)}`);
	}
	lines.push("Cross-lane gates:");
	if (report.crossLaneGates.length === 0) {
		lines.push("  none");
	} else {
		for (const gate of report.crossLaneGates) {
			lines.push(`  ${gate.from} (${gate.fromLane}) -> ${gate.to} (${gate.toLane}): ${gate.state}`);
		}
	}
	lines.push("Lane overlap:");
	const overlaps = report.laneOverlaps.filter((overlap) => overlap.common.length > 0);
	if (overlaps.length === 0) {
		lines.push("  none");
	} else {
		for (const overlap of overlaps) {
			lines.push(`  ${overlap.a} <-> ${overlap.b}: ${overlap.pct}% ${overlap.common.join(", ")}`);
		}
	}
	lines.push("Counts:");
	lines.push(`  backlog: ${report.counts.backlog}`);
	for (const [lane, count] of Object.entries(report.counts.lanes)) {
		lines.push(`  lane ${lane}: ${count}`);
	}
	lines.push(`  done: ${report.counts.done}`);
	return lines.join("\n");
}

export function validationJsonPayload(result: ValidateRoadmapResult, includeReport = false): unknown {
	if (!includeReport) return result.alerts;
	return { alerts: result.alerts, report: result.report };
}
