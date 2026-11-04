# Demo estática reproducible de LectorLab 2.0

Estos archivos construyen la vista pública `/avance/` a partir de las pantallas de `public/platform/`. La salida no depende de rutas de un equipo específico ni necesita Express, PostgreSQL o credenciales para abrirse en un alojamiento estático.

## Construir

Desde la raíz del repositorio, con Node.js 24:

```sh
node scripts/pages-preview/build-public-entry-preview.mjs
```

La salida queda en `dist/pages-preview/avance/`. Se puede indicar otra raíz de publicación:

```sh
node scripts/pages-preview/build-public-entry-preview.mjs /ruta/a/publicacion
```

El constructor escribe solamente `avance/` dentro de ese destino. Si ya existen `index.html` o `v1/index.html` en la raíz de publicación, comprueba que sus bytes permanezcan intactos. No necesita esos archivos para generar una publicación nueva.

`seed.json` contiene una lectura y datos ficticios de ejemplo. El adaptador en memoria y `design-preview.js` se incluyen exclusivamente en esta demo; la aplicación con servidor no los importa.

## Comprobar en navegador

Después de instalar las dependencias del proyecto y un navegador compatible con Playwright:

```sh
node scripts/pages-preview/test-public-entry-preview.mjs
node scripts/pages-preview/test-internal-redesign.mjs
```

Los dos verificadores sirven los archivos con un servidor estrictamente estático bajo el prefijo de GitHub Pages. Admiten una raíz de publicación como primer argumento y un directorio de capturas como segundo:

```sh
node scripts/pages-preview/test-internal-redesign.mjs /ruta/a/publicacion /ruta/a/capturas
```

Sin argumentos, leen `dist/pages-preview/` y guardan capturas y resultados en `dist/pages-preview-test-artifacts/`. Para usar Chromium instalado en el sistema, se puede definir `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` con su ruta. Las pruebas cubren escritorio y móvil, recursos locales, navegación, guardado temporal, editor, rúbrica y validación de ejemplo, y ausencia de solicitudes a una API o conexiones externas.

## Alcance de la demostración

- Los accesos abren roles de ejemplo; no autentican usuarios. Los campos de contraseñas están deshabilitados.
- Los cambios y borradores permanecen únicamente en la memoria de la pestaña y se reinician al recargar. No constituyen registros académicos.
- La propuesta de rúbrica y su valoración son ejemplos identificados como ficticios; no se llama a una IA. Guardar una revisión de ejemplo conserva un borrador privado; validarla modifica solamente los datos de demostración.
- No existe conexión con Google Sheets, OpenAI ni almacenamiento central. La exportación de ejemplo produce CSV.
- Las claves de preguntas son inspeccionables en una demo estática. No usar esta publicación para evaluar ni recopilar información personal de estudiantes.
- La carga de archivos, el nuevo límite de 50 MB, la conservación del original y los servicios de IA requieren su implementación y configuración en la aplicación con servidor; esta demo no los habilita.

No se necesita instalar Node.js en el equipo de quien visita el sitio ya publicado. Node.js se utiliza para construir y verificar los archivos antes de publicarlos.
