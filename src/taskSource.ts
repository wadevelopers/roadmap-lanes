import { RELATION_FIELDS, hasExplicitEmptyRelation, type RelationField } from "./relations";
import { DOC_TYPE, type Alert, type RawTask } from "./types";

export interface TaskSource {
	file: string;
	basename: string;
	raw: string;
	frontmatter: Record<string, unknown>;
	hasFrontmatter: boolean;
	relationList: (key: RelationField, fallback: unknown) => string[];
}

export interface ParsedTaskSource {
	task: RawTask;
	alerts: Alert[];
}

export function markdownBody(raw: string): string {
	const lines = raw.split(/\r?\n/);
	if (lines[0]?.trim() !== "---") return raw.trim();
	const end = lines.indexOf("---", 1);
	if (end === -1) return "";
	return lines.slice(end + 1).join("\n").trim();
}

export function hasFrontmatterBlock(raw: string): boolean {
	const lines = raw.split(/\r?\n/);
	return lines[0]?.trim() === "---" && lines.indexOf("---", 1) !== -1;
}

function stringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function relationSingle(source: TaskSource, key: RelationField): string | null {
	return source.relationList(key, source.frontmatter[key])[0] || null;
}

function relationMany(source: TaskSource, key: RelationField): string[] {
	return source.relationList(key, source.frontmatter[key]);
}

export function parseTaskSource(source: TaskSource): ParsedTaskSource {
	const frontmatter = source.frontmatter;
	const id =
		typeof frontmatter.id === "string"
			? frontmatter.id
			: source.hasFrontmatter
				? undefined
				: source.basename;
	const title = typeof frontmatter.title === "string" ? frontmatter.title : source.basename;
	const alerts: Alert[] = [];

	if (!source.hasFrontmatter) {
		alerts.push({
			code: "missing-frontmatter",
			severity: "error",
			taskId: id,
			params: { file: source.file },
		});
	}

	for (const field of RELATION_FIELDS) {
		if (!hasExplicitEmptyRelation(frontmatter[field])) continue;
		alerts.push({
			code: "empty-relation-field",
			severity: "error",
			taskId: id,
			params: { id: id ?? source.file, field },
		});
	}

	const partOf = relationSingle(source, "part_of");
	// El vacío explícito ya disparó empty-relation-field arriba; solo el ausente
	// (o irresoluble, ej. part_of: []) cae acá.
	if (
		frontmatter.type === DOC_TYPE &&
		!partOf &&
		!hasExplicitEmptyRelation(frontmatter.part_of)
	) {
		alerts.push({
			code: "doc-without-task",
			severity: "error",
			params: { file: source.file },
		});
	}

	return {
		task: {
			id,
			title,
			type: typeof frontmatter.type === "string" ? frontmatter.type : undefined,
			maturity: typeof frontmatter.maturity === "string" ? frontmatter.maturity : undefined,
			status: typeof frontmatter.status === "string" ? frontmatter.status : undefined,
			duration:
				typeof frontmatter.duration === "number" || typeof frontmatter.duration === "string"
					? frontmatter.duration
					: undefined,
			areas: stringList(frontmatter.areas),
			zones: stringList(frontmatter.zones),
			parent: relationSingle(source, "parent"),
			absorbs: relationMany(source, "absorbs"),
			depends_on: relationMany(source, "depends_on"),
			part_of: partOf,
			body: markdownBody(source.raw),
			_file: source.file,
		},
		alerts,
	};
}
