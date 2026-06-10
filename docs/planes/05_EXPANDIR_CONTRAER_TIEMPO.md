# PLAN — Expandir/Contraer tiempo (modo Gantt ↔ orden) + jornada configurable

> Estado: **listo para ejecutar** (spec cerrada). **Pendiente de implementar** en este plugin.
> La feature es render-pesada: el render (alturas, filas, divisores, switch) vive en el `ItemView`;
> la *lógica de conversión* (horas↔días según jornada) va en el **core** reutilizable (TS, testeable
> sin Obsidian).

## 1. Objetivo

Un **switch** que alterna cómo el tablero representa el tiempo:

- **Modo tiempo (Gantt) — ON:** la **altura** de cada card representa su duración, con soporte de
  **horas** (no sólo días) y una **jornada configurable**. Ventaja: se ve la escala temporal real.
  Costo: tareas cortas ocultan filas del card, y tareas largas alargan mucho la página.
- **Modo orden (contraído) — OFF:** **todos los cards miden lo mismo** (las 4 filas completas,
  altura mínima `M`). **No** representa tiempo, sólo el **orden** de las tareas dentro del carril.
  Ventaja: toda la información visible en todos los cards; página compacta.

Expandir = activar el modo Gantt; contraer = modo orden.

## 2. Modelo de tiempo: horas declaradas y días de display

La duración de una tarea se declara en el campo **`duracion`** como número de horas, sin sufijo
(ver VISION §7.9):
- `duracion: 4` → 4 horas.
- `duracion: 16` → 16 horas.

La jornada configurable se usa para convertir esas horas a días de display y de ahí derivar la
altura.

## 3. Jornada configurable (cuántas horas = 1 día)

El usuario define **cuántas horas de trabajo equivalen a un día** (depende de cuántas horas
trabaja por día). Es **configuración del usuario**, no de la tarea: se guarda en los **settings
del plugin** (`loadData`/`saveData`, ver §5), se puede cambiar en cualquier momento y la vista
se re-renderiza con el nuevo valor.

- Opciones **preestablecidas**: **4, 6, 8, 10, 12, 14** horas/día (no es campo libre).
- Conversión: `dias_efectivos = horas_tarea / jornada`.
  - Jornada 4 h, tarea de 8 h → **2 días**.
  - Jornada 8 h, tarea de 8 h → **1 día**.

## 4. Mapeo tiempo → filas/altura del card (modo Gantt)

Un **día completo** = altura mínima `M` = las **4 filas** del card. Cada fila representa
`jornada / 4` horas. Las filas, de arriba hacia abajo:

1. **head** — id + chip de tipo + duración
2. **título**
3. **meta** — madurez + absorbe + solape
4. **estado**

Cuando una tarea ocupa **menos de un día**, se muestran sólo las filas de arriba y se **ocultan
las de abajo**, bajando la altura proporcionalmente:

`filas = clamp(ceil( horas_fracción / (jornada/4) ), 1, 4)` — **mínimo 1 fila** (sólo `head`),
aunque la tarea dure menos que el paso de una fila.

Para tareas de **más de un día**: por cada día completo, las 4 filas + **línea divisoria de día**;
la fracción restante se mapea con la fórmula de arriba (filas + filas en blanco hasta el medio día
correspondiente). La altura total es **aditiva** (apilar fracciones equivale a la suma), para que
la escala temporal entre cards/carriles se mantenga comparable.

> Las 4 filas se diseñan con **altura fija** (`M/4` cada una) para que ocultar filas reduzca la
> altura de forma exacta.

### Ejemplos (jornada = 4 h → cada fila = 1 h)
| Duración | Filas visibles | Altura |
|---|---|---|
| 1 h | 1 (id) | ¼ de día |
| 2 h | 2 (id, título) | ½ día |
| 4 h | 4 (todas) | 1 día completo |
| 6 h | 4 + divisor + 2 en blanco | 1½ días |
| 8 h | 4 + divisor + 4 | 2 días |

### Ejemplos (jornada = 8 h → cada fila = 2 h; mínimo 2 h = 1 fila)
| Duración | Filas visibles |
|---|---|
| 1 h o 2 h | 1 (id) |
| 3 h o 4 h | 2 (id, título) |
| 6 h | 3 |
| 8 h | 4 (día completo) |

Nota: no importa que se oculte información en cards cortos — **siempre se abre el detalle con
click**. Lo importante es preservar la **escala de tiempo**.

## 5. Configuración (settings del plugin)

La config se persiste con los settings **nativos del plugin** (`this.loadData()` /
`this.saveData()`, guardados en el `data.json` del plugin dentro del vault) — **no** en
`localStorage` (eso era de la web standalone):

- `jornada` — horas/día (4/6/8/10/12/14). Cambiarla re-renderiza el tablero.
- `modoTiempo` — switch Gantt (ON) / orden (OFF).

UI: un selector de jornada + el switch de modo en la barra de controles del tablero, y/o en la
pestaña de *settings* del plugin (`PluginSettingTab`).

## 6. Decisiones (cerradas)

1. **Campo de duración:** `duracion` en horas numéricas (`4`, `16`). Los sufijos (`4h` / `2d`) son inválidos.
2. **Filas de altura fija:** sí — las 4 filas miden `M/4` exactas, para que ocultar filas reduzca
   la altura de forma proporcional.
3. **Contenedores:** sin tratamiento especial. La barra trunca con `overflow:hidden` + ellipsis;
   no importa si con poco alto se ve hasta como una sola letra. En la práctica un contenedor agrupa
   varias tareas (alguna larga), así que su alto crece; y siempre se abre el detalle con click.
4. **Redondeo:** `ceil`. Suficiente para el objetivo (ver §7): previsión **aproximada** para
   coordinar carriles, no estimación exacta.
5. **Modo orden (OFF):** no aparecen divisor de día ni filas en blanco; todos los cards = 4 filas planas.

## 7. Alcance: previsión aproximada, no estimación exacta

El objetivo es **prever de forma aproximada** cuánto va a tomar una tarea, para **coordinar los
carriles** y **minimizar el solape y los bloqueos** (pisar trabajo en curso de otro carril). **No**
es estimación exacta ni *tracking* de horas. Por eso `ceil` y el mapeo a filas alcanzan: comunican
el **orden de magnitud** temporal. Coherente con VISION §4 (principio 7) y §7.9.

## 8. Implementación en el plugin

- La **lógica de conversión** (horas↔días, jornada) vive en el **core** (TS), separada del render
  y testeable sin Obsidian.
- El **render** (alturas, filas de `M/4`, divisores de día, el switch) se implementa en el
  `ItemView` del tablero, junto con el resto de la vista portada de la web `v0.2.0`.
- La duración (`duration: 40`) sale del *frontmatter* vía `metadataCache` (VISION §7.9).

## 9. Display del texto de duración: días vs. horas

> No es problema hoy (jornada fija = default), pero **sí** cuando la jornada sea configurable (este
> plan): el texto puede mostrar días aunque la nota esté en horas, y confundir. `duration` se anota
> **siempre en horas**; el display la convierte a días según `hoursPerDay`. Reglas para que no engañe:

1. **Badge del card** (texto `Nd`/`Nh` visible): mostrar **días** (`"Nd"`) **solo si**
   `horas % hoursPerDay == 0` (días exactos); si no, mostrar **horas** (`"Nh"`). Evita tener que meter
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

La conversión horas↔días vive en el **core** (§8, separada del render); el badge, el tooltip y el detalle
la consumen.
