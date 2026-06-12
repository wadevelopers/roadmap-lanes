# Leyenda del tablero (cómo leer Roadmap Lanes)

> [🇬🇧 English](../guides/BOARD_LEGEND.md) · 🇪🇸 Español

Referencia de qué significa cada **color**, **ícono** y **señal** del tablero. El tablero **deriva**
todo del frontmatter de las notas (ver [`FLUJO_DE_TRABAJO.md`](FLUJO_DE_TRABAJO.md) y
[`VISION.md`](../VISION.es.md)); acá se explica cómo **leerlo**.

---

## 1. La tarjeta (card)

Una tarjeta = una tarea. De arriba hacia abajo, sus filas:

1. **Cabecera**: `id` · chip de **tipo** · **duración** (a la derecha).
2. **Título**.
3. **Meta**: ícono de **madurez** + íconos de **absorbe** / **solape**.
4. **Estado** (abajo).

La **altura** de la tarjeta representa el **tiempo**: más alta = más horas (modo Gantt). (Ver
[`planes/05_EXPANDIR_CONTRAER_TIEMPO.md`](../internal/planes/05_EXPANDIR_CONTRAER_TIEMPO.md).)

### Tipo (chip de color)

| Chip | Valor (`type`) | Color | Significado |
|---|---|---|---|
| `FEAT` | `feat` | azul | **Feature**: capacidad nueva. |
| `MAINT` | `maint` | naranja | **Mantenimiento**: arreglar/mejorar lo que ya existe (bug o deuda). |
| `INFRA` | `infra` | púrpura | **Infra**: plomería, build, docs — lo que el usuario final no ve. |
| `COMBO` | `combo` | acento | **Agrupador**: una etapa con tareas hijas. |

El quinto valor de `type`, `doc`, nunca aparece como tarjeta: marca una **parte** (documento
acompañante de una tarea), visible solo en el panel de detalle de su tarea.

### Madurez (ícono) — cuán listo está el *plan*

| Ícono | Valor (`maturity`) | Significado |
|:---:|---|---|
| ![nota](../assets/note.svg) | `raw` | Capturado crudo (idea, problema detectado, TODO), sin analizar. |
| ![calavera](../assets/skull.svg) | `draft` | Documentado con decisiones abiertas; **aún no ejecutable**. |
| ![estrella](../assets/star-fat.svg) | `ready` | Listo para ejecutar. |

### Otros íconos (fila meta)

| Ícono | Significado |
|:---:|---|
| ![pacman](../assets/pacman.svg) | La tarea **absorbe** a otra: la resuelve adentro suyo; la absorbida no aparece como tarjeta suelta. |
| ![círculos solapados](../assets/photo-filter.svg) | La tarea **se pisa** (solapa) con otra de otro carril en una zona común. El **id de esa tarea** sale coloreado según el nivel (§3). |

### Estado — cuánto avanzó el *trabajo*

| Estado | Color | Significado |
|---|---|---|
| **Hecho** | verde | Terminada. |
| **En curso** | azul | Empezada pero no terminada (un COMBO con algunos hijos hechos). |
| **Próxima** | amarillo | La siguiente agarrable en su carril. |
| **Fuera de turno** | rojo | **Bloqueada**: espera una dependencia sin terminar. |
| **En espera** | neutro | Pendiente, ni próxima ni bloqueada. |

---

## 2. Carriles, backlog y hechas

- Cada **columna** es un **carril** (definido en `lanes.yaml`), con su cola ordenada de trabajo.
- **Backlog**: tareas con `zonas`/datos pero **sin carril** asignado (todavía no se decidió ejecutarlas).
- **Hechas**: columna aparte con lo terminado (registro, fuera de la coordinación activa).

---

## 3. Solape entre carriles (overlap)

Dos tareas de **carriles distintos** que tocan la **misma zona** se *pisan*: hacerlas a la vez arriesga
una colisión (una sobreescribe el trabajo de la otra). El nivel mide **cuánto** se pisan las zonas de
los dos carriles.

| Nivel | Color | Significado |
|---|---|---|
| 0 | verde | Sin solape o mínimo. |
| 1 | amarillo | Solape bajo. |
| 2 | naranja | Solape medio. |
| 3 | rojo | Solape alto: mucho riesgo de pisarse. |

> Las tareas **hechas no cuentan** para el solape (ya no pueden chocar con nada).

---

## 4. Dependencias cruzadas (gates)

Un **gate** `A → B` significa que la tarea **A depende de B** (`depends_on`) y están en **carriles
distintos**. Sirve para coordinar el orden entre carriles. El color cuenta el estado **desde A**:

| A (el que depende) | B (la dependencia) | Color | Qué significa |
|---|---|---|---|
| pendiente | pendiente | 🟠 **naranja** (en espera) | Respetá el orden: hacé **B antes que A**. |
| pendiente | hecha | 🟢 **verde** (listo) | B terminó → podés **arrancar A** limpio. |
| hecha | pendiente | 🔴 **rojo** (fuera de orden) | Hiciste **A sin B** → vas a tener que **retocar A** cuando B termine (lo va a pisar). |
| hecha | hecha | — (oculto) | Resuelto: no se muestra. |

> El rojo es el caso accionable: el problema **no** es estar bloqueado (eso es lo normal y esperado),
> sino haber trabajado **fuera de orden**. Las dependencias **dentro del mismo carril** no son gates
> (el orden de la cola ya las maneja).

---

## 5. Alertas del modelo

Inconsistencias en los datos del roadmap, agrupadas por **severidad**:

| Severidad | Color | Significado |
|---|---|---|
| **Error** | rojo | Dato **roto/imposible** (referencia colgada, id duplicado, enum inválido). Hay que arreglarlo. |
| **Warning** | naranja | Inconsistencia **recuperable**, puede ser intencional (área/zona desconocida, COMBO desincronizado). Se puede **aceptar** o corregir. |
| **Info** | azul | Recordatorio suave, no implica error. |

También aparece una warning cuando la tarea **Próxima** de un carril no está en `maturity: ready` o
no declara `maturity`: puede seguir en el carril, pero conviene promover su plan antes de ejecutarla.

RL también reporta problemas de higiene de origen: notas de tarea sin frontmatter, y campos de
relación como `parent`, `depends_on` o `absorbs` declarados como string vacío explícito.

**Alertas de partes** (`type: doc` + `part_of`): un doc sin `part_of` resoluble (`doc-without-task`),
un `part_of` que apunta a una tarea inexistente (`missing-part-of`) o a otro doc (`part-of-to-doc`)
son **errores**; `part_of` declarado en una tarea (`part-of-on-task`) y campos de tarea declarados en
un doc (`doc-task-fields-ignored`) son **warnings**.

Las warnings/info traen un botón **Aceptar** para silenciar esa alerta puntual; reaparece si los valores
cambian. (Ver [`planes/02_ALERTAS_SEVERIDAD.md`](../internal/planes/02_ALERTAS_SEVERIDAD.md).)

---

## 6. Tabla rápida de colores

El mismo color significa cosas distintas según **dónde** aparece:

| Color | Estado del card | Solape | Gate | Alerta |
|---|---|---|---|---|
| **Verde** | hecho | nivel 0 | listo (B hecha, A pendiente) | — |
| **Amarillo** | próxima | nivel 1 | — | — |
| **Naranja** | — | nivel 2 | en espera (ambas pendientes) | warning |
| **Rojo** | fuera de turno | nivel 3 | fuera de orden (A hecha, B pendiente) | error |
| **Azul** | en curso | — | — | info |

---

## 7. Controles y ajustes del tablero

- **Modo tiempo ↔ orden**: en *tiempo*, la altura del card = duración; en *orden*, todos miden igual y
  solo cuenta la posición en la cola del carril.
- **Filtros**: por texto, tipo, madurez y columnas.
- **Colapsar coordinación**: cada bloque (solape / gates / alertas) tiene un toggle `▲/▼`; el contador
  por color del header queda visible al colapsar.
- **Tipos compactos** (ajuste): el chip de tipo se muestra como un punto de color, para ahorrar ancho.
- **Resaltar tareas en espera** (ajuste): atenúa el borde de todas las tareas salvo las que están en
  *waiting for*, que pasan al color primario del tema.
