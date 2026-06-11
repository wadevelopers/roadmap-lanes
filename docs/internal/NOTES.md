# NOTES

Lista consultable de decisiones tomadas y pendientes/deuda detectada.

## Decisiones tomadas

- **Wikilinks `[[id]]` en las relaciones — ADOPTADO** (jun 2026). Las relaciones (`parent`,
  `depends_on`, `absorbs`) se escriben como **wikilinks entrecomillados** en el frontmatter
  (p. ej. `parent: "[[FT-001]]"`, `depends_on: ["[[FT-002]]"]`). Verificado empíricamente en
  Obsidian 1.4+: funcionan **a la vez** para RL (vía `frontmatterLinks` del `metadataCache`, que
  entrega el destino ya resuelto), para el **grafo y los backlinks nativos**, y para **Dataview**
  (los lee como tipo `Link`) — **sin duplicar campos ni scripts de sincronización**. Justificación
  y tabla de integración en `VISION.md` §8.
  - Reemplaza la antigua nota de la web standalone que lo *difería*: ahí el cálculo era distinto
    (no había `metadataCache`, no se corría dentro de Obsidian, y la doc de Dataview que se
    consultó estaba desactualizada respecto a Obsidian 1.4).
  - El plugin **normaliza** wikilink→id en un único punto (al leer del `metadataCache`).
  - `areas`/`zones` quedan como **arrays planos** (no wikilinks): Dataview los consulta igual y no
    aportan al grafo de dependencias.
- **Frontmatter canónico en inglés — ADOPTADO** (jun 2026). Las claves y valores que el usuario
  escribe en los `.md` son el contrato interno del plugin: `type` (`feat`/`maint`/`infra`/`combo`),
  `maturity` (`raw`/`draft`/`ready`), `status` (`pending`/`done`), `title`, `duration`, `zones`,
  `parent`, `absorbs` y `depends_on`. No hay aliases legacy en español; una capa de alias
  multi-idioma puede agregarse más adelante sobre este contrato canónico si realmente hace falta.
- **Carpeta raíz configurable — ADOPTADO** (jun 2026). RL usa una carpeta dentro del vault para
  todos sus archivos. Por defecto es `roadmap/`, configurable desde las settings nativas del plugin.
  Dentro viven `lanes.yaml`, `taxonomy.yaml` y cualquier `.md` de tareas, incluyendo subcarpetas.
  El plugin crea `roadmap/`, `lanes.yaml` y `taxonomy.yaml` si faltan, pero no crea una carpeta
  `tasks/`.
- **Visualización con herramientas de Obsidian — DOCUMENTADO** (jun 2026). El grafo nativo,
  backlinks y Breadcrumbs son vistas complementarias sobre los mismos wikilinks/frontmatter, pero
  no reemplazan el tablero de RL. Ver `guias/VISUALIZACION_OBSIDIAN.md`.
- **COMBO + duración en horas — ADOPTADO** (jun 2026). Una tarea con hijos se modela como
  `type: combo` y declara `duration`, `maturity` y `status` para Obsidian/Bases/grafo; RL sigue
  derivando los cálculos funcionales desde las hojas y alerta si esos campos se desincronizan.
  `duration` pasa a ser número de horas sin sufijo (`40`, no `5d`), con display convertido a días
  según la jornada configurada.

## Próximos pasos (retomar acá)

> Punto de continuación del proyecto. **Objetivo de la próxima versión: poder trabajar 100% desde la
> aplicación**, sin editar `lanes.yaml` / `taxonomy.yaml` a mano. La publicación en la comunidad de
> Obsidian se hace recién con la **v0.4.0**.

### v0.4.0 — UI de configuración de carriles y taxonomía

Flujo deseado para arrancar un proyecto nuevo, todo desde la app:

1. **Backlog automático — YA IMPLEMENTADO.** RL escanea la carpeta del roadmap (`roadmap/` por
   defecto) vía `metadataCache` y muestra en **backlog** toda tarea **hoja, `status: pending`, no
   absorbida y sin carril asignado**. Es reactivo (se actualiza al editar notas). No hace falta botón.
   (Ref: filtro de `backlog` en `render.ts` y el scan de la carpeta con `getMarkdownFiles` en
   `dataSource.ts`.)
2. **Crear carriles desde la app.** Formulario **modal de alta** para crear carriles **vacíos**
   (escribe en `lanes.yaml`: `focus`, `worktree`, `queue: []`).
3. **Asignar tareas con drag & drop.** Arrastrar tareas entre backlog ↔ carriles (y entre carriles).
   Por debajo = **asignar la tarea a un carril** (agregar/quitar su `id` del `queue` en `lanes.yaml`).
   Todo lo que no está en un carril queda en backlog por defecto.
4. **Botón "limpiar hechas".** Depurar `lanes.yaml`: sacar de los `queue` las tareas con
   `status: done`.
5. **Editar taxonomía desde la app.** UI para `taxonomy.yaml` (áreas/zonas), así no se edita a mano.

Esto implica que el plugin **escriba** en `lanes.yaml` / `taxonomy.yaml` (hoy solo los **lee**;
escritura viable con `vault.adapter.write` / `vault.modify`).

### Publicar en la comunidad de Obsidian (hacer al salir v0.4.0)

Ya hecho: repo público + release.
- Repo: https://github.com/wadevelopers/roadmap-lanes
- Release `0.3.0` con `main.js` + `manifest.json` + `styles.css` adjuntos.

Falta el **PR a `obsidianmd/obsidian-releases`**, agregando esta entrada al **final** del array en
`community-plugins.json`:

```json
{
  "id": "roadmap-lanes",
  "name": "Roadmap Lanes",
  "author": "Martin Wasmosy",
  "description": "Shows a roadmap folder as parallel work-lanes, using estimated time as card height and highlighting where tasks overlap, read from your notes' frontmatter.",
  "repo": "wadevelopers/roadmap-lanes"
}
```

Recordar para el release de v0.4.0:
- Subir versión en `manifest.json`, `package.json` y `versions.json` (mapea versión → `minAppVersion`).
- Crear un GitHub Release con **tag sin `v`** que coincida exacto con `manifest.json` (ej. `0.4.0`),
  adjuntando `main.js` + `manifest.json` + `styles.css` como **assets sueltos** (no zip).
- El PR trae un **checklist** que confirma el autor (que probaste el plugin, leíste las políticas de
  devs, etc.). **Hasta que el PR se mergee, el plugin NO aparece en el buscador in-app** (mientras
  tanto: install manual desde el release, o vía el plugin **BRAT**).
- El PR/review es **solo la primera vez**. Después, para updates: solo nuevo Release + bump de
  versión, sin PR.
