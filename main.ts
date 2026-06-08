import {
	ItemView,
	Plugin,
	PluginSettingTab,
	Setting,
	type App,
	type TAbstractFile,
	type WorkspaceLeaf,
} from "obsidian";

import { buildModel } from "./src/buildModel";
import { ensureRoadmapStructure, isRoadmapSourcePath, loadRoadmapData } from "./src/dataSource";
import { createTranslator, type Translator } from "./src/i18n";
import { renderLoading, renderModel } from "./src/render";
import {
	DEFAULT_SETTINGS,
	normalizeRoadmapFolder,
	normalizeSettings,
	type RoadmapLanesSettings,
} from "./src/settings";

export const VIEW_TYPE_ROADMAP = "roadmap-lanes-view";

class RoadmapLanesView extends ItemView {
	private readonly plugin: RoadmapLanesPlugin;
	private renderRequest: number | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: RoadmapLanesPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ROADMAP;
	}

	getDisplayText(): string {
		return "Roadmap Lanes";
	}

	getIcon(): string {
		return "columns-3";
	}

	async onOpen(): Promise<void> {
		this.containerEl.addClass("roadmap-lanes-leaf");
		await this.renderRoadmap();
	}

	async onClose(): Promise<void> {
		this.containerEl.removeClass("roadmap-lanes-leaf");
		if (this.renderRequest !== null) {
			window.clearTimeout(this.renderRequest);
			this.renderRequest = null;
		}
	}

	queueRender(): void {
		if (this.renderRequest !== null) window.clearTimeout(this.renderRequest);
		this.renderRequest = window.setTimeout(() => {
			this.renderRequest = null;
			void this.renderRoadmap();
		}, 100);
	}

	private async renderRoadmap(): Promise<void> {
		const root = this.contentEl;
		renderLoading(root, this.plugin.translate);
		const data = await loadRoadmapData(this.app, this.plugin.settings);
		const model = buildModel(data);
		renderModel(root, model, this.plugin.translate, this.app, this);
	}
}

class RoadmapLanesSettingTab extends PluginSettingTab {
	private readonly plugin: RoadmapLanesPlugin;

	constructor(app: App, plugin: RoadmapLanesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: this.plugin.translate("settingsTitle") });

		new Setting(containerEl)
			.setName(this.plugin.translate("roadmapFolderSetting"))
			.setDesc(this.plugin.translate("roadmapFolderDesc"))
			.addText((text) => {
				const commit = async () => {
					const next = normalizeRoadmapFolder(text.getValue());
					text.setValue(next);
					if (next === this.plugin.settings.roadmapFolder) return;
					this.plugin.settings.roadmapFolder = next;
					await this.plugin.saveSettings();
					this.plugin.refreshOpenViews();
				};
				text.setPlaceholder(DEFAULT_SETTINGS.roadmapFolder).setValue(this.plugin.settings.roadmapFolder);
				text.inputEl.addEventListener("blur", () => {
					void commit();
				});
				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						void commit();
					}
				});
			});
	}
}

export default class RoadmapLanesPlugin extends Plugin {
	translate: Translator = createTranslator();
	settings: RoadmapLanesSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		this.translate = createTranslator();
		await this.loadSettings();
		await ensureRoadmapStructure(this.app, this.settings);
		this.registerView(
			VIEW_TYPE_ROADMAP,
			(leaf) => new RoadmapLanesView(leaf, this)
		);
		this.addSettingTab(new RoadmapLanesSettingTab(this.app, this));

		this.addRibbonIcon("columns-3", this.translate("openRibbon"), () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-roadmap-lanes",
			name: this.translate("openCommand"),
			callback: () => void this.activateView(),
		});

		this.registerRoadmapEvents();
	}

	onunload(): void {}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_ROADMAP)[0];
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE_ROADMAP, active: true });
		}
		await workspace.revealLeaf(leaf);
	}

	async loadSettings(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
	}

	async saveSettings(): Promise<void> {
		this.settings = normalizeSettings(this.settings);
		await this.saveData(this.settings);
		await ensureRoadmapStructure(this.app, this.settings);
	}

	private registerRoadmapEvents(): void {
		const onFileChange = (file: TAbstractFile) => {
			if (isRoadmapSourcePath(file.path, this.settings)) this.refreshOpenViews();
		};

		this.registerEvent(this.app.vault.on("modify", onFileChange));
		this.registerEvent(this.app.vault.on("create", onFileChange));
		this.registerEvent(this.app.vault.on("delete", onFileChange));
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (isRoadmapSourcePath(file.path, this.settings)) this.refreshOpenViews();
			})
		);
	}

	refreshOpenViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_ROADMAP)) {
			const view = leaf.view;
			if (view instanceof RoadmapLanesView) view.queueRender();
		}
	}
}
