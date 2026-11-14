import React, { useEffect, useMemo, useState } from 'react';

const SCENES = [
  {name:'Egipto', icon:'𓂀', tone:'egypt', detail:'Las tierras del faraón'},
  {name:'Mar Rojo', icon:'🌊', tone:'sea', detail:'El camino entre las aguas'},
  {name:'Monte Sinaí', icon:'⛰', tone:'sinai', detail:'La montaña de Dios'},
  {name:'Río Jordán', icon:'🌿', tone:'jordan', detail:'Cruza hacia la promesa'},
  {name:'Jericó', icon:'🏰', tone:'jericho', detail:'La ciudad fortificada'}
];
const CHARACTERS = [
  {id:'warrior',name:'Guerrero',emoji:'🛡️',desc:'Túnica y escudo'},
  {id:'soldier',name:'Soldado',emoji:'⚔️',desc:'Armadura y escudo'},
  {id:'trumpeter',name:'Trompetista',emoji:'📯',desc:'Túnica y shofar'},
  {id:'woman',name:'Mujer israelita',emoji:'🏺',desc:'Vestido y cántaro'}
];
const QUESTIONS = {
  facil:[
    ['¿Quién construyó el arca por mandato de Dios?',['Abraham','Noé','Moisés','David'],1,'Génesis 6:13-14'],
    ['¿Quién fue tragado por un gran pez?',['Jonás','Pedro','Elías','Pablo'],0,'Jonás 1:17'],
    ['¿Quién derrotó al gigante Goliat?',['Saúl','Salomón','David','Josué'],2,'1 Samuel 17:49-50'],
    ['¿En qué ciudad nació Jesús?',['Nazaret','Belén','Jerusalén','Jericó'],1,'Mateo 2:1'],
    ['¿Quién recibió los Diez Mandamientos?',['Aarón','Josué','Moisés','Noé'],2,'Éxodo 31:18']
  ],
  medio:[
    ['¿Cuántos hombres escogió Gedeón para su ejército?',['100','300','500','1.000'],1,'Jueces 7:7'],
    ['¿Qué reina visitó a Salomón para probarlo con preguntas?',['Ester','La reina de Sabá','Jezabel','Vasti'],1,'1 Reyes 10:1'],
    ['¿Quién interpretó los sueños del faraón?',['Daniel','José','Moisés','Aarón'],1,'Génesis 41:15-16'],
    ['¿En qué isla naufragó Pablo?',['Creta','Chipre','Malta','Patmos'],2,'Hechos 28:1'],
    ['¿Quién sucedió a Moisés como líder de Israel?',['Caleb','Aarón','Josué','Eleazar'],2,'Josué 1:1-2']
  ],
  dificil:[
    ['¿Qué juez hizo un voto imprudente antes de luchar contra los amonitas?',['Sansón','Jefté','Gedeón','Barac'],1,'Jueces 11:30-35'],
    ['¿Cómo se llamaba el padre de Betsabé?',['Ahitofel','Eliam','Abner','Sadoc'],1,'2 Samuel 11:3'],
    ['¿Qué rey de Judá encontró el libro de la ley durante la reparación del templo?',['Ezequías','Josías','Uzías','Manasés'],1,'2 Reyes 22:8'],
    ['¿Quién era el sumo sacerdote cuando Samuel era niño?',['Elí','Abiatar','Sadoc','Aarón'],0,'1 Samuel 1:9'],
    ['¿En qué ciudad estaban Pablo y Silas cuando cantaron en la cárcel?',['Éfeso','Corinto','Filipos','Tesalónica'],2,'Hechos 16:12,25']
  ]
};
const LEVELS = [{id:'facil',label:'Fácil',steps:1},{id:'medio',label:'Medio',steps:2},{id:'dificil',label:'Difícil',steps:3}];
const shuffle = a => [...a].sort(()=>Math.random()-.5);
function App(){
 const [screen,setScreen]=useState('menu');
 const [lang,setLang]=useState('Español');
 const [sound,setSound]=useState(true);
 const [music,setMusic]=useState(true);
 const [count,setCount]=useState(2);
 const [names,setNames]=useState(['Jugador 1','Jugador 2','Jugador 3','Jugador 4']);
 const [chosen,setChosen]=useState([]);
 const [players,setPlayers]=useState([]);
 const [turn,setTurn]=useState(0);
 const [level,setLevel]=useState(null);
 const [question,setQuestion]=useState(null);
 const [answer,setAnswer]=useState(null);
 const [feedback,setFeedback]=useState(null);
 const [used,setUsed]=useState({facil:[],medio:[],dificil:[]});
 const [winner,setWinner]=useState(null);
 const [mapIntro,setMapIntro]=useState(false);
 const [wallFrame,setWallFrame]=useState(0);
 const [showBible,setShowBible]=useState(false);
 const active=players[turn];
 const startSetup=()=>{setNames(['Jugador 1','Jugador 2','Jugador 3','Jugador 4']);setChosen([]);setScreen('setup')};
 const chooseCharacter=(id)=>{if(chosen.includes(id))return;setChosen([...chosen,id]);};
 const begin=()=>{const ps=names.slice(0,count).map((name,i)=>({name:name.trim(),character:CHARACTERS.find(c=>c.id===chosen[i]),steps:0}));setPlayers(ps);setTurn(0);setUsed({facil:[],medio:[],dificil:[]});setWinner(null);setMapIntro(true);setScreen('map');setTimeout(()=>{setMapIntro(false);setScreen('board')},3000)};
 const pickLevel=(l)=>{setLevel(l);const pool=QUESTIONS[l.id];let unused=pool.map((_,i)=>i).filter(i=>!used[l.id].includes(i));if(!unused.length){unused=pool.map((_,i)=>i);setUsed(u=>({...u,[l.id]:[]}));}const idx=shuffle(unused)[0];setUsed(u=>({...u,[l.id]:[...u[l.id],idx]}));const q=pool[idx];const opts=shuffle(q[1].map((v,i)=>({text:v,correct:i===q[2]})));setQuestion({text:q[0],options:opts,reference:q[3],steps:l.steps});setAnswer(null);setScreen('question')};
 const respond=()=>{const ok=question.options[answer]?.correct;const next=players.map((p,i)=>i===turn?{...p,steps:Math.min(30,p.steps+(ok?question.steps:0))}:p);setPlayers(next);setFeedback({ok,steps:ok?question.steps:0});setScreen('feedback');setTimeout(()=>{setFeedback(null);if(ok&&next[turn].steps>=30){setWinner(next[turn]);setScreen('collapse');setWallFrame(0);}else{setTurn((turn+1)%players.length);setScreen('board')}},4000)};
 useEffect(()=>{if(screen!=='collapse')return;let f=0;const id=setInterval(()=>{f++;setWallFrame(f);if(f>=5){clearInterval(id);setScreen('story')}},950);return()=>clearInterval(id)},[screen]);
 const reset=()=>{setScreen('menu');setPlayers([]);setWinner(null);setChosen([])};
 const positions=useMemo(()=>players.map(p=>Math.min(100,p.steps/30*100)),[players]);
 return <main className="game-shell">
  <header className="topbar"><div className="brand-mark">J</div><div><div className="brand">JERICO</div><div className="subtitle">CAMINO A JERICÓ</div></div><div className="top-spacer"/><button className="tiny" onClick={()=>setScreen('settings')}>⚙</button></header>
  {screen==='menu'&&<section className="hero scene-jericho"><div className="hero-shade"/><div className="hero-content"><p className="eyebrow">UNA AVENTURA BÍBLICA</p><h1>JERICO</h1><p className="hero-sub">Camino a Jericó</p><div className="gold-line"/><button className="primary" onClick={startSetup}>Iniciar juego <span>▶</span></button><button className="secondary" onClick={()=>setScreen('instructions')}>Cómo jugar</button><button className="secondary" onClick={()=>setScreen('settings')}>Configuración</button></div><div className="hero-bottom">UNA HISTORIA DE FE · VALOR · OBEDIENCIA</div></section>}
  {screen==='instructions'&&<section className="panel parchment"><h2>Cómo jugar</h2><p>¡Prepárate para recorrer el camino hacia Jericó! Responde preguntas bíblicas para avanzar por cinco escenarios.</p><ol><li>Participan de 1 a 4 jugadores.</li><li>Cada jugador elige un personaje diferente.</li><li>En cada turno elige la dificultad: Fácil avanza 1 paso, Medio 2 y Difícil 3.</li><li>Si respondes incorrectamente, no avanzas.</li><li>El primer jugador que llegue a 30 pasos conquista Jericó y gana la partida.</li></ol><button className="primary" onClick={()=>setScreen('menu')}>Volver al menú</button></section>}
  {screen==='settings'&&<section className="panel parchment"><h2>Configuración</h2><label>Idioma<select value={lang} onChange={e=>setLang(e.target.value)}><option>Español</option><option>Português</option><option>English</option></select></label><label className="switch-row">Efectos de sonido <input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)}/></label><label className="switch-row">Música <input type="checkbox" checked={music} onChange={e=>setMusic(e.target.checked)}/></label><p className="small">JERICO — Camino a Jericó · Proyecto educativo</p><button className="primary" onClick={()=>setScreen('menu')}>Guardar y volver</button></section>}
  {screen==='setup'&&<section className="panel parchment"><p className="eyebrow">PREPARA TU PARTIDA</p><h2>¿Cuántos jugadores?</h2><div className="player-count">{[1,2,3,4].map(n=><button key={n} className={count===n?'count active':'count'} onClick={()=>setCount(n)}>{n}</button>)}</div><h3>Nombres de los jugadores</h3><div className="name-grid">{names.slice(0,count).map((n,i)=><label key={i}>Jugador {i+1}<input maxLength="12" value={n} onChange={e=>setNames(v=>v.map((x,j)=>j===i?e.target.value:x))}/></label>)}</div><button className="primary" disabled={names.slice(0,count).some(n=>!n.trim())} onClick={()=>{setChosen([]);setScreen('characters')}}>Siguiente</button></section>}
  {screen==='characters'&&<section className="panel parchment"><p className="eyebrow">SELECCIÓN DE PERSONAJES</p><h2>{chosen.length<count?names[chosen.length]:'¡Listos para partir!'}</h2><p>Elige un personaje distinto para cada jugador ({chosen.length}/{count}).</p><div className="character-grid">{CHARACTERS.map(c=><button key={c.id} disabled={chosen.includes(c.id)} className={'character '+(chosen.includes(c.id)?'locked':'')} onClick={()=>chooseCharacter(c.id)}><span className="character-emoji">{c.emoji}</span><b>{c.name}</b><small>{c.desc}</small></button>)}</div>{chosen.length===count?<button className="primary" onClick={begin}>Comenzar aventura</button>:<p className="hint">Selecciona {count-chosen.length} personaje(s) más.</p>}<button className="text-button" onClick={()=>setScreen('setup')}>Volver</button></section>}
  {screen==='map'&&<section className="map-screen"><p className="eyebrow">EL CAMINO A LA PROMESA</p><h2>De Egipto a Jericó</h2><div className="map-route">{SCENES.map((s,i)=><div className="map-stop" key={s.name}><span>{s.icon}</span><b>{s.name}</b><small>6 pasos</small>{i<4&&<i/>}</div>)}</div><p>La aventura comienza...</p></section>}
  {screen==='board'&&<section className="board scene-board"><div className="board-head"><div><p className="eyebrow">TURNO DE {active?.name?.toUpperCase()}</p><h2>{SCENES[Math.min(4,Math.floor(active.steps/6))].name}</h2></div><div className="turn-avatar">{active?.character?.emoji}</div></div><div className="scene-track"><div className="track-sky"/><div className="track-ground"/><div className="track-city">🏰</div><div className="track-path">{SCENES.map((s,i)=><div className="track-stage" key={s.name}><span>{s.icon}</span><b>{s.name}</b><small>0–{(i+1)*6}</small></div>)}</div>{players.map((p,i)=><div className="player-token" key={p.name} style={{left:`calc(${Math.max(2,Math.min(96,positions[i]))}% )`,bottom:`${i*43+16}px`}} title={p.name}><span>{p.character.emoji}</span></div>)}</div><div className="player-progress">{players.map((p,i)=><div className={'progress-card '+(i===turn?'current':'')} key={p.name}><span>{p.character.emoji}</span><div><b>{p.name}</b><small>{p.steps}/30 pasos · {SCENES[Math.min(4,Math.floor(p.steps/6))].name}</small><div className="meter"><i style={{width:positions[i]+'%'}}/></div></div></div>)}</div><div className="turn-actions"><p>Elige la dificultad para responder una pregunta bíblica.</p><div className="difficulty">{LEVELS.map(l=><button key={l.id} onClick={()=>pickLevel(l)}><b>{l.label}</b><small>+{l.steps} paso{l.steps>1?'s':''}</small></button>)}</div></div></section>}
  {screen==='question'&&<section className="panel question-panel"><p className="eyebrow">{level.label.toUpperCase()} · {level.steps} PASO(S) EN JUEGO</p><h2>{question.text}</h2><div className="answers">{question.options.map((o,i)=><button key={i} className={answer===i?'answer selected':''} onClick={()=>setAnswer(i)}><span>{String.fromCharCode(65+i)}</span>{o.text}</button>)}</div><p className="reference">Referencia: {question.reference}</p><button className="primary" disabled={answer===null} onClick={respond}>Responder</button></section>}
  {screen==='feedback'&&<div className="modal-backdrop"><div className={'feedback-card '+(feedback?.ok?'good':'bad')}><div className="feedback-icon">{feedback?.ok?'✦':'×'}</div><h2>{feedback?.ok?'¡Respuesta correcta!':'¡Respuesta incorrecta!'}</h2><p>{feedback?.ok?`Avanzas +${feedback.steps} paso(s)`:'No avanzas'}</p></div></div>}
  {screen==='collapse'&&<section className="collapse-screen"><p className="eyebrow">¡EL PUEBLO HA GRITADO!</p><h2>¡Las murallas caen!</h2><div className="wall-scene"><div className="wall-sky"/><div className={'wall wall-'+wallFrame}>🏰</div><div className="celebrators">{players.map(p=><span key={p.name}>{p.character.emoji} 🙌</span>)}</div><div className="dust">✦　·　✧　·　✦</div></div><p>Jericó ha sido conquistada</p></section>}
  {screen==='story'&&<section className="panel parchment story-panel"><p className="eyebrow">LA PROMESA SE CUMPLIÓ</p><h2>La conquista de Jericó</h2><div className="scripture"><p><strong>1</strong> Las puertas de Jericó estaban bien aseguradas por temor a los israelitas; nadie podía salir o entrar.</p><p><strong>2</strong> Pero el Señor dijo a Josué: «¡He entregado en tus manos a Jericó y a su rey con sus guerreros! <strong>3</strong> Tú y tus soldados marcharán una vez alrededor de la ciudad; así lo harán durante seis días. <strong>4</strong> Siete sacerdotes llevarán trompetas y marcharán frente al arca. El séptimo día ustedes marcharán siete veces alrededor de la ciudad, mientras los sacerdotes tocan las trompetas. <strong>5</strong> Cuando todos escuchen el toque de trompeta, el pueblo deberá gritar a voz en cuello. Entonces los muros de la ciudad se derrumbarán y cada uno entrará sin impedimento».</p></div><b className="scripture-ref">Josué 6:1–5</b><button className="primary" onClick={()=>setScreen('victory')}>Continuar</button></section>}
  {screen==='victory'&&<section className="victory-screen"><div className="victory-crown">♛</div><p className="eyebrow">LA CONQUISTA HA TERMINADO</p><h1>¡Felicidades!</h1><h2>{winner?.name}</h2><p className="winner-copy">Has conquistado Jericó</p><div className="bible-art">📖</div><div className="invite"><b>Gracias por participar.</b><p>Te invitamos a ti y a todos los jugadores a seguir conociendo la Biblia, leyendo cada día la Palabra de Dios.</p></div><button className="primary" onClick={reset}>Volver al menú</button></section>}
 </main>
}
export default App;
