export const DIFFICULTY_STEPS = Object.freeze({ facil: 1, medio: 2, dificil: 3 });
export const TOTAL_STEPS = 30;
export const STEPS_PER_SCENE = 6;
export const SCENE_COUNT = 5;

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

    if (!validText || !validOptions || !validIndex || !validReference || !answerMatches) {
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

export function selectQuestionForTurn(bank, difficulty, usedIds, random = Math.random) {
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
  const options = shuffle(selected.options.map((text, index) => ({
    text,
    correct: index === selected.correctAnswerIndex
  })), random);
  return { question: selected, options, usedIds: nextUsedIds, cycleRestarted };
}

export function resolveAnswer(currentSteps, isCorrect, awardedSteps) {
  const safeAward = Number.isInteger(awardedSteps) && awardedSteps > 0 ? awardedSteps : 0;
  const steps = Math.max(0, Math.min(TOTAL_STEPS, currentSteps + (isCorrect ? safeAward : 0)));
  return { steps, won: isCorrect && steps >= TOTAL_STEPS };
}

export function sceneIndexForStep(steps) {
  return Math.max(0, Math.min(SCENE_COUNT - 1, Math.floor(Math.max(0, steps) / STEPS_PER_SCENE)));
}
