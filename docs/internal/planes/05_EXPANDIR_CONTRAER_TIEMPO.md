# PLAN — Expandir/Contraer tiempo (`boardMode: time` ↔ `order`) + jornada configurable

> Estado: **listo para ejecutar** (spec cerrada y actualizada tras frontmatter en inglés). **Pendiente de implementar** en este plugin.
> La feature es render-pesada: el render (alturas, filas, divisores, switch) vive en el `ItemView`;
> la *lógica de conversión* (horas↔días según jornada) va en el **core** reutilizable (TS, testeable
> sin Obsidian).

## 1. Objetivo

Un **switch** que alterna cómo el tablero representa el tiempo:

- **Modo `time` (Gantt):** la **altura** de cada card representa su duración, con soporte de
  **horas** (no sólo días) y una **jornada configurable**. Ventaja: se ve la escala temporal real.
  Costo: tareas cortas ocultan filas del card, y tareas largas alargan mucho la página.
- **Modo `order` (contraído):** **todos los cards miden lo mismo** (las 4 filas completas,
  altura mínima `M`). **No** representa tiempo, sólo el **orden** de las tareas dentro del carril.
  Ventaja: toda la información visible en todos los cards; página compacta.

Expandir = `boardMode: "time"`; contraer = `boardMode: "order"`.

## 2. Modelo de tiempo: horas declaradas y días de display

La duración de una tarea se declara en el campo **`duration`** como número de horas, sin sufijo
(ver VISION §7.9):
- `duration: 4` → 4 horas.
- `duration: 16` → 16 horas.

La jornada configurable se usa para convertir esas horas a días de display y de ahí derivar la
altura.

## 3. Jornada configurable (cuántas horas = 1 día)

El usuario define **cuántas horas de trabajo equivalen a un día** (depende de cuántas horas
trabaja por día). Es **configuración del usuario**, no de la tarea: se guarda en los **settings
del plugin** (`loadData`/`saveData`, ver §6), se puede cambiar en cualquier momento y la vista
se re-renderiza con el nuevo valor.

- Opciones **preestablecidas**: **4, 6, 8, 10, 12, 14** horas/día (no es campo libre).
- Setting interno: `hoursPerDay`.
- UI: **solo en la pestaña de settings del plugin**. No va en la toolbar del tablero porque no es un
  ajuste operativo que se cambie a cada rato.
- Conversión: `effectiveDays = taskHours / hoursPerDay`.
  - Jornada 4 h, tarea de 8 h → **2 días**.
  - Jornada 8 h, tarea de 8 h → **1 día**.

## 4. Precisión temporal: horas por línea

El usuario también puede definir cuánta precisión quiere en modo `time`: **cuántas horas representa
cada línea temporal del card**. Esto es configuración de usuario y se muestra debajo de
`hoursPerDay` en la pestaña de settings.

La precisión se guarda directamente como `hoursPerLine`. Esa es la unidad conceptual que configura
el usuario y evita mantener un modelo indirecto que después hay que traducir en cada cálculo.

```ts
timeUnits = durationHours / hoursPerLine
```

Valores menores aumentan precisión a costa de cards más altos.

Opciones permitidas:

| `hoursPerDay` | `hoursPerLine` disponibles |
|---|---:|
| 4 | 1 |
| 6 | 1, 1.5 |
| 8 | 1, 1.5, 2 |
| 10 | 1, 1.5, 2 |
| 12 | 1, 1.5, 2 |
| 14 | 1, 1.5, 2 |

Regla al cambiar `hoursPerDay`: si el `hoursPerLine` actual sigue siendo válido para la nueva
jornada, se conserva; si no, se vuelve al default de esa jornada (`2` si existe; si no, la opción
mayor disponible). Ejemplos:

- `hoursPerDay: 8`, `hoursPerLine: 2` → cambiar a `10` conserva `2`.
- `hoursPerDay: 8`, `hoursPerLine: 2` → cambiar a `6` vuelve a `1.5`.

## 5. Estructura única del card

Hay **una sola estructura DOM y un solo diseño base de card**. No se mantienen dos diseños distintos.
El modo cambia clases/variables CSS y la altura calculada:

- `boardMode: "time"`: usa escala temporal exacta, oculta filas de abajo cuando la tarea dura menos
  de un día y ajusta el espacio interno para alinear bordes entre carriles.
- `boardMode: "order"`: usa la misma estructura, muestra las 4 filas, ignora la escala temporal y
  reduce los espacios internos para quedar compacto, visualmente parecido al diseño actual.

Las filas semánticas del card, de arriba hacia abajo:

1. **head** — id + chip de tipo + duración
2. **título**
3. **meta** — madurez + absorbe + solape
4. **estado**

## 6. Mapeo tiempo → líneas/altura del card (modo `time`)

Un **día completo** = `hoursPerDay / hoursPerLine` unidades temporales. Cada unidad representa
`hoursPerLine` horas.

Cuando una tarea ocupa **menos de un día**, primero se calcula cuántas líneas temporales ocupa:

`semanticLines = max(1, ceil(durationHours / hoursPerLine))`.

Luego se muestran las filas semánticas desde arriba hasta donde alcance: `head`, `title`, `meta`,
`state`. Si `semanticLines < 4`, las filas semánticas de abajo se ocultan. Si `semanticLines > 4`, las
4 filas semánticas se muestran en los primeros slots temporales y el resto queda como espacio en
blanco.

La altura no usa `ceil`: se calcula con unidades reales para que las sumas entre carriles no acumulen
redondeos por card:

```text
timeUnits = durationHours / hoursPerLine
```

La unidad temporal mínima **no es sólo una línea de texto**. En modo `time`, una línea temporal debe
representar el **footprint completo de un card de 1 fila**: contenido + padding + borde. Esto es
necesario para que los carriles alineen correctamente.

Regla de alineación general:

```text
height(N líneas temporales)
=
N cards de 1 línea + (N - 1) gaps entre cards
```

En otras palabras: el borde inferior de un card de `N` líneas temporales debe coincidir con el borde
inferior de `N` cards de 1 línea en el carril de al lado. Para lograrlo, el espacio interno entre
líneas del card más alto absorbe el equivalente del gap/padding/borde que tendrían varios cards
chicos apilados.

Ejemplos:

- Con `hoursPerDay: 8` y `hoursPerLine: 2`, 1 día = 4 unidades temporales.
- Con `hoursPerDay: 8` y `hoursPerLine: 1`, 1 día = 8 unidades temporales.

Fórmula conceptual para modo `time`:

```text
timeHeight(units) = units * (oneLineCardHeight + cardGap) - cardGap
```

Donde `oneLineCardHeight` incluye el footprint externo de un card mínimo, no sólo el line-height del
texto.

El render debe usar una estructura controlada (grid/flex con variables explícitas) donde las 4 filas
semánticas se monten sobre slots temporales exactos. No alcanza con el `flex` actual, porque hoy `gap`,
`padding`, `min-height` y `margin-top:auto` hacen que la altura se vea bien, pero no garantizan la
equivalencia matemática entre carriles.

Cuando una tarea dura **menos de un día**, las filas semánticas no visibles se ocultan en modo
`time`; el click al detalle sigue mostrando toda la información.

Cuando un día tiene más de 4 unidades temporales, hay más unidades que filas semánticas. En ese caso,
las primeras unidades pueden mostrar las 4 filas de contenido y las unidades restantes son espacio
temporal en blanco. Ejemplo: `hoursPerDay: 8` + `hoursPerLine: 1` implica 1 hora por unidad; una
tarea de 8 h usa 8 unidades, pero sólo las primeras 4 tienen contenido visible.

Para tareas de **más de un día**: por cada día completo, `hoursPerDay / hoursPerLine` unidades
temporales + divisor de día; la fracción restante se mapea con la fórmula de arriba. La altura total debe ser
aditiva, para que apilar fracciones equivalga a la suma y la escala temporal entre cards/carriles se
mantenga comparable.

> El costo de precisión/alineación se paga sólo en modo `time`; en modo `order` se compactan los
> espacios internos y `hoursPerLine` no cambia la altura de los cards.

### Ejemplos (`hoursPerDay = 4`, `hoursPerLine = 1`)
| Duración | Líneas temporales | Altura |
|---|---|---|
| 1 h | 1 (id) | ¼ de día |
| 2 h | 2 (id, título) | ½ día |
| 4 h | 4 (todas) | 1 día completo |
| 6 h | 4 + divisor + 2 en blanco | 1½ días |
| 8 h | 4 + divisor + 4 | 2 días |

### Ejemplos (`hoursPerDay = 8`, `hoursPerLine = 2`)
| Duración | Filas visibles |
|---|---|
| 1 h o 2 h | 1 (id) |
| 3 h o 4 h | 2 (id, título) |
| 6 h | 3 |
| 8 h | 4 (día completo) |

### Ejemplos (`hoursPerDay = 8`, `hoursPerLine = 1`)
| Duración | Líneas temporales | Contenido visible |
|---|---:|---|
| 1 h | 1 | head |
| 2 h | 2 | head + título |
| 4 h | 4 | 4 filas semánticas |
| 8 h | 8 | 4 filas semánticas + 4 líneas en blanco |

Nota: no importa que se oculte información en cards cortos — **siempre se abre el detalle con
click**. Lo importante es preservar la **escala de tiempo**.

## 7. Configuración (settings del plugin)

La config se persiste con los settings **nativos del plugin** (`this.loadData()` /
`this.saveData()`, guardados en el `data.json` del plugin dentro del vault) — **no** en
`localStorage` (eso era de la web standalone):

- `hoursPerDay` — horas/día (4/6/8/10/12/14). Se configura **sólo en Settings**.
- `hoursPerLine` — precisión temporal del modo `time`. Se configura **sólo en Settings**, debajo
  de `hoursPerDay`.
- `boardMode` — `"time"` / `"order"`. Se controla **sólo desde la toolbar del tablero**, pero se
  persiste igual en `data.json` para recordar la preferencia.

Defaults:

```ts
hoursPerDay: 8
hoursPerLine: 2
boardMode: "time"
```

Cambiar cualquiera de estos valores re-renderiza las vistas abiertas.

## 8. Decisiones (cerradas)

1. **Campo de duración:** `duration` en horas numéricas (`4`, `16`). Los sufijos (`4h` / `2d`) son inválidos.
2. **Un solo diseño de card:** misma estructura DOM para `time` y `order`; cambian clases/variables.
3. **Modo `time`:** líneas temporales exactas. El footprint de 1 línea incluye contenido + padding +
   borde; un card de `N` líneas temporales debe alinear con `N` cards de 1 línea + `N - 1` gaps.
4. **Precisión configurable:** se guarda `hoursPerLine` directamente.
5. **Modo `order`:** no aparecen divisores de día ni filas en blanco; todos los cards muestran las
   4 filas y usan espacios internos compactos.
6. **Contenedores:** sin tratamiento especial. La barra trunca con `overflow:hidden` + ellipsis;
   no importa si con poco alto se ve hasta como una sola letra. En la práctica un contenedor agrupa
   varias tareas (alguna larga), así que su alto crece; y siempre se abre el detalle con click.
7. **Redondeo:** la altura usa unidades reales, sin `ceil` por card; `ceil` sólo decide cuántas filas
   semánticas mostrar.

## 9. Alcance: previsión aproximada, no estimación exacta

El objetivo es **prever de forma aproximada** cuánto va a tomar una tarea, para **coordinar los
carriles** y **minimizar el solape y los bloqueos** (pisar trabajo en curso de otro carril). **No**
es estimación exacta ni *tracking* de horas. La altura conserva proporciones reales según
`hoursPerLine`; el `ceil` sólo decide cuántas filas semánticas visibles entran en cards cortos.
Coherente con VISION §4 (principio 7) y §7.9.

## 10. Implementación en el plugin

- La **lógica de conversión** (horas↔días, `hoursPerDay`, `hoursPerLine`, cálculo de líneas
  temporales visibles y desglose para display) vive en el **core** (TS), separada del render y
  testeable sin Obsidian.
- El **render** (clases por `boardMode`, alturas, filas, divisores de día y switch) vive en el
  `ItemView` del tablero.
- La duración (`duration: 40`) sale del *frontmatter* vía `metadataCache` (VISION §7.9).
- El helper actual de altura (`cardHeight`) no debe crecer como lógica suelta del render: conviene
  extraerlo a helpers puros y cubrirlo con tests unitarios, incluyendo el caso de alineación
  `N líneas temporales = N cards de 1 línea + (N - 1) gaps`.

## 11. Display del texto de duración: días vs. horas

> No es problema hoy (jornada fija = default), pero **sí** cuando la jornada sea configurable (este
> plan): el texto puede mostrar días aunque la nota esté en horas, y confundir. `duration` se anota
> **siempre en horas**; el display la convierte a días según `hoursPerDay`. Reglas para que no engañe:

1. **Badge del card** (texto `Nd`/`Nh` visible): mostrar **días** (`"Nd"`) **solo si**
   `hours % hoursPerDay == 0` (días exactos); si no, mostrar **horas** (`"Nh"`). Evita tener que meter
   un `+ Xh` en el espacio reducido del card.
   - Ejemplos (jornada 8 h): `16` → `2d`; `24` → `3d`; `12` → `12h`; `4` → `4h`.
2. **Tooltip de la duración en el card**: el desglose real (días + horas), ya que la nota está en horas.
   Ej.: badge `2d` → tooltip `2d (16 h)`; badge `12h` → tooltip `1d + 4h (12 h)`. (No entra inline en el
   card; por eso va al tooltip.)
3. **Panel de detalle**: el desglose en días con las **horas totales entre paréntesis**, pero **solo
   cuando hay días**:
   - días exactos: `2d (16 h)`.
   - días + resto: `1d + 4h (12 h)`.
   - menos de un día: solo `4 h` (sin paréntesis — sería información duplicada).

La conversión horas↔días vive en el **core** (§10, separada del render); el badge, el tooltip y el detalle
la consumen.
