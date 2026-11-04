# Lectura original y archivos de hasta 50 MB

## Requisitos confirmados

- El usuario no quiere que la IA modifique, adapte, resuma o reescriba la lectura. La experiencia anterior de adaptación del recurso no debe repetirse al importar un original.
- El usuario eligió **50 MB por archivo** como nuevo límite de subida.
- Se conserva la fase de bocetos: el código y la publicación actuales todavía no han cambiado de 2 MB a 50 MB.

## Conservación del contenido

Guardar el archivo original completo como recurso privado e inmutable: bytes, nombre, tipo, tamaño, propietario y huella. Mantener el texto extraído como recurso separado con su versión y procedencia. Guardar el original no equivale a prometer extracción perfecta de PDF/DOCX ni diseño idéntico en una vista de texto.

La lectura importada será de solo lectura por defecto. Ofrecer Ver original y comparación con el texto extraído. La IA de preguntas, rúbrica o evaluación recibe una copia para trabajar y no tiene una operación que reescriba la lectura. Los esquemas de salida y las operaciones de guardado deben impedir que una respuesta del modelo sustituya texto o archivo.

Si hay errores de extracción, mostrarlos y dejar la actividad pendiente de revisión; no reconstruir palabras por conjetura. Si posteriormente el docente solicita una corrección manual de extracción, hacerla explícita, comparada y versionada como derivado, conservando siempre el original. No crear ese cambio automáticamente ni presentar un derivado como archivo original.

Las normalizaciones técnicas y la redacción de datos personales para el proveedor son copias separadas; no deben sobrescribir el archivo original ni ocultar diferencias con él. Las citas deben poder verificarse contra la versión exacta de lectura que se utilizó.

## Tamaño de subida y alcance de procesamiento

50 MB es un límite de subida, no una promesa de contexto ilimitado de IA o extracción instantánea de cualquier libro. Conservar el archivo completo. Para documentos extensos, permitir seleccionar páginas, capítulos o fragmentos literales para la actividad, con alcance visible y acceso al original completo. No resumir ni truncar silenciosamente para ajustarse a un modelo.

Si se supera una capacidad de extracción o de contexto, avisar y ofrecer un alcance explícito; no fingir que se procesó el documento entero. No hay OCR implementado: un PDF escaneado no debe convertirse por conjeturas en una lectura nueva.

## Diferencias respecto del código actual

El generador actual devuelve preguntas y actualiza solo questions, no reading_text. La adaptación pedagógica de Quiroga ya venía en la lectura de la semilla del recurso.

El importador actual conserva SHA-256 y texto, pero descarta el binario original. Normaliza Unicode/saltos de línea/espacios. El límite 2 MB aparece en cliente, Multer y extractDocument. También hay límites independientes de 40 000 caracteres, PDF 80 páginas, worker de 15 segundos y 160 MB, dos extracciones globales y expansión DOCX acotada. Actividad y JSON tienen sus propios límites. Cambiar solo el rótulo o una constante no implementa el nuevo requisito.

## Preparación necesaria para implementar 50 MB

- Aplicar el límite en cliente, servidor y alojamiento/proxy de forma coherente.
- Evitar cargar y duplicar repetidamente un archivo de 50 MB en memoria. Usar recepción acotada hacia almacenamiento privado temporal/original y procesamiento limitado.
- Revisar memoria, concurrencia, tiempos y trabajo por secciones; usar estados de procesamiento y permitir recuperación ante fallo sin borrar el original conservado.
- Mantener controles de estructura, expansión y recursos externos de DOCX y procesamiento PDF; no aumentar todos los límites proporcionalmente.
- Definir permisos de acceso al original para su docente y estudiantes asignados, sin URLs públicas ni exposición de rutas o credenciales. Aplicar política de conservación y borrado adecuada a la institución antes del uso real.

## Criterios de aceptación

1. Los bytes y la huella del original no cambian al generar o regenerar preguntas/rúbrica, al evaluar ni al editar metadatos de la actividad.
2. La lectura importada no se reescribe desde una respuesta del modelo, ni siquiera si el proveedor devuelve campos no admitidos o instrucciones dentro del texto.
3. El archivo hasta el límite se recibe por la ruta de carga revisada; un exceso se rechaza con mensaje claro y limpieza de temporales. Probar límites exactos, carga concurrente y archivos problemáticos con consumo acotado.
4. Extracción fallida, OCR ausente y exceso de contexto se muestran como pendientes/error/alcance por seleccionar, nunca como texto inventado ni lectura completa truncada.
5. Ver original entrega el archivo correcto al usuario autorizado. El texto extraído y sus diferencias quedan separados y trazables.
6. Las citas, preguntas, rúbrica y evaluaciones apuntan a la versión y al alcance correctos; generaciones atrasadas no sobrescriben correcciones o versiones nuevas.

## Boceto solicitado

Actualizar el paso Lectura: lectura original y texto extraído de solo lectura, Ver original, límite propuesto 50 MB y comparación antes de continuar. Mantener diseño vino/crema/dorado y no modificar las palabras del texto de ejemplo en la imagen.
