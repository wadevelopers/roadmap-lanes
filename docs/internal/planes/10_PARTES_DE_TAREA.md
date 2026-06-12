# PLAN — Partes de tarea (`type: doc` + `part_of`) y botón "Abrir nota en Obsidian"

> Estado: **draft** — diseño completo tras dos rondas de revisión externa (identidad por path,
> precedencia de alertas, `DetailTarget`, comportamiento del botón; luego: `part_of` a través del
> parser, emisión de `doc-without-task` en el parser, índice de basenames para `part-of-to-doc`).
> Puntos abiertos en §9.
>
> **Justificación (modelo del plugin)**: hoy *todo* `.md` dentro de `roadmap/` se interpreta como
> tarea (`parseTaskSource` — sin frontmatter → `missing-frontmatter`). Una unidad de trabajo cuyo
> plan se compone de **varios documentos** (diseño + auditoría + apéndices) no tiene modelado: los
> documentos acompañantes deben vivir *fuera* de la carpeta del roadmap, partiendo la unidad en
> "mitad adentro (la tarjeta), mitad afuera (el plan)" — el mismo anti-patrón de dos-lugares que
> RL declara querer matar en `WORKFLOW.md`.
>
> **Corroboración (uso real)**: la primera migración real a RL produjo ~24 tarjetas-stub que
> apuntan a planes externos en otra carpeta del repo consumidor, porque no había forma legítima de
> traer esos documentos adentro. Evidencia de la necesidad, no el fundamento.

## 1. Objetivo

Dos features:

1. **Partes de tarea**: un `.md` dentro de `roadmap/` puede declararse **documento acompañante**
   de una tarea (`type: doc` + `part_of`). No es trabajo ejecutable: queda **excluido** del
   tablero (queues, backlog, solape, gates, conteos, combos) pero es **navegable** desde el panel
   de detalle de su tarea. Con esto, una tarea multi-documento vive completa dentro de `roadmap/`
   (convención sugerida al consumidor: una subcarpeta por tarea multi-documento).
2. **Botón "Abrir nota en Obsidian"**: en el panel de detalle de **cualquier** nota (tarea o
   parte), un botón en la zona del título abre el `.md` en el editor de Obsidian. Feature general
   que faltaba; las partes la vuelven imprescindible (es donde se *edita* el plan).

## 2. Qué NO es (deslindes conceptuales)

- **No es combo**: `parent`/combo modela *descomposición del trabajo* — hijos con `status` y
  `duration` propios que alimentan derivaciones (suma de horas, done derivado, bloqueo heredado).
  Una parte no tiene estado ni duración: es *documentación* de la tarea. Por eso `part_of` es un
  campo propio y **no se reusa `parent`** — cero ambigüedad entre "etapa de" y "documento de".
- **No cambia el eje `maturity`**: un draft antecedente que quedó como historia es una parte, no
  una tarea con madurez rara. No se agrega ningún valor `discard`.
- **No da semántica a las carpetas**: el modelo sigue ignorando la estructura de carpetas. La
  agrupación física (subcarpeta por tarea) es convención del proyecto consumidor.
- **Preserva el fail-loud**: un `.md` sin frontmatter sigue alertando `missing-frontmatter`. Nada
  se excluye del tablero *en silencio* — la exclusión es siempre explícita (`type: doc`).

## 3. Semántica exacta

Frontmatter de una parte:

```yaml
---
type: doc                 # rol: documento acompañante, no tarea
part_of: "[[REQ]]"        # la tarea a la que pertenece (wikilink, single)
title: Diseño técnico     # opcional; default = basename
---
```

- **`type: doc`** se suma al union `TYPES` (deja de disparar `invalid-type`). **No** se suma a
  `FILTERABLE_TYPES` — no hay chip de filtro porque las partes no son tarjetas.
- **`part_of`**: relación **single** (como `parent`), acepta wikilink o string, se normaliza con
  el mecanismo existente (`relations.ts`). Reglas:
  - Obligatorio en `type: doc`.
  - Debe resolver a una **tarea existente que no sea doc** (las partes no se encadenan entre sí —
    un solo nivel; si un plan amerita jerarquía de trabajo, eso es un combo).
  - Prohibido en tareas (no-doc): "soy parte de una épica" se dice con `parent`, no con `part_of`.
- **Identidad de una parte = su path** (`_file`), no su basename: Obsidian permite basenames
  duplicados entre subcarpetas (dos tareas pueden tener cada una su `DISEÑO.md`) y el
  normalizador de wikilinks descarta carpetas (`relations.ts:5`). El modelo **nunca** necesita
  resolver un wikilink *hacia* una parte — la relación apunta parte→tarea (por `id`), nunca al
  revés — así que la clave por path es gratis y los basenames duplicados entre partes son
  inofensivos. Las partes **no declaran `id`**: no entran al mapa de tareas ni al chequeo
  `duplicate-id`.
- **Campos de tarea en una parte** (`id`, `status`, `maturity`, `duration`, `zones`, `areas`,
  `parent`, `absorbs`, `depends_on`): se **ignoran** y alertan (un solo código, severidad
  `warning`) — la parte no debe simular ser tarea.

**Matriz de alertas nuevas (sin doble disparo):**

| Caso | Código | Severidad |
|---|---|---|
| `type: doc` sin `part_of` (**ausente**, o declarado pero sin valor resoluble — ej. `part_of: []`) | `doc-without-task` | error |
| `part_of: ""` / `part_of: [""]` (vacío explícito) | *(ninguno nuevo)* — lo cubre `empty-relation-field`, la señal raíz existente (`taskSource.ts:64`); `doc-without-task` **no** se apila encima | — |
| `part_of` apunta a id inexistente | `missing-part-of` | error |
| `part_of` apunta a otro `type: doc` | `part-of-to-doc` | error |
| `part_of` declarado en una tarea (no-doc) | `part-of-on-task` | warning |
| Parte con campos de tarea (`id`, `status`, `duration`, …) | `doc-task-fields-ignored` | warning |

Naming consistente con el patrón vigente: `missing-parent`/`missing-dependency` = "el target no
existe" → `missing-part-of` idem. El anti-doble-disparo del vacío explícito sigue el mismo patrón
del plan 06 (la señal raíz gana).

**Dónde se emite cada alerta** — la distinción "ausente vs vacío explícito" **solo existe en el
parser**: `normalizeRelationValue` (`relations.ts:11`) colapsa ambos casos a relación nula antes
de llegar al modelo. Por eso `doc-without-task` se emite en **`parseTaskSource`** (que ya emite
las alertas de forma de campo: `missing-frontmatter`, `empty-relation-field`), con guard: dispara
si `type: doc` y `part_of` no resuelve a valor, **salvo** que `hasExplicitEmptyRelation` sea
true (ahí ya disparó la señal raíz). Ojo con el edge `part_of: []`: lista vacía sin ítem `""` NO
dispara `empty-relation-field` (`relations.ts:22` solo detecta ítems `""`) — debe caer en
`doc-without-task`, no quedar silencioso. Las otras 4 alertas (que requieren el mapa completo de
tareas/partes) se emiten en `buildModel`.

**Aceptación**: como en el resto del sistema, solo las **warnings** son aceptables/dismissables
(`part-of-on-task`, `doc-task-fields-ignored`). Los **errors** no se pueden aceptar ni en UI
(`render.ts:984`) ni en CLI (`validator.ts:90`) — comportamiento existente que se mantiene.

## 4. Modelo (`buildModel.ts` + `types.ts`)

1. **Separación temprana**: en el loop de `input.tasks`, los raw con `type === "doc"` se desvían a
   un mapa propio — no entran a `byId` ni a ninguna derivación posterior (queues, overlap, gates,
   combos, conteos, next).
2. **`Model.docs`**: `Map<string, DocModel>` **clave = `_file` (path)**, con
   `{ path, basename, title, partOf, body }`.
3. **`Task.parts: string[]`**: **paths** de sus partes (en orden de archivo). Poblado al resolver
   `part_of` (parte→tarea por `id`). Es el dato que consume el panel.
4. **Validaciones de target** de la matriz §3 (`missing-part-of`, `part-of-to-doc`,
   `part-of-on-task`, `doc-task-fields-ignored`) en el mismo bloque — los códigos nuevos van al
   union `AlertCode` de `types.ts`. (`doc-without-task` se emite en el parser, §3.) **Orden de
   resolución de `part_of`** (normalizado = id/basename): ¿matchea id de tarea no-doc? → ok;
   ¿matchea basename de alguna parte? → `part-of-to-doc` (requiere un `Set` interno de basenames
   de partes — `Model.docs` está clavado por path, no alcanza solo); si ninguno → `missing-part-of`.
5. **`part_of` atraviesa el parser explícitamente** — agregarlo a `RELATION_FIELDS`
   (`relations.ts:1`) da la normalización de wikilinks y el empty-check, pero **no alcanza solo**:
   `parseTaskSource` construye el task con los campos de relación hardcodeados
   (`taskSource.ts:87-89`) y `RawTask`/`Task` no tienen el campo (`types.ts:50`). Toques:
   `part_of: relationSingle(source, "part_of")` en el objeto retornado + campo en `RawTask` y
   `Task` + emisión de `doc-without-task` con su guard (§3). Verificar que el resto de
   consumidores de `RELATION_FIELDS` no asuma "campo de tarea" (hoy: extracción de links +
   empty-check — ambos correctos para partes).
6. **Compartido por construcción**: `dataSource.ts` (Obsidian) y `nodeDataSource.ts` (CLI) ya
   confluyen en `parseTaskSource` → `buildModel`, así que el validador CLI hereda todo sin trabajo
   extra. `--report` no cambia (las partes no alteran counts/next/overlap).

## 5. Panel de detalle (`render.ts`)

1. **Sección "Partes" en el detalle de una tarea** (solo si `task.parts.length > 0`): lista de
   links (título de la parte o basename). Click → renderiza **la parte en el panel**, reutilizando
   el mecanismo de navegación existente (`detailHistory` + `openLinkedDetail`/
   `openPreviousDetail`, `render.ts:1028-1041`).
2. **`DetailTarget` discriminado**: el historial hoy es `string[]` de ids de tarea
   (`render.ts:32`); con partes navegables pasa a
   `{ kind: "task", id: string } | { kind: "doc", path: string }`. Las funciones de
   apertura/retroceso operan sobre ese union.
3. **Vista de detalle de una parte**: título + breadcrumb "← {tarea}" (el `part_of` renderizado
   como link de vuelta, además del back por historial) + body con el render markdown existente.
   Sin línea de estado ni relaciones de tarea (una parte no las tiene).
4. **Botón "Abrir nota en Obsidian"**: en la zona del título del panel de detalle, para **toda**
   nota (tarea o parte). **Comportamiento cerrado**: abre el `.md` en un **leaf/tab de markdown
   nuevo, sin reemplazar la vista del tablero** (usa el `_file` que el modelo ya carga; la llamada
   concreta al workspace se elige al implementar). Posición/icono exactos: a decidir al
   implementar (§9).
5. **i18n de UI**: strings nuevos ("Partes", "Abrir en Obsidian", aria-labels) en EN + ES por el
   mecanismo vigente de `messages.ts`.

## 6. Validador CLI

Gratis por §4.6. Único toque visible: los códigos nuevos aparecen en `--json`/`--strict` como
cualquier alerta (las warnings aceptables vía accepted-alerts; los errors nunca — §3).

## 7. Documentación (ambos idiomas, EN + ES)

1. **`VISION.md` / `VISION.es.md`** — fuente del modelo: §7.3 *"`type` — closed list (4)"* pasa a
   5 con `doc`, y toda mención "cualquier `.md` dentro de `roadmap/` es una tarea" se matiza con
   el rol de parte.
2. **`WORKFLOW.md` / `FLUJO_DE_TRABAJO.md`**: reescribir la sección *"A plan shared across N
   tasks"* — la excepción "el documento compartido vive fuera de la carpeta del roadmap" se
   reemplaza por el modelado con partes (`type: doc` + `part_of`, convención de subcarpeta por
   tarea multi-documento). Mantener la nota de que un plan genuinamente compartido entre N tareas
   distintas sigue siendo posible: la parte pertenece a **una** tarea (single); si N tareas
   comparten un documento, vive como parte de la tarea principal y las demás lo referencian por
   wikilink en su body.
3. **`AGENT_WORKFLOW.md` / `FLUJO_DEL_AGENTE.md`**: en "May": crear partes con `type: doc` +
   `part_of` al madurar un plan multi-documento. En "May not": no usar `part_of` para jerarquía de
   trabajo (eso es `parent`/combo).
4. **`VISUALIZATION.md` / `VISUALIZACION.md`**: la lista de relaciones wikilink del frontmatter
   (`parent`, `depends_on`, `absorbs`) incorpora `part_of`; nota sobre cómo se ven las partes en
   el grafo (`[type:doc]` como grupo coloreable).
5. **`BOARD_LEGEND.md` / `LEYENDA_DEL_TABLERO.md`**: las alertas nuevas.
6. **`README.md` / `README.es.md`**: mención breve de partes en la anatomía del proyecto.

## 8. Tests y fixture

- **`buildModel.test.ts`** (casos nuevos):
  - Parte válida → excluida de tasks/queues/counts/overlap; `task.parts` la lista (por path);
    `Model.docs` la contiene con su body.
  - **Dos partes con el mismo basename en subcarpetas distintas** (de tareas distintas) → ambas
    viven sin conflicto, cada `task.parts` apunta a la suya.
  - `type: doc` sin `part_of` (ausente) → `doc-without-task` (error).
  - `part_of: []` (lista vacía, sin ítem `""`) → `doc-without-task` — no queda silencioso (edge
    §3: no dispara `empty-relation-field`).
  - `part_of: ""` (vacío explícito) → **solo** `empty-relation-field`, sin `doc-without-task`
    encima (anti-doble-disparo, §3).
  - `part_of` roto → `missing-part-of` (error).
  - `part_of` → otra parte → `part-of-to-doc` (error).
  - `part_of` en tarea → `part-of-on-task` (warning); la tarea sigue siendo tarea normal.
  - Parte con `id`/`status`/`duration` → `doc-task-fields-ignored` (warning) y los campos no
    afectan ninguna derivación (el `id` declarado no entra a `duplicate-id` ni resuelve
    relaciones).
  - Parte en subcarpeta → mismo comportamiento (las carpetas siguen sin semántica).
  - Anti-regresión: `.md` sin frontmatter sigue dando `missing-frontmatter` (el fail-loud no se
    relaja).
- **Fixture demo** (`examples/`): agregar una tarea multi-documento real (subcarpeta con tarea +
  2 partes) para que el demo enseñe el patrón y el test del demo cubra el flujo completo.
- **`validator.test.ts`**: un caso con parte válida + una alerta de la matriz, verificando salida
  `--json`.

## 9. Decisiones abiertas (cerrar antes de promover a ready)

1. **Nombres de los códigos de alerta** (§3): propuestos con el patrón vigente; ajustables en
   revisión.
2. **Posición/forma del botón "Abrir en Obsidian"**: zona del título del panel; el detalle exacto
   (icono, esquina, tooltip) se decide al implementar — delegado explícitamente por el autor. El
   **comportamiento** ya está cerrado (§5.4: leaf/tab nuevo sin reemplazar el tablero).

## 10. Fuera de alcance

- Tooling de migración para consumidores existentes (mover planes externos adentro es trabajo del
  consumidor; RL solo provee el modelado).
- Partes anidadas (doc de doc) y partes compartidas multi-tarea (se cubren por wikilink en body).
- Cualquier cambio a combos, maturity o semántica de carpetas.
