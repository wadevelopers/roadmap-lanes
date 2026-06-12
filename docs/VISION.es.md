# Visión — Roadmap Lanes (RL), plugin de Obsidian

> [🇬🇧 English](VISION.md) · 🇪🇸 Español

> Producto: **Roadmap Lanes** (abreviado **RL**). Un **plugin de Obsidian** que muestra una carpeta de roadmap como un **tablero de carriles de trabajo en paralelo**, con el tiempo estimado como **altura** de cada tarjeta y el **solape** entre tareas resaltado.
>
> Viene de una web standalone (repo `roadmap-lanes`, congelada en `v0.2.0`) que probó el modelo y el render. Esta versión lo reescribe como plugin para leer del índice nativo de Obsidian y aprovechar su ecosistema.

---

## 1. El problema

- **El estado vive en la *ubicación* del archivo, no en un *dato*.** Cuando una tarea se termina hay que **mover** su carpeta de `pending` a `done`, **renombrarla** y **reparar las rutas** que la mencionaban. Lento, frágil, repetitivo.
- **El paralelismo no se ve.** No hay forma visual de saber qué línea de trabajo termina antes que otra, ni cuánto se **pisan** dos tareas si se ejecutan a la vez (worktrees + agentes de IA en paralelo).
- **Lo que el mercado no tiene.** "Tareas en markdown" ya está lleno (Obsidian + Dataview, Logseq, Foam…). Lo que casi nadie ofrece es la **orquestación de paralelismo**: varios carriles, cálculo de solape, y un Gantt vertical por carril. Ese es el ángulo de RL.

## 2. La idea, en una frase

> Cada tarea es un archivo `.md` con unos datos arriba (*frontmatter*). RL lee el *vault* y lo dibuja como un tablero de **carriles**, usando el **tiempo estimado como altura** de cada tarjeta y mostrando el **solape** entre tareas de carriles distintos. El estado es un **campo**, no la **ubicación** del archivo.

## 3. Por qué un plugin de Obsidian (y no la web)

La web standalone funcionaba, pero tenía dos límites que el plugin elimina y un beneficio que sólo el plugin desbloquea:

1. **Sin build ni `datos.js`.** La web precompilaba un `datos.js` gigante; editar un `.md` obligaba a `npm run build` + recargar. El plugin lee el **`metadataCache`** de Obsidian — un índice del *frontmatter* de todo el vault que se mantiene **solo** y se actualiza al guardar. Editar → listo.
2. **Render markdown nativo.** El cuerpo de cada tarea se muestra con `MarkdownRenderer` de Obsidian: tablas, listas, callouts, `[[wikilinks]]`, todo — no el render casero limitado de la web.
3. **El ecosistema, gratis.** Como los datos son *frontmatter* estándar con **wikilinks**, los **mismos datos** quedan disponibles para el grafo nativo, los backlinks y **Bases** (y plugins como **Extended Graph**), sin trabajo extra (§8).

## 4. Principios de diseño (los no-negociables)

1. **Markdown-first.** La verdad son archivos `.md` con *frontmatter*. Sin base de datos, sin nube.
2. **Fuente única.** Cada dato vive en **un solo lugar**. El estado es un campo (`status: done`), no la ubicación. Nada se duplica para "sincronizar".
3. **Una tarea = un archivo.** Cada DT, FT, etapa o épica es su propio `.md`.
4. **El vault *es* la base.** RL usa una carpeta de roadmap configurable dentro del *vault*; por defecto `roadmap/`.
5. **Dos vistas sobre la misma fuente.** El tablero de RL y las vistas nativas de Obsidian (grafo, Bases) miran los **mismos** `.md`.
6. **El sistema asiste, no impone.** Ni el orden ni el solape se deciden solos: RL **muestra y alerta**; las decisiones las toma el usuario.
7. **Previsión aproximada, no estimación exacta.** El tiempo sirve para **coordinar carriles** y **minimizar solape/bloqueos**, no para *tracking* de horas (§7.9).

## 5. Arquitectura

```
  Vault de Obsidian                         Plugin Roadmap Lanes
  ┌───────────────────────────┐             ┌──────────────────────────────────────┐
  │ roadmap/**/*.md           │  índice     │ lee app.metadataCache                │
  │ roadmap/lanes.yaml        │ ──nativo──► │   + lanes.yaml / taxonomy.yaml       │
  │ roadmap/taxonomy.yaml     │             │       (vault.adapter.read)           │
  └───────────────────────────┘             │            │                         │
            ▲                               │            ▼                         │
            │ editar un .md                 │   core: derivación de estados,       │
            │ (Obsidian reindexa solo)      │   solape, gates  (portado del repo   │
            └─────── evento ◄───────────────┤   roadmap-lanes, v0.2.0)             │
                                            │            │                         │
                                            │            ▼                         │
                                            │   render en un ItemView (tablero)    │
                                            │   + MarkdownRenderer (panel detalle) │
                                            └──────────────────────────────────────┘
```

- **Fuente de datos:** el *frontmatter* de las tareas sale de `app.metadataCache` (sin parsear archivos a mano). `lanes.yaml` y `taxonomy.yaml` no son notas: se leen con `vault.adapter.read` y se cachean.
- **Reactividad:** el plugin se suscribe a `metadataCache.on("changed", …)` y `vault.on("modify", …)`; al cambiar un `.md` o un `.yaml`, re-renderiza. No hay paso de build.
- **Core reutilizado:** la lógica del modelo (estados derivados, cálculo de solape, gates) se porta tal cual desde la web `v0.2.0`; lo que se reescribe es **de dónde salen los datos** y **dónde se pinta**.

## 6. Qué lee RL

1. Las **tareas** — cualquier `.md` dentro de la carpeta de roadmap, con *frontmatter* (§7.2). La excepción: un `.md` que declara `type: doc` no es una tarea sino un **documento acompañante** de una (§7.3).
2. El **archivo de carriles** — `lanes.yaml`: qué carril y en qué orden (§7.7).
3. El **doc de taxonomía** — `taxonomy.yaml`: áreas y zonas válidas (§7.6).

---

## 7. El modelo de datos

### 7.1 Los ejes (por qué hay tantos campos y no se mezclan)

Una tarea tiene **dimensiones independientes**. El error a evitar es meter varias en un mismo campo. Cada eje es su propio campo o relación:

| Eje | Pregunta | Dónde vive |
|---|---|---|
| **Naturaleza** | ¿Qué clase de trabajo es? | `type` |
| **Jerarquía** | ¿Es parte de algo más grande? | `parent` (wikilink) |
| **Absorción** | ¿Resuelve otras tareas al ejecutarse? | `absorbs` (wikilinks) |
| **Madurez** | ¿Cuán listo está el *plan*? | `maturity` |
| **Estado** | ¿Cuánto avanzó el *trabajo*? | `status` |
| **Clasificación** | ¿Qué parte del sistema toca? | `areas`, `zones` |
| **Tiempo** | ¿Cuánto dura? | `duration` |
| **Dependencias** | ¿Qué necesita antes? | `depends_on` (wikilinks) |
| **Orden y carril** | ¿En qué carril y posición? | el **archivo de carriles** |

### 7.2 La ficha de la tarea (frontmatter)

```yaml
---
id: FT-002
title: Pasarela de pago en el checkout
type: feat                        # feat | maint | infra | combo | doc     (§7.3)
maturity: ready             # raw | draft | ready  (§7.4)
status: pending               # pending | done          (§7.4; el resto se deriva)
duration: 40                    # horas, sin sufijo           (§7.9)
areas: [backend, pagos]         # taxonomía cerrada          (§7.6)
zones: [CheckoutService, PaymentGateway]
parent: "[[EPIC-100]]"           # wikilink → jerarquía       (§7.5, §8)
absorbs: []                     # wikilinks → tareas que resuelve  (§7.5)
depends_on: ["[[FT-001]]"]      # wikilinks → dependencias   (§7.8, §8)
---

(el cuerpo del archivo es el plan completo en markdown)
```

**Las relaciones (`parent`, `depends_on`, `absorbs`) son wikilinks entrecomillados.** Es la decisión central de formato del plugin (§8): sirven igual para RL y para el grafo y los backlinks nativos. Los identificadores son ids estables (`FT-002`); el resto de los campos son valores planos.

### 7.3 `type` — lista cerrada (5)

`combo` es un valor estructural especial: una tarea que tiene hijos. No es una tarjeta ejecutable ni
participa del filtro de tipo del tablero.

`doc` es el otro valor estructural: una **parte** — documento acompañante de una tarea cuyo plan se
compone de varios archivos (diseño, auditoría, apéndices). Una parte declara `part_of: "[[TAREA]]"`
(wikilink single, obligatorio) y opcionalmente `title`; **no es trabajo**: queda excluida del tablero
(queues, backlog, solape, gates, conteos) pero es navegable desde el panel de detalle de su tarea.
Una parte pertenece a exactamente **una** tarea que no sea a su vez parte (no hay cadenas doc-de-doc —
la jerarquía de trabajo es `parent`/combo, no `part_of`), no declara campos de tarea (`id`, `status`,
`duration`, … se ignoran con warning) y su identidad es su **path**, así que dos tareas pueden tener
cada una su propio `DESIGN.md`. Convención sugerida: una subcarpeta por tarea multi-documento — las
carpetas siguen sin tener semántica para el modelo.

Para tareas **hoja**, se evalúa de arriba hacia abajo; gana el primero que da "sí":

1. ¿Es plomería de desarrollo o documentación que el usuario final no ve (deps, build, scripts, config, migración, docs)? → `infra`
2. ¿Agrega una **capacidad nueva**? → `feat`
3. Si no: arreglar/mejorar algo que **ya existe**, roto (bug) o subóptimo (deuda) → `maint`

Las hojas son **MECE**: cada una cae en exactamente una de `feat`, `maint` o `infra`. Los **COMBOs**
(tareas con hijos) declaran `type: combo` para que Obsidian, Bases y el grafo puedan identificarlos
directamente, pero RL los reconoce por tener hijos (`parent`), no por ese campo.

### 7.4 Madurez vs. estado — dos ejes del ciclo de vida

- **`maturity`** — cuán listo está el *plan*: `raw` (idea en caliente) → `draft` (documentado, con decisiones abiertas, **no ejecutable**) → `ready` (listo).
- **`status`** — cuánto avanzó el *trabajo*: `pending` → `done`. En hojas es el estado real; en
  COMBOs es metadata declarada para Obsidian y se valida contra los hijos. No hay estado intermedio
  escrito: *"en progreso"* se deriva.
- **Estados visuales derivados (no se escriben):**
  - `out-of-turn` = tiene `depends_on` sin cerrar.
  - `next` = la primera tarea libre del carril.
  - `waiting` = pendiente sin turno.
  - `in-progress` = **reservado a COMBOs**: algunos hijos hechos, no todos.
  - `done` (COMBO) = todos los hijos hechos.

### 7.5 Jerarquía (`parent`) y absorción (`absorbs`)

- **`parent`** — relación estructural (una etapa apunta a su tarea grande; una tarea de una épica apunta a la épica). Un **COMBO** (tarea con hijos) es un agrupador: declara `type: combo`, `status`, `maturity` y `duration` para las herramientas de Obsidian, pero RL deriva orden, bloqueos, gates, solape, estado visual y alturas desde las hojas. "Épica" no es un tipo aparte: es una tarea **que tiene hijos**.
- **`absorbs`** — decisión de ejecución: una tarea consume otra registrada por separado (`FT-002 absorbe [[DT-005]]`). La absorbida no aparece como tarjeta suelta: se muestra como sub-ítem de quien la absorbe.

RL valida los COMBOs sin bloquear el render: alerta si falta `type: combo`, si una hoja declara
`combo`, si la `duration` declarada es físicamente imposible, si falta `duration`/`maturity`/`status` o si
esos campos se desvían de lo derivado. La duración mayor que la suma de hijos puede ser legítima
(coordinación extra) y se puede aceptar.

### 7.6 Áreas y zonas — taxonomía cerrada, no rutas

- **`areas`** — clasificación **gruesa**, lista cerrada definida en `taxonomy.yaml`. Filtro y agrupación.
- **`zones`** — segundo nivel (subdivisión de las áreas). **No son rutas de archivos.** Son **las que "chocan"**: el **solape** entre dos tareas = intersección de sus `zones`.
- **Cerrada pero extensible:** una tarea sólo usa valores que **ya existen** en `taxonomy.yaml`; el doc se amplía editándolo a propósito.
- `areas`/`zones` se dejan como **arrays planos** en el frontmatter (no wikilinks): Bases los consulta igual, y no aportan al grafo de dependencias.

### 7.7 El archivo de carriles — orden y pertenencia

El orden y el carril **no viven en la tarea**: viven en `lanes.yaml`, fuente única de "qué tarea, en qué carril, en qué orden". Reordenar = mover líneas acá.

```yaml
lanes:
  A: { focus: Checkout y pagos,       worktree: main-app, queue: [FT-001, FT-002] }
  B: { focus: Mejoras independientes, worktree: wt-side,  queue: [DT-011, INFRA-003, DT-020] }
# Toda tarea que NO esté en ninguna lista `queue` = backlog. N carriles; la UI arranca con 2.
```

**Regla de orden (la lista manda; las dependencias sólo alertan):** RL **nunca reordena solo**. Si la lista pone una tarea antes que algo de lo que depende (sin cerrar), la marca **"fuera de turno"** y explica por qué. *"Lo próximo agarrable"* = la primera de la cola que esté **libre**.

### 7.8 Relaciones derivadas — gates y `unlocks` no son campos

- **Gates (semáforos cruzados):** una `depends_on` entre tareas de **carriles distintos**. RL la dibuja como semáforo. No es un campo aparte.
- **`unlocks`:** es `depends_on` invertido. RL lo deriva del grafo. **Un solo lado es editable** (`depends_on`), para que las dos puntas no se desincronicen.

### 7.9 Tiempo — `duration` en horas

`duration` se declara como **número de horas sin sufijo**: `40`, `8`, `4`. El display convierte esas
horas a días usando la jornada configurada (`40` → `5d` con jornada de 8 h), pero el frontmatter
queda numérico para Bases, grafo extendido y validaciones. Valores con letras (`5d`, `4h`) son
alertas de duración inválida.

En una hoja, `duration` alimenta la altura de la tarjeta. En un COMBO, `duration` es la estimación de
la etapa completa y se muestra igual en la barra y el detalle; la altura del bloque sigue saliendo de
las hojas visibles en cada columna. El objetivo es **previsión aproximada** (principio §4.7), no
tracking exacto.

---

## 8. Integración con Obsidian (lo que se gana por el formato)

Como las relaciones son **wikilinks en frontmatter** (`parent: "[[EPIC-100]]"`, `depends_on: ["[[FT-001]]"]`) y la clasificación son **propiedades** (`type`, `status`, `maturity`, `areas`, `zones`), los **mismos datos** que usa RL alimentan, sin trabajo extra:

| Herramienta | Qué da |
|---|---|
| **Grafo nativo** | Jerarquía (`parent`) y dependencias (`depends_on`) como grafo, coloreable por `type`/`status`/`maturity`. |
| **Backlinks** | "¿Qué depende de esta tarea?" aparece solo (es `depends_on` invertido). |
| **Bases** (nativo) | Tablas y consultas del frontmatter (`type`, `status`, `areas`…), sin configuración de datos extra. |
| **Extended Graph** (plugin) | Colorea/filtra por **tipo de link** (`parent`/`depends_on`/`absorbs`/`part_of`), muestra varias propiedades como arcos, vistas guardadas con selector y **tamaño de nodo = `duration`**. |

> Verificado (jun 2026): desde Obsidian 1.4, los wikilinks **entrecomillados** en frontmatter se parsean (`frontmatterLinks`), aparecen en el grafo y los backlinks y se actualizan al renombrar. Por eso **no se duplican campos** ni hace falta un script de sincronización: un único formato sirve para todo. El plugin normaliza wikilink→id en **un solo punto** (al leer del `metadataCache`, que ya entrega el destino resuelto).

Esto reescribe la antigua nota "wikilinks diferidos" de la web: en el plugin, **adoptarlos es la decisión correcta**, no deuda.

La configuración práctica del grafo (nativo y con Extended Graph) y de Bases está en
[`VISUALIZACION.md`](guides.es/VISUALIZACION.md).

## 9. Las vistas

**a) Tablero de carriles (la principal, el `ItemView` de RL).**
- **Izquierda:** backlog (toda tarea fuera de las colas).
- **Medio:** un carril por columna, con su cola ordenada de arriba hacia abajo.
- **Derecha:** hecho.
- Altura de la tarjeta = tiempo; colores = estado; solape e iconografía como en `v0.2.0`. Qué significa
  cada color, ícono y señal: [`guides.es/LEYENDA_DEL_TABLERO.md`](guides.es/LEYENDA_DEL_TABLERO.md).

**b) Panel de detalle** — al clickear una tarjeta: datos, relaciones, solape y el **cuerpo del `.md` renderizado con `MarkdownRenderer`** nativo.

**c) Vistas del ecosistema** (§8) — grafo (nativo + Extended Graph) y Bases: las da Obsidian sobre los mismos datos.

## 10. Alcance y no-objetivos

- **Lectura + edición mínima.** El MVP del plugin renderiza; la edición de campos desde el tablero puede venir después (en el plugin es viable vía `vault.modify`, a diferencia de la web).
- **No** es tracking de horas ni un Gantt de gestión de proyectos clásico: es coordinación de **paralelismo** entre carriles.
- **No** reimplementa lo que Obsidian ya da (grafo, consultas): lo **aprovecha**.
