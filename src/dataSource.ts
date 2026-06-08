import type { App, CachedMetadata, FrontmatterLinkCache, TFile } from "obsidian";
import * as yaml from "js-yaml";

import type { BuildModelInput, CarrilesInput, RawTarea, Taxonomia } from "./types";

export interface RoadmapDataSourceOptions {
	tareasFolder?: string;
	carrilesPath?: string;
	taxonomiaPath?: string;
	horasPorDia?: number;
}

const DEFAULT_OPTIONS: Required<RoadmapDataSourceOptions> = {
	tareasFolder: "tareas",
	carrilesPath: "carriles.yaml",
	taxonomiaPath: "taxonomia.yaml",
	horasPorDia: 8,
};

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

function parseTask(file: TFile, cache: CachedMetadata | null): RawTarea {
	const frontmatter = cache?.frontmatter || {};
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
	const resolved = { ...DEFAULT_OPTIONS, ...options };
	const folderPrefix = `${resolved.tareasFolder.replace(/\/$/, "")}/`;
	const files = app.vault
		.getMarkdownFiles()
		.filter((file) => file.path.startsWith(folderPrefix))
		.sort((a, b) => a.path.localeCompare(b.path));

	const tareas = files.map((file) => parseTask(file, app.metadataCache.getFileCache(file)));
	const taxonomia = await loadYaml<Taxonomia>(app, resolved.taxonomiaPath, { areas: {} });
	const carrilesYaml = await loadYaml<{ carriles?: CarrilesInput }>(app, resolved.carrilesPath, {
		carriles: {},
	});

	return {
		tareas,
		taxonomia,
		carriles: carrilesYaml.carriles || {},
		horasPorDia: resolved.horasPorDia,
	};
}

export function isRoadmapSourcePath(path: string, options: RoadmapDataSourceOptions = {}): boolean {
	const resolved = { ...DEFAULT_OPTIONS, ...options };
	const folderPrefix = `${resolved.tareasFolder.replace(/\/$/, "")}/`;
	return (
		path.startsWith(folderPrefix) ||
		path === resolved.carrilesPath ||
		path === resolved.taxonomiaPath
	);
}
