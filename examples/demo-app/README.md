# Dataset de ejemplo — DemoApp

Proyecto ficticio (una tienda online) que sirve de **fixture** para desarrollar y probar Roadmap Lanes. No es código real: son tareas inventadas a propósito para ejercitar **todos los casos del modelo** (§6 de la visión).

## Qué ejercita

| Caso del modelo | Dónde |
|---|---|
| Épica con hijos | `EPIC-100` ← `FT-001`, `FT-002` |
| Tarea grande partida en etapas | `DT-010` ← `ETAPA-A`, `ETAPA-B` |
| Tipos `FT` / `DT` / `INFRA` | varias |
| Estado `hecho` (columna derecha) | `FT-001` |
| Madurez `esqueleto` (hay que promover) | `ETAPA-B` |
| Dependencia intra-carril | `FT-002` depende de `FT-001` |
| Gate cross-carril ("fuera de turno") | `DT-020` (carril B) depende de `FT-002` (carril A) |
| Absorción | `FT-002` absorbe `DT-005` (no aparece suelta) |
| Backlog (sin carril) | `DT-010` y sus etapas |
| `duracion` derivada de hijos | `EPIC-100`, `DT-010` (sin `duracion` propia) |

## Estructura

- `taxonomia.yaml` — áreas y zonas válidas del proyecto (lista cerrada, extensible editando este archivo).
- `carriles.yaml` — carriles y el orden de cada cola. Lo que no está en ninguna cola = backlog.
- `tareas/` — una tarea por archivo `.md` con frontmatter.
