import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { applyQuestionTranslations } from "../src/questionTranslations.js";
import { ADDITIONAL_QUESTIONS } from "../src/additionalQuestions.js";
import { EXPANDED_BIBLE_QUESTION_PACKS } from "../src/questionPacks/index.js";

const DIFFICULTIES = ["facil", "medio", "dificil"];
const PREFIX = { facil: "F", medio: "M", dificil: "D" };
const expectedBookCounts = 50;
const expectedExpandedDistribution = { facil: 200, medio: 200, dificil: 200 };

const encoded = readFileSync(new URL("../public/data/question-bank.json.gz.b64", import.meta.url), "utf8").trim();
const sourceBank = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));
const translatedBank = applyQuestionTranslations(sourceBank);
const existingQuestions = [...translatedBank.questions, ...ADDITIONAL_QUESTIONS];

if (EXPANDED_BIBLE_QUESTION_PACKS.length !== 12) {
  throw new Error("El banco debe integrar exactamente los doce libros solicitados.");
}

const bookDistribution = {};
const nextIds = { facil: 101, medio: 101, dificil: 101 };
const expandedDistribution = { facil: 0, medio: 0, dificil: 0 };
const expandedQuestions = [];

for (const pack of EXPANDED_BIBLE_QUESTION_PACKS) {
  if (!pack.book || !Array.isArray(pack.rows) || pack.rows.length !== expectedBookCounts) {
    throw new Error(`El paquete ${pack.book || "(sin nombre)"} debe contener 50 preguntas.`);
  }
  if (bookDistribution[pack.book]) {
    throw new Error(`El libro ${pack.book} está duplicado en los paquetes.`);
  }
  bookDistribution[pack.book] = pack.rows.length;

  for (const row of pack.rows) {
    if (!Array.isArray(row) || row.length !== 11) {
      throw new Error(`Una pregunta de ${pack.book} no tiene los once campos requeridos.`);
    }
    const [difficulty, questionEs, questionPt, questionEn, optionsEs, optionsPt, optionsEn, correctAnswerIndex, refEs, refPt, refEn] = row;
    if (!DIFFICULTIES.includes(difficulty)) {
      throw new Error(`Dificultad no válida en ${pack.book}: ${difficulty}`);
    }
    for (const [language, question, options, reference] of [
      ["es", questionEs, optionsEs, refEs],
      ["pt", questionPt, optionsPt, refPt],
      ["en", questionEn, optionsEn, refEn]
    ]) {
      if (typeof question !== "string" || !question.trim() ||
          !Array.isArray(options) || options.length !== 4 ||
          options.some((option) => typeof option !== "string" || !option.trim()) ||
          new Set(options).size !== 4 ||
          typeof reference !== "string" || !reference.trim()) {
        throw new Error(`Pregunta incompleta o con opciones inválidas en ${pack.book} (${language}).`);
      }
    }
    if (!Number.isInteger(correctAnswerIndex) || correctAnswerIndex < 0 || correctAnswerIndex > 3) {
      throw new Error(`Índice de respuesta correcta inválido en ${pack.book}.`);
    }

    const id = `${PREFIX[difficulty]}${String(nextIds[difficulty]++).padStart(3, "0")}`;
    expandedDistribution[difficulty] += 1;
    expandedQuestions.push({
      id,
      difficulty,
      book: pack.book,
      question: questionEs,
      options: optionsEs,
      correctAnswerIndex,
      correctAnswer: optionsEs[correctAnswerIndex],
      biblicalReference: refEs,
      translations: {
        pt: {
          question: questionPt,
          options: optionsPt,
          correctAnswer: optionsPt[correctAnswerIndex],
          biblicalReference: refPt
        },
        en: {
          question: questionEn,
          options: optionsEn,
          correctAnswer: optionsEn[correctAnswerIndex],
          biblicalReference: refEn
        }
      }
    });
  }
}

if (Object.values(bookDistribution).some((count) => count !== expectedBookCounts)) {
  throw new Error("Cada uno de los doce libros debe aportar exactamente 50 preguntas.");
}
if (Object.entries(expectedExpandedDistribution).some(([difficulty, expected]) => expandedDistribution[difficulty] !== expected)) {
  throw new Error(`La ampliación debe aportar 200 preguntas por dificultad. Recibido: ${JSON.stringify(expandedDistribution)}`);
}

const questions = [...existingQuestions, ...expandedQuestions];
const distribution = Object.fromEntries(DIFFICULTIES.map((difficulty) => [
  difficulty,
  questions.filter((question) => question.difficulty === difficulty).length
]));
if (questions.length !== 900 || Object.values(distribution).some((count) => count !== 300)) {
  throw new Error(`El banco debe contener 900 preguntas con 300 por dificultad. Recibido: ${JSON.stringify(distribution)}`);
}
const ids = questions.map((question) => question.id);
if (new Set(ids).size !== 900) throw new Error("El banco contiene identificadores duplicados.");

const multilingualBank = {
  ...translatedBank,
  version: 5,
  questionCount: 900,
  distribution,
  languages: ["es", "pt", "en"],
  expandedQuestionCount: expandedQuestions.length,
  bookDistribution,
  questions
};
writeFileSync(new URL("../public/data/question-bank.multilingual.json", import.meta.url), JSON.stringify(multilingualBank));
console.log("Banco JERICO generado: 900 preguntas (300 por dificultad), incluidas 600 preguntas nuevas de doce libros, en español, portugués e inglés.");
