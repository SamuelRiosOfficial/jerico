import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { applyQuestionTranslations } from "../src/questionTranslations.js";
const encoded = readFileSync(new URL("../public/data/question-bank.json.gz.b64", import.meta.url), "utf8").trim();
const bank = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));
const localized = applyQuestionTranslations(bank);
writeFileSync(new URL("../public/data/question-bank.multilingual.json", import.meta.url), JSON.stringify(localized));
console.log("Banco JERICO atualizado: 120 perguntas em espanhol, português e inglês.");
