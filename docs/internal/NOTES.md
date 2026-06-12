# NOTES

Lista consultable de decisiones tomadas y pendientes.

## Decisiones tomadas

- **Wikilinks `[[id]]` en las relaciones — ADOPTADO** (jun 2026). Las relaciones (`parent`,
  `depends_on`, `absorbs`, `part_of`) se escriben como **wikilinks entrecomillados** en el frontmatter
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
  escribe en los `.md` son el contrato interno del plugin: `type` (`feat`/`maint`/`infra`/`combo`/`doc`),
  `maturity` (`raw`/`draft`/`ready`), `status` (`pending`/`done`), `title`, `duration`, `zones`,
  `parent`, `absorbs`, `depends_on` y `part_of`. No hay aliases legacy en español; una capa de alias
  multi-idioma puede agregarse más adelante sobre este contrato canónico si realmente hace falta.
- **Carpeta raíz configurable — ADOPTADO** (jun 2026). RL usa una carpeta dentro del vault para
  todos sus archivos. Por defecto es `roadmap/`, configurable desde las settings nativas del plugin.
  Dentro viven `lanes.yaml`, `taxonomy.yaml` y cualquier `.md` de tareas o partes (`type: doc`),
  incluyendo subcarpetas.
  El plugin crea `roadmap/`, `lanes.yaml` y `taxonomy.yaml` si faltan, pero no crea una carpeta
  `tasks/`.
- **Visualización con herramientas de Obsidian — DOCUMENTADO** (jun 2026). El grafo nativo,
  backlinks y Breadcrumbs son vistas complementarias sobre los mismos wikilinks/frontmatter, pero
  no reemplazan el tablero de RL. Ver `../guides.es/VISUALIZACION.md`.
- **Estado escrito `in-progress` para hojas — DESCARTADO, YAGNI** (jun 2026). Evaluado al mapear
  un caso real con 2 carriles paralelos ("¿qué está haciendo cada carril ahora?"). Se descarta:
  RL organiza **orden y prioridad**, no tracking de ejecución (VISION §10); el estado virtual
  `next` + la asignación a lane ya responden lo accionable; y un `in-progress` escrito sería
  estado mantenido a mano que alguien debe recordar poner/sacar — el anti-patrón que RL elimina.
- **COMBO + duración en horas — ADOPTADO** (jun 2026). Una tarea con hijos se modela como
  `type: combo` y declara `duration`, `maturity` y `status` para Obsidian/Bases/grafo; RL sigue
  derivando los cálculos funcionales desde las hojas y alerta si esos campos se desincronizan.
  `duration` pasa a ser número de horas sin sufijo (`40`, no `5d`), con display convertido a días
  según la jornada configurada.
- **Partes de tarea (`type: doc` + `part_of`) — ADOPTADO** (jun 2026). Un `.md` dentro de
  `roadmap/` puede declararse documento acompañante de una tarea: queda fuera del tablero pero es
  navegable desde el panel de detalle, con identidad por path (basenames duplicados entre
  subcarpetas son válidos). Semántica completa en `VISION.es.md` §7.3; diseño y desvíos en
  `planes/10_PARTES_DE_TAREA.md`.

## Pendientes

- **Plan 09 — integración git por lane (opcional).** Automatiza un check que hoy es manual;
  promover solo si el uso real lo pide. Ver `planes/09_INTEGRACION_GIT_POR_LANE.md`.

### UI de configuración de carriles y taxonomía — "algún día"

> Degradado de "próxima versión" a "algún día" (2026-06-11): el usuario actual no lo necesita (los
> archivos los escribe una IA; editar YAML no es fricción). Cobra valor recién con usuarios de la
> comunidad que operen RL a mano — re-priorizar si aparece esa demanda.

Flujo deseado para arrancar un proyecto nuevo, todo desde la app:

1. **Crear carriles desde la app.** Formulario modal de alta para carriles **vacíos** (escribe en
   `lanes.yaml`: `focus`, `worktree`, `queue: []`).
2. **Asignar tareas con drag & drop** entre backlog ↔ carriles (y entre carriles). Por debajo =
   agregar/quitar el `id` de la tarea del `queue` en `lanes.yaml`.
3. **Botón "limpiar hechas".** Depurar `lanes.yaml`: sacar de los `queue` las tareas con
   `status: done`.
4. **Editar taxonomía desde la app.** UI para `taxonomy.yaml` (áreas/zonas).

Implica que el plugin **escriba** en `lanes.yaml` / `taxonomy.yaml` (hoy solo los **lee**; escritura
viable con `vault.adapter.write` / `vault.modify`).

### Publicar en la comunidad de Obsidian

Repo público y release `0.3.0` ya publicados (https://github.com/wadevelopers/roadmap-lanes). Falta
el **PR a `obsidianmd/obsidian-releases`**, agregando esta entrada al **final** del array en
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

Recordar para el release que acompañe la publicación:
- Subir versión en `manifest.json`, `package.json` y `versions.json` (mapea versión → `minAppVersion`).
- Crear un GitHub Release con **tag sin `v`** que coincida exacto con `manifest.json` (ej. `0.4.0`),
  adjuntando `main.js` + `manifest.json` + `styles.css` como **assets sueltos** (no zip).
- El PR trae un **checklist** que confirma el autor (que probaste el plugin, leíste las políticas de
  devs, etc.). **Hasta que el PR se mergee, el plugin NO aparece en el buscador in-app** (mientras
  tanto: install manual desde el release, o vía el plugin **BRAT**).
- El PR/review es **solo la primera vez**. Después, para updates: solo nuevo Release + bump de
  versión, sin PR.
