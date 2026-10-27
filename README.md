# LectorLab 2.0 — primera versión

Plataforma de Comunicación para secundaria peruana, construida sobre LectorLab existente. Conserva *Más allá de las palabras* y su recorrido de siete etapas; añade acceso docente/estudiante, grupos, actividades con revisión, trabajo persistente y resultados desde servidor.

**Para empezar sin revisar código:** [guía de primeros pasos](docs/PRIMEROS_PASOS.md).

## Arranque

Node **24.19.0** y npm **11.9.0**. Desde esta carpeta:

```bash
npm ci
npm start
```

Abrir la dirección local indicada por el servidor, normalmente `http://127.0.0.1:3000`. En Windows: `INSTALAR.bat`, después `INICIAR.bat`. No abrir el HTML directamente. La primera pantalla crea tu acceso docente, con contraseña propia de al menos 10 caracteres. No hay cuentas ni claves predeterminadas. No requiere configurar IA para comenzar.

## Qué funciona

- Espacios docente y estudiante; sesiones de servidor, roles, CSRF, contraseñas scrypt y permisos por propietario/grupo.
- Grupos y accesos individuales con alias; publicación de versión revisada y asignación.
- RED original, lector con párrafos, seis preguntas de primer intento registrado, hipótesis, dos evidencias, vínculo razonado y reflexión.
- Guardado y recuperación al recargar; entrega y tiempos de servidor; respuestas objetivas calculadas desde claves privadas. Producciones abiertas pendientes de revisión docente, sin nota por longitud.
- Rúbrica y devolución docente; insignias privadas confirmadas por revisión, sin rankings ni acusaciones automáticas.
- Carga privada de TXT UTF-8, DOCX y PDF **textuales** (hasta 2 MB); revisión del texto extraído.
- Autoría manual; adaptador IA para generar inferencia, relación y completado con evidencia literal validada. Nada se publica automáticamente.
- Tutor situado en el texto asignado, historial auténtico, cinco intervenciones controladas en servidor e idempotencia. Sin proveedor, guía fija claramente marcada como **sin IA**.
- Excel individual y consolidado, tres hojas, obtenido desde registros persistidos.
- Cola persistente y conexión opcional a Sheets con destino por docente, escritura RAW y reconciliación por ID. Sin credencial explícita se muestra no configurado y Excel sigue funcionando.

## Datos y configuración

PostgreSQL embebido **PGlite** guarda en `.data/postgres` sin instalar un servicio separado. Una sola instancia abre esa carpeta; no borrarla ni incluirla en Git/ZIP. Para respaldarla, detener LectorLab y copiar la carpeta privada completa a un destino protegido. Nunca copiar una DB abierta. Restaurar con el proceso detenido y conservar una copia anterior. La persistencia y reapertura están probadas; no hay backup automático ni política institucional de borrado aplicada.

`DATABASE_URL` permite usar PostgreSQL externo con el adaptador `pg`, pero esa conexión externa no fue probada en esta entrega. No ejecutar varias instancias sobre PGlite. Usar el checkout existente; no hacen falta worktrees adicionales.

`.env.example` documenta opciones. Crear `.env` solo si se necesitan; no poner credenciales en HTML/JS ni subirlas a Git.

IA real requiere **ambos** `OPENAI_API_KEY` y `OPENAI_MODEL`, con un modelo disponible en tu cuenta. No se consumió API real en las pruebas. Se usa `store:false`, sin afirmar retención nula del proveedor. Se minimizan identificadores y se enmascaran algunos datos personales por patrón; eso no reconoce todos los nombres o datos indirectos. Verificar modelos, costos, contratos y calidad pedagógica antes de habilitar IA con estudiantes.

Sheets requiere un archivo de credencial de servicio **exclusivo del proyecto**, referenciado por `LECTORLAB_GOOGLE_CREDENTIALS_FILE`. Compartir con esa cuenta únicamente la hoja elegida. No se adopta la credencial ambiental de la máquina. El docente configura el ID en su interfaz; nunca introduce claves en el navegador. La conexión real a Google no está verificada sin esa configuración. Esta primera versión sincroniza mediante acción docente; Google no es la base de datos ni origen de calificaciones.

## Pruebas

```bash
npm run check
npm test
npx playwright install chromium
npm run test:e2e
npm run test:platform:e2e
```

En esta nube ya hay Chromium: usar `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` para las suites de navegador. `bash scripts/setup-cloud.sh` instala con lockfile y ejecuta todas las suites; usa un navegador instalado o la ruta explícita. Las pruebas usan cuentas ficticias, PostgreSQL embebido real, parsers y XLSX reales; los servicios externos son dobles **solo en tests**.

La Etapa A se conserva en `src/app.js` y `public/index.html`, con su suite de regresión. `npm run start:legacy` permite consultar esa demo en loopback:3001, sin adaptador IA y sin autoridad académica. Sus rutas públicas no se montan en la plataforma autenticada; las claves de esa demo no están disponibles a estudiantes de la plataforma.

## Límites de esta entrega

Es una primera versión para probar con datos ficticios, **sin despliegue público**. No incluye OCR, antivirus externo, recuperación por correo, altas de docentes adicionales desde interfaz, multiinstitución, revisión legal ni backups/borrado automáticos. Los originales subidos se descartan tras extraer: se conserva texto canónico privado y hash, no el archivo original. Offsets de citas son puntos de código Unicode del texto revisado, no coordenadas del PDF.

La calidad real del modelo y la política de no dar respuestas requieren evaluación pedagógica; un prompt y filtros finitos no son garantía absoluta. Antes de menores reales: responsable institucional, base/autorizaciones, avisos, conservación, transferencias, HTTPS y operación revisados. Cookies `Secure` al usar `NODE_ENV=production`; `TRUST_PROXY=1` solo detrás de un proxy conocido. El alta inicial se deshabilita fuera de loopback.

El respaldo original y el punto de retorno Etapa A están registrados en Git; [arquitectura y estado de esta versión](docs/VERSION_2_PREVIEW.md). No se ha subido código a GitHub ni probado restauración en otra tarea de nube.
