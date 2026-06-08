import { normalizePath, type App, type CachedMetadata, type FrontmatterLinkCache, type TFile } from "obsidian";
import * as yaml from "js-yaml";

import type { BuildModelInput, CarrilesInput, RawTarea, Taxonomia } from "./types";
import { DEFAULT_SETTINGS, normalizeRoadmapFolder } from "./settings";

export interface RoadmapDataSourceOptions {
	roadmapFolder?: string;
	horasPorDia?: number;
}

const DEFAULT_OPTIONS: Required<RoadmapDataSourceOptions> = {
	roadmapFolder: DEFAULT_SETTINGS.roadmapFolder,
	horasPorDia: 8,
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
		horasPorDia: options.horasPorDia ?? DEFAULT_OPTIONS.horasPorDia,
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

function basenameFromLink(link: string): string {
	const clean = link.split("#")[0].replace(/\.md$/i, "");
	const parts = clean.split("/");
	return parts[parts.length - 1] || clean;
}

function normalizeRelationValue(value: unknown): string[] {
	const values = Array.isArray(value) ? value : value ? [value] : [];
	return values
		.filter((item): item is string => typeof item === "string")
		.map((item) => {
			const match = item.match(/^\[\[([^|\]#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/);
			return basenameFromLink(match ? match[1] : item);
		})
		.filter((item) => item.length > 0);
}

function linksForKey(cache: CachedMetadata | null, key: string): FrontmatterLinkCache[] {
	return (cache?.frontmatterLinks || []).filter(
		(link) => link.key === key || link.key.startsWith(`${key}.`)
	);
}

function relationList(cache: CachedMetadata | null, key: string, fallback: unknown): string[] {
	const links = linksForKey(cache, key);
	if (links.length > 0) return links.map((link) => basenameFromLink(link.link));
	return normalizeRelationValue(fallback);
}

function relationSingle(cache: CachedMetadata | null, key: string, fallback: unknown): string | null {
	return relationList(cache, key, fallback)[0] || null;
}

function stringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function markdownBody(raw: string): string {
	const lines = raw.split(/\r?\n/);
	if (lines[0]?.trim() !== "---") return raw.trim();
	const end = lines.indexOf("---", 1);
	if (end === -1) return "";
	return lines.slice(end + 1).join("\n").trim();
}

async function parseTask(app: App, file: TFile, cache: CachedMetadata | null): Promise<RawTarea> {
	const frontmatter = cache?.frontmatter || {};
	const raw = await app.vault.cachedRead(file);
	return {
		id: typeof frontmatter.id === "string" ? frontmatter.id : file.basename,
		titulo: typeof frontmatter.titulo === "string" ? frontmatter.titulo : file.basename,
		tipo: typeof frontmatter.tipo === "string" ? frontmatter.tipo : undefined,
		madurez: typeof frontmatter.madurez === "string" ? frontmatter.madurez : undefined,
		estado: typeof frontmatter.estado === "string" ? frontmatter.estado : undefined,
		duracion: typeof frontmatter.duracion === "string" ? frontmatter.duracion : undefined,
		areas: stringList(frontmatter.areas),
		zonas: stringList(frontmatter.zonas),
		padre: relationSingle(cache, "padre", frontmatter.padre),
		absorbe: relationList(cache, "absorbe", frontmatter.absorbe),
		depende_de: relationList(cache, "depende_de", frontmatter.depende_de),
		cuerpo: markdownBody(raw),
		_archivo: file.path,
	};
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
	const resolved = resolveOptions(options);
	await ensureRoadmapStructure(app, resolved);
	const folderPrefix = `${resolved.roadmapFolder}/`;
	const files = app.vault
		.getMarkdownFiles()
		.filter((file) => file.path.startsWith(folderPrefix))
		.sort((a, b) => a.path.localeCompare(b.path));

	const tareas = await Promise.all(
		files.map((file) => parseTask(app, file, app.metadataCache.getFileCache(file)))
	);
	const taxonomia = await loadYaml<Taxonomia>(app, roadmapPath(resolved, TAXONOMY_FILENAME), {
		areas: {},
	});
	const lanesYaml = await loadYaml<{ lanes?: CarrilesInput; carriles?: CarrilesInput }>(
		app,
		roadmapPath(resolved, LANES_FILENAME),
		{
			lanes: {},
		}
	);

	return {
		projectName: app.vault.getName(),
		tareas,
		taxonomia,
		carriles: lanesYaml.lanes || lanesYaml.carriles || {},
		horasPorDia: resolved.horasPorDia,
	};
}

export function isRoadmapSourcePath(path: string, options: RoadmapDataSourceOptions = {}): boolean {
	const resolved = resolveOptions(options);
	const folderPrefix = `${resolved.roadmapFolder}/`;
	return path === resolved.roadmapFolder || path.startsWith(folderPrefix);
}
