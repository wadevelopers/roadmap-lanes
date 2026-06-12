# PLAN — Validador CLI (cerrar el loop de validación para agentes IA)

> Estado: **ready** — las 5 decisiones de §6 cerradas el 2026-06-11 (3 elegidas por el usuario,
> 2 resueltas con evidencia de la migración wadev). Listo para ejecutar; prerequisito blando:
> plan 06 primero (el set de alerts queda completo antes de congelar fixtures).
> Origen: 2026-06-11, migración del roadmap de wadev a RL. RL está pensado para que **una IA
> escriba** los documentos y el humano mire el tablero — pero los model alerts (refs rotas, ids
> duplicados, `combo-falsely-done`, duraciones inválidas…) solo se renderizan **en el tablero**.
> El agente que escribe el frontmatter nunca los ve; el error lo descubre el humano, visualmente,
> después. El loop de validación está roto justo para el actor que produce los datos.

## 1. Objetivo

Un comando CLI que valide una carpeta de roadmap **reutilizando el core** (`buildModel` ya es TS
sin dependencias de Obsidian) y emita los mismos alerts que ve el humano en el tablero:

```sh
node <clone>/validate.js <carpeta-roadmap> [--json] [--report] [--strict] [--hours-per-day N]
```

- **Salida texto** (default): un alert por línea con severidad, id de tarea y mensaje — formato
  pensado para que un agente lo lea como lee la salida de un linter.
- **Salida `--json`**: el array de alerts crudo, para tooling.
- **Exit code ≠ 0** si hay alerts de severidad `error` (`--strict` extiende el fallo a `warning`).
- **`--report`**: además de validar, imprime el estado derivado del tablero (§5).

El flujo del agente queda igual que con lint: escribir/editar los `.md` → correr el validador →
corregir → recién entonces dar por cerrado el cambio.

## 2. Por qué encaja

- **Mismo motor, cero duplicación**: los alerts ya existen y ya están centralizados en el core. El
  CLI no reimplementa reglas — solo les da otra salida. Si el tablero y el CLI divergieran en
  reglas, sería señal de bug, no de diseño. *(Evaluado y descartado escribirlo en Python: habría
  que reimplementar cada regla del modelo y mantenerla sincronizada en dos lenguajes — la clase
  de doble fuente de verdad que este proyecto existe para eliminar. Lo único nuevo del CLI es la
  fuente de datos, que se escribe igual en cualquier lenguaje.)*
- **El usuario objetivo corre CLI con naturalidad**: el actor que escribe es una IA en un entorno
  de desarrollo desktop; correr un comando es su modo normal de operar.
- **Sirve también para CI/hooks**: un proyecto consumidor puede correr el validador en pre-commit
  y bloquear commits que rompan el modelo del roadmap.

## 3. El problema técnico real: la fuente de datos

`buildModel` es portable, pero **`dataSource` no**: hoy lee de `app.metadataCache` (frontmatter ya
parseado, wikilinks ya resueltos vía `frontmatterLinks`). El CLI necesita una **segunda fuente de
datos** en Node puro:

1. Escanear `**/*.md` de la carpeta + leer `lanes.yaml` / `taxonomy.yaml`.
2. Parsear frontmatter (parser YAML; evaluar `gray-matter` o el parser YAML ya disponible).
3. **Normalizar wikilink→id** — hoy esa normalización vive en el camino del `metadataCache`. Para
   no duplicarla, extraerla a una función del core compartida por ambas fuentes (plugin y CLI).
   Este refactor es parte del plan, no un opcional.

Riesgo a vigilar: divergencia sutil entre cómo resuelve wikilinks Obsidian (`[[id|alias]]`, paths,
case) y cómo lo haga el parser propio. Mitigación: tests de paridad con fixtures compartidos
(`examples/demo-app/roadmap` ya sirve de fixture).

Casos reales detectados en la primera migración (wadev) que los fixtures deben cubrir:

- **Frontmatter con CRLF**: un archivo migrado venía con line endings Windows; Obsidian lo parseó
  sin problema — el parser Node tiene que igualar eso.
- **Campos declarados pero vacíos** (`parent: ""`): error real de un agente al escribir tareas.
  El validador debe flaggearlo (Obsidian lo trata como `parent: null`, fácil de no ver).

Checklist de validaciones confirmadas por uso real (la migración las corrió a mano con bash;
sirven de spec mínima del set de alerts que el CLI debe cubrir): toda `zone` usada existe en
`taxonomy.yaml`; todo wikilink de frontmatter resuelve a un archivo de tarea; todo id de las
queues de `lanes.yaml` existe; cero `id` duplicados; todo `.md` de la carpeta tiene frontmatter.

## 4. Distribución — decidida: entry en el repo, ejecución con node

El validador se compila como entry adicional de esbuild (`validate.js`, committeado en el repo
del plugin, igual que `main.js`). El proyecto consumidor lo corre desde su clone:

```sh
node <path-al-clone-de-roadmap-lanes>/validate.js <carpeta-roadmap> [--json|--report|--strict]
```

Cero publicación, funciona hoy. No requiere Obsidian instalado ni vault abierto. Publicar como
paquete npm (`npx`) queda para cuando el plugin salga a la comunidad y haya demanda externa —
no antes.

## 5. Alcance MVP

- Validar tareas + `lanes.yaml` + `taxonomy.yaml` con el set de alerts existente. Nada de alerts
  nuevos en este plan (la alerta de madurez-en-turno es el plan 06; cuando exista, el CLI la
  reporta gratis — por eso 06 va primero).
- **Exit code**: solo `error` falla por default; `--strict` hace fallar también `warning`.
- **Dismissals compartidos**: las aceptaciones se leen de `accepted-alerts.yaml` dentro de la
  carpeta del roadmap (ver §6.5) — los alerts aceptados no se reportan ni afectan el exit code.
- **`--report`**: imprime el estado derivado del tablero en texto/JSON — next por lane, gates y
  su estado, overlap, conteos por columna (backlog/lanes/done). Duraciones en horas crudas (el
  frontmatter es numérico); flag opcional `--hours-per-day N` para mostrar también días.
- Texto + `--json` + exit codes. Sin modo watch, sin autofix.

## 6. Decisiones — cerradas el 2026-06-11

1. **¿`warning` afecta el exit code?** → **Solo `error` falla; `--strict` opcional para
   warnings** (decisión del usuario). Coherente con linters estándar; los warnings legítimos
   pendientes de acción humana no bloquean al agente.
2. **Distribución** → **entry compilado en el repo, ejecución con `node` desde el clone**
   (decisión del usuario). npm diferido a la publicación comunitaria.
3. **`--report`** → **entra al MVP**. Evidencia de la migración wadev: el agente que escribió las
   ~80 tareas derivó a mano el estado del tablero tres veces (conteo de backlog, next por lane,
   verificación de gates) con one-liners bash ad-hoc — exactamente lo que `--report` da gratis.
4. **Conversión horas→días** → el CLI trabaja en **horas crudas** (la unidad del frontmatter);
   `--hours-per-day N` opcional para display en días. Sin acceso a settings del plugin.
5. **Dismissals compartidos** → **`accepted-alerts.yaml` versionable dentro de la carpeta del
   roadmap** (decisión del usuario), escrito por el plugin al apretar Accept y leído por ambos.
   Versionado en git → la aceptación viaja con el repo y la ven todos los agentes y máquinas.
   **Incluye migrar la persistencia de dismissals del plugin** a ese archivo (hoy viven en estado
   del plugin) — es parte de este plan, no un opcional: sin eso el CLI re-reporta lo aceptado
   (caso real: los 4 alerts de margen de duración de los combos de wadev).

## 7. Non-goals

- No edita ni corrige archivos (el agente corrige; el validador solo reporta).
- No reemplaza al tablero: es la misma información en otro canal, para otro actor.
