import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateQuestionBank, selectQuestionForTurn } from '../src/gameEngine.js';
const loadBank=()=>JSON.parse(readFileSync(new URL('../public/data/question-bank.multilingual.json',import.meta.url),'utf8'));
test('o banco multilingue contém 120 perguntas e a distribuição aprovada',()=>{
 const bank=loadBank();
 assert.equal(bank.version,3);
 assert.deepEqual(bank.languages,['es','pt','en']);
 assert.equal(bank.questionCount,120);
 assert.deepEqual(validateQuestionBank(bank),{facil:40,medio:40,dificil:40});
 assert.equal(bank.randomizeQuestionOrder,true);
 assert.equal(bank.randomizeAnswerOrder,true);
 assert.equal(bank.noRepeatUntilDifficultyPoolExhausted,true);
 assert.equal(bank.poolScope,'shared_by_all_players_in_the_same_game');
});
test('as 120 perguntas têm traduções completas e preservam a opção correta',()=>{
 const bank=loadBank(); const ids=bank.questions.map(q=>q.id);
 assert.equal(new Set(ids).size,120);
 for(const q of bank.questions) for(const lang of ['pt','en']){
  assert.ok(q.translations[lang].question);
  assert.equal(q.translations[lang].options.length,4);
  assert.equal(q.translations[lang].biblicalReference.length>0,true);
  assert.equal(q.translations[lang].options[q.correctAnswerIndex].trim().length>0,true);
 }
});
test('a seleção devolve pergunta, opções e referência no idioma solicitado',()=>{
 const bank=loadBank(); const q=bank.questions[0];
 const r=selectQuestionForTurn(bank.questions,q.difficulty,{facil:[],medio:[],dificil:[]},()=>0,'en');
 assert.equal(r.question.question,q.translations.en.question);
 assert.equal(r.question.biblicalReference,q.translations.en.biblicalReference);
 assert.equal(r.options.find(x=>x.correct).text,q.translations.en.options[q.correctAnswerIndex]);
});
