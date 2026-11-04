# Evaluación de abiertas con IA y validación docente

## Decisión confirmada

El usuario confirmó que desea valoración inicial de respuestas abiertas por IA mediante rúbrica, con edición de nota y devolución por el docente y validación final. Sustituye la duda previa entre revisión exclusivamente humana y revisión asistida.

Flujo: entrega → propuesta de IA → revisión y ajustes docentes → validación → publicación de la evaluación al estudiante.

La propuesta de IA siempre es provisional. El tutor socrático sigue siendo un servicio separado: acompaña sin calificar ni entregar respuestas directas durante la actividad.

## Presentación propuesta

- Alternativas: corrección automática con la clave revisada, aciertos y porcentaje por separado. Ejemplo 5/6 = 83,3 %.
- Abiertas: estado «Propuesta IA · Pendiente de validación».
- Rúbrica con columnas IA y Docente y puntajes editables por criterio.
- Escala confirmada por el usuario: puntajes por criterio y total de la rúbrica, sin conversión a 20 o AD/A/B/C. Ejemplo: Inferencia 2/3, Evidencias 3/3, Vínculo 2/3, Revisión 1/3; total 8/12 provisional. Los criterios y máximos definitivos serán los que el docente apruebe para esa actividad, no necesariamente esos cuatro ni un total fijo de 12.
- Devolución editable. Guardar cambios conserva un borrador privado; Validar evaluación confirma la versión que verá el estudiante.
- Detalle de lectura y producción al lado de la rúbrica para comprobar las justificaciones.

## Qué existe y qué falta

Existe revisión docente con cuatro criterios 0–3, devolución editable y estado reviewed. Existe corrección objetiva de alternativas, relación y completado. Los servicios actuales de IA son tutor y generación de preguntas.

No existe evaluador IA de respuestas abiertas, almacenamiento de propuestas separado, validación independiente o historial completo. La tabla assessments representa actualmente la última revisión del docente y es visible al estudiante: no guardar allí una propuesta de IA pendiente como si ya fuera una evaluación validada.

Se necesita almacenar propuesta original, versión de rúbrica y lectura, referencia a la entrega congelada, justificaciones, modelo/fecha, cambios docentes, motivo del ajuste y evento de validación. El código de la aplicación y el sitio público no se han modificado durante esta fase de bocetos.

El usuario confirmó además que la IA debe proponer la rúbrica durante la preparación de la actividad, y que el docente puede modificarla antes de publicar. Esto es distinto de aplicar esa rúbrica a una entrega. Ver `PREPARACION_ACTIVIDAD.md`.

## Criterios de aceptación para implementación

1. Evaluar la entrega y lectura específicas con una rúbrica revisada y versionada. Cada justificación debe apoyarse en fragmentos comprobables; nunca inventar citas ni atribuir falta de autoría.
2. Propuesta IA privada y separada de la evaluación oficial. El estudiante y las exportaciones definitivas solo reciben la versión validada. No emitir insignias ni sincronizar notas finales por una propuesta pendiente.
3. Solo el docente propietario modifica y valida. Validar en servidor rangos, versión y coherencia entre puntajes y total. Conservar la primera respuesta objetiva y no aceptar notas finales aportadas por el cliente estudiante.
4. Conservar propuesta IA original y cambios docentes con autor, fecha y motivo. Una nueva generación no sobrescribe una evaluación ya validada; debe quedar identificada como otra propuesta.
5. Separar objetivas y rúbrica abierta. El total del ejemplo debe ser 8/12; no combinarlo con 83,3 % sin una regla de ponderación previamente acordada. Pantalla, Excel y Sheets deben coincidir sobre qué versión está validada.
6. Ante fallo, datos insuficientes o resultado no válido de IA, dejar pendiente y permitir revisión manual. No asignar cero por fallo técnico ni repetir llamadas automáticamente sin control de duplicados.

## Privacidad y calidad

Enviar solo lectura, rúbrica y producción necesarias; omitir identificadores de cuenta y minimizar datos personales. Tratar respuestas del estudiante y documentos como datos no confiables, sin permitir que sus instrucciones cambien la rúbrica. La evaluación no debe premiar extensión o estilo por sí solos y debe admitir interpretaciones alternativas sustentadas.

La integración requiere proveedor configurado y puede generar consumo de API. No se hizo ninguna llamada a un modelo para calificar estudiantes ni se usaron datos reales; las cifras del boceto son ficticias.
