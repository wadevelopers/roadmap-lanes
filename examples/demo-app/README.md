# Dataset de ejemplo - DemoApp

Proyecto ficticio que sirve de **fixture visual** para desarrollar y probar Roadmap Lanes. No es código real: son tareas inventadas para validar el modo `time`, el modo `order` y la escala configurable de horas.

## Qué ejercita

| Caso | Dónde |
|---|---|
| Duraciones de 1h a 16h | `TIME-01` ... `TIME-16` |
| Tarea larga junto a stack de tareas cortas | `TIME-15` vs. `TIME-01` ... `TIME-05` |
| Stack corto contra tarea media | `TIME-01` ... `TIME-03` vs. `TIME-06` |
| Stack medio contra tarea hecha | `TIME-06` + `TIME-10` vs. `TIME-16` |
| Combos anidados | `COMBO-SHORT` -> `COMBO-SHORT-LOW` -> `TIME-01` ... `TIME-03` |
| Backlog sin carril | `TIME-07`, `TIME-08`, `TIME-09`, `COMBO-BACKLOG` |
| Duraciones no múltiplo de día | `TIME-09`, `TIME-10`, `TIME-11`, `TIME-13`, `TIME-14`, `TIME-15` |
| Modo compacto por orden | cualquier carril en modo `order` |
| Modo tiempo con distintas precisiones | settings `hoursPerDay` + `hoursPerLine` |

## Estructura

- `roadmap/taxonomy.yaml` — áreas y zonas válidas del proyecto. En este fixture está vacío a propósito.
- `roadmap/lanes.yaml` — carriles y el orden de cada `queue`. Lo que no está en ninguna `queue` = backlog.
- `roadmap/*.md` — una tarea por archivo `.md` con frontmatter. El plugin también lee subcarpetas dentro de `roadmap/`.
