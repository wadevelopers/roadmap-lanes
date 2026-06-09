# Visualizar Roadmap Lanes con herramientas de Obsidian

Esta guía explica qué se puede ver del modelo de datos de Roadmap Lanes usando herramientas
nativas de Obsidian y plugins externos. El tablero de RL sigue siendo la vista principal; estas vistas son complementarias para explorar links, backlinks y metadatos.

## Grafo nativo

El grafo nativo de Obsidian muestra notas como nodos y wikilinks como líneas. Como RL escribe
relaciones en frontmatter usando wikilinks (`padre`, `depende_de`, `absorbe`), esas relaciones aparecen en el grafo y en backlinks sin duplicar datos.

Limitación importante: el grafo nativo no conoce el significado de cada link. Para Obsidian, un link en `padre` y un link en `depende_de` son simplemente enlaces entre notas. Puede mostrar la dirección de los enlaces si se activa `Display -> Arrows`, pero no etiqueta la línea como "padre", "depende de" o "absorbe".

Otra limitación: los grupos del grafo colorean cada nodo con un solo color efectivo. Si una nota cumple varios grupos, el grafo no puede mostrar varias dimensiones visuales a la vez, como:

- color = tipo;
- borde = estado;
- icono = madurez.

Por eso conviene elegir una dimensión principal para colorear.

Por ejemplo, para resaltar documentos que son contenedores o que no tienen hijos se podria crear el grupo `[padre:null]` o si quiero ver lo opuesto (solo documentos con algun padre) deberia agregar el signo `-` delante del filtro para negarlo, para este ejemplo seria `-[padre:null]`.

Si queremos resaltar documentos que tienen dicha propiedad, sea cual fuere el valor, seria simplemente `[padre]` o para documentos que no tienen esa propiedad seria `-[padre]`

También se pueden crear grupos compuestos combinando propiedades:

```text
[tipo:DT] [estado:hecho]
[tipo:DT] [estado:pendiente]
[tipo:FT] [madurez:ejecutable]
```

Esto sirve para preguntas puntuales, pero no conviene como esquema principal si se intenta cubrir todas las combinaciones de `tipo`, `estado` y `madurez`: la cantidad de grupos crece rápido y el grafo se vuelve difícil de mantener.

### Uso 1: color por tipo

Es la lectura más estable para RL. En `Graph settings -> Groups`, crear grupos con búsquedas por propiedad:

```text
[tipo:FT]
[tipo:DT]
[tipo:INFRA]
```

Esto permite distinguir features, deuda técnica e infraestructura en el grafo general.

### Uso 2: foco temporal por estado

Cuando se quiere mirar progreso, se puede cambiar la dimensión de color o usar filtros:

```text
[estado:hecho]
[estado:pendiente]
```

Esto ayuda a limpiar ruido visual cuando se está revisando qué quedó abierto o qué ya cerró.

### Uso 3: foco por madurez del plan

Para revisar preparación del trabajo, usar:

```text
[madurez:nota]
[madurez:esqueleto]
[madurez:ejecutable]
```

Esto sirve para detectar notas inmaduras dentro del roadmap, pero no reemplaza el tablero: RL sigue siendo quien calcula orden, solape, gates y próximos agarrables.

## Extended Graph

This plugin enables you to:

- Add images to graph nodes.
- Change the shapes of the nodes.
- Easily filter by tags and properties.
- Remove links based on relationship types.
- Configure multiple views and switch between them.
- Export the graph view to SVG.
- Modify the appearance on the current active node.
- Focus on a specific node.
- Pin nodes.
- Reflect your search result and opened tabs in the graph.
- Change the size of nodes and links based on statistical functions.
- And many more...

## Backlinks

Los backlinks nativos sirven especialmente para responder preguntas inversas sin que RL duplique campos:

- si una tarea aparece en `depende_de` de otras notas, sus backlinks muestran qué tareas dependen de ella;
- si una tarea aparece como `padre`, sus backlinks ayudan a encontrar hijos;
- si una tarea fue absorbida desde `absorbe`, también aparece referenciada.

RL deriva `desbloquea` desde `depende_de`; no hace falta escribir ambos lados.

## Breadcrumbs

Breadcrumbs puede ser útil para RL si se configura para interpretar campos del frontmatter como relaciones tipadas. La diferencia con el grafo nativo es esta:

- el grafo nativo ve "A enlaza a B";
- Breadcrumbs puede representar "A se relaciona con B mediante el campo `depende_de`, `padre` o `absorbe`".

Eso puede aportar vistas navegables de jerarquía o dependencias que RL no intenta reemplazar, por ejemplo:

- partir de una tarea y recorrer su árbol de `padre` / hijos;
- ver cadenas de dependencia usando `depende_de`;
- separar visualmente relaciones de jerarquía y relaciones de bloqueo.

Lo que Breadcrumbs no resuelve para RL:

- no colorea el grafo nativo por varias dimensiones al mismo tiempo;
- no calcula solape entre carriles;
- no calcula gates de carriles como semáforos operativos;
- no reemplaza el tablero de ejecución ni la altura por duración.

Conclusión: Breadcrumbs sí puede servir como vista complementaria de relaciones tipadas, pero no como sustituto del tablero de RL. Antes de documentarlo como flujo recomendado, hay que validar su configuración exacta con los campos actuales (`padre`, `depende_de`, `absorbe`) dentro de Obsidian.

## Referencias

- Obsidian Graph view: https://obsidian.md/help/plugins/graph
- Sintaxis de búsqueda por propiedades: https://obsidian.md/help/plugins/search
- Breadcrumbs: https://github.com/michaelpporter/breadcrumbs
