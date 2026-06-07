# PLAN — Entorno de desarrollo (vault de prueba + abrir el plugin)

> Objetivo: poder **abrir el plugin en Obsidian y ver su vista**, con el `demo-app` como
> contenido, y el ciclo *editar `.ts` → recompila → recarga* funcionando. Al terminar, no hay
> tablero todavía (eso es el port del core + el render): se ve el **placeholder** actual, pero
> el plugin **carga y corre** en Obsidian sobre datos reales.
>
> Guía conceptual de fondo: [`SETUP_DESARROLLO.md`](SETUP_DESARROLLO.md). Este plan baja eso a
> pasos concretos para este repo.

## Estado: esqueleto (a revisar antes de ejecutar)

## Decisión a tomar — dónde vive el vault de prueba

El plugin tiene que cargarse desde `<vault>/.obsidian/plugins/roadmap-lanes/`. Hay dos formas
razonables; elegir una antes de ejecutar:

- **Opción A — vault = `examples/demo-app` (dentro del repo).** El demo queda **versionado** en un
  solo lugar. El plugin se enlaza en `examples/demo-app/.obsidian/plugins/roadmap-lanes` → la raíz
  del repo. Se ignora `examples/demo-app/.obsidian/` en `.gitignore` (config local del vault).
  - *Pro:* el demo es uno solo y versionado; cero duplicación.
  - *Contra:* hay un `.obsidian/` (ignorado) dentro del repo, y el symlink apunta al propio repo.
- **Opción B — vault fuera del repo** (p. ej. `C:\…\ObsidianVaults\rl-test\`). Se **copia** el
  `demo-app` ahí y se enlaza el plugin.
  - *Pro:* el repo del plugin queda 100% limpio, sin `.obsidian/`.
  - *Contra:* el demo del vault es una copia que puede divergir del `examples/demo-app` versionado.

**Recomendación:** **Opción A** — el demo versionado es valioso (es el fixture de las pruebas) y
`.obsidian/` se ignora sin fricción. El plan asume A; si elegís B, cambian sólo los pasos 1 y 4.

## Pasos

### 1. Portar el `demo-app`

Copiar `examples/demo-app/` del repo `roadmap-lanes` a `examples/demo-app/` de este repo: las
tareas (`tareas/*.md`), `carriles.yaml`, `taxonomia.yaml` y el `README.md`.

> Se porta **tal cual** (ids planos en las relaciones). La adaptación a **wikilinks**
> (`padre: "[[EPIC-100]]"`) es parte del **plan del port del core**, donde se define la lectura de
> relaciones. Para este plan (abrir el placeholder, que aún no lee datos) el contenido no importa.

### 2. Instalar dependencias

`npm install` en la raíz del repo (baja `obsidian` types, esbuild, typescript).

### 3. Compilar en watch

`npm run dev` — esbuild genera `main.js` y queda observando. Dejar la terminal abierta.

### 4. Conectar el plugin al vault (Opción A)

- Abrir `examples/demo-app` como vault en Obsidian (*Open folder as vault*) → crea el `.obsidian/`.
- Crear el symlink (PowerShell, con Modo de desarrollador de Windows activo):
  ```powershell
  New-Item -ItemType SymbolicLink `
    -Path "examples\demo-app\.obsidian\plugins\roadmap-lanes" `
    -Target "C:\laragon\www\obsidian-roadmap-lanes"
  ```
- Agregar `examples/demo-app/.obsidian/` al `.gitignore` (config local del vault, no se versiona).

### 5. (Recomendado) Instalar Hot Reload

Copiar el plugin **Hot Reload** (pjeby) a `examples/demo-app/.obsidian/plugins/hot-reload/` y
activarlo, para que recargue RL solo al recompilar `main.js`.

### 6. Activar y abrir

*Ajustes → Plugins de la comunidad* → desactivar Modo restringido → activar **Roadmap Lanes** →
abrir con el comando *"Abrir tablero de carriles"* o el ícono del ribbon.

## Criterio de "hecho"

- Obsidian abre el vault `demo-app` con sus tareas visibles en el explorador.
- El plugin **Roadmap Lanes** aparece, se activa sin errores (consola con `Ctrl+Shift+I` limpia) y
  su vista muestra el **placeholder**.
- Editar `main.ts` → `main.js` se regenera → la vista se recarga (con Hot Reload o `Ctrl+R`).

## Riesgos / notas

- **Symlink en Windows:** si falla por permisos, activar Modo de desarrollador o usar la Opción B.
- **Recursión del symlink (Opción A):** el `.obsidian/plugins/roadmap-lanes` apunta al repo que lo
  contiene; es inofensivo siempre que `.obsidian/` esté ignorado y no se siga el link al indexar.
- No requiere el core portado: el placeholder no lee datos todavía.
