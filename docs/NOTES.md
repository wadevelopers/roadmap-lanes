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

## Pendientes

### Roadmap operativo post-port del core/tablero

- **Settings adicionales del plugin.** Ya existe `PluginSettingTab` y persistencia con
  `loadData`/`saveData` para `roadmapFolder`. Falta agregar horas por día y modo tiempo/orden.
- **Modo expandir/contraer tiempo.** Implementar el switch Gantt/orden y la jornada configurable
  según `planes/05_EXPANDIR_CONTRAER_TIEMPO.md`.
- **Panel de detalle.** Mejorar acciones y navegación: abrir la nota original, resolver/abrir links
  internos, y pulir el layout de relaciones.
- **Render/UX fino.** Revisar iconos de madurez/absorción/solape, tratamiento visual de gates,
  estados, filtros y comportamiento en ventanas angostas.
- **Preparación para publicación.** Revisar `manifest.json`, versionado, README público, instrucciones
  de uso, archivos de release y checklist para comunidad de Obsidian.
- **Cobertura adicional.** Agregar tests para datasource con wikilinks y casos de regresión del
  modelo.
- **Aplicación a documentación real.** Planificar cómo adaptar/crear tareas para
  `/mnt/minis_forum/wadev/doc/roadmap-pending`. Ese repo se usa como fuente de lectura salvo
  autorización explícita para escribir ahí.
