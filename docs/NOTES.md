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

- (sin pendientes/deuda registrados por ahora)
