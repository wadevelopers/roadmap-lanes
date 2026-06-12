# PLAN — Alerta de madurez en turno (next pickable sin plan listo)

> Estado: **ready** — la única decisión abierta (§4) se cerró con evidencia del caso wadev, y la
> revisión externa del 2026-06-11 corrigió un supuesto falso (§2: no existía alerta de maturity
> ausente en hojas) y completó el checklist de §3 y los tests de §5. Listo para ejecutar.
> Origen: 2026-06-11, migración del roadmap de wadev a RL. El roadmap de wadev mantiene una
> sección manual entera ("Gates de promoción de planes MIXTOS") cuyo único propósito es evitar
> que se ejecute una tarea cuyo plan no está maduro. RL ya tiene los dos ingredientes — `maturity`
> y el cálculo de "next pickable" — pero no los cruza.

## 1. Objetivo

Nueva **model alert derivada**: si la tarea **next** de un lane (la primera libre de la queue)
tiene `maturity` distinta de `ready`, alertar:

> ⚠️ `maturity-not-ready-on-next` — la próxima tarea del lane A (`DT-082`, `draft`) no tiene plan
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
- `maturity: raw` y `maturity: draft` alertan igual (ninguna es ejecutable). **Tarea sin
  `maturity` también alerta** (ausente ≠ ready), con mensaje diferenciado ("sin maturity
  declarada"). Verificado contra código: NO existe alerta de maturity ausente para hojas —
  `invalid-maturity` (`buildModel.ts:142`) es por *valor inválido* y `combo-missing-maturity`
  (`:352`) es solo para combos; sin este caso, una next sin maturity pasaría en silencio. No se
  crea una alerta genérica de campo-faltante en hojas: scope aparte, evaluable en el plan 07.
- Severidad: `warning` (no rompe el modelo; pide acción humana antes de ejecutar).

## 3. Implementación esperada

Checklist completo de toques (todos obligatorios):

1. **`src/buildModel.ts`**: bloque nuevo después del cálculo de `next` por lane (~10-20 líneas),
   cubriendo `raw`/`draft`/ausente.
2. **`src/types.ts`**: agregar el código nuevo al union `AlertCode`.
3. **`src/i18n.ts`**: mensaje en EN y ES (incluida la variante "sin maturity declarada").
4. **Leyendas — ambos idiomas**: `docs/guides/BOARD_LEGEND.md` **y**
   `docs/guides.es/LEYENDA_DEL_TABLERO.md`.
5. **Tests** (§5).

Dismissable como el resto de los alerts.

## 4. Decisión cerrada — solo lanes, no backlog

¿La alerta también debe dispararse para la tarea next del **backlog**? **No** — cerrada el
2026-06-11 con evidencia del caso real: al completar la migración de wadev, el backlog quedó con
~37 tareas `raw`/`draft` (estado correcto y deseable de un backlog — las cosas maduran ahí
mientras esperan turno). Alertar sobre eso sería ruido permanente. "Next" solo tiene sentido
dentro de un lane.

## 5. Tests y fixture

- **El fixture demo conserva su rol** ("válido y sin alerts", `test/buildModel.test.ts` —
  `expect(m.alerts).toEqual([])` se mantiene). Para eso, las dos cabezas de queue que hoy no son
  `ready` se promueven en el fixture: `TIME-01` (lane B, hoy `raw`) y `TIME-06` (lane C, hoy
  `draft`) pasan a `maturity: ready`. Las otras dos cabezas (`TIME-15`, `TIME-12`) ya son
  `ready` — no se tocan.
- **Tests dedicados de la alerta** (casos nuevos en `buildModel.test.ts`):
  - next `raw` → warning; next `draft` → warning; next **sin maturity** → warning con la
    variante de mensaje.
  - next `ready` → sin alerta; tareas `raw`/`draft` en posiciones no-next de la queue → sin
    alerta; backlog con tareas inmaduras → sin alerta (§4).
  - combo en queue: la madurez evaluada es la de la **hoja** next, no la declarada del combo.
