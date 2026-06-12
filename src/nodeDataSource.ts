import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import * as yaml from "js-yaml";

import { normalizeRelationValue, type RelationField } from "./relations";
import { parseTaskSource } from "./taskSource";
import { DEFAULT_HOURS_PER_DAY, normalizeHoursPerDay } from "./time";
import type { Alert, BuildModelInput, LanesInput, RawTask, Taxonomy } from "./types";

const LANES_FILENAME = "lanes.yaml";
const TAXONOMY_FILENAME = "taxonomy.yaml";

export interface NodeRoadmapDataSourceOptions {
	hoursPerDay?: number;
	projectName?: string;
}

interface SplitFrontmatterResult {
	frontmatter: Record<string, unknown>;
	hasFrontmatter: boolean;
}

async function listMarkdownFiles(dir: string, prefix = ""): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
			const abs = join(dir, entry.name);
			if (entry.isDirectory()) return listMarkdownFiles(abs, rel);
			return entry.isFile() && entry.name.endsWith(".md") ? [rel] : [];
		})
	);
	return files.flat().sort((a, b) => a.localeCompare(b));
}

function splitFrontmatter(raw: string): SplitFrontmatterResult {
	const lines = raw.split(/\r?\n/);
	if (lines[0]?.trim() !== "---") return { frontmatter: {}, hasFrontmatter: false };
	const end = lines.indexOf("---", 1);
	if (end === -1) return { frontmatter: {}, hasFrontmatter: false };
	const parsed = yaml.load(lines.slice(1, end).join("\n"));
	const frontmatter =
		parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	return { frontmatter, hasFrontmatter: true };
}

async function readYaml<T>(path: string, fallback: T): Promise<T> {
	try {
		const raw = await readFile(path, "utf8");
		return (yaml.load(raw) as T | undefined) || fallback;
	} catch {
		return fallback;
	}
}

async function parseTaskFile(roadmapDir: string, file: string): Promise<{ task: RawTask; alerts: Alert[] }> {
	const absolute = join(roadmapDir, file);
	const raw = await readFile(absolute, "utf8");
	const { frontmatter, hasFrontmatter } = splitFrontmatter(raw);
	const parsed = parseTaskSource({
		file: file.replace(/\\/g, "/"),
		basename: basename(file, extname(file)),
		raw,
		frontmatter,
		hasFrontmatter,
		relationList: (_key: RelationField, fallback: unknown) => normalizeRelationValue(fallback),
	});
	return parsed;
}

function defaultProjectName(roadmapDir: string): string {
	const parent = basename(join(roadmapDir, ".."));
	return parent || basename(roadmapDir) || "Roadmap Lanes";
}

export async function loadNodeRoadmapData(
	roadmapDir: string,
	options: NodeRoadmapDataSourceOptions = {}
): Promise<BuildModelInput> {
	const files = await listMarkdownFiles(roadmapDir);
	const parsedTasks = await Promise.all(files.map((file) => parseTaskFile(roadmapDir, file)));
	const lanesYaml = await readYaml<{ lanes?: LanesInput }>(join(roadmapDir, LANES_FILENAME), {
		lanes: {},
	});
	const taxonomy = await readYaml<Taxonomy>(join(roadmapDir, TAXONOMY_FILENAME), { areas: {} });
	const projectName = options.projectName ?? defaultProjectName(roadmapDir);

	return {
		projectName,
		tasks: parsedTasks.map((parsed) => parsed.task),
		taxonomy,
		lanes: lanesYaml.lanes || {},
		hoursPerDay: normalizeHoursPerDay(options.hoursPerDay ?? DEFAULT_HOURS_PER_DAY),
		sourceAlerts: parsedTasks.flatMap((parsed) => parsed.alerts),
	};
}
