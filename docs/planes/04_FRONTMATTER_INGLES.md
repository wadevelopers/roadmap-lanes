# PLAN — Frontmatter canónico en inglés (claves y valores)

> Estado: **aprobado — pendiente de ejecución** (incorpora revisión externa).
> Orden: **después de `03_COMBO` (hecho), antes de `05_EXPANDIR_CONTRAER_TIEMPO`**.
> Migración de vocabulario: el valor del `.md` **es** el canónico interno (sin capa de traducción).

---

## 1. Objetivo y motivación

Hoy las **claves y valores** del frontmatter están en español: `titulo`, `tipo`, `madurez`, `estado`,
`duracion`, `padre`, `absorbe`, `depende_de`, `zonas`; y valores `FT/DT/INFRA/COMBO`,
`nota/esqueleto/ejecutable`, `pendiente/hecho`. Para un plugin **publicable**, el usuario debe
escribir en **inglés** (lingua franca de apps/plugins de este tipo), y debe poder hacerlo a mano.

**Decisión de fondo (cerrada en discusión):**
- **Se conserva la política de UI actual** (no es un cambio): las *labels* se traducen por i18n, pero el
  **valor del `.md` se muestra crudo** y los estados *visuales* derivados se traducen. Como ahora el valor
  es inglés, lo que se muestra crudo pasa a verse en inglés — consecuencia de migrar el valor, no de tocar
  la UI. (Nada de i18n del valor.)
- El frontmatter en inglés **es** el vocabulario canónico interno. Un único idioma.
- **Sin compatibilidad legacy**: el parser lee **solo** las claves nuevas en inglés. Nada de
  `tipo || type`, `estado || status`, `foco || focus`. Los datos actuales son de prueba; se migran.
- Esto **no cierra la puerta** a soporte multi-idioma futuro: como el canónico queda en inglés, agregar
  un día una capa de alias (es→en) sería una adición limpia en `parseTask`, no un rewrite.

## 2. Decisiones cerradas — vocabulario

| Concepto | Clave (es → en) | Valores (es → en) |
|---|---|---|
| Tipo | `tipo` → **`type`** | `FT`→`feat` · `DT`→`maint` · `INFRA`→`infra` · `COMBO`→`combo` |
| Madurez | `madurez` → **`maturity`** | `nota`→`raw` · `esqueleto`→`draft` · `ejecutable`→`ready` |
| Estado | `estado` → **`status`** | `pendiente`→`pending` · `hecho`→`done` |
| Título | `titulo` → **`title`** | — |
| Duración | `duracion` → **`duration`** | número de horas (sin cambio de formato) |
| Áreas | `areas` (igual) | valores de `taxonomy.yaml` |
| Zonas | `zonas` → **`zones`** | valores de `taxonomy.yaml` |
| Padre | `padre` → **`parent`** | wikilink |
| Absorbe | `absorbe` → **`absorbs`** | wikilinks |
| Depende de | `depende_de` → **`depends_on`** | wikilinks |
| `id` | igual | — |

**Por qué estos términos** (del análisis):
- **`maint` (maintenance)**: el tipo agrupa "arreglar/mejorar lo que ya existe (bug + deuda)". El término
  de libro para eso es **mantenimiento de software** (corrective=bug, perfective=mejora, preventive=deuda).
  Es más preciso que `fix` (solo bugs) o `td` (solo deuda).
- **`raw`**: primer nivel de madurez = capturado crudo (idea, problema detectado, TODO) sin analizar.
- **`ready`**: término establecido ("Definition of Ready").
- **Códigos legibles, no códigos de 2 letras**: `FE` colisiona con "frontend" (FE/BE es universal) y
  `MA/IN/CO` son crípticos **justo en Graph/Bases**, que es donde más se *lee* el `type`. `feat`/`maint`/
  `infra`/`combo` siguen siendo compactos, pero se entienden sin tabla externa. El valor se escribe una vez
  y se lee muchas → gana la legibilidad. El **badge** muestra ese mismo valor en mayúsculas por CSS, sin
  tabla de presentación que separe valor-guardado de valor-mostrado.

## 3. Alcance — rename interno completo a inglés

Decisión cerrada: el inglés llega **hasta el fondo**, no solo al frontmatter. Si la corrección es "esto
debió nacer en inglés", dejar parte del modelo en español sería **deuda nueva** (lo que la regla de
arquitectura limpia prohíbe). El proyecto está chico → costo bajo. Se renombra:

- **Campos espejo del frontmatter** (`RawTask`/`Task`): `titulo`→`title`, `tipo`→`type`,
  `madurez`→`maturity`, `estado`→`status`, `duracion`→`duration`, `zonas`→`zones`, `padre`→`parent`,
  `absorbe`→`absorbs`, `depende_de`→`depends_on`.
- **Campos derivados internos**: `esContenedor`→`isContainer`, `duracionHoras`→`durationHours`,
  `horasEfectivas`→`effectiveHours`, `estadoVisual`→`visualState`, `esperaIds`→`waitingFor`,
  `bloqueado`→`blocked`, `absorbidaPor`→`absorbedBy`, `desbloquea`→`unlocks`, `hijos`→`children`,
  `carril`→`lane`, `posicion`→`position`.
- **Nombres de tipos/interfaces**: `Tarea`→`Task`, `RawTarea`→`RawTask`, `Modelo`→`Model`,
  `Carriles`→`Lanes`, `Taxonomia`→`Taxonomy`, `Alerta`→`Alert`, `CodigoAlerta`→`AlertCode`,
  `Severidad`→`Severity`, `SolapeCarriles`→`LaneOverlap`, `GateCruzado`→`CrossLaneGate`
  (y derivados análogos).
- **Campos agregados del modelo/input**: `tareas`→`tasks`, `taxonomia`→`taxonomy`, `carriles`→`lanes`,
  `horasPorDia`→`hoursPerDay`, `zonasDeCarril`→`laneZones`, `solapeCarriles`→`laneOverlaps`,
  `gatesCruzados`→`crossLaneGates`, `alertas`→`alerts`.
- **Campos de alertas y params**: `codigo`→`code`, `severidad`→`severity`, `tareaId`→`taskId`; params a
  inglés (`archivo`→`file`, `valor`→`value`, `carril`→`lane`, `carrilA/B`→`laneA/B`,
  `declarada`→`declared`, `derivada`→`derived`, `esperado`→`expected`, etc.).
- **Estados visuales** (`ESTADOS_VISUALES`): `hecho`/`fuera-de-turno`/`proximo`/`en-espera`/`en-curso`
  → `done`/`out-of-turn`/`next`/`waiting`/`in-progress`.
- **Códigos de alerta** (`CodigoAlerta`→`AlertCode`): a inglés (§4 i18n). Son identificadores internos sin datos
  reales que dependan de ellos (las huellas de "Aceptar" viven en `data.json`, gitignored y descartable);
  dejarlos en español sería el código a medio migrar.

TS caza cada referencia al renombrar (no compila si falta una), así que el rename es seguro aunque ancho.

## 4. Cambios por archivo

### `src/types.ts`
- `TIPOS = ["feat", "maint", "infra", "combo"]`; `MADUREZ = ["raw", "draft", "ready"]`;
  `ESTADOS = ["pending", "done"]`.
- **Centralizar enums** (hoy `render.ts` duplica los suyos): exportar también `TIPOS_FILTRABLES`
  (= `TIPOS` sin `combo`) para el filtro del tablero; `render.ts` los importa, no los redefine.
- `ESTADOS_VISUALES` → inglés (§3). `AlertCode` (la unión de códigos) → inglés (ver i18n).
- Interfaces y campos a inglés: `Task`/`RawTask`/`Model`/`Lanes`/`Taxonomy`; campos espejo y derivados
  según §3.

### `src/dataSource.ts`
- `parseTask` lee **solo** las claves nuevas en inglés (`frontmatter.title`/`type`/…); relaciones por
  `relationSingle/relationList(cache, "parent"/"absorbs"/"depends_on", …)`.
- **Sin aliases legacy**: borrar `foco`↔`focus`, `cola`↔`queue` (lanes), `carriles`↔`lanes` (YAML
  top-level) y `zonas`↔`zones` (taxonomía) → solo `focus`/`worktree`/`queue`, top-level `lanes` y `zones`.

### `src/buildModel.ts`
- Enums (`isType`/`isMaturity`/`isStatus`), campos, nombres internos del modelo y **códigos de alerta** a
  inglés. La estructura semántica de las alertas no cambia, pero sus propiedades sí: `code`, `severity`,
  `taskId`, `params` con claves en inglés.
- Renombrar helpers internos en español cuando sean parte del modelo/refactor (`parseDuracionHoras`,
  `normalizeCarriles`, `estaHecho`, `collectLeaves`, etc.) para evitar una mezcla de idiomas en el código.

### `src/render.ts`
- Importar `TIPOS_FILTRABLES`/`MADUREZ` de `types.ts` (borrar los locales). Campos (`task.status`/
  `type`/`maturity`/…). Badge: clases `rl-type-feat/maint/infra/combo`, mostrando el valor como código
  legible (mayúsculas por CSS). `formatAlert` arma `alert_${alert.code}` con los códigos ya en inglés.

### `src/i18n.ts`
- Renombrar las claves `alert_<code>` a los códigos en inglés (es/en). Ajustar los mensajes que **listan
  valores**: `alert_invalid-status` "(only pending | done)" / "(solo pending | done)".

### `styles.css`
- Variables y reglas `.rl-type-feat/maint/infra/combo`; `text-transform: uppercase` en el badge para
  conservar el look actual sin separar valor-guardado de valor-mostrado.

### Ejemplos (`examples/demo-app/roadmap/*.md`)
- Migrar **todos** los `.md`: claves + valores a inglés. `lanes.yaml`/`taxonomy.yaml` ya usan
  `focus`/`worktree`/`queue` y `zones` (verificar, dejar inglés-only).

### Tests (`test/buildModel.test.ts`)
- `datosBase` y los pushes: valores y campos a inglés (`type:"feat"`, `status:"done"`, `maturity:"ready"`,
  `type:"combo"`). El fixture demo debe seguir **sin alertas**.

## 5. Documentación a actualizar

| Archivo | Cambio |
|---|---|
| `VISION.md` | Ejemplo de frontmatter (§7.2), árbol de `tipo` (§7.3), madurez/estado (§7.4): claves y valores a inglés. |
| `guias/FLUJO_DE_TRABAJO.md` | Menciones a `tipo/estado/madurez` y sus valores. |
| `guias/VISUALIZACION_OBSIDIAN.md` | Ejemplos del grafo: `[tipo:FT]`→`[type:feat]`, `[estado:hecho]`→`[status:done]`, `[madurez:…]`→`[maturity:…]`, `[padre]`→`[parent]`. |
| `NOTES.md` | Entrada de decisión (frontmatter en inglés + vocabulario). |

## 6. Migración de datos existentes

- **Demo (en el repo)**: parte de este plan (§4). Find-replace de claves y valores.
- **Roadmap real del usuario** (ERP, fuera de este repo): el usuario migra sus notas con un
  find-replace de claves+valores. Hasta migrar, sus notas no se interpretan correctamente por el plugin:
  las claves españolas quedarían ignoradas; si una nota queda parcialmente migrada (claves nuevas con
  valores viejos), ahí sí aparecerían alertas de enum inválido. **Acción del usuario**, no del plugin — se
  documenta acá pero no se ejecuta desde este plan.

## 7. Fuera de alcance

- **i18n del valor para display** (descartado: el `.md` se muestra tal cual).
- **Alias multi-idioma** (es↔en en `parseTask`): futuro; el canónico inglés lo deja como adición limpia.
- **Agregar/quitar estados, tipos o madureces**: NO — mismo set, solo renombre.

## 8. Orden de ejecución (commits)

El rename no tiene capa de compat, así que es **cross-cutting**: `types`/`buildModel`/`render`/ejemplos/
tests deben cambiar **juntos** o el repo no compila ni pasan los tests. Por eso **no** se parte en "core"
y "UI" (dejaría commits rotos en el medio). Regla: **commitear solo cuando `npm run build` y `npm test`
pasan**.

1. **Migración de código** (un commit, build+test verdes): `types.ts` + `dataSource.ts` + `buildModel.ts`
   + `render.ts` + `i18n.ts` + `styles.css` + `examples/**` + `test/**`. Fixture demo sin alertas.
2. **Docs** (commit aparte): `VISION.md`, `guias/*`, `NOTES.md`.
