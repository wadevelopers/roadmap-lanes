# Visualizar el roadmap con el grafo de Obsidian

El tablero de Roadmap Lanes (RL) es la vista principal. El **grafo** de Obsidian es una vista
**complementaria** para explorar las **relaciones** entre tareas (jerarquía y dependencias) y para
colorear el roadmap por sus distintos ejes.

No hay que duplicar datos: RL escribe las relaciones como **wikilinks en el frontmatter**
(`padre`, `depende_de`, `absorbe`) y la clasificación como **propiedades** (`tipo`, `estado`,
`madurez`, `areas`, `zonas`). El grafo nativo y los plugins leen exactamente esos campos.

---

## 1. Grafo nativo de Obsidian

Muestra notas como nodos y wikilinks como líneas. En `Graph settings → Groups` se crean grupos con
**búsquedas por propiedad**:

```text
[tipo:FT]            # colorear por tipo: features…
[tipo:DT]            # …deuda técnica…
[tipo:INFRA]         # …infraestructura
[estado:hecho]       # o enfocar por estado
[madurez:nota]       # o por madurez del plan
```

Sintaxis útil de filtros:

- `[padre]` — notas que **tienen** la propiedad `padre`; `-[padre]` — las que **no** (raíces del árbol).
- `[padre:null]` — `padre` declarado pero vacío.
- Grupos compuestos: `[tipo:DT] [estado:pendiente]`.

> No conviene crear grupos para **todas** las combinaciones de `tipo` × `estado` × `madurez`: la
> cantidad explota y el grafo se vuelve inmanejable. Para eso está Extended Graph (§2).

**Dos límites del grafo nativo** (que Extended Graph resuelve):

1. **No conoce el significado de cada link.** Para Obsidian, un link en `padre` y uno en `depende_de`
   son lo mismo: no etiqueta la línea como "padre", "depende de" o "absorbe".
2. **Una sola dimensión de color a la vez.** No puede mostrar `tipo` + `estado` + `madurez` juntos, y
   cambiar de una a otra obliga a reescribir los grupos a mano.

---

## 2. Extended Graph (plugin recomendado)

[Extended Graph](https://github.com/ElsaTam/obsidian-extended-graph) (de ElsaTam, en la galería de
plugins de la comunidad) levanta los dos límites de arriba y agrega cosas muy útiles para RL.

### a) Tipos de link coloreados y filtrables

El **nombre de la propiedad es el tipo de link**: `padre`, `depende_de` y `absorbe` se vuelven tipos
distintos automáticamente. Con eso se puede:

- **colorear cada tipo** (p. ej. `padre` azul, `depende_de` rojo, `absorbe` gris) y mostrar su
  etiqueta sobre la línea;
- **filtrar/ocultar por tipo** — ver, por ejemplo, **solo** el árbol de jerarquía (`padre`) o **solo**
  las dependencias (`depende_de`).

Resuelve el límite 1 del grafo nativo.

### b) Propiedades como arcos (varias dimensiones a la vez)

Las propiedades se dibujan como **arcos de color alrededor del nodo**, y se pueden mostrar **varias a
la vez** como anillos concéntricos. Así se ve `tipo` + `estado` + `madurez` **simultáneamente**, sin
elegir una sola. El color sale de una paleta o se asigna a mano por valor; una leyenda permite
activar/desactivar valores (y filtra los nodos). Resuelve el límite 2.

### c) Graph states (vistas guardadas con un selector)

Se guarda una **configuración con nombre** (qué propiedades y tipos de link están activos, colores,
etc.) y se **cambia entre ellas con un selector**. Por ejemplo estados *"Por tipo"*, *"Por estado"*,
*"Por madurez"*, *"Dependencias"* — un click para alternar el enfoque.

> Los cambios **no se guardan solos**: hay que guardarlos explícitamente. Hay un estado por defecto y
> uno inicial configurables.

### d) Tamaño del nodo = duración de la tarea

Se puede dimensionar cada nodo por una **propiedad numérica**. Apuntándolo a **`duracion`** (que en RL
es un **número de horas, sin sufijo**), **un nodo más grande = más trabajo**: de un vistazo se ve qué
tareas pesan más. *(Esta es una de las razones por las que `duracion` se declara como número plano y
no `5d`/`4h`.)* También se puede dimensionar por nº de backlinks o centralidad, para resaltar tareas
"hub" muy conectadas.

### e) Extras

Formas de nodo por propiedad, foco en un nodo, pin de posiciones y export del grafo a SVG.

---

## 3. Bases (tablas, nativo)

Para vistas **tabulares** del roadmap (filtrar por `tipo`/`estado`/`area`, agrupar, ordenar),
Obsidian ya trae **Bases** — no hace falta un plugin externo. Lee el mismo frontmatter que RL, así que
una base sobre la carpeta del roadmap da tablas y consultas sin configuración de datos extra.

---

## 4. Por qué el formato alimenta todo esto sin duplicar datos

Que los wikilinks en frontmatter sirvan **a la vez** para RL, el grafo, los backlinks y Bases es una
decisión de diseño explicada en [`VISION.md` §8](../VISION.md). Esta guía solo baja eso a la
configuración práctica del grafo.

---

## Referencias

- Grafo de Obsidian: https://obsidian.md/help/plugins/graph
- Búsqueda por propiedades: https://obsidian.md/help/plugins/search
- Extended Graph (wiki): https://github.com/ElsaTam/obsidian-extended-graph/wiki
- Bases: https://help.obsidian.md/bases
