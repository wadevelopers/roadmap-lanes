import { Plugin, ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_ROADMAP = "roadmap-lanes-view";

/**
 * Vista del tablero de carriles.
 *
 * Por ahora es un placeholder. La migración porta aquí:
 *  - el core (derivación de estados, solape, gates) desde `src/buildModel.js`
 *    de la web standalone (repo `roadmap-lanes`, congelado en v0.2.0), y
 *  - el render del tablero (desde `web/tablero.js` + `web/tablero.css`).
 *
 * A diferencia de la web, los datos NO salen de un `datos.js` precompilado:
 * salen del índice nativo de Obsidian (`app.metadataCache`), que se mantiene
 * solo y se actualiza al guardar un `.md` — sin paso de build.
 */
class RoadmapLanesView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
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
		const root = this.contentEl;
		root.empty();
		root.addClass("roadmap-lanes-view");
		root.createEl("h2", { text: "Roadmap Lanes" });
		root.createEl("p", {
			cls: "rl-placeholder",
			text: "Scaffold del plugin listo. Aquí se renderiza el tablero de carriles.",
		});
	}

	async onClose(): Promise<void> {
		// Sin recursos que liberar todavía.
	}
}

export default class RoadmapLanesPlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerView(
			VIEW_TYPE_ROADMAP,
			(leaf) => new RoadmapLanesView(leaf)
		);

		this.addRibbonIcon("columns-3", "Abrir Roadmap Lanes", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-roadmap-lanes",
			name: "Abrir tablero de carriles",
			callback: () => void this.activateView(),
		});
	}

	onunload(): void {
		// Obsidian cierra las hojas de la vista registrada al desactivar el plugin.
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_ROADMAP)[0];
		if (!leaf) {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({ type: VIEW_TYPE_ROADMAP, active: true });
		}
		await workspace.revealLeaf(leaf);
	}
}
