# PLAN — Guía del agente IA + huecos de WORKFLOW detectados en uso real

> Estado: **ejecutado** (2026-06-12) — guías `AGENT_WORKFLOW.md` / `FLUJO_DEL_AGENTE.md` creadas
> (EN+ES), los 5 patrones de §3 aplicados a `WORKFLOW.md` / `FLUJO_DE_TRABAJO.md` y enlaces en
> ambos README. Sin sección git (se difiere al plan 09). Revisión externa del 2026-06-12 aplicada
> previo a la redacción (6 ajustes: --report
> ya decidido, fórmula de next corregida contra código, fases cierre/borrado separadas, snapshot
> del template wadev en §5, conteo de parches, paridad EN/ES explícita en los parches de §3).
> **Desacople de wadev (2026-06-12)**: la guía es para un proyecto que arranca de cero — el
> vocabulario normativo es el del plugin (`type: feat/maint/infra/combo`, serie de ids libre);
> wadev (DT/FT, índice migrado) aparece solo como ejemplo etiquetado, nunca como doctrina.
>
> **Justificación (modelo del plugin)**: RL está pensado para que **una IA escriba los
> documentos** y el humano mire el tablero — pero toda la documentación pública (WORKFLOW, README)
> está redactada para un humano, y VISION menciona "parallel AI agents" una sola vez al pasar (§1).
> El contrato del agente no existe escrito: cualquier proyecto que adopte RL tiene que inventarlo.
> Es un hueco genérico de la documentación del plugin, no de un consumidor. Origen: detectado en la
> primera migración real (2026-06-11).

## 1. Objetivo

Dos entregables de documentación:

1. **`docs/guides/AGENT_WORKFLOW.md`** (+ versión ES en `guides.es/`, como las demás guías): la
   guía que un agente IA lee al inicio de sesión para saber cómo operar un roadmap RL.
2. **Parches a `docs/guides/WORKFLOW.md` y `docs/guides.es/FLUJO_DE_TRABAJO.md`** (el repo
   mantiene paridad EN/ES de las guías — los parches van en ambos): cinco convenciones/patrones
   que el uso real demandó y hoy no están escritos (§3). Van en la guía humana porque aplican a
   ambos actores.

## 2. Contenido de `AGENT_WORKFLOW.md` — el contrato del agente

**a) Qué puede y qué no puede hacer el agente:**

- Crear tareas nuevas (frontmatter mínimo + `zones` tentativas desde el día 1 — alimentan overlap).
- Clasificar cada task con el **`type`** del plugin (taxonomía canónica, VISION §7.3). En hojas,
  evaluar **en este orden** (el orden importa — el primer "sí" gana): **(1) `infra`** —
  plumbing/build/scripts/config/migración/docs que el usuario final no ve; **(2) `feat`** —
  agrega una capacidad nueva; **(3) `maint`** — arregla/mejora algo que ya existe (bug o deuda).
  `combo` no entra en esta evaluación: se declara cuando el task tiene hijos. Cuidado con el
  orden: trabajo de build/docs/migración es `infra` aunque "suene" a feature — por eso `infra`
  va primero. **No** confundir `type` con la serie de ids del proyecto (ver abajo): son ejes
  ortogonales — un `BUG-12` es `type: maint`, un `FEAT-3` es `type: feat`.
- Madurar el body y subir `maturity` (raw → draft → ready) cuando el plan se documenta/cierra.
- Cerrar trabajo = **cambiar `status: done` y nada más**. No mover archivos, no renombrar, no
  tocar queues para "archivar", **y nunca borrar el archivo en el acto de cierre** — el borrado
  de `done` viejas es una fase posterior y separada (§3.5), siempre autorizada explícitamente por
  el humano o ejecutada como tarea de limpieza dedicada.
- Registrar `absorbs`/`depends_on` cuando una decisión de ejecución lo establece.
- **NO reordenar `queue` de `lanes.yaml` por iniciativa propia**: el orden es decisión del humano
  (principio VISION §4.6 — el sistema asiste, no impone; vale también para el agente).
- **NO inventar valores de `areas`/`zones`**: taxonomía cerrada. Si falta una zona, proponerla al
  humano o agregarla a `taxonomy.yaml` como cambio explícito y declarado, nunca de contrabando.
- Asignación de **ids**: el plugin **no manda ningún prefijo** — cada proyecto elige su serie (el
  demo del propio plugin usa `TIME-`/`COMBO-`; un consumidor puede usar `FEAT-`, `BUG-`, o lo que
  prefiera). Próximo id = máximo de la serie relevante + 1; los huecos no se reusan (trazabilidad).
- **`absorbs` no propaga madurez**: si una tarea `ready` absorbe una `draft`, el absorber NO es
  ejecutable al 100% — el agente debe declararlo `draft` hasta promover lo absorbido. (Ejemplo
  real de un consumidor —wadev—: un combo alertó `maturity-too-low` porque la draft-ness venía de
  una absorbida invisible para la derivación.) Candidata a **alerta derivada futura**: "absorber
  `ready` con absorbida `raw`/`draft`".

**b) Herramientas para "ver" lo que el humano ve en el tablero:**

- **Validador CLI (plan 07)**: correr tras cada tanda de escritura; corregir alerts antes de dar
  por cerrado. Es el equivalente del lint.
- **Estado derivado** (next por lane, gates, overlap, conteos): vía **`--report` del validador**
  — ya decidido en el MVP del plan 07, y como el 07 se ejecuta antes que esta guía, es el único
  camino documentado (sin derivación manual como alternativa). La guía documenta igualmente el
  algoritmo exacto de next para que el agente entienda qué lee (verificado contra
  `buildModel.ts`): *la queue se expande a hojas (un combo cuenta por sus hojas); next = la
  primera con `status` distinto de `done` y no bloqueada, donde bloqueada = alguna `depends_on`
  inexistente o no-done, **o bloqueo heredado de su `parent`***.
- **Sección git** (cuando el plan 09 se ejecute): comandos para verificar integración por lane
  (`git log <base>..<rama>`) antes de cruzar un gate. La guía nace sin esta sección y se amplía
  al cerrar 09 — no especular ahora.

**c) Plantilla para proyectos consumidores**: snippet corto para el `AGENTS.md`/rules del proyecto
que adopta RL (dónde está la carpeta roadmap, qué serie de ids elige, puntero a esta guía). La
guía genérica vive en RL; lo específico del proyecto, en el proyecto — sin duplicar. La plantilla
se redacta **greenfield** (proyecto que arranca de cero), en vocabulario del plugin. El §5 ofrece
un **ejemplo** de cómo un consumidor real (wadev) la cableó — material ilustrativo, no la
plantilla a copiar literal: wadev arrastra decisiones propias (serie DT/FT, migración desde un
índice manual) que un proyecto nuevo no tiene.

## 3. Parches a las guías humanas de workflow, EN/ES (huecos detectados en uso real)

1. **Patrón "absorción parcial"**: `absorbs` es todo-o-nada. Cuando una tarea registrada se
   resuelve por partes en lugares distintos (una mitad dentro de un bloque grande, otra mitad
   independiente), el modelado correcto es **partir la tarea en dos archivos** con ids derivados
   (`X-A`/`X-B`) y que cada parte siga su camino. Hoy nadie lo dice y es la primera pregunta de
   cualquier backlog con dependencias parciales.
2. **Patrón "plan compartido entre N tareas"**: cuando un solo documento de plan cubre varias
   tareas (subetapas de un task grande, fases de un combo con secciones comunes), partirlo
   duplicaría contexto. El modelado correcto: cada tarea lleva frontmatter + resumen + puntero a
   la sección, y el documento compartido vive **fuera** de la carpeta del roadmap (todo `.md`
   adentro es una tarea). Es la excepción legítima a "el body es el plan completo".
3. **Gate contra una fase** → la fase se vuelve tarea hija: si una dependencia cross-lane apunta
   a una *parte* de otra tarea ("necesito las fases 0-3 de X"), esas fases se modelan como hijas
   del combo X y el `depends_on` apunta a la fase exacta. Así el gate es computable en vez de
   prosa.
4. **Apéndice situacional — migrar desde un índice manual existente** (NO aplica a proyectos
   greenfield; solo para consumidores que ya traían un índice/roadmap manual, como wadev).
   Playbook validado: (1) carriles activos primero — el trabajo en ejecución pasa a tareas/lanes
   y el humano valida el tablero antes de seguir; (2) backlog — cada entrada del índice viejo
   pasa a tarea `raw`/`draft` con su texto como body; (3) el índice viejo se **congela** como
   archivo histórico (header con puntero al tablero; las entradas cerradas no se reescriben);
   (4) reescribir las reglas del proyecto que mandaban a escribir en el índice. Numeración
   durante la transición: el siguiente correlativo se busca en el **máximo entre el tablero y el
   índice congelado** — nunca reusar números. (Un proyecto que arranca en RL no tiene índice
   congelado: su numeración mira solo el tablero.)
5. **Fin de vida de las `done` — convención de borrado, en dos fases separadas**: el **cierre**
   de una tarea es solo `status: done` (nunca incluye borrar — ver §2a); el **borrado** de `done`
   viejas es una fase posterior e independiente, que ocurre únicamente con autorización explícita
   del humano o como tarea de limpieza dedicada (ej. al cortar release, o cuando la columna done
   estorba — criterio del humano, nunca iniciativa del agente). Git preserva el historial; el
   relato curado vive en el CHANGELOG del proyecto consumidor. El tablero muestra estado actual,
   no historial — coherente con VISION §"What RL does NOT replace". Nota: esto es **distinto**
   del botón "limpiar hechas" previsto en NOTES.md para v0.4.0, que solo depura los `queue` de
   `lanes.yaml`.

## 4. Non-goals

- No es documentación de un agente concreto (Claude Code, Cursor…): es el contrato neutral; cada
  proyecto lo cablea a su tooling.
- No duplica VISION ni WORKFLOW: referencia. La guía solo agrega lo que es específico del actor
  agéntico.

## 5. Anexo — ejemplo de un consumidor real (reglas de wadev, 2026-06-11)

Ejemplo ilustrativo de cómo **un** consumidor (wadev) cableó las reglas — NO la plantilla
canónica (esa se redacta greenfield, §2c). wadev arrastra decisiones propias que un proyecto
nuevo no tiene: usa la serie de ids `DT`/`FT` (en RL eso es libre — un proyecto nuevo elige la
suya) y migró desde un índice manual (de ahí el "índice histórico congelado", inexistente en
greenfield). Leerlo por la *forma* de las reglas, no por esos detalles:

> **Reglas duras del tablero**
> - Una unidad de trabajo = un archivo que madura. La idea cruda y el plan formal son el mismo
>   `.md` en distintos `maturity` (`raw` → `draft` → `ready`). No crear documentos paralelos.
> - Cerrar = `status: done` en el frontmatter, en el mismo commit del trabajo. No se mueven
>   archivos, no se renombra, no hay tablero manual que sincronizar.
> - El body lleva el plan. Excepción legítima — plan compartido entre N tareas: cada tarea lleva
>   resumen + puntero, y el documento compartido vive fuera de la carpeta del roadmap.
> - `taxonomy.yaml` es lista cerrada: ampliar = editar el yaml a propósito, nunca inventar
>   valores en la tarea.
> - Orden y carril viven en `lanes.yaml`, no en la tarea. El agente NO reordena queues por
>   iniciativa propia; las dependencias duras van en `depends_on`.
> - Todo plan vivo del proyecto existe como tarea en el tablero: si hay un plan sin tarea que lo
>   apunte, es un olvido — crear la tarea.
>
> **Deuda técnica — anotación en caliente**
> - Las DTs se anotan en caliente cuando surge el problema: crear `DT-XXX.md` con frontmatter
>   mínimo (`maturity: raw`, `zones` tentativas, `duration` gruesa) y el hallazgo como body. Sin
>   lane → backlog automático.
> - Número correlativo: el siguiente al máximo entre el tablero y el índice histórico congelado
>   del proyecto. Los números no se reusan nunca.
> - Cierre por descarte: `status: done` con el motivo registrado en el body — trazabilidad de
>   "se evaluó y se descartó".
