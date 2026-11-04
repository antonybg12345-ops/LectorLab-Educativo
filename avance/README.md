# Avance de la interfaz de LectorLab 2.0

Vista pública: https://antonybg12345-ops.github.io/LectorLab-Educativo/avance/

Presenta la bienvenida y los accesos nuevos, con los espacios actuales de docente y estudiante. Se publica como archivos estáticos dentro de `demo-presentacion`, sin sustituir la demo principal ni `/v1/`.

## Alcance

- Datos ficticios, conservados únicamente en la memoria de la pestaña. Recargar reinicia los cambios.
- Los botones de acceso abren un rol de demostración. Los campos de usuario y contraseña están deshabilitados; no existen cuentas ni sesiones reales en esta publicación.
- Permite recorrer grupos, actividades, una producción de ejemplo y el trabajo del estudiante. La revisión del ejemplo es manual.
- Exporta CSV de demostración. No conecta con Google, OpenAI ni servicios externos.
- La carga de archivos y la generación con IA están deshabilitadas. La carga de 50 MB, la conservación del archivo original y la propuesta y evaluación de rúbricas con IA continúan pendientes en la aplicación.
- Las claves de preguntas incluidas en una demo estática son inspeccionables; no debe usarse como evaluación real ni para recopilar datos de estudiantes.

La implementación con servidor y autenticación se conserva por separado en [`feat/bienvenida-accesos`, commit `ddefdd7`](https://github.com/antonybg12345-ops/LectorLab-Educativo/tree/ddefdd7e73d9cda5cddfebe305f224e2b1fbf93f). Esta publicación utiliza sus pantallas y un adaptador exclusivo de demostración en memoria.

## Verificación

Probado en Chromium con servidor exclusivamente estático bajo `/LectorLab-Educativo/`, en 1366 × 900 y 390 × 844: recursos locales, portales, rutas con hash, recarga y Atrás, campos de credenciales deshabilitados, paneles, salida y conservación temporal del borrador. Sin solicitudes a una API, envíos POST, conexiones externas, errores JavaScript ni desborde horizontal. La política CSP bloquea conexiones de red desde la aplicación.

Publicación mediante la rama ya configurada para GitHub Pages. No requiere Node.js en el equipo de quien la visita.
