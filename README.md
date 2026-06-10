# Roadmap Lanes — plugin de Obsidian

Tablero de **carriles de trabajo en paralelo** sobre tus notas markdown: usa el
**tiempo estimado como altura** de cada tarjeta (Gantt vertical) y muestra el
**solape** entre tareas de carriles distintos. Lee el *frontmatter* de las notas
vía el índice nativo de Obsidian — **sin build ni base de datos**.

Es la migración de la web standalone `roadmap-lanes` (congelada en `v0.2.0`) a un
plugin. La visión y las especificaciones se portan al `docs/` de este repo.

## Estado

Plugin funcional en desarrollo: carga datos desde `app.metadataCache`, lee
`roadmap/lanes.yaml` y `roadmap/taxonomy.yaml`, renderiza el tablero, el panel de
detalle, alertas del modelo, solape entre carriles y gates cruzados.

## Desarrollo

Requisitos: Node 18+.

    npm install
    npm run dev        # compila main.ts -> main.js en modo watch

Para probarlo, el plugin debe vivir en la carpeta de plugins de un vault de prueba:

    <vault>/.obsidian/plugins/roadmap-lanes/

con `main.js`, `manifest.json` y `styles.css` (podés enlazar este repo ahí con un
symlink). Activalo en *Ajustes → Plugins de la comunidad* y abrí el tablero con el
comando **"Abrir tablero de carriles"** o el icono de la barra lateral.

`npm run build` genera la versión de producción (sin sourcemaps, minificada).

## Estructura

- `main.ts` — entry del plugin + la vista (`ItemView`).
- `manifest.json` / `versions.json` — metadata del plugin.
- `esbuild.config.mjs` — bundler.
- `styles.css` — estilos (deben usar las variables de tema de Obsidian).
- `src/` — core del modelo, lectura de datos, render e i18n.
- `docs/` — visión, guías y planes de evolución.
