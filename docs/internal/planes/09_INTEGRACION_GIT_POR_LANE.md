# PLAN — Estado de integración git por lane (derivado, no declarado)

> Estado: **draft, estacionado a propósito** — idea en maduración, decisiones abiertas en §7.
> NO ejecutable. **Criterio de promoción**: no ejecutar hasta que el uso real posterior a los
> planes 06-08 muestre **dolor repetido** — señales concretas que lo promueven: (a) un near-miss
> real (alguien cruzó un gate sin que el trabajo estuviera integrado), (b) pasar de 2 a 3+
> carriles/worktrees, (c) demanda de la comunidad al publicar. Lo que cubre ya existe como check
> manual documentado (`git log base..rama` en la guía del consumidor); este plan solo lo
> automatiza/visualiza.
> Origen: 2026-06-11, durante la primera migración real de un proyecto a RL. Al mapear un flujo de
> ejecución paralela quedó claro que RL modela los gates y el anti-idle, pero la
> **política de merge entre worktrees** quedaba como prosa fuera del tablero. Este plan explora la
> única forma de modelarla que respeta los principios de VISION.

## 1. El problema

En un flujo de N lanes sobre N worktrees git, cada lane acumula trabajo en su rama y lo integra a
`main` por hitos. La regla operativa típica es *"el gate manda: antes de cruzar un semáforo en
verde, verificar que el trabajo del que depende esté **en `main`**, no solo cerrado en la otra
rama"*. Hoy RL no puede ayudar con eso:

- Una tarea con `status: done` en el lane B puede estar **sin integrar** — el lane A ve el gate en
  verde en el tablero, arranca, y el trabajo del que depende no está en su rama.
- El estado de integración vive en **git** ("¿este commit está en `main`?"). RL lee frontmatter del
  vault; no ve git.
- La salida fácil — un campo manual tipo `in_main: true` en el frontmatter — es **duplicar a mano
  el estado de git**: una segunda fuente de verdad que deriva. Viola VISION §4.2 (single source) y
  está descartada de plano.

## 2. La idea, en una frase

> RL **deriva** (nunca declara) un indicador de integración por lane leyendo git directamente:
> *"rama `dt-073` del worktree `wt-01`: **N commits sin integrar** a `main`"*. Fuente única = git;
> RL solo muestra, igual que con overlap y gates.

## 3. Por qué encaja con los principios

- **Single source (VISION §4.2)**: el dato no se escribe en ningún `.md` ni `.yaml` — se consulta a
  git y se muestra. Cero drift posible.
- **El sistema asiste, no impone (VISION §4.6)**: RL no bloquea nada; señala. La decisión de
  mergear sigue siendo del usuario, como con el orden y el overlap.
- **No reimplementar lo que otra herramienta ya da (VISION §10)**: la respuesta autoritativa sigue
  siendo `git log main..rama`; RL solo la acerca al tablero donde se toma la decisión.
- **El campo ya existe**: `lanes.yaml` declara `worktree` por lane (hoy solo se muestra como texto
  en el header del lane, `render.ts`). Este plan le da semántica real.

## 4. Qué mostraría

**MVP = solo el badge por lane** (decidido — resuelve el 80% del problema con un cuarto del
trabajo):

1. **Badge por lane en el header del tablero**: rama checked-out en ese worktree + commits ahead
   de la rama base (`main` por defecto). Ej.: `wt-01 · dt-073 · ↑12`. Con `↑0`, el lane está
   integrado.
2. **El mismo dato en el `--report` del validador CLI** (plan 07, que ya estará ejecutado): si el
   actor principal es el agente, el estado de integración le sirve más en el CLI que en la UI —
   una línea por lane en la sección de reporte. **Best-effort y opt-in, obligatorio**: el
   validador es deliberadamente read-only y sin dependencias de entorno; git le agrega modos de
   fallo nuevos (shallow clones en CI donde `rev-list --count` miente o falla, detached HEAD,
   git ausente del PATH) justo en los usos donde el 07 promete robustez (pre-commit/CI). La
   sección git del reporte solo aparece con `gitIntegration` activo y repo sano; ante cualquier
   fallo **se omite la sección** — nunca afecta la validación ni el exit code.

**Iteración 2 (fuera del MVP)** — refuerzo del gate cross-lane: si un gate apunta a una tarea
`done` de un lane cuyo worktree tiene commits sin integrar, el gate se muestra en verde **con
advertencia** ("cerrada pero posiblemente sin integrar a la base").

**Limitación honesta del refuerzo de gates** (documentarla en la UI/leyenda si se implementa): la
señal es **a nivel rama, no a nivel tarea**. Git no puede decir si los commits pendientes
corresponden a *esa* tarea — RL solo sabe que el worktree de su lane tiene algo sin integrar. Es
una advertencia heurística, no un veredicto. Intentar mapear tarea→commits (por convención de
mensaje, etc.) es frágil y queda explícitamente fuera (§8).

## 5. Cómo obtener el dato

- **Descubrimiento del repo**: el vault puede ser una subcarpeta del repo (caso real: vault =
  `doc/`, repo en el padre). Resolver con `git rev-parse --show-toplevel` desde el path del vault.
  Si no hay repo → la feature se desactiva en silencio (vaults sin git siguen funcionando igual).
- **Mapeo lane → rama**: `git worktree list --porcelain` devuelve `worktree path / branch` de cada
  worktree. Se matchea el campo `worktree` del lane contra el nombre del directorio del worktree.
  No se agrega campo nuevo a `lanes.yaml` en el MVP.
- **Commits pendientes**: `git rev-list --count <base>..<branch>` — devuelve el entero directo
  (métrica robusta, sin parsear/contar salida de texto). Rama base configurable en settings
  (`baseBranch`, default `main`).

## 6. Restricciones de plataforma

- Ejecutar `git` requiere `child_process` → **solo Obsidian desktop**. En mobile la feature se
  desactiva con degradación limpia (el tablero queda como hoy). Mismo patrón de settings existente
  (`RoadmapLanesSettings` + `loadData`/`saveData`).
- Las consultas git son **fuera del vault** → `metadataCache` no avisa de cambios. No hay evento
  nativo que dispare re-render (ver decisión abierta §7.3).

## 7. Decisiones abiertas (lo que falta madurar)

1. **¿CLI git vs leer `.git` directo vs isomorphic-git?** Inclinación actual: CLI (`child_process`),
   porque leer `.git` a mano es frágil y isomorphic-git es una dependencia pesada para dos
   comandos. Contra: depende de git en el PATH del usuario.
2. **¿Toggle de la feature?** Probablemente sí: setting `gitIntegration: on/off`, default off
   (opt-in), para que los vaults sin worktrees no paguen nada.
3. **¿Cuándo refrescar?** Opciones: (a) al abrir/enfocar el tablero + botón manual de refresh;
   (b) polling con timer. Inclinación: (a) — sin timers de fondo, coherente con un plugin que hoy
   es 100% reactivo a eventos.
4. **Naming del campo**: ¿`worktree` sigue siendo el nombre correcto si ahora se matchea contra
   git, o conviene aceptar también un path? Casos borde: worktree renombrado, lane sin worktree.

(La ex-decisión "¿el refuerzo del gate entra en el MVP?" se cerró el 2026-06-12: MVP = badge
solo, en tablero y en `--report`; gate reforzado = iteración 2 — ver §4.)

## 8. Non-goals

- **No** es tracking tarea→commits (frágil, fuera — ver §4).
- **No** ejecuta operaciones git (merge, fetch, push): solo lectura. RL nunca muta el repo.
- **No** reemplaza el protocolo de merge escrito del proyecto consumidor (cuándo mergear, con qué
  mecánica): eso sigue siendo decisión y documentación del usuario. RL muestra el *estado*, no la
  *política*.
