# Preparar actividad: lectura, preguntas y rúbrica

## Decisiones confirmadas

- El usuario quiere que la IA proponga la rúbrica, al igual que las actividades, y que el docente pueda modificarla.
- La valoración se mostrará mediante puntajes por criterio y total de la rúbrica, sin conversión a escala 20 ni AD/A/B/C.
- La IA propondrá evaluaciones de abiertas usando la rúbrica aprobada; el docente podrá corregir puntajes y devolución y validar la evaluación.
- Alternativas con corrección automática y porcentaje propio, sin mezclarlo con la rúbrica abierta.

## Recorrido de preparación propuesto

1. **Lectura:** título y propósito; pegar texto o importar PDF, DOCX o TXT; conservar el original y comparar la extracción. Texto importado de solo lectura por defecto, sin adaptación ni reescritura por IA. Límite de subida acordado: 50 MB por archivo. Cualquier corrección posterior de extracción debe ser explícita y versionada, sin alterar el original.
2. **Preguntas:** generar propuestas o añadir preguntas; revisar enunciados, claves, citas y vínculo. Conservar el recorrido original disponible desde la biblioteca.
3. **Rúbrica:** la IA propone criterios, descriptores de logro y puntajes máximos coherentes con lectura, preguntas y propósito. El docente puede modificar la propuesta, añadir o quitar criterios y adaptar niveles y puntos. El máximo total se calcula desde los máximos de cada criterio.
4. **Revisar y publicar:** vista previa y confirmación explícita del docente sobre texto, preguntas, claves, evidencias y rúbrica. Solo después se publica y se puede asignar.

## Distinción entre los dos usos de IA

- **Diseñar:** propuesta de rúbrica antes de publicar, editable por el docente.
- **Evaluar:** aplicación de la rúbrica ya aprobada a una entrega congelada, con puntajes y justificaciones provisionales.

La misma rúbrica versionada gobierna lo que ve el estudiante, la propuesta de IA y la validación docente. Las claves de preguntas y anotaciones privadas no forman parte de la rúbrica pública para estudiantes.

## Guardado y versiones

- Guardar borrador y continuar entre pasos no publica la actividad.
- Informar de cambios sin guardar, guardando, guardado y error; proteger la salida.
- Nueva propuesta de IA no debe sobrescribir silenciosamente ajustes docentes. Conservar la propuesta anterior y ofrecer revisar o aplicar los cambios.
- Publicar congela lectura, preguntas y rúbrica. Editar una versión publicada crea otra; los intentos anteriores conservan la rúbrica y lectura que recibieron.
- Una generación atrasada no puede sobreescribir una versión de texto o rúbrica modificada durante la solicitud.

## Qué requiere implementación

Los parsers actuales admiten PDF textual, DOCX y TXT con límites; no hay OCR. El editor actual permite crear y revisar preguntas, pero mezcla el flujo en una página larga. La generación actual reemplaza la lista de preguntas: se necesita evitar pérdida silenciosa de cambios.

El límite actual de 2 MB no se ha ampliado todavía. Implementar 50 MB y conservar el archivo original requiere almacenamiento privado y una ruta de procesamiento revisada, sin equiparar tamaño de archivo con contexto de IA. Ver `LECTURA_ORIGINAL_Y_CARGA.md`.

Las actividades actuales guardan preguntas, instrucciones y límites del tutor, pero no una rúbrica estructurada y configurable por actividad. La revisión actual usa cuatro criterios fijos 0–3. Crear la rúbrica con IA, persistir criterios/niveles/máximos/versiones y evaluar con esa rúbrica son funciones nuevas. Esta documentación y los bocetos no son una implementación ni una publicación.

## Criterios de aceptación principales

1. Propuesta IA coherente con la actividad; esquema y puntajes validados en servidor; ningún campo de cliente estudiante gobierna una nota.
2. Criterios, descriptores y puntos editables por el docente autorizado; total máximo recalculado, sin confiar en un total suministrado.
3. Revisión docente necesaria antes de publicar; las generaciones se mantienen como borrador.
4. Evaluaciones usan la rúbrica y entrega correctas, con trazabilidad de versiones y sin recalificar intentos previos al editar.
5. Rúbrica de evaluación consultable por el estudiante antes de responder, sin exponer claves privadas de solución; la valoración IA provisional solo la recibe el docente hasta validación.
6. Fallos de extracción o generación dejan los datos ya guardados disponibles y permiten edición manual. No inventar texto ni asignar un cero por fallo técnico.

## Boceto de ejemplo en preparación

Paso 3 Rúbrica; cuatro criterios de ejemplo con máximo 3 y total máximo 12. Solo un criterio expandido para que sus descriptores sean legibles. Los otros permanecen compactos con acción Editar. Resumen lateral y Nueva propuesta con IA, sin botón Publicar en ese paso. Los datos y criterios son ilustrativos y modificables; no se fijan como la única rúbrica posible.
