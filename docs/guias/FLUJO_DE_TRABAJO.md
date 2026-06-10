# Flujo de trabajo con Roadmap Lanes

> Cómo descubrir, documentar y ejecutar el trabajo de un proyecto con RL, **sin un índice
> maestro mantenido a mano**. Asume el modelo de datos de [`VISION.md`](../VISION.md) (tipos,
> madurez, estado, carriles, solape, gates).

## El anti-patrón que RL reemplaza

El reflejo natural es llevar un **índice maestro manual**: un único documento que lista todo el
trabajo, su orden de ejecución, los prerequisitos, los semáforos cruzados, las absorciones, el
estado (✅/⏳) y la justificación de prioridad.

Ese índice **es el síntoma del problema**, no la solución. Concentra a mano todo lo que RL
**deriva**, y por eso:

- **Se desincroniza:** cada tarea nueva, cerrada o reordenada obliga a editarlo.
- **Oculta el solape y la prioridad:** quedan escritos en prosa, no *calculados*. Saber "qué
  conviene agarrar" o "cuánto se pisan dos líneas de trabajo" exige reconstruirlo mentalmente.
- **Duplica:** la idea cruda vive en el índice *y* el plan formal vive en otro documento, enlazados
  — dos lugares para la misma cosa.

Con RL no hay índice maestro: hay **un archivo por unidad de trabajo** + un **archivo de carriles**,
y el "índice" lo arma el tablero (vivo) y, si se quiere una tabla, Dataview.

## Cómo configurar Obsidian para RL

En esta versión, RL asume una regla simple:

**1 vault de Obsidian = 1 proyecto Roadmap Lanes.**

El nombre del proyecto se toma del **nombre del vault** de Obsidian. Por ejemplo, si el vault se
llama `demo-app`, el tablero muestra `Proyecto demo-app`. No hay selector de proyecto ni soporte
para múltiples roadmaps dentro del mismo vault.

RL crea y usa una carpeta de roadmap dentro del vault. Por defecto se llama `roadmap`, y se puede
cambiar en las settings nativas del plugin:

`Settings → Community plugins → Roadmap Lanes → Roadmap folder`

La estructura esperada por defecto es:

```text
demo-app/
└── roadmap/
    ├── lanes.yaml
    ├── taxonomy.yaml
    ├── DT-001.md
    ├── FT-001.md
    └── notas/
        └── INFRA-001.md
```

RL lee:

- todos los `.md` dentro de `roadmap/`, incluyendo subcarpetas, como unidades de trabajo;
- `roadmap/lanes.yaml` para ordenar tareas en carriles;
- `roadmap/taxonomy.yaml` para validar áreas y zonas.

El plugin crea automáticamente la carpeta `roadmap/` y los archivos `lanes.yaml` /
`taxonomy.yaml` si no existen. No crea una carpeta `tasks/`: si el usuario quiere organizar las
tareas en subcarpetas, puede hacerlo dentro de `roadmap/`.

Si se quiere trabajar con otro proyecto, se crea o abre otro vault de Obsidian. Usar varios
proyectos dentro del mismo vault no forma parte del flujo soportado por ahora.

La carpeta `roadmap/` debe reservarse para documentos de RL. Cualquier `.md` que esté dentro de esa
carpeta se interpreta como una unidad de trabajo.

## Una unidad de trabajo = un archivo que madura

Cada tarea (DT, FT, INFRA, épica…) es **su propio `.md`**, y **el mismo archivo evoluciona** a lo
largo de su vida — no se mueve, no se renombra, no se copia a otro documento:

- **`madurez`** (cuán listo está el *plan*): `nota` → `esqueleto` → `ejecutable`. *(VISION §7.4)*
- **`estado`** (cuánto avanzó el *trabajo*): `pendiente` → `hecho`. En hojas es el estado real; en
  COMBOs se valida contra sus hijos. *(VISION §7.4)*

La idea cruda y el plan formal son **el mismo documento** en distinta madurez. Esto es la mejora
central sobre el índice manual: **fuente única**, sin "mover la nota al plan".

## El flujo, paso a paso

### 1. Descubrimiento → un `.md` mínimo

Al detectar un problema mientras se ejecuta otra cosa, se crea un archivo nuevo con *frontmatter*
mínimo y un párrafo. Ejemplo:

```yaml
---
id: DT-042
titulo: El stock no se reajusta al devolver un ítem
tipo: DT
madurez: nota            # idea en caliente, sin investigar
estado: pendiente
duracion: 8               # horas, sin sufijo
zonas: [CheckoutService] # aunque sea aproximada: alimenta el cálculo de solape
---

Detectado al tocar el checkout: al devolver un ítem la cantidad no vuelve al stock.
Falta investigar si afecta también a las notas de crédito.
```

> Poner `zonas` desde el inicio (aunque sea tentativo) es lo que permite que RL ya muestre el
> solape de esta tarea con las demás. El resto de los campos puede completarse al madurar.

### 2. Aparece sola en el backlog

No se toca ningún índice: RL escanea la carpeta. La tarea nueva entra al **backlog** (no está en
ninguna cola de carril) y, por tener `zonas`, **ya participa del cálculo de solape**.

### 3. Evaluación

- **Trivial / se resuelve en el acto** → se arregla, `estado: hecho`, al commit. *(Lo que se
  resuelve al instante no necesita archivo — ver abajo.)*
- **Se resuelve dentro de otra tarea en curso** → se marca `absorbe` desde esa otra tarea; la
  absorbida no aparece como tarjeta suelta. *(VISION §7.5)*
- **Necesita plan** → se **madura el mismo documento** (paso 4).

### 4. Maduración (el mismo documento)

`madurez: nota → esqueleto → ejecutable`. El **cuerpo del `.md` es el plan que crece**: en
`esqueleto` se documenta con decisiones abiertas (no ejecutable aún); en `ejecutable` queda listo
para agarrar. No se crea un documento aparte.

Si el documento crece y otras tareas empiezan a apuntarlo con `padre`, deja de ser una hoja y pasa a
ser un **COMBO**. En ese momento se cambia manualmente su frontmatter:

```yaml
tipo: COMBO
duracion: 40       # estimación de etapa en horas
madurez: esqueleto # menor madurez de sus hojas
estado: pendiente  # hecho sólo cuando todos los hijos están hechos
```

RL sigue derivando bloqueos, solape, gates y estado visual desde las hojas, pero valida que esos
campos declarados del COMBO estén sincronizados. La duración del COMBO puede ser mayor que la suma de
sus hijos si documenta coordinación o trabajo extra propio del documento.

### 5. Ejecución (asignar a un carril)

Cuando se decide ejecutarla, se agrega a la cola de un carril en `roadmap/lanes.yaml`, en la posición
elegida. Recién ahí RL muestra, para esa tarea: el **solape** con lo que hay en otros carriles, los
**gates** (si depende de algo en otro carril), si está **fuera de turno**, y cuál es el **próximo
agarrable**. *(VISION §7.7, §7.8)*

## Cuándo NO crear un archivo

No todo descubrimiento merece un `.md`. Si se arregla en el momento (cambio chico, sin decisión de
diseño), se arregla y se commitea — no entra al tablero. El archivo es para lo que **queda
pendiente**, hay que **priorizar** contra otras tareas, o hay que **madurar**.

## Qué reemplaza cada pieza del índice manual

| Índice maestro (a mano) | Roadmap Lanes (derivado / visual) |
|---|---|
| Lista de trabajo "en orden de ejecución" | `roadmap/lanes.yaml` + el tablero |
| Columna "Prerequisitos" | `depende_de` |
| Semáforos cruzados (A→B entre carriles) | gates (derivados de `depende_de` entre carriles) |
| "Absorbe X, Y…" | `absorbe` |
| Estado `✅`/`⏳` por bloque | `estado` (+ estados derivados) |
| "Carril A / Carril B" descritos en prosa | las columnas del tablero |
| "Por qué este orden" / priorización | se **ve** en el tablero; no se escribe |

## Qué RL NO reemplaza

- **El "por qué" estratégico del orden** (p. ej. "esta tarea va antes que aquella porque la
  segunda necesita una decisión que toma la primera"). El tablero muestra el **qué** y el **orden**;
  ese razonamiento, si se quiere conservar, va en el **cuerpo** de la tarea o en un documento de
  estrategia. RL orquesta, no narra.
- **El historial de lo completado** (qué se cerró, en qué versión). Eso es historial → vive en
  `CHANGELOG.md` y `git`. RL muestra el **estado actual** (hecho/pendiente), no la línea de tiempo
  de releases.

## En una frase

Se pasa de **mantener y releer** un índice donde la prioridad y el solape son prosa que hay que
reconstruir mentalmente, a **escribir una tarea por unidad de trabajo** y **ver** el orden, el
solape y "qué conviene agarrar" **calculados** en el tablero.
