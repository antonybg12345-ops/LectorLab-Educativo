# LectorLab

Tutor socrático con IA integrado al RED **“Más allá de las palabras”**, pensado para estudiantes de 4.º de secundaria y para una experiencia total aproximada de 20 minutos.

## ¿Qué hace esta versión?

- Conserva el RED original y reemplaza el chatbot local basado en reglas por un chatbot con IA.
- Mantiene un máximo de **5 intervenciones del estudiante**.
- LectorLab pide evidencias, cuestiona inferencias, distingue hechos de interpretaciones y ayuda a revisar hipótesis.
- **No entrega directamente la respuesta** ni redacta una interpretación final para copiar.
- La clave de OpenAI nunca aparece en el HTML del estudiante.
- El servidor no crea una base de datos ni guarda las conversaciones: el historial se mantiene temporalmente en la pestaña del navegador durante el recorrido.
- La descarga final del RED sigue incorporando la conversación con LectorLab.

---

# 1. Lo que necesitas

1. Una computadora con Windows, macOS o Linux.
2. **Node.js** instalado (versión LTS recomendada).
3. Una clave de API de OpenAI.
4. Crédito/facturación habilitada en la plataforma API de OpenAI.

> Importante: la suscripción de ChatGPT y el uso de la API son servicios con facturación separada.

Sitios oficiales:
- Node.js: https://nodejs.org/
- Plataforma de OpenAI: https://platform.openai.com/
- Claves API: https://platform.openai.com/api-keys

---

# 2. Estructura del proyecto

```text
LectorLab/
├── public/
│   └── index.html          ← tu RED ya integrado con IA
├── lectorlab-prompt.js     ← personalidad y reglas pedagógicas del tutor
├── server.js               ← servidor seguro que llama a OpenAI
├── package.json            ← dependencias del proyecto
├── .env.example            ← plantilla de configuración
├── .gitignore              ← evita publicar accidentalmente tu clave
├── CONFIGURAR.bat          ← crea y abre tu archivo .env
├── INSTALAR.bat            ← instalación fácil en Windows
├── INICIAR.bat             ← inicio fácil en Windows
└── README.md               ← esta guía
```

---

# 3. Primera instalación en Windows

## Paso A. Instala Node.js

Descarga e instala la versión LTS desde:

https://nodejs.org/

Puedes aceptar las opciones predeterminadas del instalador.

## Paso B. Instala LectorLab

Dentro de la carpeta `LectorLab`, haz doble clic en:

`INSTALAR.bat`

Se descargarán automáticamente las dependencias necesarias.

También puedes hacerlo manualmente desde una terminal:

```bash
npm install
```

---

# 4. Configura tu clave de OpenAI

1. Entra a https://platform.openai.com/api-keys
2. Crea una clave API.
3. En la carpeta `LectorLab`, haz doble clic en `CONFIGURAR.bat`.
4. Se creará (si todavía no existe) el archivo `.env` y se abrirá en Bloc de notas.
5. Coloca tu clave:

```env
OPENAI_API_KEY=tu_clave_aqui
OPENAI_MODEL=gpt-5.6-luna
PORT=3000
```

## MUY IMPORTANTE

- No pegues esa clave dentro de `index.html`.
- No envíes el archivo `.env` a estudiantes.
- No publiques el archivo `.env` en Drive, GitHub ni una página web pública.
- Los estudiantes solo deben acceder a la página; nunca necesitan conocer tu clave.

---

# 5. Inicia LectorLab

En Windows, haz doble clic en:

`INICIAR.bat`

Cuando aparezca algo similar a:

```text
📚 LectorLab listo en http://localhost:3000
```

abre en tu navegador:

http://localhost:3000

No abras `public/index.html` directamente con doble clic: para que la IA funcione, el RED debe abrirse a través del servidor.

---

# 6. Cómo probar que realmente usa IA

Ve hasta la etapa **“Tutor socrático”** y escribe respuestas diferentes, por ejemplo:

```text
Creo que Jordán pudo influir en lo que le ocurrió a Alicia porque era muy frío con ella.
```

LectorLab debería cuestionar la relación causal y pedir evidencia.

Luego prueba algo como:

```text
La pista que más me importa es que Alicia empeoraba después de las noches.
```

La respuesta debería cambiar y profundizar esa pista, no repetir una pregunta fija.

También puedes intentar:

```text
Dime la respuesta correcta.
```

El tutor debe negarse a resolverla y redirigirte hacia una evidencia del texto.

---

# 7. Cómo funciona el límite de 5 intervenciones

El navegador lleva la cuenta de las respuestas del estudiante y, además, el servidor valida que `turn` esté entre 1 y 5.

Después de la quinta intervención:

- LectorLab realiza un cierre metacognitivo breve.
- El cuadro de escritura se bloquea.
- El estudiante continúa hacia la evaluación final.

Esto evita que el chat se convierta en una actividad demasiado larga dentro de un RED de 20 minutos.

---

# 8. Dónde modificar la personalidad del chatbot

Abre:

`lectorlab-prompt.js`

Ahí están las reglas pedagógicas de LectorLab. Puedes cambiar su tono, dificultad, estrategias o texto de referencia sin tocar la conexión con la API.

Conviene mantener estas reglas:

- no dar respuestas finales;
- pedir evidencia;
- cuestionar el vínculo entre evidencia y conclusión;
- una pregunta principal por intervención;
- respuestas breves;
- no solicitar datos personales;
- máximo cinco intervenciones.

---

# 9. Dónde cambiar el modelo

En `.env`:

```env
OPENAI_MODEL=gpt-5.6-luna
```

El modelo está separado del código para que puedas cambiarlo sin reprogramar nada.

---

# 10. Si aparece un error

## “LectorLab todavía no tiene configurada su clave de API”

Revisa que exista el archivo `.env` y que contenga `OPENAI_API_KEY=` seguido de tu clave.

## “No se pudo conectar con LectorLab”

Comprueba:

1. que `INICIAR.bat` siga abierto;
2. que tengas conexión a internet;
3. que tu cuenta API tenga facturación/crédito disponible;
4. que la clave sea válida.

## `npm` no se reconoce como comando

Node.js no está instalado correctamente o debes cerrar y volver a abrir la terminal después de instalarlo.

---

# 11. Para usarlo con estudiantes por internet

`localhost` solo funciona en tu propia computadora. Para que tus estudiantes accedan desde sus celulares o computadoras, necesitas publicar **todo el proyecto Node.js** en un servicio de alojamiento que admita variables de entorno.

En el alojamiento deberás crear una variable secreta llamada:

```text
OPENAI_API_KEY
```

con tu clave como valor.

Nunca conviertas la clave en una variable JavaScript visible en el navegador.

---

# 12. Diseño pedagógico implementado

La secuencia conversacional no obliga a LectorLab a hacer exactamente las mismas cinco preguntas. En cambio, utiliza una política adaptativa:

1. identifica qué afirma el estudiante;
2. detecta si aporta o no evidencia;
3. pide justificar el vínculo entre pista e interpretación;
4. introduce objeciones o explicaciones alternativas cuando el razonamiento ya está avanzado;
5. conduce a una revisión metacognitiva antes de la producción final.

De este modo, dos estudiantes pueden recibir preguntas distintas aunque estén leyendo el mismo cuento.


---

# 13. Exportación de respuestas a Excel

Esta versión reemplaza la descarga en Bloc de notas por un archivo **.xlsx**.

Al terminar el RED y pulsar **“Descargar respuestas en Excel”**, el servidor genera el archivo en ese momento y lo entrega al navegador. **No se almacena una copia permanente en el servidor.**

El Excel contiene tres hojas:

1. **Resumen**: puntaje formativo, nivel lector, aciertos e información básica del recorrido.
2. **Respuestas**: respuesta inicial, seis preguntas de primer intento, hipótesis, interpretación final, evidencias y reflexión.
3. **LectorLab**: diálogo completo estudiante–tutor, organizado por turnos.

Para habilitar esta función, `package.json` incluye la dependencia `exceljs`. Si actualizas desde una versión anterior, ejecuta nuevamente:

```bash
npm install
```

o haz doble clic en `INSTALAR.bat`.
