import { LECTORLAB_PROMPT } from '../../lectorlab-prompt.js';

const originalQuestions = [
  {
    "id": "q1",
    "type": "mcq",
    "prompt": "Antes del desenlace, ¿cuál representa mejor el problema central del relato?",
    "options": [
      {
        "id": "a",
        "text": "A. Jordán causa deliberadamente la enfermedad de Alicia."
      },
      {
        "id": "b",
        "text": "B. Alicia se debilita progresivamente y nadie logra explicar con certeza la causa."
      },
      {
        "id": "c",
        "text": "C. La casa está embrujada y eso provoca la enfermedad."
      }
    ],
    "correctAnswer": "b",
    "feedback": {
      "a": "La personalidad de Jordán puede orientar una sospecha, pero el relato no demuestra que él cause la enfermedad.",
      "c": "La atmósfera de la casa es inquietante, pero eso no demuestra una causa sobrenatural.",
      "correct": "Bien. Antes del desenlace sí sabemos que Alicia empeora, pero todavía no conocemos con certeza qué lo provoca."
    }
  },
  {
    "id": "q2",
    "type": "mcq",
    "prompt": "¿Cuál de las siguientes afirmaciones es un hecho presentado por el relato y no una interpretación del lector?",
    "options": [
      {
        "id": "a",
        "text": "A. La frialdad emocional de Jordán provoca el deterioro de Alicia."
      },
      {
        "id": "b",
        "text": "B. La casa parece querer hacerle daño a Alicia."
      },
      {
        "id": "c",
        "text": "C. Los médicos no identifican una causa clara mientras Alicia se debilita."
      }
    ],
    "correctAnswer": "c",
    "feedback": {
      "a": "Esa relación causal no está demostrada; es una interpretación posible del lector.",
      "b": "El relato crea una atmósfera inquietante, pero no afirma que la casa tenga voluntad propia.",
      "correct": "Correcto. El deterioro de Alicia y la incertidumbre de los médicos aparecen expresamente en el relato."
    }
  },
  {
    "id": "q3",
    "type": "mcq",
    "prompt": "Antes de conocer el contenido del almohadón, ¿qué conclusión era la más prudente?",
    "options": [
      {
        "id": "a",
        "text": "A. Existía una causa todavía desconocida y las pistas disponibles no bastaban para identificarla."
      },
      {
        "id": "b",
        "text": "B. Jordán era responsable porque se mostraba distante."
      },
      {
        "id": "c",
        "text": "C. Alicia imaginaba sus síntomas."
      }
    ],
    "correctAnswer": "a",
    "feedback": {
      "b": "La frialdad de Jordán puede influir en nuestra impresión, pero no constituye evidencia suficiente para atribuirle la causa.",
      "c": "El texto presenta los síntomas como reales; no ofrece evidencia para afirmar que Alicia los imagine.",
      "correct": "Muy bien. Una inferencia rigurosa también reconoce los límites de lo que todavía no puede demostrarse."
    }
  },
  {
    "id": "q4",
    "type": "mcq",
    "prompt": "Después del desenlace, ¿qué detalle anterior adquiere un significado especialmente importante?",
    "options": [
      {
        "id": "a",
        "text": "A. Las paredes de la casa son blancas."
      },
      {
        "id": "b",
        "text": "B. Jordán es una persona seria y reservada."
      },
      {
        "id": "c",
        "text": "C. Alicia empeora tras las noches y no quiere que muevan el almohadón."
      }
    ],
    "correctAnswer": "c",
    "feedback": {
      "a": "Ese detalle contribuye a la ambientación, pero no se conecta de manera directa con la causa revelada.",
      "b": "La personalidad de Jordán caracteriza la relación, pero no explica la evidencia material del desenlace.",
      "correct": "Exacto. El desenlace permite releer esos detalles como pistas que antes parecían aisladas."
    }
  },
  {
    "id": "q5",
    "type": "mcq",
    "prompt": "Cuando el desenlace aporta una causa nueva, ¿qué acción representa mejor una lectura crítica?",
    "options": [
      {
        "id": "a",
        "text": "A. Revisar la interpretación anterior y volver a examinar las pistas del relato."
      },
      {
        "id": "b",
        "text": "B. Mantener la primera explicación para ser coherente con lo pensado al inicio."
      },
      {
        "id": "c",
        "text": "C. Concluir que ninguna interpretación es válida porque el final sorprende."
      }
    ],
    "correctAnswer": "a",
    "feedback": {
      "b": "Mantener una idea solo por haberla pensado primero impide valorar la nueva evidencia.",
      "c": "La sorpresa no impide interpretar; invita a reconstruir la explicación con la información nueva.",
      "correct": "Correcto. Revisar una hipótesis cuando aparece mejor evidencia es una práctica central del pensamiento crítico."
    }
  },
  {
    "id": "q6",
    "type": "mcq",
    "prompt": "¿Cuál juicio muestra una lectura más crítica del cuento?",
    "options": [
      {
        "id": "a",
        "text": "A. Si un final sorprende, entonces cualquier explicación anterior era igualmente válida."
      },
      {
        "id": "b",
        "text": "B. La atmósfera puede orientar nuestras sospechas, pero debemos distinguirla de la evidencia que demuestra una causa."
      },
      {
        "id": "c",
        "text": "C. La primera impresión del lector es más importante que la evidencia que aparece después."
      }
    ],
    "correctAnswer": "b",
    "feedback": {
      "a": "Que una explicación sea posible no significa que esté igualmente sustentada por el texto.",
      "c": "Una primera impresión puede ser útil como hipótesis, pero debe revisarse si aparece evidencia más sólida.",
      "correct": "Muy bien. El cuento muestra por qué debemos distinguir aquello que orienta nuestras expectativas de aquello que realmente sustenta una conclusión."
    }
  }
];

/** Original reading/questions preserved as a private, reviewable teacher draft. */
export function seedActivity() {
  const readingText = LECTORLAB_PROMPT.split('TEXTO DE REFERENCIA DEL RED\n')[1].trim().normalize('NFC');
  const quotes = [
    'Los médicos la examinaban sin encontrar una explicación clara.',
    'Los médicos la examinaban sin encontrar una explicación clara.',
    'Los médicos seguían desconcertados porque los síntomas no parecían tener una causa evidente.',
    'Algunos días parecía recuperarse un poco y, a la mañana siguiente, volvía a encontrarse agotada.',
    'Lo que antes parecían hechos aislados formaba ahora una explicación.',
    'Al abrirlo descubrieron, escondido entre las plumas, un enorme parásito.',
  ];
  const reasons = [
    'La incertidumbre médica distingue el deterioro observado de una causa todavía no demostrada.',
    'El examen sin explicación clara es un hecho narrado, a diferencia de las atribuciones causales del lector.',
    'La falta de causa evidente sostiene reconocer incertidumbre en lugar de atribuir responsabilidad sin prueba.',
    'El agotamiento al despertar puede reinterpretarse al conocer la causa que actúa durante las noches.',
    'La explicación nueva relaciona indicios antes aislados y permite revisar la hipótesis previa.',
    'El hallazgo material proporciona una causa frente a las sospechas construidas solo por la atmósfera.',
  ];
  return {
    title: 'Más allá de las palabras', readingText,
    instructions: 'Lee, distingue hechos e inferencias, formula una hipótesis y explica cómo las evidencias sostienen o cambian tu interpretación. El tutor acompaña sin resolver por ti.',
    source: { filename: 'LectorLab_RESPALDO_PORTATIL_2026-09-24.zip', author: 'Adaptación pedagógica a partir de Horacio Quiroga', license: 'Revisar procedencia y derechos para el uso docente.' },
    questions: originalQuestions.map((question, index) => {
      const quote = quotes[index];
      const offset = readingText.indexOf(quote);
      const start = [...readingText.slice(0, offset)].length;
      return { ...question, rubric: 'Distingue evidencia textual de interpretación y revisa la atribución causal.', evidence: [{ quote, start, end: start + [...quote].length, reason: reasons[index] }] };
    }),
  };
}
