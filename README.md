# LectorLab — Etapa A

Recurso de Comunicación para 4.º de secundaria del Perú: adaptación de *El almohadón de pluma*, seis preguntas, hipótesis, tutor socrático, interpretación con dos evidencias, reflexión y Excel.

Esta versión estabiliza el proyecto existente para **desarrollo y demostración local**. No es aún una plataforma multiusuario: no tiene cuentas, DB ni registro confiable de primeros intentos o conversaciones. No usar datos reales de menores ni publicar como evaluación segura.

## Instalación y ejecución

Node.js **24.19.0** (`.nvmrc`/`.node-version`) y npm **11.9.0**. Usar el checkout existente; no hace falta crear otro worktree para cada tarea.

```bash
cd /workspace/LectorLab-Educativo
npm ci
npm run check
npm test
npm start
```

En otra computadora, cambiar la primera ruta por la de la carpeta del proyecto. El servidor escucha en `127.0.0.1:3000` por defecto. Abrir esa dirección en el navegador; no abrir el HTML directamente. `HOST` y `PORT` son configurables, pero cambiar el host no añade seguridad multiusuario. Detener con Ctrl+C.

Lectura, preguntas, cierre y Excel funcionan **sin clave de IA**. Si falta configuración, el tutor informa el error y permite continuar; no se sustituye por respuestas simuladas en producción. Los dobles de IA viven únicamente en pruebas.

### Tutor real opcional

Copiar `.env.example` a `.env` y configurar `OPENAI_API_KEY` **solo en servidor**. No subir `.env`, compartirlo con estudiantes ni poner credenciales en HTML/JS. La API tiene facturación separada de ChatGPT.

`OPENAI_MODEL` conserva el valor del respaldo; su disponibilidad y compatibilidad no se comprobaron contra una cuenta real. No se hicieron llamadas a OpenAI para completar la Etapa A. El adaptador pide `store:false`, pero eso no demuestra retención nula del proveedor ni resuelve el tratamiento de menores.

`GET /api/health` informa que HTTP está vivo y si hay adaptador configurado; `ai.verified:false` aclara que no verifica credencial/modelo/conectividad. No prueba que el tutor real funcione.

En Windows: `INSTALAR.bat` usa `call npm ci`; `CONFIGURAR.bat` crea `.env` si falta; `INICIAR.bat` inicia y permite abrir la dirección al estar listo, sin una espera arbitraria de dos segundos. Los BAT se revisaron, pero no se ejecutaron en Windows.

## Estructura

```text
server.js                    arranque, configuración y cierre
src/app.js                   Express sin abrir puertos ni llamar a IA
src/config.js                puerto/host/modelo y configuración
src/validation.js            listas permitidas, tipos y límites
src/ai/openai.js             adaptador IA server-side inyectable
src/reports/workbook.js      Excel: Resumen, Respuestas, LectorLab
lectorlab-prompt.js          reglas y lectura originales del tutor
public/index.html            siete etapas, contenido y fuentes
public/styles.css            estilos extraídos sin rediseño
public/js/app.js             estado y eventos
public/js/api.js             llamadas con espera finita
public/js/assessment.js      indicador compartido orientativo
tests/*.test.js              reglas, HTTP real y XLSX real
tests/e2e/                   escritorio y viewport móvil
docs/baseline/               inventario y hash del respaldo
docs/ETAPA_A.md              aceptación y límites pendientes
```

## Cambios y límites

Se corrigió la función inexistente que impedía finalizar/descargar y se unificó el cálculo. El indicador abierto comprueba **completitud**, no calidad inferencial: extensión mínima, dos evidencias distintas y reflexión. Los mensajes aclaran que pertinencia y vínculo lógico requieren revisión docente; las bandas e insignias conservadas no certifican dominio.

La descarga envía respuestas crudas. El servidor recalcula aciertos/completitud e ignora `score`, `correct`, `criteria` y niveles del cliente. Valida tipos para impedir objetos fórmula/hipervínculo en ExcelJS. Conserva las tres hojas y el diálogo. Las fechas de inicio/cierre del navegador son informativas y no verificadas; la generación tiene fecha UTC del servidor.

**No prueba autoría ni primer intento.** Las claves siguen públicas para el feedback local. El alumno aún puede alterar respuestas/historial/turnos o recargar. B–D incorporarán identidad, versiones, DB, autorización y contadores persistidos. El limitador IP en memoria es protección local, no identidad ni cuota confiable de aula.

El trabajo sigue solo en memoria de pestaña; hay aviso al salir/recargar y confirmación al reiniciar. No se añadió `localStorage` sensible. Descargar no conserva un borrador recuperable. Las imágenes externas del respaldo siguen presentes; las pruebas no dependen de ellas. Privacidad/licencia y alojamiento local de recursos se revisarán antes del piloto.

## Pruebas

```bash
npm run check
npm test
```

Para E2E en una máquina de desarrollo:

```bash
npx playwright install chromium
npm run test:e2e
```

En esta nube hay Chromium. Se validó con:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

En PowerShell puede configurarse `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` si se utiliza un navegador de sistema. Sin esa variable se usa el navegador de Playwright. Las pruebas levantan un servidor test-only en loopback:3101 con IA simulada; no usan ni leen claves reales. No ejecutar `scripts/e2e-server.js` para estudiantes. Viewport móvil no equivale a dispositivo físico ni auditoría completa de accesibilidad.

`npm run test:all` encadena sintaxis, unitarias/HTTP y E2E. `npm audit` consulta avisos conocidos del registro. El override acotado `exceljs → uuid@11.1.1` corrige el aviso de la transitiva original sin bajar ExcelJS; se prueba también su uso de UUID en XLSX. Quedan dependencias transitivas obsoletas de ExcelJS para seguimiento; cero avisos conocidos no significa ausencia de todo riesgo.

## Conservación y continuación

El commit inicial conserva los doce archivos del ZIP sin cambios, con inventario/hash. Los `.txt` portátiles describen la versión histórica: seguir ahora este README y el lockfile, sin reemplazar masivamente archivos ni volver a resolver dependencias sin revisar.

No se añadieron roles, grupos, DB, documentos, generación de preguntas ni Sheets. La siguiente etapa prevista es B: identidad, sesiones y grupos. No publicar para menores hasta completar controles y revisión institucional del plan de auditoría.
