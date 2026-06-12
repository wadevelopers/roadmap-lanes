# PLAN — Alerta de madurez en turno (next pickable sin plan listo)

> Estado: **ready** — decisión §4 cerrada, supuesto falso del §2 corregido (no existía alerta de
> maturity ausente en hojas) y checklist §3 / tests §5 completos. Listo para ejecutar.
>
> **Justificación (modelo del plugin)**: la *next* de un lane es la tarea que está por ejecutarse;
> RL ya computa `next` y ya tiene el eje `maturity`, pero no los cruza — así, una next cuyo plan no
> está `ready` no produce ninguna señal, justo en el punto donde más importa. Esta alerta cierra
> ese hueco con los dos ingredientes que el modelo ya tiene.
>
> **Corroboración (uso real)**: la primera migración real de un proyecto a RL traía una sección
> manual de "gates de promoción" cuyo único fin era evitar exactamente eso — un checklist que RL
> puede derivar. Evidencia que confirma la necesidad, no el fundamento de la regla.

## 1. Objetivo

Nueva **model alert derivada**: si la tarea **next** de un lane (la primera libre de la queue)
tiene `maturity` distinta de `ready`, alertar:

> ⚠️ `maturity-not-ready-on-next` — la próxima tarea del lane A (`TIME-07`, `draft`) no tiene plan
> listo. Promover a `ready` antes de ejecutar.

Con esto, la regla "no ejecutar planes esqueleto/mixtos" deja de ser prosa + checklist manual en
el proyecto consumidor y pasa a ser una señal computada del tablero (y del validador CLI del
plan 07, que la reporta gratis al compartir el core).

## 2. Semántica exacta

- Se evalúa **solo la next de cada lane** (no toda la queue): una `draft` en posición 5 es normal
  — madura mientras le llega el turno. El problema es solo cuando le **llegó** el turno.
- Las queues ya se expanden a hojas (`expandQueue`), así que la madurez evaluada es la de la
  **hoja** next, no la declarada del combo. Es lo correcto: un combo `draft` puede tener su
  primera hoja `ready` y ejecutable.
- **Matriz de casos para la maturity de la next (MECE, sin doble disparo):**
  - `raw` o `draft` (válida pero no ejecutable) → `maturity-not-ready-on-next`.
  - **ausente o vacía** → `maturity-missing-on-next`.
  - **valor inválido** (ej. `maturity: nope`) → **ninguna de las dos**: lo maneja
    `invalid-maturity` (`buildModel.ts:141`, ya existente), que es la señal raíz. Piloteársela
    encima sería ruido — primero se corrige el valor.
  - `ready` → sin alerta.
  - **Guard obligatorio en `buildModel`**: el bloque next-maturity solo se evalúa si el valor es
    una maturity **válida no-`ready`** o está **ausente**; si hay un valor inválido presente, se
    saltea (lo cubre `invalid-maturity`).
- **Dos códigos, no uno**, porque los mensajes de alert son un template plano por código en
  `i18n.ts` (no ramifican por param): la distinción `not-ready` vs `missing` va por código, nunca
  por texto en `buildModel`. Es el patrón vigente del codebase (`invalid-maturity` vs
  `combo-missing-maturity` ya son códigos separados). Verificado: NO existía alerta de maturity
  ausente para hojas — `invalid-maturity` (`:141`) es por *valor inválido* y `combo-missing-maturity`
  (`:352`) es solo para combos; sin `maturity-missing-on-next`, una next sin maturity pasaría en
  silencio. No se crea una alerta genérica de campo-faltante en hojas: scope aparte, plan 07.
- Severidad: `warning` (no rompe el modelo; pide acción humana antes de ejecutar).

## 3. Implementación esperada

Checklist completo de toques (todos obligatorios):

1. **`src/buildModel.ts`**: bloque nuevo después del cálculo de `next` por lane (~10-20 líneas) —
   emite `maturity-not-ready-on-next` (raw/draft) o `maturity-missing-on-next` (ausente).
2. **`src/types.ts`**: agregar **los dos códigos nuevos** al union `AlertCode`.
3. **`src/i18n.ts`**: un template EN + ES por cada código (`alert_maturity-not-ready-on-next`,
   `alert_maturity-missing-on-next`).
4. **Leyendas — ambos idiomas**: `docs/guides/BOARD_LEGEND.md` **y**
   `docs/guides.es/LEYENDA_DEL_TABLERO.md`.
5. **Tests** (§5).

Dismissable como el resto de los alerts.

## 4. Decisión cerrada — solo lanes, no backlog

¿La alerta también debe dispararse para la tarea next del **backlog**? **No** — el backlog no
tiene turno de ejecución, así que "next" no significa nada ahí. Corroborado por la primera
migración real: al volcar un backlog completo quedó con ~37 tareas `raw`/`draft` — el estado
correcto y deseable de un backlog (las cosas maduran ahí mientras esperan turno). Alertar sobre
eso sería ruido permanente.

## 5. Tests y fixture

- **El fixture demo conserva su rol de ejemplo variado**: no se promueven artificialmente las
  cabezas inmaduras solo para mantener cero alerts. `TIME-01` (lane B, `raw`) y `TIME-06`
  (lane C, `draft`) quedan como están, y el test del demo deja de esperar
  `expect(m.alerts).toEqual([])` para pasar a esperar exactamente esos dos warnings
  `maturity-not-ready-on-next`. Las otras dos cabezas (`TIME-15`, `TIME-12`) ya son `ready` y no
  alertan.
- **Tests dedicados de la alerta** (casos nuevos en `buildModel.test.ts`):
  - next `raw` → warning; next `draft` → warning (ambas `maturity-not-ready-on-next`); next
    **sin maturity** → warning `maturity-missing-on-next`.
  - next con **valor inválido** (ej. `maturity: nope`) → solo `invalid-maturity`, **sin** ningún
    código next-maturity encima (anti-doble-disparo, §2).
  - next `ready` → sin alerta; tareas `raw`/`draft` en posiciones no-next de la queue → sin
    alerta; backlog con tareas inmaduras → sin alerta (§4).
  - combo en queue: la madurez evaluada es la de la **hoja** next, no la declarada del combo.
