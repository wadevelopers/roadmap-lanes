# PLAN — Port del core (`buildModel` → TypeScript leyendo del `metadataCache`)

> Objetivo: tener la **lógica del modelo** (validación + derivaciones + solape + gates) corriendo
> en el plugin, alimentada por el **`metadataCache`** de Obsidian, **tipada** y **cubierta por
> tests**, con una **salida mínima visible** que confirme que funciona (todavía **no** el tablero;
> eso es el plan de render aparte).
>
> Depende de: el entorno de desarrollo ([`SETUP_DESARROLLO.md`](../SETUP_DESARROLLO.md))
> para poder verlo en Obsidian.

## Estado: implementado como salida mínima

## Qué se mantiene y qué cambia

El core de la web `v0.2.0` se parte en dos responsabilidades que ya estaban separadas
(`buildModel.js` = lógica; `loadProject.js` = IO):

| Pieza de la web | En el plugin |
|---|---|
| `buildModel.js` (lógica pura) | **Se porta casi 1:1 a TS** (mismas validaciones y derivaciones), tipado. |
| `loadProject.js` (lee disco con `node:fs` + `js-yaml`) | **Se reemplaza** por una capa que lee del `metadataCache` (tareas) y de `vault.read` (los `.yaml`). |
| `build.js` (genera `datos.js`) | **Desaparece.** No hay build de datos: el `metadataCache` es la fuente viva. |

La lógica de `buildModel` (indexar por id, validar enums/áreas/zonas/relaciones, derivar `hijos`,
`desbloquea`, `absorbidaPor`, `esContenedor`, `horasEfectivas`, estados visuales,
`solapeCarriles`, `gatesCruzados`) se porta a TypeScript y se adapta al contrato del plugin:
`duracion` en horas numéricas reemplaza al `dias` de la web.

## Decisiones técnicas aplicadas

1. **Normalización wikilink → id.** Las relaciones (`padre`, `depende_de`, `absorbe`) son wikilinks
   (`"[[EPIC-100]]"`). Dos formas de obtener el id destino:
   - **(a) `frontmatterLinks` del `metadataCache`** — Obsidian ya parsea cada wikilink del
     frontmatter y da `{ key, link, displayText }`; `link` es el archivo destino. **Recomendada.**
   - (b) parsear el string `"[[X]]"` a mano (quitar corchetes).
   - **Convención asumida:** el `id` de una tarea = nombre de su archivo (`FT-001.md` → `id: FT-001`),
     así `link` ya **es** el id. Si en el futuro divergen, se resuelve el link al `TFile` con
     `metadataCache.getFirstLinkpathDest()` y se lee su `frontmatter.id`. El plan asume la convención.
2. **Test runner para TS.** El core es lógica pura sin Obsidian → testeable aislado. Se usa
   **Vitest**, con `.obsidian/` excluido para no duplicar tests por el symlink del vault de prueba.
3. **Adaptar el `demo-app` a wikilinks.** Para probar el core con relaciones reales, los `.md` del
   demo pasan de `padre: EPIC-100` a `padre: "[[EPIC-100]]"` (y `depende_de`, `absorbe`). En el
   mismo cambio, `dias` pasa a `duracion`.

## Estructura de archivos (nueva)

```
src/
├── types.ts        # interfaces: RawTarea, Tarea, Modelo, Carriles, Taxonomia
├── buildModel.ts   # la lógica pura portada de buildModel.js (tipada)
├── dataSource.ts   # metadataCache + vault.read(yaml) + normalización wikilink→id → input de buildModel
├── i18n.ts         # traducciones mínimas en inglés/español
└── render.ts       # (mínimo por ahora) volcado del modelo en el ItemView para verificar
test/
└── buildModel.test.ts   # port de los tests, fixtures en memoria (sin Obsidian)
```

`main.ts` deja de tener el placeholder y pasa a: en `onOpen`, `dataSource → buildModel → render`.

## Pasos

### 1. Tipos (`types.ts`)
Definir las interfaces del modelo a partir de los campos reales (id, titulo, tipo, madurez, estado,
duracion, areas, zonas, padre, absorbe, depende_de + derivados: hijos, desbloquea, absorbidaPor,
esContenedor, horasEfectivas, estadoVisual, esperaIds, carril, posicion). Más `Modelo`,
`Carriles`, `Taxonomia`.

### 2. Portar `buildModel.js` → `buildModel.ts`
Copiar la lógica tal cual, tipando. Mantener las constantes `TIPOS`/`MADUREZ`/`ESTADOS` y todas las
derivaciones. **Sin cambios de comportamiento** — es un port, no un rediseño.

### 3. Capa de datos (`dataSource.ts`)
- **Tareas:** recorrer los `.md` dentro de la carpeta de roadmap configurable; por cada uno,
  `metadataCache.getFileCache(file)` → `frontmatter` (campos planos) + `frontmatterLinks`
  (relaciones). Normalizar wikilink→id (decisión 1). Producir el array `tareas` con la misma forma
  que consumía `buildModel`.
- **`taxonomy.yaml` / `lanes.yaml`:** no son notas → `vault.adapter.read()` + `js-yaml`.
- Devolver `{ tareas, taxonomia, carriles }`.

### 4. Adaptar el `demo-app` a wikilinks (decisión 3)
Editar los `.md` del demo: relaciones a `"[[id]]"` y `duracion` en horas. Verificar en Obsidian
que el grafo/backlinks reconocen los wikilinks (cierra de paso la verificación de formato).

### 5. Tests (`buildModel.test.ts`)
Portar `test/buildModel.test.js` de la web (10 tests) a TS, con fixtures en memoria (no tocan
Obsidian). Cubrir: validaciones, derivaciones, estado visual de contenedores, solape, gates.

### 6. Salida mínima + reactividad
En el `ItemView`, render mínimo (lista de tareas con id, estado derivado, carril, y el resumen de
`solapeCarriles`) — **no** el tablero, sólo prueba de que el pipeline anda. Suscribir
`metadataCache.on("changed")` y `vault.on("modify")` para re-renderizar al editar.

## Criterio de "hecho"

- `npm test` (o `vitest`) verde con los tests del core portados.
- Al abrir la vista en el vault `demo-app`, se ve la **lista de tareas con su estado derivado** y el
  **solape entre carriles** calculado — leído del `metadataCache`, sin `datos.js`.
- Editar un `.md` (p. ej. marcar `estado: hecho`) y guardar → la vista se **actualiza sola**.

## Riesgos / notas

- **Forma de `frontmatterLinks`:** confirmar en runtime los nombres exactos de los campos
  (`key`/`link`) en la versión de Obsidian instalada (puede variar levemente). Verificación canónica:
  un `console.log` del cache de una nota del demo.
- **Listas de wikilinks** (`depende_de: ["[[A]]", "[[B]]"]`): confirmar que `frontmatterLinks` las
  enumera todas con su `key`.
- **No incluye el render del tablero** (Gantt, carriles, solape visual, panel de detalle,
  expandir/contraer): eso es un plan posterior que reusa el CSS de la web `v0.2.0`.
