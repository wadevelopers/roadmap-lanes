# Flujo del agente con Roadmap Lanes

> [🇬🇧 English](../guides/AGENT_WORKFLOW.md) · 🇪🇸 Español

> El contrato que un **agente IA** lee al inicio de una sesión para operar un roadmap RL. RL está
> pensado para que un agente **escriba los documentos** y un humano **mire el tablero**; esta guía es
> la mitad de ese contrato escrita para el agente. Asume el modelo de datos de
> [`VISION.md`](../VISION.es.md) y el flujo humano de [`FLUJO_DE_TRABAJO.md`](FLUJO_DE_TRABAJO.md) —
> no los repite, agrega lo que es específico del actor agéntico.

Esta guía es **neutral respecto del agente**: no trata de Claude Code, Cursor ni ninguna herramienta
en particular. Cada proyecto la cablea a su propio tooling (ver
[Plantilla para proyectos consumidores](#plantilla-para-proyectos-consumidores)).

## Qué puede y qué no puede hacer el agente

**Puede:**

- **Crear tareas nuevas** — frontmatter mínimo más **`zones` tentativas desde el día uno** (aunque
  sean aproximadas, ya alimentan el cálculo de solape).
- **Clasificar cada tarea con el `type` del plugin** (taxonomía canónica, VISION §7.3). En hojas,
  evaluar **en este orden — el primer "sí" gana**:
  1. **`infra`** — plumbing, build, scripts, config, migración, docs que el usuario final no ve.
  2. **`feat`** — agrega una capacidad nueva.
  3. **`maint`** — arregla o mejora algo que ya existe (bug o deuda).

  `combo` **no** entra en esta evaluación: se declara cuando la tarea tiene hijos. Cuidado con el
  orden: el trabajo de build/docs/migración es `infra` aunque "suene" a feature — por eso `infra` va
  primero. **No** confundir `type` con la serie de ids del proyecto (más abajo): son ejes
  ortogonales — un `BUG-12` es `type: maint`, un `FEAT-3` es `type: feat`.
- **Madurar el cuerpo y subir `maturity`** (`raw` → `draft` → `ready`) a medida que el plan se
  documenta y se cierra.
- **Registrar `absorbs` / `depends_on`** cuando una decisión de ejecución los establece.

**No puede:**

- **Cerrar trabajo es cambiar `status: done` y nada más.** No mover archivos, no renombrar, no tocar
  queues para "archivar", y **nunca borrar el archivo en el acto de cierre** — borrar tareas `done`
  viejas es una fase posterior y separada
  ([convención de borrado](FLUJO_DE_TRABAJO.md#fin-de-vida-de-las-tareas-done-convención-de-borrado)),
  siempre autorizada explícitamente por el humano o ejecutada como tarea de limpieza dedicada.
- **No reordenar el `queue` de `lanes.yaml` por iniciativa propia** — el orden es decisión del humano
  (VISION §4: *el sistema asiste, no impone* — vale también para el agente).
- **No inventar valores de `areas` / `zones`** — es una taxonomía cerrada. Si falta una zona,
  proponerla al humano o agregarla a `taxonomy.yaml` como cambio explícito y declarado, nunca de
  contrabando.

## Asignación de ids

El plugin **no manda ningún prefijo** — cada proyecto elige su propia serie de ids (el demo del
propio plugin usa `TIME-` / `COMBO-`; un consumidor puede usar `FEAT-`, `BUG-`, o lo que prefiera).
El próximo id es el **máximo de la serie relevante + 1**; los huecos no se reusan nunca
(trazabilidad).

## `absorbs` no propaga madurez

Si una tarea `ready` absorbe una `draft`, el absorber **no** es ejecutable al 100% — declararlo
`draft` hasta promover lo absorbido. Si no, un combo puede alertar `maturity-too-low` porque la
draft-ness viene de una absorbida invisible para la derivación. *(Candidata a alerta derivada futura:
"absorber `ready` con absorbida `raw` / `draft`".)*

## Herramientas para "ver" lo que el humano ve en el tablero

El tablero es la ventana del humano. El agente lee el **mismo estado derivado** a través del
**validador CLI** (ver la [sección de desarrollo del README](../../README.es.md#desarrollo) para el
build y los flags).

### El validador es el lint

Correrlo tras cada tanda de escritura y corregir las alerts antes de dar el trabajo por cerrado:

```sh
node validate.js <vault>/roadmap --report --strict
```

`--strict` hace que los warnings también afecten el exit code; `--json` emite salida legible por
máquina; `--lang es` pasa los mensajes a castellano.

### Estado derivado: `--report`

`--report` imprime el mismo estado derivado que el humano lee en el tablero:

- **Next by lane** — la próxima tarea agarrable por carril.
- **Cross-lane gates** — dependencias que cruzan carriles, con su estado.
- **Lane overlap** — pares de carriles que tocan las mismas zonas, con el porcentaje y las zonas
  compartidas.
- **Counts** — backlog, por carril y done.

Con `--json --report` el payload es `{ alerts, report }` para tooling.

### Cómo se calcula `next`

La guía documenta el algoritmo exacto para que el agente entienda qué lee (coincide con
`buildModel.ts`):

1. El `queue` del carril se **expande a hojas** — un combo cuenta por sus hojas, no como una entrada.
2. **`next` = la primera hoja con `status` distinto de `done` y no bloqueada**, donde **bloqueada** =
   algún `depends_on` inexistente o no-`done`, **o** el bloqueo heredado de su `parent`.

Así, una hoja puede ser agarrable por sus propios datos y seguir bloqueada porque su combo padre lo
está.

### Integración con git

La verificación de integración por carril (revisar la integración antes de cruzar un gate) se
documenta aparte y se agrega cuando ese trabajo aterriza — esta guía no especula sobre ello todavía.

## Plantilla para proyectos consumidores

La guía genérica vive en RL; lo específico de un proyecto vive en el proyecto, sin duplicar. Agregar
un snippet corto al `AGENTS.md` / reglas del consumidor que apunte al agente hacia el tablero.
Redactarlo **greenfield** (un proyecto que arranca de cero), en el vocabulario del plugin:

```markdown
## Roadmap (Roadmap Lanes)

- El roadmap vive en `roadmap/` — un `.md` por unidad de trabajo, más `lanes.yaml` y
  `taxonomy.yaml`.
- Serie de ids de este proyecto: `FEAT-` / `BUG-` / `INFRA-`.  <!-- elegí la tuya -->
- Contrato del agente: leer `AGENT_WORKFLOW.md` de RL antes de tocar el tablero.
- Tras cada tanda de escritura, correr el validador y limpiar sus alerts:
  `node validate.js roadmap --report --strict`.
```

Para una ilustración de cómo un consumidor real cableó esto, ver el
[anexo](#anexo-ejemplo-de-un-consumidor-real).

## Non-goals

- No es la documentación de un agente concreto (Claude Code, Cursor…): es el contrato neutral; cada
  proyecto lo cablea a su tooling.
- No duplica VISION ni FLUJO_DE_TRABAJO: los referencia. La guía solo agrega lo que es específico del
  actor agéntico.

## Anexo: ejemplo de un consumidor real

Solo ilustrativo — **no** la plantilla canónica (esa se redacta greenfield, arriba). Este consumidor
arrastra decisiones propias que un proyecto nuevo no tiene: usa la serie de ids `DT` / `FT` (en RL
eso es libre — un proyecto nuevo elige la suya) y migró desde un índice manual (de ahí el "índice
histórico congelado", inexistente en greenfield). Leerlo por la **forma** de las reglas, no por esos
detalles:

> **Reglas duras del tablero**
> - Una unidad de trabajo = un archivo que madura. La idea cruda y el plan formal son el mismo `.md`
>   en distinto `maturity` (`raw` → `draft` → `ready`). No crear documentos paralelos.
> - Cerrar = `status: done` en el frontmatter, en el mismo commit del trabajo. No se mueven archivos,
>   no se renombra, no hay tablero manual que sincronizar.
> - El body lleva el plan. Excepción legítima — plan compartido entre N tareas: cada tarea lleva
>   resumen + puntero, y el documento compartido vive fuera de la carpeta del roadmap.
> - `taxonomy.yaml` es lista cerrada: ampliar = editar el yaml a propósito, nunca inventar valores en
>   la tarea.
> - Orden y carril viven en `lanes.yaml`, no en la tarea. El agente NO reordena queues por iniciativa
>   propia; las dependencias duras van en `depends_on`.
> - Todo plan vivo del proyecto existe como tarea en el tablero: si hay un plan sin tarea que lo
>   apunte, es un olvido — crear la tarea.
>
> **Deuda técnica — anotación en caliente**
> - Las deudas se anotan en caliente cuando surge el problema: crear `DT-XXX.md` con frontmatter
>   mínimo (`maturity: raw`, `zones` tentativas, `duration` gruesa) y el hallazgo como body. Sin lane
>   → backlog automático.
> - Número correlativo: el siguiente al máximo entre el tablero y el índice histórico congelado del
>   proyecto. Los números no se reusan nunca.
> - Cierre por descarte: `status: done` con el motivo registrado en el body — trazabilidad de "se
>   evaluó y se descartó".
