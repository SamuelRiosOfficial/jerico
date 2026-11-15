import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateQuestionBank, selectQuestionForTurn } from '../src/gameEngine.js';
const loadBank=()=>JSON.parse(readFileSync(new URL('../public/data/question-bank.multilingual.json',import.meta.url),'utf8'));
test('o banco multilingue contém 300 perguntas e 100 por dificuldade',()=>{
 const bank=loadBank();
 assert.equal(bank.version,4);
 assert.deepEqual(bank.languages,['es','pt','en']);
 assert.equal(bank.questionCount,300);
 assert.deepEqual(validateQuestionBank(bank),{facil:100,medio:100,dificil:100});
 assert.deepEqual(bank.distribution,{facil:100,medio:100,dificil:100});
 assert.equal(bank.randomizeQuestionOrder,true);
 assert.equal(bank.randomizeAnswerOrder,true);
 assert.equal(bank.noRepeatUntilDifficultyPoolExhausted,true);
 assert.equal(bank.poolScope,'shared_by_all_players_in_the_same_game');
});
test('as 300 perguntas têm traduções completas, quatro opções e IDs únicos',()=>{
 const bank=loadBank(); const ids=bank.questions.map(q=>q.id);
 assert.equal(new Set(ids).size,300);
 for(const q of bank.questions) for(const lang of ['pt','en']){
  assert.ok(q.translations[lang].question);
  assert.equal(q.translations[lang].options.length,4);
  assert.equal(new Set(q.translations[lang].options).size,4);
  assert.equal(q.translations[lang].biblicalReference.length>0,true);
  assert.equal(q.translations[lang].options[q.correctAnswerIndex].trim().length>0,true);
 }
});
test('a seleção devolve pergunta, opções e referência no idioma solicitado',()=>{
 const bank=loadBank(); const q=bank.questions.find(item=>item.difficulty==='facil');
 const r=selectQuestionForTurn([q],'facil',{facil:[],medio:[],dificil:[]},()=>0,'en');
 assert.equal(r.question.question,q.translations.en.question);
 assert.equal(r.question.biblicalReference,q.translations.en.biblicalReference);
 assert.equal(r.options.find(x=>x.correct).text,q.translations.en.options[q.correctAnswerIndex]);
});
test('a seleção conserva as 100 perguntas de cada grupo sem repetições dentro do ciclo',()=>{
 const bank=loadBank().questions.filter(q=>q.difficulty==='dificil');
 let used={facil:[],medio:[],dificil:[]}; const chosen=new Set();
 for(let i=0;i<100;i++){
  const r=selectQuestionForTurn(bank,'dificil',used,()=>0.37,'pt');
  assert.equal(chosen.has(r.question.id),false);
  chosen.add(r.question.id); used=r.usedIds;
 }
 assert.equal(chosen.size,100);
 assert.equal(used.dificil.length,100);
 const restarted=selectQuestionForTurn(bank,'dificil',used,()=>0.37,'pt');
 assert.equal(restarted.cycleRestarted,true);
});
