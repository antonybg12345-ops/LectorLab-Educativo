# Decisiones acordadas para LectorLab 2.0

La bienvenida y los accesos están descritos en [REDISENO_ENTRADA.md](../REDISENO_ENTRADA.md); la integración posterior de los espacios internos, en [REDISENO_INTERNO.md](../REDISENO_INTERNO.md). La tabla final distingue lo implementado de los requisitos pendientes.

## Identidad y entrada

Bienvenida vino, crema y dorado, escena de estudiantes ficticios leyendo, accesos equivalentes «Soy docente» y «Soy estudiante». Retirar la fila de tres beneficios y conservar «Leer · Sustentar · Revisar». Cada usuario tiene su cuenta; estudiantes con usuario y contraseña entregados por docente. El servidor determina rol y permisos.

## Espacio docente y preparación

Resumen de grupos, actividades y entregas; navegación lateral persistente. Lectura → Preguntas → Rúbrica → Revisar y publicar. IA propone preguntas y rúbrica; docente revisa, modifica y aprueba antes de publicar. Conservar la actividad original disponible y no reemplazar ajustes silenciosamente al generar nuevas propuestas.

## Evaluación

Alternativas automáticas con aciertos y porcentaje específico, independientes de la rúbrica abierta. IA valora abiertas con la rúbrica aprobada; el docente modifica puntajes y devolución y valida. Propuesta IA provisional y privada hasta validación. Mostrar puntajes por criterio y total; no convertir a20 o AD/A/B/C. Conservar propuesta original e historial de ajustes.

## Lectura original y tamaño

IA no adapta, resume ni reescribe la lectura. Conservar archivo original privado e inmutable y separar el texto extraído; avisar errores de extracción y ofrecer comparación. Nuevo límite solicitado:50MB por archivo. Procesamiento extenso por secciones explícitas, sin recorte silencioso y sin prometer OCR inexistente.

## Estado de implementación

| Área | Estado |
|---|---|
| Bienvenida y accesos nuevos | Implementados en rama de trabajo, verificados en navegador |
| Sesiones y permisos reales | Se reutiliza el backend existente |
| Panel/editor con el nuevo diseño | Implementados: navegación lateral, resumen con acciones, preparación en cuatro pasos y revisión en dos columnas |
| Porcentaje separado de alternativas | Calculado por el servidor sobre MCQ y mostrado por separado; el total objetivo mixto se conserva. Los formatos XLSX y Sheets mantienen por ahora sus columnas anteriores |
| Rúbrica generada por IA y evaluación provisional | Pendientes de integración real. La demo permite explorar criterios editables, una propuesta preescrita, borrador privado y validación con datos ficticios en memoria |
| Original inmutable y carga50MB | Especificados; límite real actual2MB |
| Publicación de esta integración | Demo estática en `/avance/`; aplicación con servidor conservada por separado en la rama de trabajo |

Detalles: [Preparación de actividad](PREPARACION_ACTIVIDAD.md), [Evaluación IA](EVALUACION_IA_RUBRICA.md), [Lectura original y carga](LECTURA_ORIGINAL_Y_CARGA.md).
