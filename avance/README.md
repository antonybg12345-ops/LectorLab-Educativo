# Avance de la interfaz de LectorLab 2.0

Vista pública: https://antonybg12345-ops.github.io/LectorLab-Educativo/avance/?v=2

Avance 2: bienvenida y accesos, paneles docente y estudiante, menú lateral, editor por pasos y revisión en dos columnas con identidad vino, crema y dorado. Se publica como archivos estáticos dentro de `demo-presentacion`, sin sustituir la demo principal ni `/v1/`.

## Alcance

- Datos ficticios, conservados únicamente en la memoria de la pestaña. Recargar reinicia los cambios.
- Los botones de acceso abren un rol de demostración. Los campos de usuario y contraseña están deshabilitados; no existen cuentas ni sesiones reales en esta publicación.
- Panel docente con métricas y acciones, entregas por revisar, actividades y grupos. Panel estudiante con tarjetas y estados, y lector con texto, preguntas y criterios de revisión.
- Editor en cuatro pasos: Lectura, Preguntas, Rúbrica, Revisar y publicar. Conserva los cambios entre pasos y exige revisión antes de publicar.
- Rúbrica editable de ejemplo con criterios, descriptores, máximos y total; las versiones publicadas se bloquean y pueden clonarse.
- Valoración preescrita de ejemplo de 8/12, ajustable por docente. No fue generada por IA. Guardar una revisión conserva un borrador privado; validar incorpora la evaluación al registro ficticio y CSV de esta pestaña.
- Aciertos y porcentaje de alternativas separados del total que incluye relación y completado, y de la rúbrica.
- Exporta CSV de demostración. No conecta con Google, OpenAI ni servicios externos.
- La carga de archivos y la generación con IA están deshabilitadas. La carga de 50 MB, la conservación del archivo original y la propuesta y evaluación de rúbricas con IA continúan pendientes en la aplicación.
- Las claves de preguntas incluidas en una demo estática son inspeccionables; no debe usarse como evaluación real ni para recopilar datos de estudiantes.

La implementación con servidor y autenticación se conserva por separado en [`feat/bienvenida-accesos`](https://github.com/antonybg12345-ops/LectorLab-Educativo/tree/feat/bienvenida-accesos). Esta publicación utiliza sus pantallas y un adaptador exclusivo de demostración en memoria. El código reproducible está en `scripts/pages-preview/` de esa rama; la aplicación real no importa el adaptador ni el prototipo de rúbricas.

## Verificación

Probado en Chromium con servidor exclusivamente estático bajo `/LectorLab-Educativo/`, en 1366 × 900 y 390 × 844: recursos locales, portales, rutas con hash, recarga y Atrás, credenciales deshabilitadas, acciones del panel, cuatro pasos, conservación de lectura y rúbrica, máximos editables y total, publicación revisada, borrador privado separado de evaluación validada, panel y recorrido estudiante y guardado temporal. Sin solicitudes a una API, POST, conexiones externas, errores JavaScript ni desborde horizontal. El botón Revisar permanece visible en móvil. La política CSP bloquea conexiones de red desde la aplicación.

Publicación mediante la rama ya configurada para GitHub Pages. No requiere Node.js en el equipo de quien la visita.
