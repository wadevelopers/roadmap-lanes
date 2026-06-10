# Dataset de ejemplo — DemoApp

Proyecto ficticio (una tienda online) que sirve de **fixture** para desarrollar y probar Roadmap Lanes. No es código real: son tareas inventadas a propósito para ejercitar **todos los casos del modelo** (§6 de la visión).

## Qué ejercita

| Caso del modelo | Dónde |
|---|---|
| Épica con hijos | `EPIC-100` ← `FT-001`, `FT-002` |
| Tarea grande partida en etapas | `DT-010` ← `ETAPA-A`, `ETAPA-B` |
| Types `feat` / `maint` / `infra` | varias |
| Status `done` (columna derecha) | `FT-001` |
| Maturity `draft` (hay que promover) | `ETAPA-B` |
| Dependencia intra-carril | `FT-002` depende de `FT-001` |
| Gate cross-carril cerrado | `DT-011` (carril B) depende de `FT-001` (carril A), ya hecho |
| Absorción | `FT-002` absorbe `DT-005` (no aparece suelta) |
| Backlog (sin carril) | `DT-010` y sus etapas |
| `duration` derivada de hijos | `EPIC-100`, `DT-010` (sin `duration` propia) |

## Estructura

- `roadmap/taxonomy.yaml` — áreas y zonas válidas del proyecto (lista cerrada, extensible editando este archivo).
- `roadmap/lanes.yaml` — carriles y el orden de cada `queue`. Lo que no está en ninguna `queue` = backlog.
- `roadmap/*.md` — una tarea por archivo `.md` con frontmatter. El plugin también lee subcarpetas dentro de `roadmap/`.
