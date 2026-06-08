import { Plugin, ItemView, type TAbstractFile, type WorkspaceLeaf } from "obsidian";

import { buildModel } from "./src/buildModel";
import { isRoadmapSourcePath, loadRoadmapData } from "./src/dataSource";
import { createTranslator, type Translator } from "./src/i18n";
import { renderLoading, renderModel } from "./src/render";

export const VIEW_TYPE_ROADMAP = "roadmap-lanes-view";

class RoadmapLanesView extends ItemView {
	private readonly translate: Translator;
	private renderRequest: number | null = null;

	constructor(leaf: WorkspaceLeaf, translate: Translator) {
		super(leaf);
		this.translate = translate;
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
		await this.renderRoadmap();
	}

	async onClose(): Promise<void> {
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
		renderLoading(root, this.translate);
		const data = await loadRoadmapData(this.app);
		const model = buildModel(data);
		renderModel(root, model, this.translate, this.app, this);
	}
}

export default class RoadmapLanesPlugin extends Plugin {
	private translate: Translator = createTranslator();

	async onload(): Promise<void> {
		this.translate = createTranslator();
		this.registerView(
			VIEW_TYPE_ROADMAP,
			(leaf) => new RoadmapLanesView(leaf, this.translate)
		);

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

	private registerRoadmapEvents(): void {
		const onFileChange = (file: TAbstractFile) => {
			if (isRoadmapSourcePath(file.path)) this.refreshOpenViews();
		};

		this.registerEvent(this.app.vault.on("modify", onFileChange));
		this.registerEvent(this.app.vault.on("create", onFileChange));
		this.registerEvent(this.app.vault.on("delete", onFileChange));
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (isRoadmapSourcePath(file.path)) this.refreshOpenViews();
			})
		);
	}

	private refreshOpenViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_ROADMAP)) {
			const view = leaf.view;
			if (view instanceof RoadmapLanesView) view.queueRender();
		}
	}
}
