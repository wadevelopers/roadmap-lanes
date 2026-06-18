# PLAN — Orden por `depends_on` en hijos de combos y selección de texto en detalle

> Estado: **propuesto** — diagnóstico verificado contra el código el 2026-06-18. No implementado.
>
> **Justificación**: el tablero ya usa `depends_on` para bloqueo, `waitingFor`, gates y `next`, pero
> no lo usa para ordenar hojas hermanas dentro de un contenedor. El contrato actualizado en VISION
> mantiene la queue explícita de `lanes.yaml` como fuente del orden de primer nivel, pero permite
> derivar por `depends_on` el orden implícito dentro de un COMBO. Además, el panel de detalle
> renderiza el body con `MarkdownRenderer`, pero no declara explícitamente que el texto del panel sea
> seleccionable; en una vista custom de Obsidian eso puede heredar superficies no seleccionables y
> bloquear el flujo básico de copiar texto del documento.

## 1. Objetivo

Resolver dos bugs acotados:

1. **Orden local dentro de combos/contenedores**: cuando una hoja depende de una hermana, la hermana
   requerida debe aparecer antes, aunque el orden alfabético de archivos sea otro.
2. **Selección de texto en el detalle**: el usuario debe poder seleccionar y copiar texto renderizado
   del documento desde el panel de detalle, sin romper el resize del panel ni los botones de navegación.

## 2. Diagnóstico verificado

### 2.1 Orden de hojas

El diagnóstico original apunta a `render.ts:415`, pero el punto efectivo empieza antes:

- `dataSource.ts:121-124` y `nodeDataSource.ts:23-33` cargan los `.md` ordenados por path.
- `buildModel.ts:237-241` arma `task.children` iterando `byId.values()`, que conserva el orden de
  carga.
- `buildModel.ts:289-312` expande un contenedor a hojas recorriendo `task.children` sin mirar
  `depends_on`.
- `buildModel.ts:334-352` usa esa expansión para asignar lane/position a hojas.
- `buildModel.ts:468-471` guarda `lane.queue` ya expandida y calcula `next` con ese orden.
- `render.ts:1026-1028` consume `model.lanes[lane].queue`; aunque `render.ts:415-438` tiene otra
  expansión, normalmente ya recibe hojas expandidas desde el modelo.

Conclusión: **arreglar solo `render.ts` corrige como mucho una capa visual parcial**. El fix correcto
debe vivir en `buildModel.ts`, porque el orden derivado también alimenta `lane.queue`, `next`, estados
visuales y alertas de madurez de la próxima tarea.

Caso real observado: si dentro de `CC-4` el orden por path deja los hijos como:

```text
ETAPA-2B -> ETAPA-3 -> ETAPA-3B
```

y `ETAPA-2B` declara `depends_on: ETAPA-3B`, el orden visible esperado es:

```text
ETAPA-3B -> ETAPA-2B -> ETAPA-3
```

No se debe resolver renombrando archivos: el contrato del plugin dice que las dependencias duras
viven en `depends_on`.

### 2.2 Selección de texto en detalle

El panel se construye en `render.ts:1284-1342` y el body markdown en `render.ts:1183-1189`.
El CSS del panel está en `styles.css:946-956`.

En el CSS del plugin solo aparece `user-select: none` durante resize (`styles.css:984-991`), lo cual
es correcto para arrastrar el borde. El problema es que el panel no fuerza `user-select: text` para
el contenido renderizado. En Obsidian, una vista/plugin puede heredar estilos de superficie pensados
para controles, no para lectura, y el body del detalle queda sin garantía explícita de selección.

Conclusión: el fix debe ser CSS puntual sobre el panel/body de detalle, manteniendo `user-select:
none` solo para controles y para el estado de resize.

### 2.3 Contrato de orden

El fix no debe cambiar el contrato de `lanes.yaml`: la queue explícita de primer nivel sigue siendo
la decisión del usuario. Si `lanes.yaml` lista `B, A` y `B depends_on A`, RL no debe mostrarlo como
`A, B`; debe conservar `B` en su posición, marcarlo bloqueado/fuera de turno y explicar que espera a
`A`.

El bug está en otro nivel: cuando la queue lista un COMBO (`CC-4`), los hijos del COMBO no tienen una
lista explícita propia en `lanes.yaml`. El orden actual por path de archivo es un fallback accidental,
no una decisión humana. En ese caso, `depends_on` sí debe decidir el orden local entre hermanos, con
path como fallback solo para hermanos independientes.

## 3. Diseño del fix de orden

### 3.1 Semántica

Ordenar **solo dentro del conjunto de hermanos de un mismo contenedor**.

- Si dos hermanos son independientes entre sí, conservar el orden actual.
- Si un hermano depende de otro hermano, emitir primero la dependencia y después el dependiente.
- Si la dependencia apunta fuera del conjunto de hermanos actual, no usarla para reordenar ese nivel.
- Si la dependencia apunta a un descendiente de un hermano contenedor, tratar ese hermano contenedor
  como prerequisito local.
- No reordenar la queue de primer nivel de `lanes.yaml`: esa sigue siendo decisión explícita del
  humano.

### 3.2 Algoritmo

Usar un orden topológico **dependency-first estable por DFS**, no un Kahn stable genérico.

Motivo: con orden original `2B, 3, 3B` y edge `2B depends_on 3B`, un Kahn estable puede producir
`3, 3B, 2B` porque `3` no tiene prerequisitos. El comportamiento deseado para el tablero es mantener
la posición conceptual del bloque dependiente y anteponerle sus prerequisitos locales:

```text
visit(2B) -> visit(3B) -> emit 3B -> emit 2B -> visit(3) -> emit 3
```

Resultado:

```text
3B, 2B, 3
```

Reglas de implementación:

1. Recibir la lista original de ids hermanos.
2. Crear un índice `taskId/descendantId -> siblingId`.
3. Para cada sibling en orden original:
   - visitar primero los siblings locales referenciados por `depends_on` del sibling o de sus hojas
     descendientes;
   - emitir el sibling después de sus prerequisitos locales;
   - no emitir dos veces.
4. En ciclos locales, cortar la recursión al detectar `visiting` y conservar el orden original lo
   máximo posible. No agregar una alerta nueva en este plan: el objetivo es ordenar cuando el grafo
   es acíclico y no empeorar ciclos existentes.

### 3.3 Dónde tocar

1. `src/buildModel.ts`
   - Agregar helper local, por ejemplo `orderSiblingChildrenByDependencies`.
   - Hacer que el `collectLeaves` interno use los hijos ordenados antes de recursar.
   - Mantener los cálculos que no dependen de orden (`effectiveHours`, `isDone`, bounds de combo)
     semánticamente iguales.
2. `src/render.ts`
   - Preferencia: dejar de re-expandir contenedores en `expandLaneItems` y consumir `lane.queue`
     como la fuente derivada del modelo, filtrando solo `done`/`absorbedBy`.
   - Si se mantiene la expansión defensiva, debe usar el mismo criterio de orden para no tener dos
     contratos distintos. Evitar duplicar algoritmos si se extrae un helper compartido.
3. `src/types.ts`
   - Sin cambios esperados de contrato público.
4. Documentación
   - Mantener VISION, guía del agente y leyenda del tablero alineadas con el contrato: no se
     reordena la queue explícita de primer nivel; sí se deriva el orden implícito de hijos de COMBO
     por `depends_on`.

## 4. Diseño del fix de selección

### 4.1 CSS

Agregar reglas explícitas:

- `.rl-detail-panel` y `.rl-detail-body` deben permitir `user-select: text`.
- El contenido generado por `MarkdownRenderer` dentro de `.rl-detail-body` debe heredar esa selección.
- Botones (`.rl-detail-nav-button`, `.rl-detail-close`), resizer (`.rl-detail-resizer`) y otros
  controles deben seguir con `user-select: none`.
- Durante `body.rl-detail-resizing`, el `user-select: none` debe seguir ganando sobre el panel para
  evitar seleccionar texto mientras se arrastra el borde.

La regla de resize necesita una especificidad mayor que la regla de selección del panel, porque
`body.rl-detail-resizing *` hoy es global y simple. Si se agrega `.rl-detail-body * { user-select:
text; }`, también hay que agregar el override equivalente para `body.rl-detail-resizing`.

### 4.2 Eventos

No cambiar el flujo de clicks del detalle salvo que la verificación manual pruebe que hace falta.
Hoy el `preventDefault()` relevante está en el resizer (`render.ts:1142-1146`) y en links internos;
no hay un listener general del panel que deba bloquear selección.

## 5. Tests

### 5.1 Unit tests de orden

Agregar casos en `test/buildModel.test.ts`:

1. **Hermano depende de hermano posterior por path**
   - Input en orden `ETAPA-2B`, `ETAPA-3`, `ETAPA-3B`.
   - `ETAPA-2B.depends_on = ["ETAPA-3B"]`.
   - Contenedor `CC-4` en la queue.
   - Esperar `model.lanes.A.queue` como `["ETAPA-3B", "ETAPA-2B", "ETAPA-3"]`.
2. **Independientes preservan orden**
   - Mismo contenedor sin dependencia local.
   - Esperar orden original.
3. **Dependencia externa no reordena hermanos**
   - Un hijo depende de una tarea fuera del contenedor.
   - Esperar orden original dentro del contenedor.
4. **No reordenar queue de primer nivel**
   - Queue `["B", "A"]` aunque `B.depends_on = ["A"]`.
   - Esperar que el primer nivel siga `B, A`; solo se ordenan hijos dentro de cada contenedor.
5. **Dependencia contra descendiente de sibling contenedor**
   - Un hijo depende de una hoja dentro de otro hijo contenedor.
   - Esperar que el sibling contenedor prerequisito aparezca antes.

### 5.2 Verificación CSS/manual

No alcanza con unit tests: hay que verificar en Obsidian.

Checklist manual:

1. Abrir el tablero.
2. Abrir el detalle de una tarea con body largo.
3. Seleccionar texto normal, headings, listas y bloques de código renderizados.
4. Copiar al portapapeles y pegar en otra nota.
5. Click en links de relaciones sigue navegando.
6. Botón de cerrar/back/abrir nota no selecciona texto accidentalmente.
7. Arrastrar el resizer no selecciona texto y mantiene cursor `ew-resize`.

## 6. Validación

Comandos esperados tras implementar:

```bash
npm run test
npm run build
```

Además, probar el caso real del vault consumidor que disparó el bug:

```text
/mnt/minis_forum/wadev/doc/roadmap/lanes.yaml
```

La expectativa visual dentro de `CC-4` es que `ETAPA-3B` aparezca antes de `ETAPA-2B`, y que
`ETAPA-3` conserve su posición relativa independiente después de ese par.

## 7. Fuera de alcance

- Renombrar etapas o archivos para forzar orden alfabético.
- Cambiar el significado de `depends_on`, `parent`, `part_of` o `absorbs`.
- Agregar alertas nuevas para ciclos de dependencia.
- Reordenar la queue de primer nivel de `lanes.yaml`.
- Cambiar el render markdown o reemplazar `MarkdownRenderer`.
