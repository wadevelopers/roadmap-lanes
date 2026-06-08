# NOTES

Lista consultable de decisiones tomadas y pendientes/deuda detectada.

## Decisiones tomadas

- **Wikilinks `[[id]]` en las relaciones — ADOPTADO** (jun 2026). Las relaciones (`padre`,
  `depende_de`, `absorbe`) se escriben como **wikilinks entrecomillados** en el frontmatter
  (p. ej. `padre: "[[FT-001]]"`, `depende_de: ["[[FT-002]]"]`). Verificado empíricamente en
  Obsidian 1.4+: funcionan **a la vez** para RL (vía `frontmatterLinks` del `metadataCache`, que
  entrega el destino ya resuelto), para el **grafo y los backlinks nativos**, y para **Dataview**
  (los lee como tipo `Link`) — **sin duplicar campos ni scripts de sincronización**. Justificación
  y tabla de integración en `VISION.md` §8.
  - Reemplaza la antigua nota de la web standalone que lo *difería*: ahí el cálculo era distinto
    (no había `metadataCache`, no se corría dentro de Obsidian, y la doc de Dataview que se
    consultó estaba desactualizada respecto a Obsidian 1.4).
  - El plugin **normaliza** wikilink→id en un único punto (al leer del `metadataCache`).
  - `areas`/`zonas` quedan como **arrays planos** (no wikilinks): Dataview los consulta igual y no
    aportan al grafo de dependencias.

## Pendientes

### Roadmap operativo post-port del core/tablero

- **Settings del plugin.** Agregar `PluginSettingTab` y persistencia con `loadData`/`saveData` para:
  carpeta de tareas, path de `carriles.yaml`, path de `taxonomia.yaml`, horas por día y modo
  tiempo/orden. Esto elimina los defaults hardcodeados del demo.
- **Modo expandir/contraer tiempo.** Implementar el switch Gantt/orden y la jornada configurable
  según `PLAN_expandir_contraer_tiempo.md`.
- **Panel de detalle.** Mejorar acciones y navegación: abrir la nota original, resolver/abrir links
  internos, y pulir el layout de relaciones.
- **Render/UX fino.** Revisar iconos de madurez/absorción/solape, tratamiento visual de gates,
  estados, filtros y comportamiento en ventanas angostas.
- **Preparación para publicación.** Revisar `manifest.json`, versionado, README público, instrucciones
  de uso, archivos de release y checklist para comunidad de Obsidian.
- **Cobertura adicional.** Agregar tests para duración en horas/fracciones, datasource con wikilinks
  y casos de regresión del modelo.
- **Aplicación a documentación real.** Planificar cómo adaptar/crear tareas para
  `/mnt/minis_forum/wadev/doc/roadmap-pending`. Ese repo se usa como fuente de lectura salvo
  autorización explícita para escribir ahí.
