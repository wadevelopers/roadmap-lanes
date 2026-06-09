# Visión — Roadmap Lanes (RL), plugin de Obsidian

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
3. **El ecosistema, gratis.** Como los datos son *frontmatter* estándar con **wikilinks**, los **mismos datos** quedan disponibles para el grafo nativo, los backlinks, **Dataview** y **Breadcrumbs**, sin trabajo extra (§8).

## 4. Principios de diseño (los no-negociables)

1. **Markdown-first.** La verdad son archivos `.md` con *frontmatter*. Sin base de datos, sin nube.
2. **Fuente única.** Cada dato vive en **un solo lugar**. El estado es un campo (`estado: hecho`), no la ubicación. Nada se duplica para "sincronizar".
3. **Una tarea = un archivo.** Cada DT, FT, etapa o épica es su propio `.md`.
4. **El vault *es* la base.** RL usa una carpeta de roadmap configurable dentro del *vault*; por defecto `roadmap/`.
5. **Dos vistas sobre la misma fuente.** El tablero de RL y las vistas nativas de Obsidian (grafo, Dataview, Breadcrumbs) miran los **mismos** `.md`.
6. **El sistema asiste, no impone.** Ni el orden ni el solape se deciden solos: RL **muestra y alerta**; las decisiones las toma el usuario.
7. **Previsión aproximada, no estimación exacta.** El tiempo sirve para **coordinar carriles** y **minimizar solape/bloqueos**, no para *tracking* de horas (§7.9).

## 5. Arquitectura

```
  Vault de Obsidian                         Plugin Roadmap Lanes
  ┌───────────────────────────┐             ┌────────────────────────────────────┐
  │ roadmap/**/*.md            │  índice     │ lee app.metadataCache               │
  │ roadmap/lanes.yaml         │ ──nativo──► │   + lanes.yaml / taxonomy.yaml      │
  │ roadmap/taxonomy.yaml      │             │       (vault.adapter.read)          │
  └───────────────────────────┘             │            │                         │
            ▲                                │            ▼                         │
            │ editar un .md                  │   core: derivación de estados,       │
            │ (Obsidian reindexa solo)       │   solape, gates  (portado del repo   │
            └─────── evento ◄────────────────┤   roadmap-lanes, v0.2.0)             │
                                             │            │                         │
                                             │            ▼                         │
                                             │   render en un ItemView (tablero)    │
                                             │   + MarkdownRenderer (panel detalle) │
                                             └────────────────────────────────────┘
```

- **Fuente de datos:** el *frontmatter* de las tareas sale de `app.metadataCache` (sin parsear archivos a mano). `lanes.yaml` y `taxonomy.yaml` no son notas: se leen con `vault.adapter.read` y se cachean.
- **Reactividad:** el plugin se suscribe a `metadataCache.on("changed", …)` y `vault.on("modify", …)`; al cambiar un `.md` o un `.yaml`, re-renderiza. No hay paso de build.
- **Core reutilizado:** la lógica del modelo (estados derivados, cálculo de solape, gates) se porta tal cual desde la web `v0.2.0`; lo que se reescribe es **de dónde salen los datos** y **dónde se pinta**.

## 6. Qué lee RL

1. Las **tareas** — cualquier `.md` dentro de la carpeta de roadmap, con *frontmatter* (§7.2).
2. El **archivo de carriles** — `lanes.yaml`: qué carril y en qué orden (§7.7).
3. El **doc de taxonomía** — `taxonomy.yaml`: áreas y zonas válidas (§7.6).

---

## 7. El modelo de datos

### 7.1 Los ejes (por qué hay tantos campos y no se mezclan)

Una tarea tiene **dimensiones independientes**. El error a evitar es meter varias en un mismo campo. Cada eje es su propio campo o relación:

| Eje | Pregunta | Dónde vive |
|---|---|---|
| **Naturaleza** | ¿Qué clase de trabajo es? | `tipo` |
| **Jerarquía** | ¿Es parte de algo más grande? | `padre` (wikilink) |
| **Absorción** | ¿Resuelve otras tareas al ejecutarse? | `absorbe` (wikilinks) |
| **Madurez** | ¿Cuán listo está el *plan*? | `madurez` |
| **Estado** | ¿Cuánto avanzó el *trabajo*? | `estado` |
| **Clasificación** | ¿Qué parte del sistema toca? | `areas`, `zonas` |
| **Tiempo** | ¿Cuánto dura? | `duracion` |
| **Dependencias** | ¿Qué necesita antes? | `depende_de` (wikilinks) |
| **Orden y carril** | ¿En qué carril y posición? | el **archivo de carriles** |

### 7.2 La ficha de la tarea (frontmatter)

```yaml
---
id: FT-002
titulo: Pasarela de pago en el checkout
tipo: FT                        # FT | DT | INFRA            (§7.3)
madurez: ejecutable             # nota | esqueleto | ejecutable  (§7.4)
estado: pendiente               # pendiente | hecho          (§7.4; el resto se deriva)
duracion: 5d                    # 5d (días) o 4h (horas)     (§7.9)
areas: [backend, pagos]         # taxonomía cerrada          (§7.6)
zonas: [CheckoutService, PaymentGateway]
padre: "[[EPIC-100]]"           # wikilink → jerarquía       (§7.5, §8)
absorbe: []                     # wikilinks → tareas que resuelve  (§7.5)
depende_de: ["[[FT-001]]"]      # wikilinks → dependencias   (§7.8, §8)
---

(el cuerpo del archivo es el plan completo en markdown)
```

**Las relaciones (`padre`, `depende_de`, `absorbe`) son wikilinks entrecomillados.** Es la decisión central de formato del plugin (§8): sirven igual para RL, para el grafo/backlinks nativos y para Dataview. Los identificadores son ids estables (`FT-002`); el resto de los campos son valores planos.

### 7.3 `tipo` — lista cerrada (3), árbol de decisión

Se evalúa de arriba hacia abajo; gana el primero que da "sí":

1. ¿Es plomería de desarrollo o documentación que el usuario final no ve (deps, build, scripts, config, migración, docs)? → **INFRA**
2. ¿Agrega una **capacidad nueva**? → **FT** (feature)
3. Si no: arreglar/mejorar algo que **ya existe**, roto (bug) o subóptimo (deuda) → **DT**

Es **MECE**: cada tarea cae en exactamente una. Los **contenedores** (tareas con hijos) **no declaran `tipo`** — el tipo es de cada hoja.

### 7.4 Madurez vs. estado — dos ejes del ciclo de vida

- **`madurez`** — cuán listo está el *plan*: `nota` (idea en caliente) → `esqueleto` (documentado, con decisiones abiertas, **no ejecutable**) → `ejecutable` (listo).
- **`estado`** — cuánto avanzó el *trabajo*, **sólo en las hojas**: `pendiente` → `hecho`. No hay estado intermedio escrito: *"en progreso"* se representa por **estar en la cola de un carril**.
- **Estados visuales derivados (no se escriben):**
  - `fuera de turno` = tiene `depende_de` sin cerrar.
  - `próximo` = la primera tarea libre del carril.
  - `en espera` = pendiente sin turno.
  - `en curso` = **reservado a contenedores**: algunos hijos hechos, no todos (el estado del contenedor sale de sus hijos).
  - `hecho` (contenedor) = todos los hijos hechos.

### 7.5 Jerarquía (`padre`) y absorción (`absorbe`)

- **`padre`** — relación estructural (una etapa apunta a su tarea grande; una tarea de una épica apunta a la épica). Un **contenedor** (tarea con hijos) es un agrupador: **no declara `tipo`, `estado`, `madurez` ni `duracion`** — se **derivan** de los hijos. "Épica" no es un tipo: es una tarea **que tiene hijos**.
- **`absorbe`** — decisión de ejecución: una tarea consume otra registrada por separado (`FT-002 absorbe [[DT-005]]`). La absorbida no aparece como tarjeta suelta: se muestra como sub-ítem de quien la absorbe.

### 7.6 Áreas y zonas — taxonomía cerrada, no rutas

- **`areas`** — clasificación **gruesa**, lista cerrada definida en `taxonomy.yaml`. Filtro y agrupación.
- **`zonas`** — segundo nivel (subdivisión de las áreas). **No son rutas de archivos.** Son **las que "chocan"**: el **solape** entre dos tareas = intersección de sus `zonas`.
- **Cerrada pero extensible:** una tarea sólo usa valores que **ya existen** en `taxonomy.yaml`; el doc se amplía editándolo a propósito.
- `areas`/`zonas` se dejan como **arrays planos** en el frontmatter (no wikilinks): Dataview los consulta igual, y no aportan al grafo de dependencias.

### 7.7 El archivo de carriles — orden y pertenencia

El orden y el carril **no viven en la tarea**: viven en `lanes.yaml`, fuente única de "qué tarea, en qué carril, en qué orden". Reordenar = mover líneas acá.

```yaml
lanes:
  A: { focus: Checkout y pagos,       worktree: main-app, queue: [FT-001, FT-002] }
  B: { focus: Mejoras independientes, worktree: wt-side,  queue: [DT-011, INFRA-003, DT-020] }
# Toda tarea que NO esté en ninguna lista `queue` = backlog. N carriles; la UI arranca con 2.
```

**Regla de orden (la lista manda; las dependencias sólo alertan):** RL **nunca reordena solo**. Si la lista pone una tarea antes que algo de lo que depende (sin cerrar), la marca **"fuera de turno"** y explica por qué. *"Lo próximo agarrable"* = la primera de la cola que esté **libre**.

### 7.8 Relaciones derivadas — gates y `desbloquea` no son campos

- **Gates (semáforos cruzados):** una `depende_de` entre tareas de **carriles distintos**. RL la dibuja como semáforo. No es un campo aparte.
- **`desbloquea`:** es `depende_de` invertido. RL lo deriva del grafo. **Un solo lado es editable** (`depende_de`), para que las dos puntas no se desincronicen.

### 7.9 Tiempo — `duracion` con unidad

`duracion` se declara con **unidad**: `5d` (días) o `4h` (horas). Se normaliza a horas con una **jornada configurable** (cuántas horas = un día). La **altura** de la tarjeta representa ese tiempo, con un switch **expandir/contraer** (modo Gantt ↔ modo orden). El detalle de la conversión y el render está en `docs/PLAN_expandir_contraer_tiempo.md`. El objetivo es **previsión aproximada** (principio §4.7), no exactitud.

---

## 8. Integración con Obsidian (lo que se gana por el formato)

Como las relaciones son **wikilinks en frontmatter** (`padre: "[[EPIC-100]]"`, `depende_de: ["[[FT-001]]"]`), los **mismos datos** que usa RL alimentan, sin trabajo extra:

| Herramienta nativa / plugin | Qué da |
|---|---|
| **Grafo nativo** | Jerarquía (`padre`) y dependencias (`depende_de`) como grafo. |
| **Backlinks** | "¿Qué depende de esta tarea?" aparece solo. |
| **Dataview** | Tablas/consultas del frontmatter, con links clickeables. |
| **Breadcrumbs** (plugin, mantenido) | Árbol/matriz de dependencias dedicado y navegable. |

> Verificado (jun 2026): desde Obsidian 1.4, los wikilinks **entrecomillados** en frontmatter se parsean (`frontmatterLinks`), aparecen en el grafo y backlinks, se actualizan al renombrar, **y** Dataview los lee como tipo `Link`. Por eso **no se duplican campos** ni hace falta un script de sincronización: un único formato sirve para todo. El plugin normaliza wikilink→id en **un solo punto** (al leer del `metadataCache`, que ya entrega el destino resuelto).

Esto reescribe la antigua nota "wikilinks diferidos" de la web: en el plugin, **adoptarlos es la decisión correcta**, no deuda.

El uso práctico del grafo nativo, backlinks y Breadcrumbs está documentado en
[`VISUALIZACION_OBSIDIAN.md`](VISUALIZACION_OBSIDIAN.md).

## 9. Las vistas

**a) Tablero de carriles (la principal, el `ItemView` de RL).**
- **Izquierda:** backlog (toda tarea fuera de las colas).
- **Medio:** un carril por columna, con su cola ordenada de arriba hacia abajo.
- **Derecha:** hecho.
- Altura de la tarjeta = tiempo; colores = estado; solape e iconografía como en `v0.2.0`.

**b) Panel de detalle** — al clickear una tarjeta: datos, relaciones, solape y el **cuerpo del `.md` renderizado con `MarkdownRenderer`** nativo.

**c) Vistas del ecosistema** (§8) — grafo, Dataview, Breadcrumbs: las da Obsidian sobre los mismos datos.

## 10. Alcance y no-objetivos

- **Lectura + edición mínima.** El MVP del plugin renderiza; la edición de campos desde el tablero puede venir después (en el plugin es viable vía `vault.modify`, a diferencia de la web).
- **No** es tracking de horas ni un Gantt de gestión de proyectos clásico: es coordinación de **paralelismo** entre carriles.
- **No** reimplementa lo que Obsidian ya da (grafo, consultas): lo **aprovecha**.
