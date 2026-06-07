# Setup de desarrollo — plugin de Obsidian

Guía para montar el entorno y **ver los cambios mientras desarrollás**. Pensada para
quien nunca desarrolló un plugin de Obsidian.

## La idea (lo que cambia respecto a una web)

- **No hay navegador ni `localhost`.** El plugin **corre dentro de Obsidian**. Para "verlo",
  Obsidian tiene que cargarlo y vos abrís su vista.
- Obsidian carga plugins desde `<vault>/.obsidian/plugins/<id>/`, y necesita **3 archivos** ahí:
  `main.js` (lo genera esbuild), `manifest.json` y `styles.css`.
- `main.js` es **generado** (está en `.gitignore`); el código fuente es `main.ts`.
- Obsidian es Electron → tenés **DevTools** con `Ctrl+Shift+I` (consola, errores, inspeccionar
  el DOM de tu vista). Es la herramienta principal de debug.

El ciclo, una vez montado: **guardás `.ts` → esbuild recompila `main.js` → Obsidian recarga el
plugin → mirás**.

## Requisitos

- **Node.js 18+** y npm.
- **Obsidian** instalado (desktop).
- En Windows, para usar symlinks sin permisos de admin: activar **Modo de desarrollador**
  (Ajustes de Windows → Para desarrolladores → Modo de desarrollador → On).

## Pasos (la primera vez)

### 1. Vault de prueba

Usá un vault **dedicado** para no ensuciar nada real. Lo más práctico es que su contenido sea
una copia del proyecto de ejemplo (`examples/demo-app/`), así el plugin tiene tareas y `.yaml`
reales para dibujar. En Obsidian: *Open another vault → Open folder as vault* → elegí esa carpeta.

### 2. Dependencias del plugin

En la raíz del repo (`obsidian-roadmap-lanes`):

```powershell
npm install
```

Baja `obsidian` (los types), `esbuild`, `typescript`, etc. Una sola vez.

### 3. Conectar el plugin al vault

El plugin tiene que aparecer en `<vault>/.obsidian/plugins/roadmap-lanes/`. Dos formas:

**Opción A — symlink (recomendada; el repo queda afuera):**

```powershell
# requiere Modo de desarrollador (o terminal como admin)
New-Item -ItemType SymbolicLink `
  -Path "<vault>\.obsidian\plugins\roadmap-lanes" `
  -Target "C:\laragon\www\obsidian-roadmap-lanes"
```

Editás en el repo; Obsidian lo lee a través del enlace.

**Opción B — desarrollar dentro del vault:** clonar/mover el repo directamente a
`<vault>\.obsidian\plugins\roadmap-lanes\`. Más simple, pero el repo queda "enterrado" en el vault.

> En cualquiera de las dos, la carpeta del plugin debe llamarse igual que el `id` del
> `manifest.json` (`roadmap-lanes`).

### 4. Compilar en watch

```powershell
npm run dev
```

esbuild queda observando: cada vez que guardás un `.ts`, regenera `main.js`. Dejá esta terminal abierta.

### 5. Activar el plugin en Obsidian

*Ajustes → Plugins de la comunidad* → desactivar **Modo restringido** → en *Plugins instalados*
debería aparecer **Roadmap Lanes** → activarlo.

### 6. (Muy recomendado) Plugin "Hot Reload"

Sin él, cada cambio en `main.js` obliga a desactivar/activar el plugin a mano (o `Ctrl+R`, que
recarga **todo** Obsidian). El plugin **Hot Reload** (de pjeby) **recarga solo tu plugin** cuando
`main.js` cambia. Instalalo en el vault de prueba (se consigue desde su repo de GitHub: copiar su
carpeta a `.obsidian/plugins/hot-reload/` y activarlo).

### 7. Abrir la vista

`Ctrl+P` → comando **"Abrir tablero de carriles"**, o el ícono de la barra lateral (ribbon).
Por ahora vas a ver el placeholder; a medida que se porte el core y el render, ahí aparece el tablero.

### 8. Debug

`Ctrl+Shift+I` abre DevTools. Usá la **consola** para errores y `console.log`, y el inspector
para ver el DOM que genera tu `ItemView`.

## El ciclo de trabajo

```
editás main.ts / src/*.ts
        │  (npm run dev sigue corriendo)
        ▼
esbuild regenera main.js
        │  (Hot Reload detecta el cambio)
        ▼
Obsidian recarga el plugin  →  mirás la vista / la consola
```

Casi tan fluido como el F5 de una web.

## Build de producción

```powershell
npm run build
```

Hace `tsc -noEmit` (chequeo de tipos) y genera un `main.js` minificado y sin sourcemaps. Es lo
que se publica en un *release* (junto con `manifest.json` y `styles.css`).

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| El plugin no aparece en la lista | La carpeta en `.obsidian/plugins/` no se llama como el `id`, o falta `manifest.json` / `main.js`. |
| Aparece pero no carga | Error en `main.js` → miralo en la **consola** (`Ctrl+Shift+I`). |
| Cambio en `.ts` no se refleja | `npm run dev` no está corriendo, o no tenés Hot Reload (probá `Ctrl+R`). |
| El symlink falla en Windows | Falta Modo de desarrollador o admin → usá la Opción B. |
| Estilos no aplican | `styles.css` no está en la carpeta del plugin, o falta recargar. |

## Referencias

- Plantilla oficial: `obsidianmd/obsidian-sample-plugin` (GitHub).
- Docs de API: `docs.obsidian.md` (TypeScript API) y el repo `obsidianmd/obsidian-api`.
- Hot Reload: `pjeby/hot-reload` (GitHub).
