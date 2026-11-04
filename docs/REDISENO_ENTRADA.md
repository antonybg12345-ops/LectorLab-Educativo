# Primera integración del diseño acordado

Rama de trabajo: `feat/bienvenida-accesos`.

## Alcance de esta entrega

La bienvenida y los accesos docente/estudiante pasan de bocetos a HTML, CSS y JavaScript funcionales sobre la aplicación Express existente. Se conserva el uso de la API de sesión y los espacios internos actuales.

- Bienvenida con identidad vino, crema y dorado, ilustración local, dos accesos equivalentes y sin la fila de tres beneficios retirada por el usuario.
- Páginas de acceso docente y estudiante, etiquetas visibles, mostrar/ocultar contraseña, regreso a inicio y cambio de acceso.
- Rutas directas y recarga para acceso e información pública.
- Sesión, alta inicial y rol confirmados por el servidor. Elegir un portal no concede permisos.
- En instalación local vacía, el primer docente se crea desde su acceso cuando el servidor habilita setup. No hay alta de estudiantes ni creación pública de docentes desde ese formulario.
- Los estudiantes utilizan usuario y contraseña individuales entregados por su docente.

## Organización

- `public/platform/entry.js`: presentación de la entrada y formularios.
- `public/platform/app.js`: sesión, navegación de entrada y transición a los espacios existentes.
- `public/platform/entry.css`: estilos de entrada, limitados a esas vistas.
- `public/platform/assets/reading-scene.png`: ilustración de personajes ficticios derivada del boceto aprobado; recurso local generado para LectorLab.
- `src/platform/app.js`: rutas de documento para abrir o recargar esas páginas.
- `tests/platform-e2e/entrada.spec.js`: recorrido de entrada, estados de acceso y comprobación del rol real.

La ilustración no contiene textos o botones de interfaz: los controles son HTML real, con sus etiquetas y navegación.

## Verificación

- `npm run check`: correcto.
- `npm test`: 54 pruebas de código existentes correctas tras añadir las rutas; los cambios posteriores se limitaron a la entrada y protección de navegación del navegador.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:platform:e2e`: 14 recorridos correctos, escritorio y móvil. Incluyen el recorrido pedagógico anterior, Excel, acceso, permisos, doble envío y cierre de sesión.
- Dos regresiones específicas: una respuesta docente tardía no vuelve a pintar datos tras Salir; Atrás cancelado por tutor pendiente conserva el intento y paso completos.
- Capturas de bienvenida y ambos accesos en 1366×900 y 390×844: imagen local cargada, sin desborde horizontal, errores JavaScript ni peticiones a terceros.

La comprobación utiliza PostgreSQL de prueba y proveedores inyectados; no llama a OpenAI o Google reales ni usa cuentas de estudiantes reales.

## Diferencia entre implementación y publicación

Esta rama trabaja sobre la aplicación Node/Express con autenticación real. El sitio GitHub Pages mantiene las demos publicadas anteriormente; no se sustituye por un formulario que aparente autenticación segura desde un archivo estático. Esta integración no se ha publicado todavía.

## Requisitos que siguen pendientes

La evaluación de abiertas con IA y rúbrica configurable, separación de propuestas/validación, historial, generación de rúbricas, nuevos editores, original documental inmutable y carga de 50 MB siguen especificados en los documentos de co-diseño. El límite real de importación continúa en 2 MB en esta entrega. Las correcciones objetivas y la rúbrica docente existentes siguen su recorrido actual.

No se conectó ningún proveedor real ni se usaron credenciales o datos de estudiantes para comprobar esta entrada.
