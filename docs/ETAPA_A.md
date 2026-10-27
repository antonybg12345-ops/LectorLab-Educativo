# Etapa A — Estabilización local de LectorLab

## Alcance y procedencia

Se trabajó sobre los doce archivos del respaldo, no sobre una aplicación reconstruida. El commit local inicial `e0abd9d` conserva el original sin cambios y `docs/baseline/inventario-original.json` permite comprobar sus hashes. El ZIP se conserva fuera del checkout. No se hizo push ni despliegue.

La selección de Etapa A autoriza A1–A4. Las siguientes entregas (cuentas, DB, documentos, generación, Sheets y piloto de menores) permanecen pendientes. No se solicita una clave de IA para ejecutar la suite o demostrar cierre/Excel.

## Cambios revisables

| Tarea | Resultado |
|---|---|
| A1 — Línea base | Respaldo en Git; Node 24.19.0 y npm 11.9; lockfile reproducible; `.env.example` sin secretos; instalación Windows `call npm ci`. |
| A2 — App comprobable | `createApp` sin puerto, `.env` ni llamada IA al importar; configuración y adaptadores aislados; servidor escucha loopback por defecto y cierra con señales. |
| A3 — Cierre y Excel | Eliminada la referencia inexistente; indicador puro compartido; snapshot de cierre; Excel desde respuestas crudas con recálculo servidor y tres hojas conservadas. |
| A4 — Caracterización | HTML/CSS/JS separados sin rediseño; siete etapas y seis preguntas conservadas; timeout/retry, bloqueo durante IA pendiente, aviso de pérdida/reinicio, labels/foco/progreso y pruebas de navegador. |

Se conservaron objetivos, lectura, alternativas, feedback, hipótesis, tutor opcional, límite local de cinco turnos, reloj orientativo, insignias, reflexión final, créditos y fuentes. La revisión comparó texto de lectura y las 18 alternativas con el respaldo, CSS extraído y prompt sin cambios.

La regla indefinida `hasEvidenceKeyword` no se sustituyó por una supuesta evaluación semántica. Se conserva el indicador 0–9 como seis aciertos más tres comprobaciones explícitas de **completitud**. Normaliza Unicode NFC, espacios y mayúsculas al comparar evidencias; cuenta puntos de código, no unidades UTF-16. Los mensajes y reportes aclaran que no prueba pertinencia de la evidencia ni calidad del razonamiento. La rúbrica y revisión docente siguen pendientes.

La exportación ya no acepta como autoridad `score`, `objectiveScore`, `correct`, `criteria`, `maxScore` o niveles del navegador: el servidor reconstruye desde alternativas y texto validados. Listas permitidas y límites de texto evitan objetos fórmula/hipervínculo en ExcelJS; las cadenas de apariencia de fórmula se escriben como texto. Se etiqueta toda autoría/historial/fecha informada como no verificada.

## Criterios de aceptación

- Instalar con `npm ci` sin modificar el lock; importar `src/app.js` no deja proceso escuchando.
- Sin credencial se puede leer, responder, finalizar y descargar; tutor devuelve 503 claro, conserva borrador y permite continuar.
- Evidencias largas distintas ya no rompen cierre/descarga; vacías, breves, iguales o Unicode no causan excepciones.
- XLSX real abre y conserva Resumen/Respuestas/LectorLab; datos y aciertos se corresponden con respuestas crudas, no con puntajes falsificados.
- La fecha de cierre se fija al finalizar; la generación del archivo tiene su propia fecha de servidor. Reflexión final puede añadirse después.
- Primera alternativa de UI no se cambia; quinto éxito del chat bloquea el sexto. Error no consume turno de UI. Doble envío y navegación mientras espera no duplican peticiones.
- Se avisa antes de salir/recargar con trabajo; reiniciar puede cancelarse o confirmarse sin aviso duplicado.
- Sin clave real en HTML/JS, sin llamadas pagadas en pruebas y sin datos personales reales. Lectura y funciones preservadas.

## Dependencias y seguridad local

La instalación resolvió Express 5.3.0, OpenAI 5.23.2, dotenv 16.6.1, ExcelJS 4.4.0 y Playwright 1.64.1. El lockfile fija también el árbol transitivo.

`npm audit` identificó inicialmente el aviso `GHSA-w5hq-g745-h8pq` en uuid 8, transitivo de ExcelJS. No se aplicó `audit fix --force` ni se bajó ExcelJS. Se acotó un override a uuid 11.1.1, cuya exportación CommonJS de `v4` usa ExcelJS. Una prueba de formato condicional extendido genera un UUID y reabre el XLSX real para verificar esa compatibilidad. Tras el cambio, el registro no reportó vulnerabilidades conocidas; eso no es una auditoría exhaustiva ni elimina los avisos de obsolescencia de otras transitivas.

El limitador de IP ahora cubre tutor/Excel, poda entradas y limita el mapa. Es una protección de demo, no un control multiinstancia o de identidad. Manejo uniforme de errores JSON, límites de cuerpo/tipos, cabeceras básicas y logs de error sin contenido del proveedor. OpenAI tiene timeout de 25 s, cero retries automáticos y `store:false`; no se probó el modelo real ni su retención contractual.

## Límites pendientes que no deben confundirse con controles terminados

1. Sin autenticación, autorización, DB, recuperación de borradores o persistencia de intentos. Las respuestas correctas siguen accesibles para el feedback local. El primer intento no es verificable fuera de la pestaña.
2. `turn` e historial del contrato heredado del tutor siguen suministrados por cliente: los límites son de UI/formato, no cuotas pedagógicas confiables. Su autoridad se implementará con identidad y sesiones persistentes en B–D. No publicar esta demo como API de aula.
3. Un resultado recalculado no prueba que el alumno lo produjo. Diálogos y fechas de navegador son informativos; Excel no es certificado académico.
4. Calidad socrática/no revelar respuestas, disponibilidad de modelo y API real no se verificaron con proveedor. Pruebas usan IA simulada y datos ficticios.
5. Antes del piloto: privacidad institucional, recursos externos, retención/borrado, proveedores, TLS, restauración, roles y autorización. No hay certificación legal ni WCAG.
6. Las pruebas móviles usan un viewport Chromium de 390 px, no dispositivo físico. Teclado/foco tienen cobertura básica, no auditoría completa de navegación asistida. BAT revisados, no ejecutados en Windows.

Las instrucciones históricas de los `.txt` se conservan por procedencia. El README actual y el lockfile sustituyen su recomendación de reinstalar/reemplazar archivos masivamente.

## Validación final ejecutada

`bash scripts/setup-cloud.sh` terminó con código 0 después de una instalación limpia mediante `npm ci`: sintaxis aprobada, **20/20 pruebas unitarias y HTTP** y **10/10 E2E** en Chromium de sistema (154.0.8037.57), escritorio y viewport móvil. Cero pruebas fallidas, omitidas o pendientes en la corrida final. Salida completa en `docs/validacion-etapa-a.txt`. Se comprobó además que los doce archivos del commit inicial coinciden con el inventario original y que el prompt permanece idéntico.

Los E2E reabren el Excel de tres hojas, verifican una segunda descarga con reflexión final actualizada y cierre estable, cinco turnos locales, reintentos, solicitud pendiente, aviso al recargar y reinicio cancelado/confirmado sin segundo aviso. El título/cobertura de teclado se limita al foco y avance inicial; no afirma auditoría completa.

También se inició `npm start` real sin clave en loopback y se hicieron solicitudes de página/health, exportación XLSX reabierta con recálculo frente a puntaje falso y tutor 503 esperado. No hubo API real. `npm audit` final informó **0 vulnerabilidades conocidas** con el árbol bloqueado. El escaneo por patrones no detectó claves, sin garantizar ausencia de todo secreto.

Se guardaron `install_script` y `start_skill` en un borrador de configuración de nube: no ejecutan ni publican por guardarlos. Para activar esa configuración en el producto, revisar y guardar los cambios en configuración del entorno y después publicar el entorno. Eso es distinto de publicar una web. Código y commit original siguen locales; no se subieron a GitHub ni se verificó restauración en otra tarea. Conservar el paquete de entrega: no asumir que el remoto `main` vacío contiene estos archivos.
