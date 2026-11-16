import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TEXT } from './gameLocales.js';
import OnlineMode from './online/OnlineMode.jsx';
import './style.css';
import './responsive.css';
import { validateQuestionBank, selectQuestionForTurn, resolveAnswer, sceneIndexForStep, nextAvailableCharacter, getJourneyMapPosition } from './gameEngine.js';
import { recordVisit } from './visitTracking.js';

const ASSET = (name) => `${import.meta.env.BASE_URL}assets/${name}`;
const DATA = (name) => `${import.meta.env.BASE_URL}data/${name}`;

const SCENES = [
  { id: 'egypt', asset: 'stage-egypt.webp' },
  { id: 'redSea', asset: 'stage-red-sea.webp' },
  { id: 'sinai', asset: 'stage-sinai.webp' },
  { id: 'jordan', asset: 'stage-jordan.webp' },
  { id: 'jericho', asset: 'stage-jericho.webp' }
];
const CHARACTERS = [
  { id: 'warrior', row: 0 },
  { id: 'soldier', row: 1 },
  { id: 'trumpeter', row: 2 },
  { id: 'woman', row: 3 }
];
const LEVELS = [
  { id: 'facil', steps: 1, color: 'easy' },
  { id: 'medio', steps: 2, color: 'medium' },
  { id: 'dificil', steps: 3, color: 'hard' }
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
  const isolatedSheet = className.split(/\s+/).includes('character-select-sprite');
  const frameStepX = isolatedSheet ? 65 : 60;
  const frameStepY = isolatedSheet ? 115 : 110;
  const spriteAsset = isolatedSheet ? 'characters-sprites-padded.webp' : 'characters-sprites.webp';
  return <span className={`sprite sprite-${character.id} ${walking ? 'is-walking' : ''} ${className}`} style={{ '--sprite-x': `${frame * -frameStepX}px`, '--sprite-y': `${character.row * -frameStepY}px`, '--sprite-image': `url("${ASSET(spriteAsset)}")` }} aria-label={character.name} />;
}

function App() {
  const [screen, setScreen] = useState('menu');
  const [visitCount, setVisitCount] = useState(null);
  const visitTracked = useRef(false);

  useEffect(() => {
    if (visitTracked.current) return;
    visitTracked.current = true;
    recordVisit().then(setVisitCount).catch(() => setVisitCount(-1));
  }, []);
  const [settingsReturnScreen, setSettingsReturnScreen] = useState('menu');
  const [language, setLanguage] = useState(() => {
    try {
      const saved = window.localStorage.getItem('jerico-language');
      return ['Español', 'Português', 'English'].includes(saved) ? saved : 'Español';
    } catch {
      return 'Español';
    }
  });
  const t = TEXT[language] || TEXT.Español;
  const localeCode = ({ Español: 'es', Português: 'pt', English: 'en' })[language] || 'es';
  const visitLabel = ({ es: 'entradas', pt: 'acessos', en: 'visits' })[localeCode];
  const playerDefault = (locale, number) => ({ Español: 'Jugador', Português: 'Jogador', English: 'Player' }[locale] || 'Player') + ' ' + number;
  const defaultNames = (locale) => Array.from({ length: 4 }, (_, index) => playerDefault(locale, index + 1));
  const localizedCharacters = CHARACTERS.map((character) => ({ ...character, ...t.characters[character.id] }));
  const localizedLevels = LEVELS.map((item) => ({ ...item, label: t.levels[item.id] }));
  const localizedScenes = SCENES.map((scene, index) => ({ ...scene, ...t.scenes[index] }));
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
      setPlayers((current) => current.map((player) => ({
        ...player, character: { ...player.character, ...TEXT[language].characters[player.character.id] }
      })));
      setWinner((current) => current ? ({
        ...current, character: { ...current.character, ...TEXT[language].characters[current.character.id] }
      }) : current);
      previousLanguage.current = language;
    }
  }, [language]);
  useEffect(() => {
    const roomCode = new URLSearchParams(window.location.search).get('room');
    if (roomCode) setScreen('online');
  }, []);

  useEffect(() => {
    document.documentElement.lang = localeCode;
    document.title = t.pageTitle;
  }, [localeCode, t.pageTitle]);

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
            <button className="primary menu-start-button" type="button" onClick={startSetup}>{t.start} <span>▶</span></button>
            <button className="secondary online-menu-button menu-online-button" type="button" onClick={() => setScreen('online')}>Jugar en línea <span>🌐</span></button>
            <button className="secondary menu-instructions-button" type="button" onClick={() => setScreen('instructions')}>{t.how}</button>
            <button className="secondary menu-settings-button" type="button" onClick={openSettings}>{t.settings}</button>
            {!isBankReady && <p className="menu-status">{bankError === 'load' ? t.bankError : t.bankLoading}</p>}
          </div>
          <div className="menu-party" aria-hidden="true">{localizedCharacters.map((character) => <Sprite key={character.id} character={character} />)}</div>
          <div className="hero-bottom">{t.heroBottom}</div>
          <div className="visit-counter" role="status" aria-live="polite">
            <span aria-hidden="true">◉</span>
            <span>{visitCount === null ? '…' : visitCount < 0 ? '—' : visitCount.toLocaleString(localeCode)} {visitLabel}</span>
          </div>
        </section>
      )}

      {screen === 'online' && (
        <OnlineMode
          onExit={() => setScreen('menu')}
          questionBank={questionBank}
          language={localeCode}
          characters={localizedCharacters}
        />
      )}

      {screen === 'instructions' && (
        <section className="panel parchment instruction-panel">
          <p className="eyebrow">{t.instructionsEyebrow}</p>
          <h2>{t.instructionsTitle}</h2>
          <p>{t.instructionsIntro}</p>
          <ol>{t.instructionsRules.map((rule, index) => <li key={index}>{rule}</li>)}</ol>
          <h3>{t.onlineInstructionsTitle}</h3>
          <p>{t.onlineInstructionsIntro}</p>
          <ol>{t.onlineInstructionsRules.map((rule, index) => <li key={index}>{rule}</li>)}</ol>
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
          {settingsModal && <div className="modal-backdrop" role="presentation" onClick={() => setSettingsModal('')}><div className="settings-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label={t.settingsClose} onClick={() => setSettingsModal('')}>×</button><h3>{settingsModal === 'support' ? t.support : settingsModal === 'credits' ? t.credits : t.termsPrivacy}</h3><p>{settingsModal === 'support' ? <>{t.supportText} <a href="mailto:Samuel.Ihad@gmail.com">Samuel.Ihad@gmail.com</a></> : settingsModal === 'credits' ? t.creditsText : t.privacyText}</p></div></div>}
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
                  <div className="character-spotlight"><Sprite character={localizedCharacters[focusedCharacter]} className="character-select-sprite" /></div>
                  <h3>{localizedCharacters[focusedCharacter].name}</h3>
                  <p>{localizedCharacters[focusedCharacter].description}</p>
                  <div className="character-dots">{localizedCharacters.map((character, index) => <button key={character.id} type="button" className={index === focusedCharacter ? 'dot active' : 'dot'} disabled={selections.includes(index)} onClick={() => chooseFocus(index)} aria-label={character.name} />)}</div>
                </div>
                <button className="carousel-arrow" type="button" aria-label={t.nextCharacter} onClick={() => { setFocusedCharacter((current) => nextAvailableCharacter(current, 1, selections)); playSound('tap'); }}>›</button>
              </div>
              <div className="character-roster">
                {localizedCharacters.map((character, index) => <button key={character.id} type="button" disabled={selections.includes(index)} className={`roster-item ${index === focusedCharacter ? 'selected' : ''} ${selections.includes(index) ? 'locked' : ''}`} onClick={() => chooseFocus(index)}><Sprite character={character} className="character-select-sprite" /><b>{character.name}</b>{selections.includes(index) && <small>{t.chosen}</small>}</button>)}
              </div>
              <div className="keyboard-hint">{t.keyboardHint}</div>
              <button className="primary" type="button" disabled={selections.includes(focusedCharacter)} onClick={confirmCharacter}>{t.confirm}</button>
            </>
          ) : (
            <>
              <div className="selected-players">{players.length ? null : names.slice(0, playerCount).map((name, index) => <div key={name}><Sprite character={localizedCharacters[selections[index]]} /> <b>{name}</b></div>)}</div>
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
            <img className="journey-map-illustration" src={ASSET('journey-map.svg')} alt={t.mapAria} draggable="false" />
            <div className="journey-map-markers" aria-label={t.positionAria}>
              {players.map((player, index) => {
                const position = getJourneyMapPosition(player.steps);
                const spread = (index - (players.length - 1) / 2) * 1.5;
                return (
                  <div className="journey-map-marker" key={player.id}
                    style={{ left: `${Math.max(5, Math.min(95, position.x + spread))}%`, top: `${Math.max(18, Math.min(68, position.y + (index % 2 ? 1.0 : 0)))}%` }}
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
                <div className="advance-active-player"><Sprite character={players.find((p) => p.id === advancePayload.playerId)?.character || localizedCharacters[0]} walking={advancePayload.correct} /><div><b>{players.find((p) => p.id === advancePayload.playerId)?.name}</b><small>{advancePayload.correct ? t.advancing : t.noAdvance}</small></div></div>
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
          <b className="scripture-ref">{t.storyReference}</b>
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
