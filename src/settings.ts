export interface RoadmapLanesSettings {
	roadmapFolder: string;
}

export const DEFAULT_SETTINGS: RoadmapLanesSettings = {
	roadmapFolder: "roadmap",
};

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
	};
}
