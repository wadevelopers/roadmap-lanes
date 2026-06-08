export interface RoadmapLanesSettings {
	roadmapFolder: string;
	detailPanelWidth: number;
}

export const DEFAULT_SETTINGS: RoadmapLanesSettings = {
	roadmapFolder: "roadmap",
	detailPanelWidth: 460,
};

export const DETAIL_PANEL_MIN_WIDTH = 360;
export const DETAIL_PANEL_MAX_WIDTH = 1100;

export function normalizeRoadmapFolder(value: unknown): string {
	if (typeof value !== "string") return DEFAULT_SETTINGS.roadmapFolder;
	const parts = value
		.trim()
		.replace(/\\/g, "/")
		.split("/")
		.map((part) => part.trim())
		.filter((part) => part.length > 0 && part !== "." && part !== "..");
	return parts.join("/") || DEFAULT_SETTINGS.roadmapFolder;
}

export function normalizeSettings(value: unknown): RoadmapLanesSettings {
	const raw = (value || {}) as Partial<RoadmapLanesSettings>;
	return {
		roadmapFolder: normalizeRoadmapFolder(raw.roadmapFolder),
		detailPanelWidth: normalizeDetailPanelWidth(raw.detailPanelWidth),
	};
}

export function normalizeDetailPanelWidth(value: unknown): number {
	const parsed = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS.detailPanelWidth;
	return Math.round(
		Math.min(DETAIL_PANEL_MAX_WIDTH, Math.max(DETAIL_PANEL_MIN_WIDTH, parsed))
	);
}
