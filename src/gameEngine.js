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
  for (const question of bank.questions) {
    if (!Object.hasOwn(counts, question.difficulty)) throw new Error('Hay una pregunta con dificultad desconocida.');
    counts[question.difficulty] += 1;
    if (!question.id || !question.question || !Array.isArray(question.options) || question.options.length !== 4 ||
        !Number.isInteger(question.correctAnswerIndex) || question.correctAnswerIndex < 0 ||
        question.correctAnswerIndex > 3 || !question.biblicalReference) {
      throw new Error(`La pregunta ${question.id || 'sin ID'} no tiene una estructura válida.`);
    }
  }
  if (counts.facil !== 40 || counts.medio !== 40 || counts.dificil !== 40) {
    throw new Error('El banco debe incluir 40 preguntas por dificultad.');
  }
  return counts;
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
