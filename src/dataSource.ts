import { normalizePath, type App, type CachedMetadata, type FrontmatterLinkCache, type TFile } from "obsidian";
import * as yaml from "js-yaml";

import type { BuildModelInput, LanesInput, RawTask, Taxonomy } from "./types";
import { DEFAULT_SETTINGS, normalizeRoadmapFolder } from "./settings";
import { DEFAULT_HOURS_PER_DAY, normalizeHoursPerDay, type HoursPerDay } from "./time";
import { basenameFromLink, normalizeRelationValue, type RelationField } from "./relations";
import { hasFrontmatterBlock, parseTaskSource, type ParsedTaskSource } from "./taskSource";

export interface RoadmapDataSourceOptions {
	roadmapFolder?: string;
	hoursPerDay?: HoursPerDay;
}

const DEFAULT_OPTIONS: Required<RoadmapDataSourceOptions> = {
	roadmapFolder: DEFAULT_SETTINGS.roadmapFolder,
	hoursPerDay: DEFAULT_HOURS_PER_DAY,
};

const LANES_FILENAME = "lanes.yaml";
const TAXONOMY_FILENAME = "taxonomy.yaml";

const DEFAULT_LANES = `# Roadmap Lanes lane order.
# Tasks not listed in any queue stay in backlog.

lanes:
  A:
    focus: Main work
    worktree: main
    queue: []
  B:
    focus: Parallel work
    worktree: side
    queue: []
`;

const DEFAULT_TAXONOMY = `# Roadmap Lanes taxonomy.
# Add areas and zones before assigning them to tasks.

areas: {}
`;

function resolveOptions(options: RoadmapDataSourceOptions = {}): Required<RoadmapDataSourceOptions> {
	return {
		roadmapFolder: normalizeRoadmapFolder(options.roadmapFolder ?? DEFAULT_OPTIONS.roadmapFolder),
		hoursPerDay: normalizeHoursPerDay(options.hoursPerDay ?? DEFAULT_OPTIONS.hoursPerDay),
	};
}

function roadmapPath(options: Required<RoadmapDataSourceOptions>, file: string): string {
	return normalizePath(`${options.roadmapFolder}/${file}`);
}

async function ensureFolder(app: App, folder: string): Promise<void> {
	let current = "";
	for (const part of folder.split("/")) {
		current = current ? `${current}/${part}` : part;
		if (!(await app.vault.adapter.exists(current))) await app.vault.createFolder(current);
	}
}

async function ensureFile(app: App, path: string, contents: string): Promise<void> {
	if (!(await app.vault.adapter.exists(path))) await app.vault.create(path, contents);
}

export async function ensureRoadmapStructure(
	app: App,
	options: RoadmapDataSourceOptions = {}
): Promise<void> {
	const resolved = resolveOptions(options);
	await ensureFolder(app, resolved.roadmapFolder);
	await ensureFile(app, roadmapPath(resolved, LANES_FILENAME), DEFAULT_LANES);
	await ensureFile(app, roadmapPath(resolved, TAXONOMY_FILENAME), DEFAULT_TAXONOMY);
}

function linksForKey(cache: CachedMetadata | null, key: RelationField): FrontmatterLinkCache[] {
	return (cache?.frontmatterLinks || []).filter(
		(link) => link.key === key || link.key.startsWith(`${key}.`)
	);
}

function relationList(cache: CachedMetadata | null, key: RelationField, fallback: unknown): string[] {
	const links = linksForKey(cache, key);
	if (links.length > 0) return links.map((link) => basenameFromLink(link.link));
	return normalizeRelationValue(fallback);
}

async function parseTask(app: App, file: TFile, cache: CachedMetadata | null): Promise<ParsedTaskSource> {
	const frontmatter = cache?.frontmatter || {};
	const raw = await app.vault.cachedRead(file);
	return parseTaskSource({
		file: file.path,
		basename: file.basename,
		raw,
		frontmatter,
		hasFrontmatter: hasFrontmatterBlock(raw),
		relationList: (key, fallback) => relationList(cache, key, fallback),
	});
}

async function loadYaml<T>(app: App, path: string, fallback: T): Promise<T> {
	try {
		const raw = await app.vault.adapter.read(path);
		return (yaml.load(raw) as T | undefined) || fallback;
	} catch (error) {
		console.error(`Roadmap Lanes: could not read ${path}`, error);
		return fallback;
	}
}

export async function loadRoadmapData(
	app: App,
	options: RoadmapDataSourceOptions = {}
): Promise<BuildModelInput> {
	// Read-only on purpose: this runs on every watcher-triggered render, and creating
	// files here races against git operations that remove the roadmap folder (branch
	// switches). Structure creation belongs to deliberate actions only (plugin load,
	// settings change, board open).
	const resolved = resolveOptions(options);
	const folderPrefix = `${resolved.roadmapFolder}/`;
	const files = app.vault
		.getMarkdownFiles()
		.filter((file) => file.path.startsWith(folderPrefix))
		.sort((a, b) => a.path.localeCompare(b.path));

	const parsedTasks = await Promise.all(
		files.map((file) => parseTask(app, file, app.metadataCache.getFileCache(file)))
	);
	const tasks: RawTask[] = parsedTasks.map((parsed) => parsed.task);
	const sourceAlerts = parsedTasks.flatMap((parsed) => parsed.alerts);
	const taxonomy = await loadYaml<Taxonomy>(app, roadmapPath(resolved, TAXONOMY_FILENAME), {
		areas: {},
	});
	const lanesYaml = await loadYaml<{ lanes?: LanesInput }>(
		app,
		roadmapPath(resolved, LANES_FILENAME),
		{
			lanes: {},
		}
	);

	return {
		projectName: app.vault.getName(),
		tasks,
		taxonomy,
		lanes: lanesYaml.lanes || {},
		hoursPerDay: resolved.hoursPerDay,
		sourceAlerts,
	};
}

export function isRoadmapSourcePath(path: string, options: RoadmapDataSourceOptions = {}): boolean {
	const resolved = resolveOptions(options);
	const folderPrefix = `${resolved.roadmapFolder}/`;
	return path === resolved.roadmapFolder || path.startsWith(folderPrefix);
}
