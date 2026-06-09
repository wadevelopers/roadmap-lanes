# PLAN — Niveles de severidad en las alertas del modelo

> Estado: **propuesto — pendiente de aprobación**. No ejecutado.
> Acoplado al [`03_COMBO.md`](03_COMBO.md): las validaciones nuevas del COMBO deben emitir
> severidad desde el inicio, así que conviene implementar esta infraestructura **antes o junto con**
> combo (ver §8). Cambio de contrato interno (`modelo.errores: string[]` → alertas estructuradas).

---

## 1. Objetivo y contexto

Hoy todas las validaciones del modelo se acumulan en `modelo.errores: string[]` y se pintan **todas
en rojo** (`renderErrors` en `render.ts`, sección "Errores del modelo"). No distingue entre un dato
**roto** (referencia colgada, id duplicado) y una **inconsistencia recuperable que puede ser
intencional** (la duración declarada de un COMBO es mayor que la suma de sus hijos por tiempo de
coordinación extra).

Este plan introduce **niveles de severidad** con colores distintos y deja el terreno preparado para
las acciones futuras **"Corregir"** y **"Aceptar"** (§7).

**Principio rector de severidad:**

| Nivel | Color | Significado |
|---|---|---|
| **error** | rojo | Dato **roto, imposible o contradictorio**. El usuario *tiene* que arreglarlo. |
| **warning** | ámbar / naranja | Inconsistencia **recuperable** que **puede ser intencional**. Se puede corregir o aceptar. |
| **info** | azul / atenuado | Recordatorio o sugerencia suave. No implica error. |

---

## 2. Cambio de contrato interno

`modelo.errores: string[]` pasa a **alertas estructuradas**, **sin texto** (el core es agnóstico de
idioma; render traduce con el i18n existente):

```ts
type Severidad = "error" | "warning" | "info";

interface Alerta {
  codigo: CodigoAlerta;   // id de máquina de la validación (p. ej. "combo-duracion-imposible")
  severidad: Severidad;
  tareaId?: string;       // a qué tarea/carril aplica (para enlazar y para "Aceptar")
  params?: Record<string, string | number | boolean>;  // valores del mensaje y de la huella
  corregible?: boolean;   // si existe un fix determinista (futuro botón "Corregir")
}
```

- `Modelo.alertas: Alerta[]` reemplaza a `errores`. **El conteo por severidad NO se guarda en el
  modelo**: se deriva con un helper puro `contarPorSeveridad(alertas)` (evita estado duplicado).
- **`buildModel` no emite texto**: emite `codigo` + `params`. `render.ts` arma el mensaje desde
  `codigo` + `params` con el traductor (i18n es/en). Aplica también a las ~13 validaciones actuales,
  que hoy meten español en el core.
- **`params` cumple doble función**: son los valores que el mensaje interpola (p. ej.
  `{ declarada: 80, cota: 88 }`) **y** la huella que el "Aceptar" (§6) necesita para reaparecer si los
  valores cambian. No hace falta un `fingerprintParts` aparte.

> Por qué estructurado y sin texto: el color, el agrupado, el conteo, la traducción, el "Aceptar"
> persistente y el "Corregir" necesitan saber **qué** validación es y **con qué valores**, no un
> string ya formateado. Dejar `mensaje: string` obligaría a internacionalizar en otro refactor y a
> parsear texto para el fingerprint.

---

## 3. Clasificación de TODAS las validaciones

### 3.1 Validaciones actuales (`buildModel.ts`)

| Código | Validación actual | Severidad | Por qué |
|---|---|---|---|
| `falta-id` | tarea sin `id` | **error** | Sin id no se puede modelar ni referenciar. |
| `id-duplicado` | dos tareas con el mismo `id` | **error** | Identidad ambigua; rompe relaciones. |
| `tipo-invalido` | `tipo` fuera de la lista | **error** | Valor de enum equivocado (typo). |
| `madurez-invalida` | `madurez` fuera de la lista | **error** | Valor de enum equivocado. |
| `estado-invalido` | `estado` ≠ pendiente/hecho | **error** | Valor de enum equivocado. |
| `duracion-invalida` | `duracion` no numérica (tiene letra) | **error** | Rompe el tamaño/altura y el dimensionado del grafo (§ visualización). |
| `padre-inexistente` | `padre` apunta a id que no existe | **error** | Jerarquía colgada. |
| `depende-inexistente` | `depende_de` a id que no existe | **error** | Rompe gates y bloqueos. |
| `absorbe-inexistente` | `absorbe` a id que no existe | **error** | Absorción colgada. |
| `carril-tarea-inexistente` | `lanes.yaml` referencia un id inexistente | **error** | La cola apunta a la nada. |
| `doble-carril` | una tarea aparece en dos carriles | **error** | Posición ambigua. |
| `area-desconocida` | `area` no está en `taxonomy.yaml` | **warning** | Taxonomía cerrada pero extensible: puede ser typo o falta agregarla. No rompe el render. |
| `zona-desconocida` | `zona` no está en `taxonomy.yaml` | **warning** | Igual que área; la zona sigue contando para solape. |

### 3.2 Validaciones nuevas del COMBO (de `03_COMBO.md` §6, ahora con severidad)

| Código | Validación | Severidad | Por qué |
|---|---|---|---|
| `combo-tipo-faltante` | tarea con hijos y `tipo` ≠ COMBO | **warning** | Falta la conversión manual; el sistema deriva igual. |
| `combo-en-hoja` | hoja con `tipo: COMBO` | **warning** | COMBO sin hijos es un malentendido; no rompe nada. |
| `combo-duracion-imposible` | `duracion` declarada **<** cota inferior física (la tarea más larga, o el carril del COMBO más cargado) | **error** | Ni con el paralelismo actual la etapa puede durar menos: una tarea sola, o un carril en secuencia, ya no entra. |
| `combo-duracion-mayor` | `duracion` declarada **>** suma de hijos | **warning** | **Válido**: tiempo de coordinación/tarea extra que solo vive en el COMBO. Corregible o aceptable. |
| `combo-duracion-faltante` | COMBO sin `duracion` | **warning** | Recordatorio de declararla. |
| `combo-madurez-mayor` | `madurez` declarada **más madura** que la menor de los hijos | **warning** | Sobreestima la preparación; debería ser la menor. |
| `combo-madurez-menor` | `madurez` declarada **menos madura** que la menor de los hijos | **info** | Conservador; inofensivo pero desincronizado. |
| `combo-madurez-faltante` | COMBO sin `madurez` | **info** | Solo afecta la vista de detalle. |
| `combo-estado-deberia-hecho` | todos los hijos hechos y `estado` ≠ hecho | **warning** | El COMBO está hecho de hecho; el campo quedó viejo. |
| `combo-estado-falso-hecho` | `estado: hecho` con algún hijo sin terminar | **warning** | Declara completitud falsa (la app deriva el estado real igual). |
| `combo-estado-faltante` | COMBO sin `estado` | **info** | Solo afecta la vista de detalle. |

> **Duración del COMBO** = estimación de la **duración de etapa** (calendario), no "esfuerzo total".
> Por eso el umbral de error es la **cota inferior física** = `max(tarea más larga, carga del carril
> del COMBO más cargado)`, no la suma: una `duracion` **menor que la suma pero ≥ cota** es válida por
> **paralelismo** y **no genera alerta**. La cota por carril es conservadora (nunca marca un falso
> error); afinar con camino crítico (`depende_de` cruzadas) queda como mejora futura. La **madurez** y
> el **estado** siguen la lógica "sobreestimar = warning, subestimar/omitir = info".

### 3.3 Candidatos opcionales (no se agregan salvo que se pida)

- `hoja-sin-duracion` (hoja sin `duracion` → tamaño 0 en tablero y grafo) → **info**. Útil pero hoy no
  se valida; se deja anotado.

---

## 4. Render de la sección de alertas (`render.ts` + `styles.css`)

- `renderErrors` → `renderAlertas`: **agrupa por severidad** (errores, luego warnings, luego info),
  cada grupo con su color.
- **Mensaje desde `codigo` + `params`**: una función traduce cada alerta con el i18n (plantilla por
  código, es/en). El core nunca emite texto.
- **Conteo con `contarPorSeveridad(alertas)`** (helper puro, no se guarda en el modelo): encabezado
  tipo `2 errores · 3 warnings · 1 info`. Vacío → "No hay alertas del modelo".
- **Renombre (i18n)**: `errorTitle` "Errores del modelo" → **"Alertas del modelo"** / "Model alerts";
  `validationOk` → "No hay alertas del modelo" / "No model alerts".
- CSS: clases `rl-alert-error` / `rl-alert-warning` / `rl-alert-info` con borde/acento por color
  (`--color-red` / `--color-orange` / `--color-blue` de Obsidian, coherente con el tema).

---

## 5. Acciones por alerta — "Corregir" y "Aceptar" (diseño; implementación futura)

Cada **warning corregible** mostraría dos botones:

- **Corregir** (*fix*): sincroniza el campo del COMBO con lo derivado de los hijos (p. ej. fija
  `duracion` = suma de hijos, `madurez` = menor, `estado` = hecho). **Requiere escritura**
  (`vault.modify`) — hoy el plugin es read-only. Es la materialización del botón "Fix model" que ya
  estaba anotado como pendiente.
- **Aceptar** (*accept*): silencia **esa** alerta para que no vuelva a aparecer. Necesita
  **persistencia** (§6).

Los **errores** (rojo) no ofrecen "Aceptar" (no se pueden aceptar datos imposibles); a lo sumo
"Corregir" si hay fix determinista.

---

## 6. Persistencia de "Aceptar" — decisión cerrada: `data.json`

El estado "esta alerta fue aceptada" se guarda en los **datos del plugin** (`data.json` vía
`loadData`/`saveData`), **no** en el frontmatter: no se ensucian las notas ni se mezcla config de UI
con datos de dominio.

La **huella** de la alerta aceptada incluye los **valores discrepantes** (p. ej.
`combo-duracion-mayor` de `CC` con `120h vs 104h`), para que **si los valores cambian la alerta
reaparezca** (aceptar = "estoy de acuerdo con *esta* diferencia puntual", no "ignorar para siempre
este chequeo").

> Trade-off asumido: `data.json` está **gitignored** (es por-vault, no se versiona ni se comparte).
> Es aceptable: aceptar una alerta es **estado local de UI**, no una decisión de dominio que deba
> viajar en git. Si en el futuro hiciera falta compartirla, se reevalúa.

---

## 7. Alcance de la primera entrega vs. futuro

**En esta entrega (junto con / antes de combo):**
- Contrato estructurado `Alerta` + `Modelo.alertas` + conteo por severidad (§2).
- Clasificación de severidad de todas las validaciones (§3).
- Render agrupado/coloreado por nivel + estilos + i18n (§4).

**Futuro (se señala, no se hace acá):**
- Botón **Corregir** (requiere salir del read-only: `vault.modify`).
- Botón **Aceptar** + su **persistencia** en `data.json` (§6).

---

## 8. Acoplamiento con `03_COMBO.md` y orden de ejecución

- Las validaciones nuevas del COMBO (combo §6) deben **emitir `Alerta` estructurada con severidad**
  desde el inicio, no strings. Por eso conviene implementar **primero** la infraestructura de este
  plan (contrato `Alerta` + render) y **después** (o en el mismo bloque) las validaciones del COMBO.
- Orden cerrado: **`02_ALERTAS_SEVERIDAD` antes de `03_COMBO`** (este plan emparejado con combo, misma
  ola). Se puede ejecutar como plan propio o como primer commit del bloque combo.

---

## 9. Archivos a tocar

- `src/types.ts` — `Alerta` (`codigo` + `params`, **sin** `mensaje`), `Severidad`, `CodigoAlerta`,
  `Modelo.alertas` (reemplaza `errores`). **Sin** conteo en el modelo.
- `src/buildModel.ts` — cada validación: `errores.push(string)` → `alertas.push({ codigo, severidad,
  params, … })`, incluidas las ~13 actuales; cota inferior por carril para `combo-duracion-imposible`.
- `src/render.ts` — `renderAlertas` agrupado/coloreado + formateo de mensaje desde `codigo`+`params`
  + helper `contarPorSeveridad`.
- `src/i18n.ts` — plantilla de mensaje por `codigo` (es/en) + renombre `alertTitle`/`noAlerts`.
- `styles.css` — `rl-alert-error/-warning/-info`.
- `test/buildModel.test.ts` — los tests pasan de `errores: string[]` a afirmar sobre `codigo`/
  `severidad`; casos: duración imposible = error, mayor = warning, válida por paralelismo = sin alerta.

> Acoplado con `03_COMBO.md` (§8): combo emite `alertas` con severidad desde el inicio; sus tests
> afirman sobre `codigo`, no sobre `errores: []`.
