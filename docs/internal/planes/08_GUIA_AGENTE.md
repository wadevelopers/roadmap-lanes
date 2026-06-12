# PLAN — Guía del agente IA + huecos de WORKFLOW detectados en uso real

> Estado: **draft** — el contenido está identificado; falta redactarlo. Conviene ejecutarlo junto
> con (o inmediatamente después de) el plan 07, porque la guía documenta el validador como
> herramienta central del agente.
> Origen: 2026-06-11, migración del roadmap de wadev a RL. RL está pensado para que **una IA
> escriba los documentos** y el humano mire el tablero — pero toda la documentación pública
> (WORKFLOW, README) está redactada para un humano. VISION menciona "parallel AI agents" una sola
> vez, al pasar (§1). El contrato del agente no existe escrito: hoy cada proyecto consumidor
> tendría que inventarlo (wadev lo tenía en sus propias rules para el índice manual — al migrar a
> RL ese vacío queda expuesto).

## 1. Objetivo

Dos entregables de documentación:

1. **`docs/guides/AGENT_WORKFLOW.md`** (+ versión ES en `guides.es/`, como las demás guías): la
   guía que un agente IA lee al inicio de sesión para saber cómo operar un roadmap RL.
2. **Parches a `WORKFLOW.md`**: dos convenciones que el uso real demandó y hoy no están escritas
   (§3). Van en la guía humana porque aplican a ambos actores.

## 2. Contenido de `AGENT_WORKFLOW.md` — el contrato del agente

**a) Qué puede y qué no puede hacer el agente:**

- Crear tareas nuevas (frontmatter mínimo + `zones` tentativas desde el día 1 — alimentan overlap).
- Madurar el body y subir `maturity` (raw → draft → ready) cuando el plan se documenta/cierra.
- Cerrar trabajo = **cambiar `status: done` y nada más**. No mover archivos, no renombrar, no
  tocar queues para "archivar".
- Registrar `absorbs`/`depends_on` cuando una decisión de ejecución lo establece.
- **NO reordenar `queue` de `lanes.yaml` por iniciativa propia**: el orden es decisión del humano
  (principio VISION §4.6 — el sistema asiste, no impone; vale también para el agente).
- **NO inventar valores de `areas`/`zones`**: taxonomía cerrada. Si falta una zona, proponerla al
  humano o agregarla a `taxonomy.yaml` como cambio explícito y declarado, nunca de contrabando.
- Asignación de **ids**: correlativo siguiente dentro de la serie del proyecto (DT-N+1, FT-N+1…).
  Los huecos no se reusan (preservan trazabilidad histórica).
- **`absorbs` no propaga madurez**: si una tarea `ready` absorbe una `draft`, el absorber NO es
  ejecutable al 100% — el agente debe declararlo `draft` hasta promover lo absorbido. (Caso real
  de la migración wadev: un combo alertó `maturity-too-low` porque la draft-ness venía de una
  absorbida invisible para la derivación.) Candidata a **alerta derivada futura**: "absorber
  `ready` con absorbida `raw`/`draft`".

**b) Herramientas para "ver" lo que el humano ve en el tablero:**

- **Validador CLI (plan 07)**: correr tras cada tanda de escritura; corregir alerts antes de dar
  por cerrado. Es el equivalente del lint.
- **Estado derivado** (next por lane, gates, overlap): vía `--report` del validador si esa
  decisión abierta del plan 07 se aprueba; mientras no exista, el agente lo deriva leyendo
  `lanes.yaml` + frontmatter (documentar el algoritmo en una frase: next = primera de la queue
  sin `depends_on` pendiente).
- **Sección git** (cuando el plan 09 se ejecute): comandos para verificar integración por lane
  (`git log <base>..<rama>`) antes de cruzar un gate. La guía nace sin esta sección y se amplía
  al cerrar 09 — no especular ahora.

**c) Plantilla para proyectos consumidores**: snippet corto para el `AGENTS.md`/rules del proyecto
que adopta RL (dónde está la carpeta roadmap, qué series de ids usa, puntero a esta guía). La
guía genérica vive en RL; lo específico del proyecto, en el proyecto — sin duplicar. **Template
real de referencia**: las reglas que wadev escribió al migrar
(`wadev/.claude/rules/documentation-rules.md` § "Roadmap — tablero Roadmap Lanes") — redactar la
plantilla destilando de ahí, no especulando.

## 3. Parches a `WORKFLOW.md` (huecos detectados en uso real)

1. **Patrón "absorción parcial"**: `absorbs` es todo-o-nada. Cuando una tarea registrada se
   resuelve por partes en lugares distintos (caso real: una DT con mitad backend dentro de un
   bloque grande y mitad UI independiente), el modelado correcto es **partir la tarea en dos
   archivos** (ids derivados, ej. `DT-080A`/`DT-080B`) y que cada parte siga su camino. Hoy nadie
   lo dice y es la primera pregunta de cualquier migración de backlog real.
2. **Patrón "plan compartido entre N tareas"**: cuando un solo documento de plan cubre varias
   tareas (subetapas A/B/C de una DT, fases de un combo con secciones comunes), partirlo
   duplicaría contexto. El modelado correcto: cada tarea lleva frontmatter + resumen + puntero a
   la sección, y el documento compartido vive **fuera** de la carpeta del roadmap (todo `.md`
   adentro es una tarea). Es la excepción legítima a "el body es el plan completo".
3. **Gate contra una fase** → la fase se vuelve tarea hija: si una dependencia cross-lane apunta
   a una *parte* de otra tarea ("necesito las fases 0-3 de X"), esas fases se modelan como hijas
   del combo X y el `depends_on` apunta a la fase exacta. Así el gate es computable en vez de
   prosa.
4. **Cómo migrar un roadmap/índice manual existente** (playbook validado en wadev, 2026-06-11):
   (1) carriles activos primero — el trabajo en ejecución pasa a tareas/lanes y el humano valida
   el tablero antes de seguir; (2) backlog — cada entrada del índice viejo pasa a tarea
   `raw`/`draft` con su texto como body; (3) el índice viejo se **congela** como archivo
   histórico (header con puntero al tablero; las entradas cerradas no se reescriben — los
   números siguen referenciados desde el changelog del proyecto); (4) reescribir las reglas del
   proyecto que mandaban a escribir en el índice. Regla de numeración post-migración: el
   siguiente correlativo se busca en el **máximo entre el tablero y el histórico congelado** —
   nunca reusar números.
5. **Fin de vida de las `done` — convención de borrado**: las tareas `done` viejas **se borran**
   (git preserva el historial; el relato curado vive en el CHANGELOG del proyecto consumidor).
   El tablero muestra estado actual, no historial — coherente con VISION §"What RL does NOT
   replace". Nota: esto es **distinto** del botón "limpiar hechas" previsto en NOTES.md para
   v0.4.0, que solo depura los `queue` de `lanes.yaml`; el borrado del archivo es el paso final
   del ciclo de vida y es manual/del agente. Documentar cuándo (ej. al cortar release, o cuando
   la columna done estorba — criterio del humano).

## 4. Non-goals

- No es documentación de un agente concreto (Claude Code, Cursor…): es el contrato neutral; cada
  proyecto lo cablea a su tooling.
- No duplica VISION ni WORKFLOW: referencia. La guía solo agrega lo que es específico del actor
  agéntico.
