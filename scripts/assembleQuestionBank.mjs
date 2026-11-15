import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { applyQuestionTranslations } from "../src/questionTranslations.js";
import { ADDITIONAL_QUESTIONS } from "../src/additionalQuestions.js";

const encoded = readFileSync(new URL("../public/data/question-bank.json.gz.b64", import.meta.url), "utf8").trim();
const sourceBank = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));
const translatedBank = applyQuestionTranslations(sourceBank);
const questions = [...translatedBank.questions, ...ADDITIONAL_QUESTIONS];
const distribution = Object.fromEntries(["facil", "medio", "dificil"].map((difficulty) => [
  difficulty, questions.filter((question) => question.difficulty === difficulty).length
]));
if (questions.length !== 300 || Object.values(distribution).some((count) => count !== 100)) {
  throw new Error("O banco expandido deve conter exatamente 300 perguntas, com 100 por dificuldade.");
}
const ids = questions.map((question) => question.id);
if (new Set(ids).size !== 300) throw new Error("O banco contém identificadores duplicados.");
const multilingualBank = {
  ...translatedBank,
  version: 4,
  questionCount: 300,
  distribution,
  languages: ["es", "pt", "en"],
  questions
};
writeFileSync(new URL("../public/data/question-bank.multilingual.json", import.meta.url), JSON.stringify(multilingualBank));
console.log("Banco JERICO gerado: 300 perguntas (100 por dificuldade) em espanhol, português e inglês.");
