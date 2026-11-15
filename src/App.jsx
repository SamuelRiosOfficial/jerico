import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TEXT } from './gameLocales.js';
import './style.css';
import { validateQuestionBank, selectQuestionForTurn, resolveAnswer, sceneIndexForStep, nextAvailableCharacter, getJourneyMapPosition } from './gameEngine.js';

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
  const [settingsReturnScreen, setSettingsReturnScreen] = useState('menu');
  const [language, setLanguage] = useState(() => {
    try {
      const saved = window.localStorage.getItem('jerico-language');
      return ['Español', 'Português', 'English'].includes(saved) ? saved : 'Español';
    } catch {
      return 'Español';
    }
  });
  useEffect(() => {
    try { window.localStorage.setItem('jerico-language', language); } catch { /* Settings still work for this session. */ }
  }, [language]);
  const previousLanguage = useRef(language);
  useEffect(() => {
    if (previousLanguage.current !== language) {
      setNames((current) => current.map((name, index) =>
        ['Español', 'Português', 'English'].some((locale) => name === playerDefault(locale, index + 1))
          ? playerDefault(language, index + 1)
          : name
      ));
      previousLanguage.current = language;
    }
  }, [language]);
  useEffect(() => { document.documentElement.lang = localeCode; }, [localeCode]);
  const t = TEXT[language] || TEXT.Español;
  const localeCode = ({ Español: 'es', Português: 'pt', English: 'en' })[language] || 'es';
  const playerDefault = (locale, number) => ({ Español: 'Jugador', Português: 'Jogador', English: 'Player' }[locale] || 'Player') + ' ' + number;
  const defaultNames = (locale) => Array.from({ length: 4 }, (_, index) => playerDefault(locale, index + 1));
  const localizedCharacters = CHARACTERS.map((character) => ({ ...character, ...t.characters[character.id] }));
  const localizedLevels = LEVELS.map((item) => ({ ...item, label: t.levels[item.id] }));
  const localizedScenes = SCENES.map((scene, index) => ({ ...scene, ...t.scenes[index] }));
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const playSound = useSound(soundOn);
  const [settingsModal, setSettingsModal] = useState('');
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState(() => defaultNames(language));
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
  const [advancePayload, setAdvancePayload] = useState(null);
  const [advanceFromSteps, setAdvanceFromSteps] = useState(0);
  const [animatedStepCount, setAnimatedStepCount] = useState(0);
  const activePlayer = players[turn];
  const openSettings = () => {
    setSettingsReturnScreen(screen);
    setSettingsModal('');
    setScreen('settings');
  };
  const closeSettings = () => {
    setSettingsModal('');
    setScreen(settingsReturnScreen || 'menu');
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch(DATA('question-bank.multilingual.json'));
        if (!response.ok) throw new Error('question-bank-load');
        const bank = await response.json();
        validateQuestionBank(bank);
        if (alive) { setQuestionBank(bank.questions); setBankError(''); }
      } catch (error) {
        if (alive) setBankError('load');
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
    const timer = window.setTimeout(() => { setIsMapIntro(false); setScreen('board'); }, 6500);
    return () => window.clearTimeout(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'feedback') return undefined;
    const timer = window.setTimeout(() => {
      setFeedback(null);
      setAnimatedStepCount(0);
      setMovingPlayerId(advancePayload?.playerId || null);
      setScreen('advance');
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [screen, feedback, advancePayload]);

  useEffect(() => {
    if (screen !== 'advance' || !advancePayload) return undefined;
    let interval;
    let finishTimer;
    let completedSteps = 0;
    const segmentEnd = Math.min(advancePayload.toSteps, (Math.floor(advanceFromSteps / 6) + 1) * 6);
    const segmentSteps = Math.max(0, segmentEnd - advanceFromSteps);
    const finishAnimation = () => {
      setMovingPlayerId(null);
      if (advancePayload.crossedScene && !advancePayload.mapShown) {
        setAdvanceFromSteps(segmentEnd);
        setAnimatedStepCount(0);
        setAdvancePayload((current) => ({ ...current, mapShown: true }));
        setScreen('routeMap');
      } else if (segmentEnd < advancePayload.toSteps) {
        setAdvanceFromSteps(segmentEnd);
        setAnimatedStepCount(0);
        setScreen('routeMap');
      } else if (advancePayload.winner) {
        setAdvancePayload(null);
        setWallFrame(1);
        setScreen('collapse');
      } else {
        setAdvancePayload(null);
        setTurn((current) => (current + 1) % players.length);
        setScreen('board');
      }
    };
    if (!advancePayload.correct || segmentSteps <= 0) {
      finishTimer = window.setTimeout(finishAnimation, 1450);
    } else {
      interval = window.setInterval(() => {
        completedSteps += 1;
        setAnimatedStepCount(completedSteps);
        if (completedSteps >= segmentSteps) {
          window.clearInterval(interval);
          finishTimer = window.setTimeout(finishAnimation, 550);
        }
      }, 520);
    }
    return () => {
      if (interval) window.clearInterval(interval);
      if (finishTimer) window.clearTimeout(finishTimer);
    };
  }, [screen, advancePayload, advanceFromSteps, players.length]);

  useEffect(() => {
    if (screen !== 'routeMap') return undefined;
    const timer = window.setTimeout(() => {
      setMovingPlayerId(null);
      if (advancePayload && advanceFromSteps < advancePayload.toSteps) {
        setAnimatedStepCount(0);
        setMovingPlayerId(advancePayload.playerId);
        setScreen('advance');
      } else if (advancePayload?.winner) {
        setAdvancePayload(null);
        setWallFrame(1);
        setScreen('collapse');
      } else {
        setAdvancePayload(null);
        setTurn((current) => (current + 1) % players.length);
        setScreen('board');
      }
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [screen, advancePayload, advanceFromSteps, players.length]);

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

  useEffect(() => {
    if (!question || !questionBank) return;
    const source = questionBank.find((item) => item.id === question.id);
    if (!source) return;
    const code = ({ Español: 'es', Português: 'pt', English: 'en' })[language] || 'es';
    const localized = code === 'es' ? source : source.translations?.[code];
    if (!localized) return;
    setQuestion((current) => current && current.id === source.id ? {
      ...current,
      text: localized.question,
      reference: localized.biblicalReference,
      options: current.options.map((option) => ({
        ...option,
        text: localized.options[option.index]
      }))
    } : current);
  }, [language, question?.id, questionBank]);

  const currentPlayerName = names[selections.length] || names[0];
  const isBankReady = Boolean(questionBank);
  const startSetup = () => {
    setPlayerCount(2);
    setNames(defaultNames(language));
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
      character: localizedCharacters[selections[index]],
      steps: 0
    }));
    setPlayers(nextPlayers);
    setTurn(0);
    setUsedQuestionIds({ facil: [], medio: [], dificil: [] });
    setWinner(null);
    setAdvancePayload(null);
    setAnimatedStepCount(0);
    setIsMapIntro(true);
    setScreen('map');
  };

  const askQuestion = (selectedLevel) => {
    if (!questionBank || !activePlayer) return;
    let selection;
    try {
      selection = selectQuestionForTurn(questionBank, selectedLevel.id, usedQuestionIds, Math.random, ({ Español: 'es', Português: 'pt', English: 'en' })[language] || 'es');
    } catch (error) {
      setBankError('selection');
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
    setAdvanceFromSteps(activePlayer.steps);
    setAnimatedStepCount(0);
    setAdvancePayload({
      playerId: activePlayer.id,
      fromSteps: activePlayer.steps,
      toSteps: newSteps,
      steps: correct ? newSteps - activePlayer.steps : 0,
      correct,
      winner: hasWon,
      crossedScene: correct && sceneIndexForStep(activePlayer.steps) !== sceneIndexForStep(newSteps)
    });
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
    setAdvancePayload(null);
    setMovingPlayerId(null);
  };
  const currentSceneIndex = activePlayer ? sceneIndexForStep(activePlayer.steps) : 0;
  const percentByPlayer = useMemo(() => players.map((player) => (player.steps / 30) * 100), [players]);
  const sceneForSteps = (steps) => localizedScenes[sceneIndexForStep(steps)];
  const stageMarkers = Array.from({ length: 6 }, (_, index) => index + 1);

  return (
    <main lang={localeCode} className={`game-shell screen-${screen}`}>
      <header className="topbar">
        <div className="brand-mark">J</div>
        <div><div className="brand">JERICO</div><div className="subtitle">{t.brandSubtitle}</div></div>
        <div className="top-spacer" />
        <button className="tiny" type="button" aria-label={t.settings} onClick={openSettings}>⚙</button>
      </header>

      {screen === 'menu' && (
        <section className="hero scene-jericho" style={{ backgroundImage: `url("${ASSET('stage-jericho.webp')}")` }}>
          <video className="hero-video" autoPlay muted loop playsInline preload="auto" poster={ASSET('stage-jericho.webp')} aria-hidden="true">
            <source src={ASSET('jerico-menu-loop.mp4')} type="video/mp4" />
          </video>
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="eyebrow">{t.heroEyebrow}</p>
            <h1>JERICO</h1>
            <p className="hero-sub">{t.heroSubtitle}</p>
            <div className="gold-line" />
            <button className="primary" type="button" onClick={startSetup}>{t.start} <span>▶</span></button>
            <button className="secondary" type="button" onClick={() => setScreen('instructions')}>{t.how}</button>
            <button className="secondary" type="button" onClick={openSettings}>{t.settings}</button>
            {!isBankReady && <p className="menu-status">{bankError === 'load' ? t.bankError : t.bankLoading}</p>}
          </div>
          <div className="menu-party" aria-hidden="true">{localizedCharacters.map((character) => <Sprite key={character.id} character={character} />)}</div>
          <div className="hero-bottom">{t.heroBottom}</div>
        </section>
      )}

      {screen === 'instructions' && (
        <section className="panel parchment instruction-panel">
          <p className="eyebrow">{t.instructionsEyebrow}</p>
          <h2>{t.instructionsTitle}</h2>
          <p>{t.instructionsIntro}</p>
          <ol>{t.instructionsRules.map((rule, index) => <li key={index}>{rule}</li>)}</ol>
          <button className="primary" type="button" onClick={() => setScreen('menu')}>{t.back}</button>
        </section>
      )}

      {screen === 'settings' && (
        <section className="panel parchment settings-panel">
          <button className="settings-close" type="button" aria-label={t.settingsClose} onClick={closeSettings}>×</button>
          <p className="eyebrow">{t.settingsEyebrow}</p>
          <h2>{t.settings}</h2>
          <label>{t.language}
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option>Español</option><option>Português</option><option>English</option>
            </select>
          </label>
          <label className="switch-row">{t.soundEffects} <input type="checkbox" checked={soundOn} onChange={(event) => setSoundOn(event.target.checked)} /></label>
          <label className="switch-row">{t.ambientMusic} <input type="checkbox" checked={musicOn} onChange={(event) => setMusicOn(event.target.checked)} /></label>
          <label className="switch-row">{t.notifications} <input type="checkbox" checked={notificationsOn} onChange={(event) => setNotificationsOn(event.target.checked)} /></label>
          <div className="settings-links">
            <button type="button" onClick={() => setSettingsModal('support')}>{t.support}</button>
            <button type="button" onClick={() => setSettingsModal('credits')}>{t.credits}</button>
            <button type="button" onClick={() => setSettingsModal('privacy')}>{t.termsPrivacy}</button>
          </div>
          <button className="primary" type="button" onClick={closeSettings}>{t.back}</button>
          {settingsModal && <div className="modal-backdrop" role="presentation" onClick={() => setSettingsModal('')}><div className="settings-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setSettingsModal('')}>×</button><h3>{settingsModal === 'support' ? t.support : settingsModal === 'credits' ? t.credits : t.termsPrivacy}</h3><p>{settingsModal === 'support' ? t.supportText : settingsModal === 'credits' ? t.creditsText : t.privacyText}</p></div></div>}
        </section>
      )}

      {screen === 'setup' && (
        <section className="panel parchment">
          <p className="eyebrow">{t.playerPrep}</p>
          <h2>{t.choosePlayers}</h2>
          <div className="player-count">
            {[1, 2, 3, 4].map((number) => <button key={number} type="button" className={playerCount === number ? 'count active' : 'count'} onClick={() => setPlayerCount(number)}>{number}</button>)}
          </div>
          <h3>{t.names}</h3>
          <div className="name-grid">
            {names.slice(0, playerCount).map((name, index) => (
              <label key={index}>{t.playerLabel} {index + 1}
                <input maxLength={12} value={name} onChange={(event) => setNames((current) => current.map((value, i) => i === index ? event.target.value.slice(0, 12) : value))} />
                <small className="char-counter">{name.length}/12</small>
              </label>
            ))}
          </div>
          <button className="primary" type="button" disabled={names.slice(0, playerCount).some((name) => !name.trim()) || !isBankReady} onClick={() => { setSelections([]); setFocusedCharacter(0); setScreen('characters'); }}>
            {t.next}
          </button>
          {!isBankReady && <p className="hint">{bankError === 'load' ? t.bankError : t.bankLoading}</p>}
        </section>
      )}

      {screen === 'characters' && (
        <section className="panel parchment character-panel">
          <p className="eyebrow">{t.characterEyebrow} · {selections.length + 1}/{playerCount}</p>
          <h2>{selections.length < playerCount ? names[selections.length] : t.ready}</h2>
          {selections.length < playerCount ? (
            <>
              <p>{t.choose}. {t.uniqueCharacters}</p>
              <div className="character-stage">
                <button className="carousel-arrow" type="button" aria-label={t.previousCharacter} onClick={() => { setFocusedCharacter((current) => nextAvailableCharacter(current, -1, selections)); playSound('tap'); }}>‹</button>
                <div className="character-preview">
                  <div className="character-spotlight"><Sprite character={CHARACTERS[focusedCharacter]} /></div>
                  <h3>{CHARACTERS[focusedCharacter].name}</h3>
                  <p>{CHARACTERS[focusedCharacter].description}</p>
                  <div className="character-dots">{CHARACTERS.map((character, index) => <button key={character.id} type="button" className={index === focusedCharacter ? 'dot active' : 'dot'} disabled={selections.includes(index)} onClick={() => chooseFocus(index)} aria-label={character.name} />)}</div>
                </div>
                <button className="carousel-arrow" type="button" aria-label={t.nextCharacter} onClick={() => { setFocusedCharacter((current) => nextAvailableCharacter(current, 1, selections)); playSound('tap'); }}>›</button>
              </div>
              <div className="character-roster">
                {CHARACTERS.map((character, index) => <button key={character.id} type="button" disabled={selections.includes(index)} className={`roster-item ${index === focusedCharacter ? 'selected' : ''} ${selections.includes(index) ? 'locked' : ''}`} onClick={() => chooseFocus(index)}><Sprite character={character} /><b>{character.name}</b>{selections.includes(index) && <small>{t.chosen}</small>}</button>)}
              </div>
              <div className="keyboard-hint">{t.keyboardHint}</div>
              <button className="primary" type="button" disabled={selections.includes(focusedCharacter)} onClick={confirmCharacter}>{t.confirm}</button>
            </>
          ) : (
            <>
              <div className="selected-players">{players.length ? null : names.slice(0, playerCount).map((name, index) => <div key={name}><Sprite character={CHARACTERS[selections[index]]} /> <b>{name}</b></div>)}</div>
              <p>{t.allHaveCharacter}</p>
              <button className="primary" type="button" onClick={beginAdventure}>{t.begin}</button>
            </>
          )}
          <button className="text-button" type="button" onClick={() => setScreen('setup')}>{t.goBack}</button>
        </section>
      )}

      {(screen === 'map' || screen === 'routeMap') && (
        <section className={`map-screen ${screen === 'routeMap' ? 'map-progress-screen' : 'map-intro-screen'}`}>
          <div className="journey-map-artboard">
            <svg className="journey-map-illustration" viewBox="0 0 1600 900" role="img" aria-label={t.mapAria}>
              <defs>
                <linearGradient id="mapPaper" x2="0" y2="1"><stop stopColor="#f7d28b"/><stop offset="1" stopColor="#e6a94f"/></linearGradient>
                <linearGradient id="mapSky" x2="0" y2="1"><stop stopColor="#84bce9"/><stop offset="1" stopColor="#f6d18d"/></linearGradient>
                <linearGradient id="mapSea" x2="0" y2="1"><stop stopColor="#22a8ea"/><stop offset="1" stopColor="#0755a8"/></linearGradient>
                <linearGradient id="mapStone" x2="0" y2="1"><stop stopColor="#f7c368"/><stop offset="1" stopColor="#a85b28"/></linearGradient>
                <pattern id="mapPixels" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 0h2v2H0zM9 9h2v2H9z" fill="#8d531f" opacity=".12"/></pattern>
                <filter id="mapShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="7" dy="9" stdDeviation="3" floodColor="#56300f" floodOpacity=".55"/></filter>
              </defs>
              <rect width="1600" height="900" fill="url(#mapPaper)"/>
              <rect x="18" y="18" width="1564" height="864" rx="24" fill="none" stroke="#7c451b" strokeWidth="13"/>
              <rect x="32" y="32" width="1536" height="836" rx="18" fill="url(#mapSky)"/>
              <path d="M35 300L170 180l92 78 136-140 125 118 115-72 110 114 126-112 115 82 109-126 129 122 142-112 134 130 70-50V650H35Z" fill="#bb8a69"/>
              <path d="M35 330l141-146 64 80 159-154 125 132 128-75 112 94 116-126 117 95 114-130 142 120 118-78 125 121 54-42V650H35Z" fill="#8c7ca0" opacity=".78"/>
              <path d="M40 426q160-90 300-32t260-14 280 18 290-20 390 15v430H40Z" fill="#e8b965"/>
              <path d="M40 540q180-112 332-44t281-21 280 30 284-35 343 28v320H40Z" fill="#e7a84e"/>
              <rect x="32" y="32" width="1536" height="836" fill="url(#mapPixels)"/>
              <path d="M350 384q-42 45 4 80t-22 76 62 75" fill="none" stroke="url(#mapSea)" strokeWidth="72" strokeLinecap="round"/>
              <path d="M335 394q-26 38 16 66t-15 69 38 58" fill="none" stroke="#7de1ff" strokeWidth="12" strokeDasharray="27 17" opacity=".8"/>
              <path d="M1094 358q-71 50-24 104t-14 95 55 75 4 104" fill="none" stroke="url(#mapSea)" strokeWidth="62" strokeLinecap="round"/>
              <path d="M1087 363q-48 47-9 92t-11 100 41 74 1 90" fill="none" stroke="#8ce6ff" strokeWidth="10" strokeDasharray="24 15"/>
              <g filter="url(#mapShadow)">
                <path d="M75 418h225v120H75z" fill="url(#mapStone)" stroke="#5e351b" strokeWidth="9"/>
                <path d="M83 419l75-122 74 122Z" fill="#e7a43e" stroke="#70421e" strokeWidth="8"/>
                <path d="M175 419l87-155 90 155Z" fill="#f4bc51" stroke="#70421e" strokeWidth="8"/>
                <path d="M98 448h180v24H98zM98 490h180v24H98z" fill="#b86c31"/>
                <path d="M132 456h26v82h-26zM207 456h26v82h-26z" fill="#714022"/>
                <path d="M278 475h60v63h-60z" fill="#9b5328" stroke="#583019" strokeWidth="7"/>
              </g>
              <g fill="#397947" stroke="#244c2e" strokeWidth="5">
                <path d="M85 357q-40-48-14-77 27 5 26 42 8-43 43-48 18 36-15 69 45-22 59 5-20 35-71 22-24 25-42-13z"/>
                <path d="M310 356q-28-46-3-72 30 9 25 45 11-39 43-37 12 39-23 65 44-14 52 17-29 27-68 10-27 19-38-28z"/>
                <path d="M1234 339q-31-47-3-75 30 8 25 47 14-40 48-36 9 40-26 63 47-12 51 18-30 25-70 7-24 20-25-24z"/>
                <path d="M1490 388q-33-48-5-74 31 8 26 45 12-37 44-35 10 39-25 62 43-13 52 16-31 27-70 10-24 20-22-24z"/>
              </g>
              <g fill="#e7ad60" stroke="#75411c" strokeWidth="9" filter="url(#mapShadow)">
                <path d="M650 460l94-190 105 190Z"/>
                <path d="M780 456l113-240 126 240Z"/>
                <path d="M890 463l75-170 98 170Z"/>
              </g>
              <g fill="#c7ad97" stroke="#775b54" strokeWidth="5">
                <path d="M648 273l96-18-94 205z"/><path d="M781 218l113-21-116 255z"/><path d="M889 297l76-14-82 182z"/>
              </g>
              <g fill="#fff4cf" stroke="#5d3518" strokeWidth="7" filter="url(#mapShadow)">
                <path d="M780 116h42v105h-42zM830 116h42v105h-42z"/>
                <path d="M760 113l41-38 41 38M810 113l41-38 41 38"/>
                <path d="M758 109h94v10h-94z"/>
              </g>
              <g fill="#eab75f" stroke="#6f3c18" strokeWidth="8" filter="url(#mapShadow)">
                <rect x="1265" y="272" width="260" height="176" rx="4"/>
                <rect x="1245" y="325" width="50" height="123"/><rect x="1495" y="325" width="50" height="123"/>
                <rect x="1283" y="228" width="57" height="90"/><rect x="1356" y="195" width="72" height="123"/><rect x="1440" y="226" width="59" height="92"/>
                <path d="M1361 448v-83q38-56 80 0v83z" fill="#663719"/>
                <path d="M1397 196v-65M1355 228v-54M1471 227v-54" fill="none"/>
                <path d="M1382 157l29 6-29 22zM1341 181l29 6-29 22zM1457 180l29 6-29 22z" fill="#b53021"/>
              </g>
              <g fill="none" stroke="#6b341a" strokeWidth="21" strokeLinecap="round" strokeLinejoin="round">
                <path d="M178 522Q298 458 402 520T603 510Q713 452 835 490T1054 471Q1175 420 1272 392"/>
              </g>
              <g fill="none" stroke="#fff0b8" strokeWidth="10" strokeDasharray="12 25" strokeLinecap="round">
                <path d="M178 522Q298 458 402 520T603 510Q713 452 835 490T1054 471Q1175 420 1272 392"/>
              </g>
              <g fill="#ffdc35" stroke="#613619" strokeWidth="7">
                <circle cx="288" cy="486" r="18"/><circle cx="402" cy="520" r="18"/><circle cx="603" cy="510" r="18"/>
                <circle cx="835" cy="490" r="18"/><circle cx="1054" cy="471" r="18"/><circle cx="1175" cy="420" r="18"/>
              </g>
              <g fontFamily="Georgia,serif" fontWeight="bold" fill="#49270f" textAnchor="middle" filter="url(#mapShadow)">
                <text x="180" y="597" fontSize="43">{t.scenes[0].name}</text>
                <text x="405" y="585" fontSize="36">{t.scenes[1].name}</text>
                <text x="740" y="589" fontSize="36">{language === 'English' ? 'Sinai Desert' : language === 'Português' ? 'Deserto do Sinai' : 'Desierto del Sinaí'}</text>
                <text x="1125" y="567" fontSize="35">{t.scenes[3].name}</text>
                <text x="1388" y="510" fontSize="44">{t.scenes[4].name}</text>
              </g>
              <g fill="#ffdc39" stroke="#673619" strokeWidth="8" filter="url(#mapShadow)">
                <path d="M110 680h360l-28 42H138z"/><path d="M600 680h400l-25 42H625z"/><path d="M1100 680h380l-28 42h-324z"/>
              </g>
              <text x="800" y="823" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="bold" fontSize="41" fill="#633b18">{language === 'English' ? 'THE JOURNEY OF GOD’S PEOPLE · FROM EGYPT TO JERICHO' : language === 'Português' ? 'A JORNADA DO POVO DE DEUS · DO EGITO A JERICÓ' : 'EL VIAJE DEL PUEBLO DE DIOS · DE EGIPTO A JERICÓ'}</text>
            </svg>
            <div className="journey-map-markers" aria-label={t.positionAria}>
              {players.map((player, index) => {
                const position = getJourneyMapPosition(player.steps);
                const spread = (index - (players.length - 1) / 2) * 2;
                return (
                  <div className="journey-map-marker" key={player.id}
                    style={{ left: `${Math.max(5, Math.min(95, position.x + spread))}%`, top: `${Math.max(18, Math.min(68, position.y + (index % 2 ? 1.8 : 0)))}%` }}
                    title={`${player.name}: ${player.steps}/30 ${t.stepsUnit}`}>
                    <b>{player.name}</b>
                    <Sprite character={player.character} />
                  </div>
                );
              })}
            </div>
            <div className="journey-map-dock">
              <div className="journey-map-dock-heading">
                <strong>{screen === 'routeMap' ? t.advanceHeading : t.startingHeading}</strong>
                <span>{screen === 'routeMap' ? t.ownRoute : t.everyoneStarts}</span>
              </div>
              <div className="journey-map-player-list">
                {players.map((player) => (
                  <div className="journey-map-player-card" key={player.id}>
                    <Sprite character={player.character} />
                    <div className="journey-map-player-info">
                      <b>{player.name}</b>
                      <small>{sceneForSteps(player.steps).name} · {player.steps}/30 {t.stepsUnit}</small>
                      <div className="meter"><i style={{ width: `${(player.steps / 30) * 100}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="journey-map-footer">
            <p>{screen === 'routeMap' ? t.routeContinue : t.routeIntro}</p>
            {screen === 'map' && <div className="map-intro-countdown"><span>{t.countdown}</span><i /></div>}
            {screen === 'routeMap' && <small>{t.nextTurnAuto}</small>}
          </div>
        </section>
      )}

      {screen === 'advance' && advancePayload && (
        <section className="advance-screen">
          {(() => {
            const sceneIndex = sceneIndexForStep(advanceFromSteps);
            const scene = sceneForSteps(advanceFromSteps);
            const segmentEnd = Math.min(advancePayload.toSteps, (Math.floor(advanceFromSteps / 6) + 1) * 6);
            const shownSteps = Math.min(segmentEnd, advanceFromSteps + animatedStepCount);
            const localStep = advancePayload.correct ? Math.min(6, (advanceFromSteps % 6) + animatedStepCount) : advanceFromSteps % 6;
            const pan = Math.max(0, Math.min(100, (localStep / 6) * 100));
            return <>
              <div className="advance-heading"><span>JERICO · {scene.name.toUpperCase()}</span><b>{advancePayload.correct ? `${t.advance} ${advancePayload.steps} ${advancePayload.steps === 1 ? t.stepUnit : t.stepsUnit}` : t.pathWait}</b></div>
              <div className="advance-playfield" style={{ backgroundImage: `url("${ASSET(scene.asset)}")`, backgroundPosition: 'center center', backgroundSize: '100% 100%' }}>
                <div className="advance-sky-vignette" />
                <div className="advance-road" />
                {players.map((player, index) => {
                  const isMoving = player.id === advancePayload.playerId;
                  const playerStep = isMoving ? shownSteps : player.steps;
                  const playerScene = sceneIndexForStep(playerStep);
                  if (playerScene !== sceneIndex && !isMoving) return null;
                  const positionStep = isMoving ? localStep : playerStep % 6;
                  const left = 8 + (Math.min(6, Math.max(0, positionStep)) / 6) * 82;
                  return <div className={`advance-actor ${isMoving ? 'active-actor' : ''}`} key={player.id} style={{ left: `${left}%`, bottom: `${8 + (index % 2) * 2}%` }}>
                    <Sprite character={player.character} walking={isMoving && advancePayload.correct} className="advance-sprite" />
                    <b>{player.name}</b>
                    <small>{isMoving ? shownSteps : player.steps}/30</small>
                  </div>;
                })}
                <div className="advance-step-counter"><span>{t.steps}</span><b>{shownSteps}/30</b><i><em style={{ width: `${(shownSteps / 30) * 100}%` }} /></i></div>
              </div>
              <div className="advance-footer">
                <div className="advance-active-player"><Sprite character={players.find((p) => p.id === advancePayload.playerId)?.character || CHARACTERS[0]} walking={advancePayload.correct} /><div><b>{players.find((p) => p.id === advancePayload.playerId)?.name}</b><small>{advancePayload.correct ? t.advancing : t.noAdvance}</small></div></div>
                <div className="advance-roster">{players.map((player) => <div key={player.id}><Sprite character={player.character} /><span>{player.name}</span><b>{player.id === advancePayload.playerId ? shownSteps : player.steps}/30</b></div>)}</div>
              </div>
            </>;
          })()}
        </section>
      )}

      {screen === 'board' && activePlayer && (
        <section className="board">
          <div className="board-head">
            <div><p className="eyebrow">{t.turn.toUpperCase()} {activePlayer.name.toUpperCase()}</p><h2>{sceneForSteps(activePlayer.steps).name}</h2><p>{sceneForSteps(activePlayer.steps).detail} · {t.regionProgress.replace('{current}', activePlayer.steps % 6)}</p></div>
            <div className="turn-avatar"><Sprite character={activePlayer.character} /></div>
          </div>
          <div className="scene-track" style={{ backgroundImage: `url("${ASSET(SCENES[currentSceneIndex].asset)}")`, backgroundSize: '100% 100%' }}>
            <div className="scene-overlay" />
            <div className="scene-labels">{localizedScenes.map((scene, index) => <span key={scene.id} className={index === currentSceneIndex ? 'active' : ''}>{scene.name}</span>)}</div>
            <div className="path-markers">{stageMarkers.map((marker) => <span key={marker} className={marker <= (activePlayer.steps % 6) ? 'passed' : ''} />)}</div>
            {players.map((player, index) => {
              if (sceneIndexForStep(player.steps) !== currentSceneIndex) return null;
              const localStep = player.steps % 6;
              const left = 8 + (localStep / 6) * 82;
              return <div className="track-player" key={player.id} style={{ left: `${left}%`, bottom: `${14 + index * 46}px` }}><Sprite character={player.character} walking={player.id === movingPlayerId} /><b>{player.name}</b></div>;
            })}
            <div className="path-line" />
          </div>
          <div className="player-progress">
            {players.map((player, index) => <div className={`progress-card ${index === turn ? 'current' : ''}`} key={player.id}><Sprite character={player.character} /><div className="progress-details"><b>{player.name}</b><small>{player.steps}/30 pasos · {sceneForSteps(player.steps).name}</small><div className="meter"><i style={{ width: `${percentByPlayer[index]}%` }} /></div></div></div>)}
          </div>
          <div className="turn-actions">
            <p>{t.difficulty}</p>
            <div className="difficulty">{localizedLevels.map((item) => <button key={item.id} type="button" className={item.color} onClick={() => askQuestion(item)}><b>{item.label}</b><small>+{item.steps} {item.steps > 1 ? t.stepsUnit : t.stepUnit}</small></button>)}</div>
            <p className="bank-status" aria-live={notificationsOn ? 'polite' : 'off'}>{notificationsOn ? t.turnStatus.replace('{name}', activePlayer.name) + ' ' : ''}{questionBank?.length === 300 ? t.bankReady : bankError === 'load' ? t.bankError : bankError === 'selection' ? t.selectionError : t.loadingBank}</p>
          </div>
        </section>
      )}

      {screen === 'question' && question && level && (
        <section className="panel question-panel">
          <p className="eyebrow">{level.label.toUpperCase()} · {t.advance} {level.steps} {level.steps > 1 ? t.stepsUnit : t.stepUnit}</p>
          <h2>{question.text}</h2>
          <div className="answers">
            {question.options.map((option, index) => <button key={`${question.id}-${index}`} type="button" className={answer === index ? 'answer selected' : 'answer'} onClick={() => { setAnswer(index); playSound('tap'); }}><span>{String.fromCharCode(65 + index)}</span>{option.text}</button>)}
          </div>
          <p className="reference">{t.reference}: {question.reference}</p>
          <div className="question-actions"><button className="text-button" type="button" onClick={() => { setUsedQuestionIds(question.previousUsedIds); setQuestion(null); setAnswer(null); setScreen('board'); }}>{t.questionCancel}</button><button className="primary" type="button" disabled={answer === null} onClick={submitAnswer}>{t.answer}</button></div>
        </section>
      )}

      {screen === 'feedback' && feedback && (
        <div className="modal-backdrop">
          <div className={`feedback-card ${feedback.correct ? 'good' : 'bad'}`}>
            <div className="feedback-icon">{feedback.correct ? '✦' : '×'}</div>
            <h2>{feedback.correct ? t.correct : t.incorrect}</h2>
            <p>{feedback.correct ? `${t.move} +${feedback.steps} paso(s)` : t.noMove}</p>
            {feedback.winner && <p className="winner-note">{t.feedbackWinner.replace('{name}', winner?.name || '')}</p>}
          </div>
        </div>
      )}

      {screen === 'collapse' && (
        <section className={`collapse-screen ${wallFrame === 3 || wallFrame === 4 ? 'heavy-shake' : 'light-shake'}`}>
          <p className="eyebrow">{t.collapseEyebrow}</p>
          <h2>{t.victory}</h2>
          <div className="wall-frame">
            <img src={ASSET(`wall-${wallFrame}.webp`)} alt={t.wallAlt.replace('{frame}', wallFrame)} />
          </div>
          <p>{t.collapseCaption}</p>
        </section>
      )}

      {screen === 'story' && (
        <section className="panel parchment story-panel">
          <p className="eyebrow">{t.storyEyebrow}</p>
          <h2>{t.storyTitle}</h2>
          <div className="scripture">
            <p><strong>1</strong> {t.story[0]}</p>
            <p><strong>2</strong> {t.story[1]} <strong>3</strong> {t.story[2]} <strong>4</strong> {t.story[3]} <strong>5</strong> {t.story[4]}</p>
          </div>
          <b className="scripture-ref">Josué 6:1–5</b>
          <button className="primary" type="button" onClick={() => setScreen('victory')}>{t.continue}</button>
        </section>
      )}

      {screen === 'victory' && (
        <section className="victory-screen" style={{ backgroundImage: `linear-gradient(180deg, #281c2a50, #281c2aee), url("${ASSET('stage-jericho.webp')}")` }}>
          <div className="victory-overlay">
            <div className="victory-crown">♛</div>
            <p className="eyebrow">{t.victoryEyebrow}</p>
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
