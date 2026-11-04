# Integración de las pantallas internas

La entrega anterior incorporó la bienvenida y los accesos, pero conservó las pantallas internas anteriores. Esta integración aplica la identidad visual acordada al panel docente, preparación, revisión, panel estudiante y lector, manteniendo la aplicación Express y sus permisos.

## Aplicación con servidor

- `workspace.js` y `workspace.css` comparten el marco visual: vino, crema y dorado, navegación lateral en escritorio y adaptación móvil. Los títulos de interfaz usan fuentes de sistema; el texto de lectura conserva una tipografía serif.
- El panel docente muestra los grupos, actividades y entregas que devuelve su API. Sus métricas y filas conducen a acciones existentes; no usa cifras decorativas ni datos ficticios en la aplicación real.
- El editor se divide en Lectura, Preguntas, Rúbrica y Revisar y publicar. Los nodos de edición se conservan al cambiar de paso, se informa el guardado y se protege la salida con cambios pendientes. Publicar requiere el último paso y confirmación docente. Generación y publicación bloquean las modificaciones durante la solicitud.
- La generación avisa antes de sustituir preguntas existentes. La lectura procedente de un documento es de solo lectura por defecto; una corrección manual debe habilitarse explícitamente. Esto no implementa todavía almacenamiento inmutable del archivo original ni 50 MB.
- La revisión reúne producción, evidencias y rúbrica en dos columnas; el resto del proceso y el diálogo están disponibles en desplegables. El docente ve puntajes por criterio y total y comparte la evaluación mediante la acción de validación existente.
- La aplicación real conserva sus cuatro criterios de 0 a 3 y revisión manual. No guarda una supuesta propuesta de IA como si ya hubiera sido validada.
- El estudiante dispone de tarjetas por actividad, estados privados, criterios consultables antes de responder y devolución con puntajes. Se conservan los siete pasos, guardado, cita de fragmentos, primeras respuestas objetivas, tutor situado, entrega y exportación real a Excel.

## Alternativas, otras objetivas y rúbrica

El servidor calcula `alternatives: {correct,total,percentage}` a partir de preguntas MCQ y respuestas persistidas, tanto en la entrega como en el listado de resultados. El resumen permanece `null` durante el trabajo en curso; sin MCQ, el porcentaje es `null`. Por ejemplo, 5/6 alternativas es 83,3 %, aunque el total que incluye relación y completado sea 7/8. No se aceptan puntajes del cliente ni se exponen claves nuevas.

La interfaz distingue este porcentaje, el total objetivo existente y el puntaje de rúbrica. No los suma ni convierte a otra escala. Los reportes XLSX y Google Sheets conservan sus columnas anteriores en esta entrega; añadirles una columna específica de alternativas queda pendiente.

## Vista pública de demostración

`https://antonybg12345-ops.github.io/LectorLab-Educativo/avance/?v=2`

La demo usa estas pantallas con un adaptador exclusivo en memoria. Incluye una rúbrica editable de ejemplo, criterios y descriptores, máximos y total, clonación y bloqueo de versiones publicadas. Permite recorrer una valoración preescrita de 8/12, modificar puntos y devolución, conservar un borrador privado y validar su evaluación de ejemplo por separado. Solo los valores validados se incorporan al registro y CSV ficticios de la pestaña. La propuesta no fue generada por IA y se identifica expresamente.

No tiene cuentas reales, conexión con IA, carga documental ni sincronización externa. Recargar reinicia sus datos. El código y las claves ficticias son inspeccionables, por lo que no sirve como evaluación real ni como registro de estudiantes. Sus credenciales están deshabilitadas y una política CSP bloquea conexiones y envíos de formularios.

La fuente y las instrucciones de compilación de la demo se conservan en `scripts/pages-preview/`, separadas del arranque real. La publicación modifica únicamente `/avance/`; las demos principal y `/v1/` permanecen iguales.

## Verificación y aceptación

- `npm run check`: sintaxis correcta.
- `npm test`: 57 pruebas correctas, incluidas separación MCQ, permisos y rechazo de puntuaciones del cliente.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:platform:e2e`: 14 recorridos correctos en escritorio y móvil. Incluyen sesión, rol, publicación revisada, extracción sin reescritura por generación, respuestas persistidas, tutor, entrega, revisión y XLSX.
- Demo bajo un servidor exclusivamente estático y el prefijo real de Pages: bienvenida, recursos locales, rutas, paneles, cuatro pasos, conservación de texto y rúbrica, confirmación de publicación, borrador privado y validación separados, lector y guardado temporal. Sin API, POST, terceros, errores JavaScript ni desborde horizontal.
- Capturas de los paneles, rúbrica, revisión y lector obtenidas del navegador, sin utilizarlas como sustituto de los controles HTML.

La IA que proponga rúbricas y evalúe abiertas, su historial persistente, el original documental privado e inmutable y la carga de 50 MB continúan pendientes. Las pruebas usan datos ficticios y proveedores inyectados; no consumen una API real ni utilizan cuentas de menores.
