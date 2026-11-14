import React, { useEffect, useMemo, useRef, useState } from 'react';
import './style.css';
import { validateQuestionBank, selectQuestionForTurn, resolveAnswer, sceneIndexForStep, nextAvailableCharacter } from './gameEngine.js';

const ASSET = (name) => `${import.meta.env.BASE_URL}assets/${name}`;
const DATA = (name) => `${import.meta.env.BASE_URL}data/${name}`;

const SCENES = [
  { name: 'Egipto', asset: 'stage-egypt.webp', detail: 'Las tierras del faraón' },
  { name: 'Mar Rojo', asset: 'stage-red-sea.webp', detail: 'El camino entre las aguas' },
  { name: 'Monte Sinaí', asset: 'stage-sinai.webp', detail: 'La montaña de Dios' },
  { name: 'Río Jordán', asset: 'stage-jordan.webp', detail: 'Cruza hacia la promesa' },
  { name: 'Jericó', asset: 'stage-jericho.webp', detail: 'La ciudad fortificada' }
];
const CHARACTERS = [
  { id: 'warrior', name: 'Guerrero', description: 'Túnica, lanza y escudo', row: 0 },
  { id: 'soldier', name: 'Soldado', description: 'Armadura y escudo', row: 1 },
  { id: 'trumpeter', name: 'Trompetista', description: 'Túnica y shofar', row: 2 },
  { id: 'woman', name: 'Mujer israelita', description: 'Vestido y cántaro', row: 3 }
];
const LEVELS = [
  { id: 'facil', label: 'Fácil', steps: 1, color: 'easy' },
  { id: 'medio', label: 'Medio', steps: 2, color: 'medium' },
  { id: 'dificil', label: 'Difícil', steps: 3, color: 'hard' }
];
const STORY = [
  'Las puertas de Jericó estaban bien aseguradas por temor a los israelitas; nadie podía salir o entrar.',
  'Pero el Señor dijo a Josué: «¡He entregado en tus manos a Jericó y a su rey con sus guerreros!',
  'Tú y tus soldados marcharán una vez alrededor de la ciudad; así lo harán durante seis días.',
  'Siete sacerdotes llevarán trompetas y marcharán frente al arca. El séptimo día ustedes marcharán siete veces alrededor de la ciudad, mientras los sacerdotes tocan las trompetas.',
  'Cuando todos escuchen el toque de trompeta, el pueblo deberá gritar a voz en cuello. Entonces los muros de la ciudad se derrumbarán y cada uno entrará sin impedimento».'
];
const TEXT = {
  Español: { start:'Iniciar juego', how:'Cómo jugar', settings:'Configuración', back:'Volver al menú', next:'Siguiente', choose:'Elige un personaje', confirm:'Confirmar personaje', choosePlayers:'¿Cuántos jugadores?', names:'Nombres de los jugadores', ready:'¡Listos para partir!', turn:'Turno de', difficulty:'Elige la dificultad para responder una pregunta bíblica.', answer:'Responder', correct:'¡Respuesta correcta!', incorrect:'¡Respuesta incorrecta!', noMove:'No avanzas', move:'Avanzas', win:'¡Felicidades!', conquered:'Has conquistado Jericó', thank:'Gracias por participar.', bible:'Te invitamos a ti y a todos los jugadores a seguir conociendo la Biblia, leyendo cada día la Palabra de Dios.', map:'De Egipto a Jericó', startAdventure:'La aventura comienza...', victory:'¡Las murallas caen!', continue:'Continuar', return:'Volver al menú'
  },
  Português: { start:'Iniciar jogo', how:'Como jogar', settings:'Configurações', back:'Voltar ao menu', next:'Avançar', choose:'Escolha um personagem', confirm:'Confirmar personagem', choosePlayers:'Quantos jogadores?', names:'Nomes dos jogadores', ready:'Prontos para partir!', turn:'Vez de', difficulty:'Escolha a dificuldade para responder uma pergunta bíblica.', answer:'Responder', correct:'Resposta correta!', incorrect:'Resposta incorreta!', noMove:'Você não avança', move:'Você avança', win:'Parabéns!', conquered:'Você conquistou Jericó', thank:'Obrigado por participar.', bible:'Convidamos você e todos os jogadores a continuarem conhecendo a Bíblia e lendo a Palavra de Deus todos os dias.', map:'Do Egito a Jericó', startAdventure:'A aventura começa...', victory:'As muralhas estão caindo!', continue:'Continuar', return:'Voltar ao menu'
  },
  English: { start:'Start game', how:'How to play', settings:'Settings', back:'Back to menu', next:'Next', choose:'Choose a character', confirm:'Confirm character', choosePlayers:'How many players?', names:'Player names', ready:'Ready to go!', turn:"It's", difficulty:'Choose a difficulty to answer a Bible question.', answer:'Answer', correct:'Correct answer!', incorrect:'Incorrect answer!', noMove:'No movement', move:'You advance', win:'Congratulations!', conquered:'You conquered Jericho', thank:'Thank you for playing.', bible:'We invite you and all players to keep discovering the Bible and reading God’s Word every day.', map:'From Egypt to Jericho', startAdventure:'The adventure begins...', victory:'The walls are falling!', continue:'Continue', return:'Back to menu'
  }
};
const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const useSound = (enabled) => {
  const contextRef = useRef(null);
  return (type = 'tap') => {
    if (!enabled || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = contextRef.current || new AudioContext();
      contextRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();
      const notes = type === 'correct' ? [523.25, 659.25, 783.99] : type === 'wrong' ? [220, 164.81] : [440];
      const now = ctx.currentTime;
      notes.forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'square';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.045, now + index * 0.09 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.09 + 0.12);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(now + index * 0.09);
        oscillator.stop(now + index * 0.09 + 0.13);
      });
    } catch (error) {
      // Audio is optional; gameplay remains available when the browser blocks it.
    }
  };
};

function Sprite({ character, walking = false, className = '' }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!walking) { setFrame(0); return undefined; }
    const walkCycle = [1, 2, 1, 2, 0];
    let cycleIndex = 0;
    const timer = window.setInterval(() => {
      setFrame(walkCycle[cycleIndex]);
      cycleIndex = (cycleIndex + 1) % walkCycle.length;
    }, 180);
    return () => window.clearInterval(timer);
  }, [walking]);
  return <span className={`sprite sprite-${character.id} ${walking ? 'is-walking' : ''} ${className}`} style={{ '--sprite-x': `${frame * -60}px`, '--sprite-y': `${character.row * -110}px`, '--sprite-image': `url("${ASSET('characters-sprites.webp')}")` }} aria-label={character.name} />;
}

function App() {
  const [screen, setScreen] = useState('menu');
  const [language, setLanguage] = useState('Español');
  const t = TEXT[language] || TEXT.Español;
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const playSound = useSound(soundOn);
  const [settingsModal, setSettingsModal] = useState('');
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState(['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4']);
  const [selections, setSelections] = useState([]);
  const [focusedCharacter, setFocusedCharacter] = useState(0);
  const [players, setPlayers] = useState([]);
  const [turn, setTurn] = useState(0);
  const [level, setLevel] = useState(null);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [usedQuestionIds, setUsedQuestionIds] = useState({ facil: [], medio: [], dificil: [] });
  const [questionBank, setQuestionBank] = useState(null);
  const [bankError, setBankError] = useState('');
  const [winner, setWinner] = useState(null);
  const [wallFrame, setWallFrame] = useState(1);
  const [isMapIntro, setIsMapIntro] = useState(false);
  const [keyboardHelp, setKeyboardHelp] = useState(true);
  const [movingPlayerId, setMovingPlayerId] = useState(null);
  const activePlayer = players[turn];

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch(DATA('question-bank.json.gz.b64'));
        if (!response.ok) throw new Error('No fue posible cargar el banco de preguntas.');
        const encoded = (await response.text()).trim();
        const compressed = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
        if (!('DecompressionStream' in window)) throw new Error('Este navegador no puede abrir el banco de preguntas comprimido.');
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
        const bank = await new Response(stream).json();
        validateQuestionBank(bank);
        if (alive) { setQuestionBank(bank.questions); setBankError(''); }
      } catch (error) {
        if (alive) setBankError(error.message || 'Error al cargar las preguntas.');
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!musicOn || screen === 'menu' || screen === 'settings') return undefined;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return undefined;
    let context;
    let interval;
    let index = 0;
    const notes = [261.63, 329.63, 392.00, 329.63, 293.66, 349.23, 440.00, 392.00];
    try {
      context = new AudioContext();
      context.resume();
      interval = window.setInterval(() => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = notes[index % notes.length];
        const now = context.currentTime;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.012, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.45);
        index += 1;
      }, 520);
    } catch (error) {
      return undefined;
    }
    return () => {
      if (interval) window.clearInterval(interval);
      if (context && context.state !== 'closed') context.close();
    };
  }, [musicOn, screen]);

  useEffect(() => {
    if (screen !== 'map') return undefined;
    const timer = window.setTimeout(() => { setIsMapIntro(false); setScreen('board'); }, 3000);
    return () => window.clearTimeout(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'feedback') return undefined;
    const timer = window.setTimeout(() => {
      const isWinner = feedback?.winner === true;
      setFeedback(null);
      if (isWinner) {
        setWallFrame(1);
        setScreen('collapse');
      } else {
        if (feedback?.correct) setMovingPlayerId(players[turn]?.id || null);
        setTurn((current) => (current + 1) % players.length);
        setScreen('board');
      }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [screen, feedback, players.length]);

  useEffect(() => {
    if (screen !== 'board' || !movingPlayerId) return undefined;
    const timer = window.setTimeout(() => setMovingPlayerId(null), 900);
    return () => window.clearTimeout(timer);
  }, [screen, movingPlayerId]);

  useEffect(() => {
    if (screen !== 'collapse') return undefined;
    setWallFrame(1);
    const timers = [1, 2, 3, 4, 5].map((frame) => window.setTimeout(() => {
      setWallFrame(frame);
      if (frame === 5) window.setTimeout(() => setScreen('story'), 1100);
    }, (frame - 1) * 1050));
    return () => timers.forEach(window.clearTimeout);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'characters') return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Enter') return;
      event.preventDefault();
      if (event.key === 'Enter') {
        confirmCharacter();
        return;
      }
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      setFocusedCharacter((current) => nextAvailableCharacter(current, direction, selections));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, focusedCharacter, selections, playerCount]);

  const currentPlayerName = names[selections.length] || names[0];
  const isBankReady = Boolean(questionBank);
  const startSetup = () => {
    setPlayerCount(2);
    setNames(['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4']);
    setSelections([]);
    setFocusedCharacter(0);
    setPlayers([]);
    setWinner(null);
    setUsedQuestionIds({ facil: [], medio: [], dificil: [] });
    setScreen('setup');
  };

  const chooseFocus = (index) => {
    if (selections.includes(index)) return;
    setFocusedCharacter(index);
    playSound('tap');
  };
  const confirmCharacter = () => {
    if (screen !== 'characters' || selections.length >= playerCount || selections.includes(focusedCharacter)) return;
    const next = [...selections, focusedCharacter];
    setSelections(next);
    playSound('correct');
    if (next.length < playerCount) {
      const nextAvailable = CHARACTERS.findIndex((character, index) => !next.includes(index));
      setFocusedCharacter(nextAvailable < 0 ? 0 : nextAvailable);
    }
  };

  const beginAdventure = () => {
    if (!isBankReady || selections.length !== playerCount) return;
    const nextPlayers = names.slice(0, playerCount).map((name, index) => ({
      id: `player-${index + 1}`,
      name: name.trim().slice(0, 12),
      character: CHARACTERS[selections[index]],
      steps: 0
    }));
    setPlayers(nextPlayers);
    setTurn(0);
    setUsedQuestionIds({ facil: [], medio: [], dificil: [] });
    setWinner(null);
    setIsMapIntro(true);
    setScreen('map');
  };

  const askQuestion = (selectedLevel) => {
    if (!questionBank || !activePlayer) return;
    let selection;
    try {
      selection = selectQuestionForTurn(questionBank, selectedLevel.id, usedQuestionIds);
    } catch (error) {
      setBankError(error.message || 'No hay preguntas disponibles.');
      return;
    }
    const selected = selection.question;
    setUsedQuestionIds(selection.usedIds);
    setLevel(selectedLevel);
    setQuestion({
      id: selected.id,
      text: selected.question,
      options: selection.options,
      reference: selected.biblicalReference,
      steps: selectedLevel.steps,
      previousUsedIds: usedQuestionIds
    });
    setAnswer(null);
    playSound('tap');
    setScreen('question');
  };

  const submitAnswer = () => {
    if (answer === null || !question || !activePlayer) return;
    const correct = question.options[answer]?.correct === true;
    const outcome = resolveAnswer(activePlayer.steps, correct, question.steps);
    const newSteps = outcome.steps;
    const nextPlayers = players.map((player, index) => index === turn ? { ...player, steps: newSteps } : player);
    const hasWon = outcome.won;
    setPlayers(nextPlayers);
    if (hasWon) setWinner(nextPlayers[turn]);
    setFeedback({ correct, steps: correct ? question.steps : 0, winner: hasWon });
    playSound(correct ? 'correct' : 'wrong');
    setScreen('feedback');
  };

  const resetGame = () => {
    setScreen('menu');
    setPlayers([]);
    setWinner(null);
    setSelections([]);
    setFeedback(null);
    setQuestion(null);
  };
  const currentSceneIndex = activePlayer ? sceneIndexForStep(activePlayer.steps) : 0;
  const percentByPlayer = useMemo(() => players.map((player) => (player.steps / 30) * 100), [players]);
  const sceneForSteps = (steps) => SCENES[sceneIndexForStep(steps)];
  const stageMarkers = Array.from({ length: 30 }, (_, index) => index + 1);

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand-mark">J</div>
        <div><div className="brand">JERICO</div><div className="subtitle">CAMINO A JERICÓ</div></div>
        <div className="top-spacer" />
        <button className="tiny" type="button" aria-label={t.settings} onClick={() => setScreen('settings')}>⚙</button>
      </header>

      {screen === 'menu' && (
        <section className="hero scene-jericho" style={{ backgroundImage: `url("${ASSET('menu.webp')}")` }}>
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="eyebrow">UNA AVENTURA BÍBLICA</p>
            <h1>JERICO</h1>
            <p className="hero-sub">Camino a Jericó</p>
            <div className="gold-line" />
            <button className="primary" type="button" onClick={startSetup}>{t.start} <span>▶</span></button>
            <button className="secondary" type="button" onClick={() => setScreen('instructions')}>{t.how}</button>
            <button className="secondary" type="button" onClick={() => setScreen('settings')}>{t.settings}</button>
            {!isBankReady && <p className="menu-status">{bankError || 'Preparando banco de 120 preguntas...'}</p>}
          </div>
          <div className="hero-bottom">UNA HISTORIA DE FE · VALOR · OBEDIENCIA</div>
        </section>
      )}

      {screen === 'instructions' && (
        <section className="panel parchment">
          <p className="eyebrow">JERICO · CAMINO A LA PROMESA</p>
          <h2>Instrucciones</h2>
          <p>¡Prepárate para recorrer el camino hacia Jericó! Responde preguntas bíblicas y avanza por cinco escenarios, con seis pasos en cada uno.</p>
          <ol>
            <li>Participan de 1 a 4 jugadores. Cada participante escribe su nombre y elige un personaje diferente.</li>
            <li>En cada turno, elige la dificultad: Fácil avanza 1 paso, Medio 2 pasos y Difícil 3 pasos.</li>
            <li>Si respondes incorrectamente, no avanzas. Si respondes correctamente, tu personaje avanza la cantidad indicada.</li>
            <li>Las preguntas se seleccionan al azar y no se repiten hasta agotar las 40 preguntas de esa dificultad.</li>
            <li>El primer jugador que alcance los 30 pasos conquista Jericó. La partida termina inmediatamente.</li>
          </ol>
          <button className="primary" type="button" onClick={() => setScreen('menu')}>{t.back}</button>
        </section>
      )}

      {screen === 'settings' && (
        <section className="panel parchment settings-panel">
          <button className="settings-close" type="button" aria-label="Cerrar configuración" onClick={() => setScreen('menu')}>×</button>
          <p className="eyebrow">JERICO · PREFERENCIAS</p>
          <h2>{t.settings}</h2>
          <label>Idioma
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option>Español</option><option>Português</option><option>English</option>
            </select>
          </label>
          <label className="switch-row">Efectos de sonido <input type="checkbox" checked={soundOn} onChange={(event) => setSoundOn(event.target.checked)} /></label>
          <label className="switch-row">Música ambiental <input type="checkbox" checked={musicOn} onChange={(event) => setMusicOn(event.target.checked)} /></label>
          <label className="switch-row">Notificaciones <input type="checkbox" checked={notificationsOn} onChange={(event) => setNotificationsOn(event.target.checked)} /></label>
          <div className="settings-links">
            <button type="button" onClick={() => setSettingsModal('Soporte')}>Soporte</button>
            <button type="button" onClick={() => setSettingsModal('Créditos')}>Créditos</button>
            <button type="button" onClick={() => setSettingsModal('Términos y privacidad')}>Términos y privacidad</button>
          </div>
          <button className="primary" type="button" onClick={() => setScreen('menu')}>{t.back}</button>
          {settingsModal && <div className="modal-backdrop" role="presentation" onClick={() => setSettingsModal('')}><div className="settings-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setSettingsModal('')}>×</button><h3>{settingsModal}</h3><p>{settingsModal === 'Soporte' ? 'Para reportar un problema, contacta al equipo responsable del proyecto JERICO.' : settingsModal === 'Créditos' ? 'JERICO — Camino a Jericó. Proyecto de juego bíblico educativo. Desarrollo y diseño: equipo del proyecto.' : 'Esta versión no usa cuentas ni sincroniza partidas. Los nombres y avances solo se mantienen durante la partida abierta en este navegador. El sitio se distribuye mediante GitHub Pages.'}</p></div></div>}
        </section>
      )}

      {screen === 'setup' && (
        <section className="panel parchment">
          <p className="eyebrow">PREPARA TU PARTIDA</p>
          <h2>{t.choosePlayers}</h2>
          <div className="player-count">
            {[1, 2, 3, 4].map((number) => <button key={number} type="button" className={playerCount === number ? 'count active' : 'count'} onClick={() => setPlayerCount(number)}>{number}</button>)}
          </div>
          <h3>{t.names}</h3>
          <div className="name-grid">
            {names.slice(0, playerCount).map((name, index) => (
              <label key={index}>Jugador {index + 1}
                <input maxLength={12} value={name} onChange={(event) => setNames((current) => current.map((value, i) => i === index ? event.target.value.slice(0, 12) : value))} />
                <small className="char-counter">{name.length}/12</small>
              </label>
            ))}
          </div>
          <button className="primary" type="button" disabled={names.slice(0, playerCount).some((name) => !name.trim()) || !isBankReady} onClick={() => { setSelections([]); setFocusedCharacter(0); setScreen('characters'); }}>
            {t.next}
          </button>
          {!isBankReady && <p className="hint">{bankError || 'Cargando las 120 preguntas bíblicas...'}</p>}
        </section>
      )}

      {screen === 'characters' && (
        <section className="panel parchment character-panel">
          <p className="eyebrow">SELECCIÓN DE PERSONAJES · {selections.length + 1}/{playerCount}</p>
          <h2>{selections.length < playerCount ? names[selections.length] : t.ready}</h2>
          {selections.length < playerCount ? (
            <>
              <p>{t.choose}. Cada jugador debe tener un personaje diferente.</p>
              <div className="character-stage">
                <button className="carousel-arrow" type="button" aria-label="Personaje anterior" onClick={() => { setFocusedCharacter((current) => nextAvailableCharacter(current, -1, selections)); playSound('tap'); }}>‹</button>
                <div className="character-preview">
                  <div className="character-spotlight"><Sprite character={CHARACTERS[focusedCharacter]} /></div>
                  <h3>{CHARACTERS[focusedCharacter].name}</h3>
                  <p>{CHARACTERS[focusedCharacter].description}</p>
                  <div className="character-dots">{CHARACTERS.map((character, index) => <button key={character.id} type="button" className={index === focusedCharacter ? 'dot active' : 'dot'} disabled={selections.includes(index)} onClick={() => chooseFocus(index)} aria-label={character.name} />)}</div>
                </div>
                <button className="carousel-arrow" type="button" aria-label="Siguiente personaje" onClick={() => { setFocusedCharacter((current) => nextAvailableCharacter(current, 1, selections)); playSound('tap'); }}>›</button>
              </div>
              <div className="character-roster">
                {CHARACTERS.map((character, index) => <button key={character.id} type="button" disabled={selections.includes(index)} className={`roster-item ${index === focusedCharacter ? 'selected' : ''} ${selections.includes(index) ? 'locked' : ''}`} onClick={() => chooseFocus(index)}><Sprite character={character} /><b>{character.name}</b>{selections.includes(index) && <small>Elegido</small>}</button>)}
              </div>
              <div className="keyboard-hint">Usa ← → para elegir y ENTER para confirmar.</div>
              <button className="primary" type="button" disabled={selections.includes(focusedCharacter)} onClick={confirmCharacter}>{t.confirm}</button>
            </>
          ) : (
            <>
              <div className="selected-players">{players.length ? null : names.slice(0, playerCount).map((name, index) => <div key={name}><Sprite character={CHARACTERS[selections[index]]} /> <b>{name}</b></div>)}</div>
              <p>Todos tienen un personaje único. El orden de juego seguirá el orden de los jugadores.</p>
              <button className="primary" type="button" onClick={beginAdventure}>Comenzar aventura</button>
            </>
          )}
          <button className="text-button" type="button" onClick={() => setScreen('setup')}>Volver</button>
        </section>
      )}

      {screen === 'map' && (
        <section className="map-screen" style={{ backgroundImage: `linear-gradient(180deg, #1a213aaa, #3f2636bb), url("${ASSET('menu.webp')}")` }}>
          <p className="eyebrow">EL CAMINO A LA PROMESA</p>
          <h2>{t.map}</h2>
          <div className="map-route">
            {SCENES.map((scene, index) => <div className="map-stop" key={scene.name}><span>{['𓂀', '🌊', '⛰', '🌿', '🏰'][index]}</span><b>{scene.name}</b><small>6 pasos</small>{index < 4 && <i />}</div>)}
          </div>
          <div className="map-travelers">{players.map((player) => <div key={player.id}><Sprite character={player.character} walking /> <b>{player.name}</b></div>)}</div>
          <p>{t.startAdventure}</p>
        </section>
      )}

      {screen === 'board' && activePlayer && (
        <section className="board">
          <div className="board-head">
            <div><p className="eyebrow">{t.turn.toUpperCase()} {activePlayer.name.toUpperCase()}</p><h2>{SCENES[currentSceneIndex].name}</h2><p>{SCENES[currentSceneIndex].detail}</p></div>
            <div className="turn-avatar"><Sprite character={activePlayer.character} /></div>
          </div>
          <div className="scene-track" style={{ backgroundImage: `url("${ASSET(SCENES[currentSceneIndex].asset)}")` }}>
            <div className="scene-overlay" />
            <div className="scene-labels">{SCENES.map((scene, index) => <span key={scene.name} className={index === currentSceneIndex ? 'active' : ''}>{scene.name}</span>)}</div>
            <div className="path-markers">{stageMarkers.map((marker) => <span key={marker} className={marker <= activePlayer.steps ? 'passed' : ''} />)}</div>
            {players.map((player, index) => {
              const left = Math.max(1.5, Math.min(98, (player.steps / 30) * 100));
              return <div className="track-player" key={player.id} style={{ left: `${left}%`, bottom: `${14 + index * 46}px` }}><Sprite character={player.character} walking={player.id === movingPlayerId} /><b>{player.name}</b></div>;
            })}
            <div className="path-line" />
          </div>
          <div className="player-progress">
            {players.map((player, index) => <div className={`progress-card ${index === turn ? 'current' : ''}`} key={player.id}><Sprite character={player.character} /><div className="progress-details"><b>{player.name}</b><small>{player.steps}/30 pasos · {sceneForSteps(player.steps).name}</small><div className="meter"><i style={{ width: `${percentByPlayer[index]}%` }} /></div></div></div>)}
          </div>
          <div className="turn-actions">
            <p>{t.difficulty}</p>
            <div className="difficulty">{LEVELS.map((item) => <button key={item.id} type="button" className={item.color} onClick={() => askQuestion(item)}><b>{item.label}</b><small>+{item.steps} paso{item.steps > 1 ? 's' : ''}</small></button>)}</div>
            <p className="bank-status" aria-live={notificationsOn ? 'polite' : 'off'}>{notificationsOn ? `Turno de ${activePlayer.name}. ` : ''}{questionBank?.length === 120 ? '120 preguntas listas · 40 por dificultad' : bankError || 'Cargando banco de preguntas...'}</p>
          </div>
        </section>
      )}

      {screen === 'question' && question && level && (
        <section className="panel question-panel">
          <p className="eyebrow">{level.label.toUpperCase()} · AVANZAS {level.steps} PASO{level.steps > 1 ? 'S' : ''}</p>
          <h2>{question.text}</h2>
          <div className="answers">
            {question.options.map((option, index) => <button key={`${question.id}-${index}`} type="button" className={answer === index ? 'answer selected' : 'answer'} onClick={() => { setAnswer(index); playSound('tap'); }}><span>{String.fromCharCode(65 + index)}</span>{option.text}</button>)}
          </div>
          <p className="reference">Referencia bíblica: {question.reference}</p>
          <div className="question-actions"><button className="text-button" type="button" onClick={() => { setUsedQuestionIds(question.previousUsedIds); setQuestion(null); setAnswer(null); setScreen('board'); }}>Cancelar turno</button><button className="primary" type="button" disabled={answer === null} onClick={submitAnswer}>{t.answer}</button></div>
        </section>
      )}

      {screen === 'feedback' && feedback && (
        <div className="modal-backdrop">
          <div className={`feedback-card ${feedback.correct ? 'good' : 'bad'}`}>
            <div className="feedback-icon">{feedback.correct ? '✦' : '×'}</div>
            <h2>{feedback.correct ? t.correct : t.incorrect}</h2>
            <p>{feedback.correct ? `${t.move} +${feedback.steps} paso(s)` : t.noMove}</p>
            {feedback.winner && <p className="winner-note">¡{winner?.name} ha llegado primero a Jericó!</p>}
          </div>
        </div>
      )}

      {screen === 'collapse' && (
        <section className={`collapse-screen ${wallFrame === 3 || wallFrame === 4 ? 'heavy-shake' : 'light-shake'}`}>
          <p className="eyebrow">¡EL PUEBLO HA GRITADO!</p>
          <h2>{t.victory}</h2>
          <div className="wall-frame">
            <img src={ASSET(`wall-${wallFrame}.webp`)} alt={`Derrumbe de las murallas de Jericó, imagen ${wallFrame} de 5`} />
          </div>
          <p>Jericó ha sido conquistada</p>
        </section>
      )}

      {screen === 'story' && (
        <section className="panel parchment story-panel">
          <p className="eyebrow">LA PROMESA SE CUMPLIÓ</p>
          <h2>La conquista de Jericó</h2>
          <div className="scripture">
            <p><strong>1</strong> {STORY[0]}</p>
            <p><strong>2</strong> {STORY[1]} <strong>3</strong> {STORY[2]} <strong>4</strong> {STORY[3]} <strong>5</strong> {STORY[4]}</p>
          </div>
          <b className="scripture-ref">Josué 6:1–5</b>
          <button className="primary" type="button" onClick={() => setScreen('victory')}>{t.continue}</button>
        </section>
      )}

      {screen === 'victory' && (
        <section className="victory-screen" style={{ backgroundImage: `linear-gradient(180deg, #281c2a50, #281c2aee), url("${ASSET('stage-jericho.webp')}")` }}>
          <div className="victory-overlay">
            <div className="victory-crown">♛</div>
            <p className="eyebrow">LA CONQUISTA HA TERMINADO</p>
            <h1>{t.win}</h1>
            <h2>{winner?.name}</h2>
            <p className="winner-copy">{t.conquered}</p>
            <div className="invite"><b>{t.thank}</b><p>{t.bible}</p></div>
            <button className="primary" type="button" onClick={resetGame}>{t.return}</button>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
