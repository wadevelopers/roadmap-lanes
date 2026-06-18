export const RELATION_FIELDS = ["parent", "absorbs", "depends_on", "part_of"] as const;

export type RelationField = (typeof RELATION_FIELDS)[number];

export function basenameFromLink(link: string): string {
	const clean = link.split("#")[0].replace(/\.md$/i, "");
	const parts = clean.split("/");
	return parts[parts.length - 1] || clean;
}

function relationValues(value: unknown): unknown[] {
	if (Array.isArray(value)) return value.flatMap((item) => relationValues(item));
	return value ? [value] : [];
}

export function normalizeRelationValue(value: unknown): string[] {
	return relationValues(value)
		.filter((item): item is string => typeof item === "string")
		.map((item) => {
			const match = item.match(/^\[\[([^|\]#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/);
			return basenameFromLink(match ? match[1] : item);
		})
		.filter((item) => item.length > 0);
}

export function hasExplicitEmptyRelation(value: unknown): boolean {
	if (typeof value === "string") return value === "";
	if (!Array.isArray(value)) return false;
	return value.some((item) => hasExplicitEmptyRelation(item));
}
