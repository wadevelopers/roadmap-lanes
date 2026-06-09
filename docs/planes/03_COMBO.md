# PLAN — Concepto COMBO + duración en horas

> Estado: **propuesto — pendiente de aprobación**. No ejecutado.
> Cambio estructural: toca el contrato del frontmatter y ~17 archivos (código + ejemplos + docs).
> Depende de `02_ALERTAS_SEVERIDAD.md` (contrato de alertas con severidad): las validaciones del COMBO
> se emiten como `alertas` estructuradas, no `errores: string[]`.
> Este documento es la fuente de verdad de la tarea hasta que se complete; al cerrar se vuelca lo
> relevante a `VISION.md` y `NOTES.md` y este plan se elimina o archiva.

---

## 1. Objetivo y contexto

Hoy un **contenedor** es una tarea que tiene hijos (otras la apuntan con `padre`). No declara
`tipo`, `estado`, `madurez` ni `duracion`: todo se **deriva** de sus hijos. Eso funciona para el
cálculo, pero tiene dos límites:

1. **No hay un "tipo" propio.** Un contenedor no aparece como `FT/DT/INFRA` ni como nada — y al
   leer el frontmatter (vista de detalle, grafo, Obsidian Bases) no se sabe qué es ni cuánto dura.
2. **La duración mostrada cambia por columna.** La barra del contenedor suma la `horasEfectivas`
   de los hijos **presentes en esa columna**, así que el mismo contenedor muestra distinta duración
   en backlog, en un carril y en hecho (ver §7, bug observado).

Este plan introduce el concepto **COMBO**: el nombre nuevo (más corto) para "contenedor". Una tarea
**se convierte en COMBO** cuando otras la apuntan como `padre`. En ese momento, **de forma manual**,
el usuario cambia su `tipo` a `COMBO` y sincroniza `duracion`, `madurez` y `estado` con sus hijos.

**Caso real que motiva el diseño** (`/mnt/minis_forum/wadev/doc/roadmap-pending/ERP/INDICE_ROADMAP.md`):
`CC` (Compras Core) es un COMBO que **coordina** la secuencia `CC-1 → CC-2 → … → CC-6`; cada `CC-N`
es a su vez un COMBO que agrupa tareas concretas (`COM-FLUJOS/ETAPA_*.md`, `DT/*/PLAN.md`). El cuerpo
del COMBO documenta **orden, gates/semáforos cruzados, carriles paralelos, absorciones y reglas de
no-colisión**. Sus duraciones son estimaciones por etapa (`~3-4 días`) que **el COMBO declara como
fuente de verdad** y que pueden **diferir** de la suma de sus hijos: **menos** si las tareas corren en
paralelo entre carriles, o **más** por coordinación / trabajo extra que solo vive en ese documento.

---

## 2. Modelo conceptual del COMBO

- **El COMBO declara `tipo: COMBO`, `duracion`, `madurez` y `estado`** (sincronizados con sus hijos).
- **El sistema ignora esos campos para todo cálculo funcional** (orden, bloqueos, solape, gates,
  estado visual, alturas) y **los deriva de los hijos**, igual que hoy. Los campos declarados existen
  para: (a) que la **vista de detalle** muestre datos correctos, (b) que herramientas que leen el
  frontmatter directo (grafo, Bases, Extended Graph) lo vean, (c) **validarse**.
- **Un COMBO sigue identificándose por tener hijos** (`esContenedor` = `hijos.length > 0`), no por su
  `tipo` declarado. El `tipo: COMBO` es informativo/validado, no el mecanismo.
- **Sincronización manual, tablero read-only.** El tablero **no edita** el frontmatter; **valida** y
  **alerta** cuando los campos del COMBO se desvían de lo derivado (§6). La corrección la hace el
  usuario. (Futuro: botón "Fix model" explícito — §11.)

---

## 3. Decisiones cerradas (confirmadas con el usuario)

| # | Decisión | Elegido |
|---|---|---|
| D1 | Formato de **entrada** de `duracion` | Número de **horas** sin sufijo (`duracion: 40`). Una letra (`5d`) → alerta de duración inválida. |
| D2 | Formato de **display** de duración | Con sufijo, convertido con la jornada: ≥1 jornada → días (`40`→`5d`); si no → horas (`6`→`6h`). Se mantiene el render actual. |
| D3 | Alcance del renombre "contenedor"→COMBO | Solo lo **visible al usuario** (textos/i18n, badge, docs). Identificadores internos (`esContenedor`, `rl-container-*`) se mantienen. |
| D4 | Campos del COMBO ausentes o desincronizados | **Alerta** en "Alertas del modelo" (no bloqueante; severidad según `02_ALERTAS_SEVERIDAD`). El sistema sigue derivando de los hijos y funciona igual. |
| D5 | Duración mostrada del COMBO (barra y detalle) | La **`duracion` declarada** en el documento, **idéntica en toda columna**. No se recalcula por columna ni por hijos visibles. |
| D6 | Dibujo/altura del COMBO | **Sin cambios**: el bloque envuelve solo los hijos presentes en esa columna; el COMBO **no suma días** al carril. |
| D7 | Validación de `duracion` (semántica de etapa) | **Error** solo si es menor que la cota física (tarea más larga / carril más cargado); **warning** si es mayor que la suma; entre ambas, válida por paralelismo. Nunca se auto-corrige. |
| D8 | Badge "COMBO" en la **vista de detalle** | Sí — chip de tipo como DT/FT/INFRA, con texto "COMBO". Solo en el detalle, no en las barras del tablero. |

---

## 4. Cambios en el contrato de datos (frontmatter)

### 4.1 Hojas (tareas sin hijos)

- `duracion`: pasa de `5d`/`4h` a **número de horas** (`40`, `4`). El resto igual.

### 4.2 COMBO (tareas con hijos)

Antes no declaraban nada. Ahora declaran (todo manual, sincronizado con hijos):

```yaml
---
id: CC
titulo: Compras Core
tipo: COMBO              # nuevo valor de tipo
madurez: esqueleto      # = la MENOR madurez de sus hojas
estado: pendiente       # pendiente | hecho (la app deriva el estado visual)
duracion: 104           # horas; estimación de etapa (≈ suma; fuente del display)
areas: [...]
zonas: [...]
padre:                  # o "[[OTRO-COMBO]]" si está anidado
absorbe: []
depende_de: []
---

(el cuerpo documenta la coordinación: orden, gates, carriles, absorciones, no-colisión)
```

---

## 5. Cambios en código (por archivo)

### 5.1 `src/types.ts`
- `TIPOS = ["FT", "DT", "INFRA", "COMBO"] as const`.
- `RawTarea.duracion?: number | string` (YAML entrega número; se acepta string solo para detectar
  errores como `"5d"`). `Tarea.duracion` hereda el tipo.

### 5.2 `src/buildModel.ts`
- **`parseDuracionHoras(duracion: number | string | undefined)`**: ya no recibe `horasPorDia`.
  - `undefined`/`""` → `{ horas: null, error: null }`.
  - número finito ≥ 0, o string puramente numérico → `{ horas: n }`.
  - cualquier otra cosa (`"5d"`, `"abc"`, negativo) → `{ horas: null, error: "duracion inválida '…' (debe ser un número de horas)" }`.
- **`horasEfectivas`**: para `esContenedor` **siempre suma los hijos**, ignorando su `duracionHoras`
  declarada. Para hoja: `duracionHoras ?? 0`. (Hoy un contenedor que declarara duracion devolvería esa
  duracion; con COMBO declarando `duracion` hay que forzar la suma de hijos.)
- **Validaciones nuevas** (§6).
- `DEFAULT_HORAS_POR_DIA` y `horasPorDia` se mantienen (se usan para el **display** y la altura Gantt,
  no para parsear la entrada).

### 5.3 `src/dataSource.ts`
- Leer `duracion` numérica: aceptar `number` **o** `string` del frontmatter
  (`typeof === "number" || typeof === "string" ? frontmatter.duracion : undefined`), para que un
  string con sufijo siga llegando al validador y genere alerta.

### 5.4 `src/render.ts`
- **Duración mostrada** (helper `formatDuration`): usar `task.duracionHoras ?? task.horasEfectivas`.
  - Para hoja: `duracionHoras` = `horasEfectivas` (sin cambio visible).
  - Para COMBO: `duracionHoras` = **declarada** (D5). Aplica a la **barra del COMBO**
    (`renderContainerBlock`, hoy suma `paths` por columna → pasa a la declarada) y al **detalle**.
- **Detalle**: mostrar `estado` y `madurez` también para COMBOs (hoy se ocultan con
  `if (!task.esContenedor)`). El **badge de tipo** ya se renderiza con `task.tipo` → mostrará "COMBO"
  (D8).
- **Topbar**: el contador usa la clave i18n `containers` (ver 5.5).
- **Filtros de tipo**: se mantienen `FT/DT/INFRA` (los COMBO se ven como barras, no como tarjetas
  filtrables). No se agrega chip COMBO.

### 5.5 `src/i18n.ts`
- `containers`: `"containers"` / `"contenedores"` → `"COMBOs"`.

### 5.6 `styles.css`
- Variable `--rl-type-combo` + regla `.roadmap-lanes-view .rl-type-COMBO { background: … }`
  (color distinto a FT/DT/INFRA) para el badge del detalle.

---

## 6. Reglas de validación del COMBO

Se emiten como **alertas estructuradas** (`codigo` + `params`), **no** strings. Sus **códigos,
severidades y mensajes** viven en [`02_ALERTAS_SEVERIDAD.md`](02_ALERTAS_SEVERIDAD.md) §3.2 (fuente de
verdad); acá quedan las **reglas de dominio**. Ninguna detiene el render ni cambia los cálculos (el
sistema deriva todo de los hijos).

| Condición (dominio) | Código (02 §3.2) |
|---|---|
| `esContenedor` y `tipo !== "COMBO"` (incluye omitido) | `combo-tipo-faltante` |
| hoja con `tipo === "COMBO"` | `combo-en-hoja` |
| `duracion` **<** cota física = `max(tarea más larga, carril del COMBO más cargado)` | `combo-duracion-imposible` (error) |
| `duracion` **>** suma de hijos | `combo-duracion-mayor` (warning) |
| COMBO sin `duracion` | `combo-duracion-faltante` |
| `madurez` ≠ menor madurez de las hojas (sobre/sub-estima) | `combo-madurez-mayor` / `combo-madurez-menor` |
| COMBO sin `madurez` | `combo-madurez-faltante` |
| todos los hijos hechos y `estado !== "hecho"` | `combo-estado-deberia-hecho` |
| `estado === "hecho"` con algún hijo sin terminar | `combo-estado-falso-hecho` |
| COMBO sin `estado` | `combo-estado-faltante` |
| `estado` declarado ≠ `pendiente`/`hecho` (incluido COMBO) | `estado-invalido` (extiende la regla actual, hoy solo en hojas) |

- **Duración** (semántica de etapa): el umbral de error es la **cota inferior física**, no la suma —
  una `duracion` menor que la suma pero ≥ cota es válida por **paralelismo entre carriles**. Detalle
  en `02_ALERTAS_SEVERIDAD.md` §3.2.
- **Madurez**: rango `MADUREZ.indexOf(m)` (`nota < esqueleto < ejecutable`), mínimo sobre las **hojas
  descendientes** que declaran `madurez`; si ninguna declara, se omite.
- Las reglas existentes (id duplicado, tipo inválido, referencias inexistentes, área/zona
  desconocida) se mantienen, ahora como alertas con severidad (02 §3.1).

---

## 7. Visualización: gráfico vs. texto (el bug de la barra)

**Síntoma actual** (demo `CC`): la barra del COMBO muestra distinta duración por columna —
backlog `2d`, carril A `8d`, hecho `3d` — porque suma los hijos presentes en cada columna.

**Comportamiento deseado**:
- **Texto** (barra + detalle): la `duracion` **declarada** del COMBO, **siempre la misma**
  (`CC` → `13d` en las tres columnas). (D5)
- **Dibujo/altura**: **igual que ahora** — el bloque del COMBO envuelve solo los hijos de esa
  columna; no crece a 13d ni empuja las tarjetas. El COMBO **no agrega días al carril** (el total del
  carril sigue siendo la suma de las **hojas**, no de los COMBO). (D6)

Resultado: la barra comunica "este COMBO completo dura 13d" mientras agrupa visualmente solo la parte
que cae en esa columna.

---

## 8. Ejemplos del demo — valores exactos (`examples/demo-app/roadmap/`)

Jornada = 8 h. Conversión de duraciones de hojas:

| Hoja | Antes | Ahora (horas) |
|---|---|---|
| FT-001 | 3d | 24 |
| FT-002 | 5d | 40 |
| FT-003 | 1d | 8 |
| ETAPA-A | 2d | 16 |
| ETAPA-B | 3d | 24 |
| DT-005 | 1d | 8 |
| DT-040 | 1d | 8 |
| DT-011 | 4d | 32 |
| DT-020 | 3d | 24 |
| DT-030 | 1d | 8 |
| INFRA-003 | 2d | 16 |
| INFRA-005 | 2d | 16 |

COMBOs (jerarquía `CC → {CC-1 → DT-010 → [ETAPA-A, ETAPA-B]}, {CC-2 → EPIC-100 → [FT-001, FT-002]}`):

| COMBO | `tipo` | `duracion` (h) | `madurez` | `estado` | Derivación |
|---|---|---|---|---|---|
| EPIC-100 | COMBO | 64 | ejecutable | pendiente | FT-001(24)+FT-002(40); min(ejec,ejec) |
| CC-2 | COMBO | 64 | ejecutable | pendiente | = EPIC-100 |
| DT-010 | COMBO | 40 | esqueleto | pendiente | ETAPA-A(16)+ETAPA-B(24); min(ejec,esq) |
| CC-1 | COMBO | 40 | esqueleto | pendiente | = DT-010 |
| CC | COMBO | 104 | esqueleto | pendiente | 40+64; min de todas las hojas |

- Todos los valores coinciden con la derivación → el fixture demo queda **sin alertas de error**.
- Se quitan los comentarios actuales tipo "un contenedor no declara tipo/madurez/duracion".
- `lanes.yaml`, `taxonomy.yaml`, `zonas` y relaciones: **sin cambios**.

---

## 9. Tests (`test/buildModel.test.ts`)

- `datosBase`: duraciones a números (`2d`→16, `3d`→24, `4h`→4). `E` pasa a COMBO declarado
  (`tipo: COMBO`, `duracion: 16`, `madurez: ejecutable`, `estado: pendiente`); `C2` del test de
  dependencia contra contenedor declara `tipo: COMBO`.
- **Invertir** `"rechaza duracion sin unidad"` → `"acepta duracion numérica y rechaza con sufijo"`:
  `duracion: 16` válido (sin error); `duracion: "2d"` → error "duracion inválida".
- **Tests nuevos** (afirmando sobre `codigo`/`severidad`): contenedor sin COMBO, hoja con COMBO,
  `combo-duracion-imposible` (< cota) = error, `combo-duracion-mayor` = warning, duración válida por
  paralelismo = sin alerta, madurez ≠ menor, hijos hechos con estado ≠ hecho.
- Se mantienen y deben seguir pasando: bloqueos, `desbloquea`, `proximo`, expansión de cola, estado
  visual, gates y solape.
- Fixture demo: **sin alertas de error**; `EPIC-100.horasEfectivas` = 64; `DT-010.horasEfectivas` = 40; se
  agrega `CC.horasEfectivas` = 104 y `CC.duracionHoras` = 104.

---

## 10. Documentación a actualizar

| Archivo | Cambio |
|---|---|
| `VISION.md` | Concepto COMBO en §7.3 (4º valor de `tipo`; cómo una tarea se vuelve COMBO), §7.4 (madurez/estado del COMBO), §7.5 (el COMBO declara y se valida, el sistema deriva), §7.9 (`duracion` = número de horas y por qué; gráfico vs texto). Ejemplo de frontmatter (§7.2) con `duracion` numérica. Sección nueva: reglas de validación del COMBO. |
| `guias/FLUJO_DE_TRABAJO.md` | Flujo **manual** de conversión a COMBO (cambiar `tipo`, fijar `duracion`/`madurez`/`estado`), tablero read-only que **valida y alerta**, el cuerpo del COMBO documenta la coordinación. |
| `NOTES.md` | Entrada de decisión (COMBO + horas). § Pendientes: botón "Fix model" futuro. |
| `planes/04_EXPANDIR_CONTRAER_TIEMPO.md` | `duracion` con unidad → número de horas (§2, §6.1, §8); "contenedor" → COMBO (§6.3). La jornada sigue mapeando horas→altura. |
| `planes/01_PORT_CORE.md` | Corregir menciones a `duracion` con unidad y "contenedor". |
| `guias/VISUALIZACION_OBSIDIAN.md` | Agregar `[tipo:COMBO]` al ejemplo de colorear por tipo (§1). |

DRY: la definición del modelo vive en `VISION.md`; el resto referencia, no duplica.

---

## 11. Fuera de alcance (se señala, no se hace)

- **Edición/escritura automática** del frontmatter del COMBO desde el tablero. Sigue read-only.
- **Botón "Fix model"**: acción **explícita** del usuario que sincronizaría `tipo`/`duracion`/
  `madurez`/`estado` del COMBO con sus hijos. **Nunca** silencioso: el COMBO puede tener tiempo o
  tareas extra que solo viven en su documento. Queda registrado en `NOTES.md` § Pendientes.
- **Chip de filtro COMBO** en el tablero (no aplica a tarjetas).
- Renombre de identificadores internos (`esContenedor`, clases CSS `rl-container-*`).

---

## 12. Orden de ejecución sugerido (commits)

1. **Core**: `types.ts` + `buildModel.ts` (parser, `horasEfectivas`, validaciones) + `dataSource.ts` + tests. Verificable con `vitest`.
2. **Render**: `render.ts` + `i18n.ts` + `styles.css` (duración declarada, detalle con estado/madurez/badge).
3. **Ejemplos**: conversión de hojas a horas + campos COMBO en los 5 contenedores. Verificable con el fixture demo (**sin alertas de error**).
4. **Docs**: `VISION.md`, `guias/FLUJO_DE_TRABAJO.md`, `NOTES.md`, `planes/04_EXPANDIR_CONTRAER_TIEMPO.md`, `planes/01_PORT_CORE.md`, `guias/VISUALIZACION_OBSIDIAN.md`.

(Alternativa: commitear primero `VISION.md` como fuente de verdad. A decidir al aprobar.)
