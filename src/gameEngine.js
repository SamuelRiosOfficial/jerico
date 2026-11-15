export const DIFFICULTY_STEPS = Object.freeze({ facil: 1, medio: 2, dificil: 3 });
export const TOTAL_STEPS = 30;
export const STEPS_PER_SCENE = 6;
export const SCENE_COUNT = 5;

const JOURNEY_MAP_NODES = Object.freeze([
  Object.freeze({ x: 10.8, y: 50.2 }),
  Object.freeze({ x: 30.5, y: 53.5 }),
  Object.freeze({ x: 49.4, y: 49.4 }),
  Object.freeze({ x: 69.1, y: 45.7 }),
  Object.freeze({ x: 80.5, y: 40.6 }),
  Object.freeze({ x: 85.0, y: 35.2 })
]);

/** Returns an independently animated position along the illustrated route (0–30 steps). */
export function getJourneyMapPosition(steps) {
  const safeSteps = Number.isFinite(steps) ? Math.max(0, Math.min(TOTAL_STEPS, steps)) : 0;
  const segment = Math.min(SCENE_COUNT - 1, Math.floor(safeSteps / STEPS_PER_SCENE));
  const progress = (safeSteps - segment * STEPS_PER_SCENE) / STEPS_PER_SCENE;
  const start = JOURNEY_MAP_NODES[segment];
  const end = JOURNEY_MAP_NODES[segment + 1];
  return {
    x: Number((start.x + (end.x - start.x) * progress).toFixed(2)),
    y: Number((start.y + (end.y - start.y) * progress).toFixed(2))
  };
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function validateQuestionBank(bank) {
  if (!bank || bank.questionCount !== 120 || !Array.isArray(bank.questions) || bank.questions.length !== 120) {
    throw new Error('El banco debe contener exactamente 120 preguntas.');
  }

  const counts = { facil: 0, medio: 0, dificil: 0 };
  const ids = new Set();

  for (const question of bank.questions) {
    const id = typeof question?.id === 'string' ? question.id.trim() : '';
    if (!id || ids.has(id)) throw new Error(`La pregunta ${id || 'sin ID'} tiene un identificador vacío o duplicado.`);
    ids.add(id);

    if (!Object.hasOwn(counts, question.difficulty)) throw new Error('Hay una pregunta con dificultad desconocida.');
    counts[question.difficulty] += 1;

    const validOptions = Array.isArray(question.options) &&
      question.options.length === 4 &&
      question.options.every((option) => typeof option === 'string' && option.trim().length > 0) &&
      new Set(question.options.map((option) => option.trim())).size === 4;
    const validIndex = Number.isInteger(question.correctAnswerIndex) &&
      question.correctAnswerIndex >= 0 && question.correctAnswerIndex < 4;
    const validText = typeof question.question === 'string' && question.question.trim().length > 0;
    const validReference = typeof question.biblicalReference === 'string' && question.biblicalReference.trim().length > 0;
    const answerMatches = question.correctAnswer === undefined ||
      (validIndex && question.correctAnswer === question.options[question.correctAnswerIndex]);
    const validTranslations = !bank.languages?.includes('pt') ||
      ['pt', 'en'].every((language) => {
        const translation = question.translations?.[language];
        return typeof translation?.question === 'string' && translation.question.trim().length > 0 &&
          typeof translation?.biblicalReference === 'string' && translation.biblicalReference.trim().length > 0 &&
          Array.isArray(translation.options) && translation.options.length === 4 &&
          translation.options.every((option) => typeof option === 'string' && option.trim().length > 0) &&
          new Set(translation.options.map((option) => option.trim())).size === 4;
      });
    if (!validText || !validOptions || !validIndex || !validReference || !answerMatches || !validTranslations) {
      throw new Error(`La pregunta ${id} no tiene una estructura válida o su respuesta correcta no coincide.`);
    }
  }

  if (counts.facil !== 40 || counts.medio !== 40 || counts.dificil !== 40) {
    throw new Error('El banco debe incluir 40 preguntas por dificultad.');
  }
  return counts;
}

export function nextAvailableCharacter(currentIndex, direction, selectedIndices, characterCount = 4) {
  if (!Number.isInteger(characterCount) || characterCount < 1) return currentIndex;
  const step = direction < 0 ? -1 : 1;
  for (let offset = 1; offset <= characterCount; offset += 1) {
    const candidate = (currentIndex + step * offset + characterCount) % characterCount;
    if (!selectedIndices.includes(candidate)) return candidate;
  }
  return currentIndex;
}

export function selectQuestionForTurn(bank, difficulty, usedIds, random = Math.random, language = 'es') {
  const pool = bank.filter((question) => question.difficulty === difficulty);
  if (!pool.length) throw new Error(`No hay preguntas para la dificultad ${difficulty}.`);
  const alreadyUsed = usedIds[difficulty] || [];
  const unused = pool.filter((question) => !alreadyUsed.includes(question.id));
  const cycleRestarted = unused.length === 0;
  const selected = shuffle(cycleRestarted ? pool : unused, random)[0];
  const nextUsedIds = {
    ...usedIds,
    [difficulty]: [...(cycleRestarted ? [] : alreadyUsed), selected.id]
  };
  const localized = language === 'es' ? selected : selected.translations?.[language];
  if (!localized) throw new Error(`No existe traducción para el idioma ${language}.`);
  const displayQuestion = language === 'es' ? selected : {
    ...selected, question: localized.question, options: localized.options,
    correctAnswer: localized.options[selected.correctAnswerIndex],
    biblicalReference: localized.biblicalReference
  };
  const options = shuffle(displayQuestion.options.map((text, index) => ({
    text, correct: index === selected.correctAnswerIndex
  })), random);
  return { question: displayQuestion, options, usedIds: nextUsedIds, cycleRestarted };
}

export function resolveAnswer(currentSteps, isCorrect, awardedSteps) {
  const safeAward = Number.isInteger(awardedSteps) && awardedSteps > 0 ? awardedSteps : 0;
  const steps = Math.max(0, Math.min(TOTAL_STEPS, currentSteps + (isCorrect ? safeAward : 0)));
  return { steps, won: isCorrect && steps >= TOTAL_STEPS };
}

export function sceneIndexForStep(steps) {
  return Math.max(0, Math.min(SCENE_COUNT - 1, Math.floor(Math.max(0, steps) / STEPS_PER_SCENE)));
}
