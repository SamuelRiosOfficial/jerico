import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getJourneyMapPosition, sceneIndexForStep } from '../gameEngine.js';

const ASSET = (name) => import.meta.env.BASE_URL + 'assets/' + name;
const CHARACTER_ROWS = Object.freeze({ warrior: 0, soldier: 1, trumpeter: 2, woman: 3 });

function OnlineSprite({ characterId, walking = false, className = '' }) {
  const row = CHARACTER_ROWS[characterId] ?? 0;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!walking) {
      setFrame(0);
      return undefined;
    }
    const walkCycle = [1, 2, 1, 2, 0];
    let cycleIndex = 0;
    const timer = window.setInterval(() => {
      setFrame(walkCycle[cycleIndex]);
      cycleIndex = (cycleIndex + 1) % walkCycle.length;
    }, 180);
    return () => window.clearInterval(timer);
  }, [walking]);

  return (
    <span
      className={'sprite sprite-' + characterId + (walking ? ' is-walking' : '') + (className ? ' ' + className : '')}
      style={{
        '--sprite-x': (frame * -60) + 'px',
        '--sprite-y': (row * -110) + 'px',
        '--sprite-image': 'url("' + ASSET('characters-sprites.webp') + '")'
      }}
      aria-hidden="true"
    />
  );
}

function interpolate(value, from, to) {
  return from.replace('{value}', String(value)).replace('{current}', String(value)).replace('{name}', String(value));
}

export default function OnlineGameView({
  gameState,
  roomCode,
  language,
  scenes = [],
  gameText = {},
  onlineText = {},
  questionBank,
  busy,
  selectedAnswer,
  setSelectedAnswer,
  askQuestion,
  submitAnswer,
  continueTurn,
  canContinue,
  onExit
}) {
  const players = gameState?.players || [];
  const turn = Number.isInteger(gameState?.turn) ? gameState.turn : 0;
  const activePlayer = players[turn] || null;
  const question = gameState?.question || null;
  const feedback = gameState?.feedback || null;
  const winner = gameState?.winner || null;
  const [view, setView] = useState('mapIntro');
  const [activeAdvance, setActiveAdvance] = useState(null);
  const [animatedStepCount, setAnimatedStepCount] = useState(0);
  const [wallFrame, setWallFrame] = useState(1);
  const hasShownIntro = useRef(false);
  const seenAnimationId = useRef(null);

  const localizedScenes = scenes.length ? scenes : [
    { id: 'egypt', asset: 'stage-egypt.webp', name: 'Egipto', detail: 'Las tierras del faraón' },
    { id: 'redSea', asset: 'stage-red-sea.webp', name: 'Mar Rojo', detail: 'El camino entre las aguas' },
    { id: 'sinai', asset: 'stage-sinai.webp', name: 'Monte Sinaí', detail: 'La montaña de Dios' },
    { id: 'jordan', asset: 'stage-jordan.webp', name: 'Río Jordán', detail: 'Cruza hacia la promesa' },
    { id: 'jericho', asset: 'stage-jericho.webp', name: 'Jericó', detail: 'La ciudad fortificada' }
  ];
  const sceneForSteps = (steps) => localizedScenes[sceneIndexForStep(steps)] || localizedScenes[0];
  const currentSceneIndex = activePlayer ? sceneIndexForStep(activePlayer.steps) : 0;
  const stageMarkers = [1, 2, 3, 4, 5, 6];
  const activeScene = sceneForSteps(activePlayer?.steps || 0);
  const regionProgress = (activePlayer?.steps || 0) % 6;
  const percentByPlayer = useMemo(
    () => players.map((player) => (Math.max(0, Math.min(30, player.steps || 0)) / 30) * 100),
    [players]
  );
  const stepLabel = (steps) => (steps === 1 ? (gameText.stepUnit || 'paso') : (gameText.stepsUnit || 'pasos'));
  const regionLabel = (current) => (gameText.regionProgress || '{current}/6 pasos en esta región').replace('{current}', String(current));
  const levelName = (id) => gameText.levels?.[id] || ({ facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' }[id]);
  const translation = (key, fallback) => gameText[key] || fallback;
  const winnerName = winner?.name || players.find((player) => player.steps >= 30)?.name || '';

  useEffect(() => {
    const phase = gameState?.phase;
    if (!phase) return undefined;

    if (phase === 'board') {
      if (!hasShownIntro.current) {
        setView('mapIntro');
        const timer = window.setTimeout(() => {
          hasShownIntro.current = true;
          setView('board');
        }, 6500);
        return () => window.clearTimeout(timer);
      }
      setView('board');
      return undefined;
    }

    if (phase === 'question') {
      setView('question');
      return undefined;
    }

    if (phase === 'feedback' || phase === 'finished') {
      const currentFeedback = gameState.feedback || {};
      const animationId = currentFeedback.animationId;
      if (animationId && seenAnimationId.current !== animationId) {
        seenAnimationId.current = animationId;
        setActiveAdvance({
          animationId,
          playerId: currentFeedback.playerId || players[turn]?.id,
          fromSteps: Number.isFinite(currentFeedback.fromSteps) ? currentFeedback.fromSteps : (players[turn]?.steps || 0),
          toSteps: Number.isFinite(currentFeedback.toSteps) ? currentFeedback.toSteps : (players[turn]?.steps || 0),
          correct: Boolean(currentFeedback.correct),
          steps: Number(currentFeedback.steps || 0),
          winner: phase === 'finished' || Boolean(gameState.winner)
        });
        setAnimatedStepCount(0);
        setView('feedback');
        const timer = window.setTimeout(() => setView('advance'), 4000);
        return () => window.clearTimeout(timer);
      }

      if (phase === 'finished' && !animationId) setView('collapse');
      else if (phase === 'feedback' && !animationId) setView('board');
    }
    return undefined;
  }, [gameState?.phase, gameState?.feedback?.animationId]);

  useEffect(() => {
    if (view !== 'advance' || !activeAdvance) return undefined;
    const segmentEnd = Math.min(
      activeAdvance.toSteps,
      (Math.floor(activeAdvance.fromSteps / 6) + 1) * 6
    );
    const segmentSteps = Math.max(0, segmentEnd - activeAdvance.fromSteps);
    let interval = null;
    let finishTimer = null;
    let completedSteps = 0;

    const finishSegment = () => {
      setAnimatedStepCount(segmentSteps);
      if (segmentEnd < activeAdvance.toSteps) {
        setActiveAdvance((current) => ({ ...current, fromSteps: segmentEnd }));
        setAnimatedStepCount(0);
        setView('routeMap');
      } else if (activeAdvance.winner) {
        setView('collapse');
      } else {
        setView('board');
      }
    };

    if (!activeAdvance.correct || segmentSteps <= 0) {
      finishTimer = window.setTimeout(finishSegment, 1450);
    } else {
      interval = window.setInterval(() => {
        completedSteps += 1;
        setAnimatedStepCount(completedSteps);
        if (completedSteps >= segmentSteps) {
          window.clearInterval(interval);
          finishTimer = window.setTimeout(finishSegment, 550);
        }
      }, 520);
    }

    return () => {
      if (interval) window.clearInterval(interval);
      if (finishTimer) window.clearTimeout(finishTimer);
    };
  }, [view, activeAdvance?.animationId, activeAdvance?.fromSteps]);

  useEffect(() => {
    if (view !== 'routeMap') return undefined;
    const timer = window.setTimeout(() => setView('advance'), 3200);
    return () => window.clearTimeout(timer);
  }, [view, activeAdvance?.fromSteps]);

  useEffect(() => {
    if (view !== 'collapse') return undefined;
    setWallFrame(1);
    const timers = [1, 2, 3, 4, 5].map((frame) => window.setTimeout(() => {
      setWallFrame(frame);
      if (frame === 5) window.setTimeout(() => setView('story'), 1100);
    }, (frame - 1) * 1050));
    return () => timers.forEach(window.clearTimeout);
  }, [view]);

  if (!gameState) return null;

  const renderMap = (isProgress) => (
    <section className="map-screen">
      <div className="journey-map-artboard">
        <img className="journey-map-illustration" src={ASSET('journey-map.svg')} alt={gameText.mapAria || 'Mapa del viaje de Egipto a Jericó'} draggable="false" />
        <div className="journey-map-markers" aria-label={gameText.positionAria || 'Posición de los jugadores'}>
          {players.map((player, index) => {
            const position = getJourneyMapPosition(player.steps || 0);
            const spread = (index - (players.length - 1) / 2) * 0.45;
            const left = Math.max(5, Math.min(95, position.x + spread));
            const top = Math.max(18, Math.min(68, position.y));
            return (
              <div className="journey-map-marker" key={player.id}
                style={{ left: left + '%', top: top + '%' }}
                title={player.name + ': ' + player.steps + '/30 ' + (gameText.stepsUnit || 'pasos')}>
                <b>{player.name}</b>
                <OnlineSprite characterId={player.characterId} />
              </div>
            );
          })}
        </div>
        <div className="journey-map-dock">
          <div className="journey-map-dock-heading">
            <strong>{isProgress ? (gameText.advanceHeading || 'AVANCE DE LOS JUGADORES') : (gameText.startingHeading || 'JUGADORES EN EL PUNTO DE PARTIDA')}</strong>
            <span>{isProgress ? (gameText.ownRoute || 'Cada personaje avanza por su propia ruta') : (gameText.everyoneStarts || 'Todos comienzan en Egipto')}</span>
          </div>
          <div className="journey-map-player-list">
            {players.map((player) => (
              <div className="journey-map-player-card" key={player.id}>
                <OnlineSprite characterId={player.characterId} />
                <div className="journey-map-player-info">
                  <b>{player.name}</b>
                  <small>{sceneForSteps(player.steps || 0).name} · {player.steps}/30 {gameText.stepsUnit || 'pasos'}</small>
                  <div className="meter"><i style={{ width: ((player.steps || 0) / 30 * 100) + '%' }} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="journey-map-footer">
        <p>{isProgress ? (gameText.routeContinue || 'El recorrido continúa. Observa cómo cambia la posición de cada jugador.') : (gameText.routeIntro || 'Acompaña al pueblo de Israel desde Egipto hasta Jericó.')}</p>
        {!isProgress && <div className="map-intro-countdown"><span>{gameText.countdown || 'La aventura comenzará automáticamente'}</span><i /></div>}
        {isProgress && <small>{gameText.nextTurnAuto || 'El siguiente turno comenzará automáticamente.'}</small>}
      </div>
    </section>
  );

  const renderAdvance = () => {
    const advance = activeAdvance;
    const fromSteps = advance?.fromSteps || 0;
    const sceneIndex = sceneIndexForStep(fromSteps);
    const scene = sceneForSteps(fromSteps);
    const segmentEnd = Math.min(advance?.toSteps || 0, (Math.floor(fromSteps / 6) + 1) * 6);
    const shownSteps = Math.min(segmentEnd, fromSteps + animatedStepCount);
    const localStep = advance?.correct ? Math.min(6, (fromSteps % 6) + animatedStepCount) : fromSteps % 6;
    const movingPlayer = players.find((player) => player.id === advance?.playerId);
    const advancingText = advance?.correct
      ? (gameText.advancing || 'Avanzando por el camino...')
      : (gameText.noAdvance || 'No hubo avance en este turno.');

    return (
      <section className="advance-screen">
        <div className="advance-heading">
          <span>JERICO · {(scene?.name || '').toUpperCase()}</span>
          <b>{advance?.correct ? (translation('advance', 'AVANZA') + ' ' + advance.steps + ' ' + stepLabel(advance.steps)) : (gameText.pathWait || 'EL CAMINO ESPERA')}</b>
        </div>
        <div className="advance-playfield" style={{ backgroundImage: 'url("' + ASSET(scene?.asset || 'stage-egypt.webp') + '")', backgroundPosition: 'center center', backgroundSize: '100% 100%' }}>
          <div className="advance-sky-vignette" />
          <div className="advance-road" />
          {players.map((player, index) => {
            const isMoving = player.id === advance?.playerId;
            const playerStep = isMoving ? shownSteps : (player.steps || 0);
            const playerScene = sceneIndexForStep(playerStep);
            if (playerScene !== sceneIndex && !isMoving) return null;
            const positionStep = isMoving ? localStep : playerStep % 6;
            const left = 8 + (Math.min(6, Math.max(0, positionStep)) / 6) * 82;
            return (
              <div className={'advance-actor' + (isMoving ? ' active-actor' : '')} key={player.id}
                style={{ left: left + '%', bottom: (8 + (index % 2) * 2) + '%' }}>
                <OnlineSprite characterId={player.characterId} walking={isMoving && advance?.correct} className="advance-sprite" />
                <b>{player.name}</b>
                <small>{isMoving ? shownSteps : player.steps}/30</small>
              </div>
            );
          })}
          <div className="advance-step-counter">
            <span>{gameText.steps || 'PASOS'}</span>
            <b>{shownSteps}/30</b>
            <i><em style={{ width: (shownSteps / 30 * 100) + '%' }} /></i>
          </div>
        </div>
        <div className="advance-footer">
          <div className="advance-active-player">
            <OnlineSprite characterId={movingPlayer?.characterId || players[0]?.characterId} walking={Boolean(advance?.correct)} />
            <div><b>{movingPlayer?.name}</b><small>{advancingText}</small></div>
          </div>
          <div className="advance-roster">
            {players.map((player) => (
              <div key={player.id}>
                <OnlineSprite characterId={player.characterId} />
                <span>{player.name}</span>
                <b>{player.id === advance?.playerId ? shownSteps : player.steps}/30</b>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderBoard = () => {
    if (!activePlayer) return null;
    const scene = activeScene || sceneForSteps(activePlayer.steps);
    return (
      <section className="board online-board">
        <div className="board-head">
          <div>
            <p className="eyebrow">{(gameText.turn || 'Turno de').toUpperCase()} {activePlayer.name.toUpperCase()}</p>
            <h2>{scene.name}</h2>
            <p>{scene.detail} · {regionLabel(regionProgress)}</p>
          </div>
          <div className="turn-avatar"><OnlineSprite characterId={activePlayer.characterId} /></div>
        </div>
        <div className="scene-track" style={{ backgroundImage: 'url("' + ASSET(scene.asset) + '")', backgroundSize: '100% 100%' }}>
          <div className="scene-overlay" />
          <div className="scene-labels">
            {localizedScenes.map((item, index) => <span key={item.id} className={index === currentSceneIndex ? 'active' : ''}>{item.name}</span>)}
          </div>
          <div className="path-markers">
            {stageMarkers.map((marker) => <span key={marker} className={marker <= regionProgress ? 'passed' : ''} />)}
          </div>
          {players.map((player, index) => {
            if (sceneIndexForStep(player.steps || 0) !== currentSceneIndex) return null;
            const localStep = (player.steps || 0) % 6;
            const left = 8 + (localStep / 6) * 82;
            return (
              <div className="track-player" key={player.id}
                style={{ left: left + '%', bottom: (14 + index * 46) + 'px' }}>
                <OnlineSprite characterId={player.characterId} className="online-track-sprite" />
                <b>{player.name}</b>
              </div>
            );
          })}
          <div className="path-line" />
        </div>
        <div className="player-progress">
          {players.map((player, index) => (
            <div className={'progress-card' + (index === turn ? ' current' : '')} key={player.id}>
              <OnlineSprite characterId={player.characterId} />
              <div className="progress-details">
                <b>{player.name}</b>
                <small>{player.steps}/30 {gameText.stepsUnit || 'pasos'} · {sceneForSteps(player.steps).name}</small>
                <div className="meter"><i style={{ width: (percentByPlayer[index] || 0) + '%' }} /></div>
              </div>
            </div>
          ))}
        </div>
        <div className="turn-actions online-turn-actions">
          {gameState.phase === 'board' ? (
            <>
              <p>{gameText.difficulty || 'Elige la dificultad para responder una pregunta bíblica.'}</p>
              <div className="difficulty">
                {['facil', 'medio', 'dificil'].map((id) => {
                  const steps = id === 'facil' ? 1 : id === 'medio' ? 2 : 3;
                  const color = id === 'facil' ? 'easy' : id === 'medio' ? 'medium' : 'hard';
                  return (
                    <button key={id} type="button" className={color}
                      disabled={!questionBank || !isActiveTurn || busy}
                      onClick={() => askQuestion({ id, steps, color })}>
                      <b>{levelName(id)}</b><small>+{steps} {stepLabel(steps)}</small>
                    </button>
                  );
                })}
              </div>
              <p className="bank-status">{questionBank ? (gameText.bankReady || 'Preguntas listas') : (gameText.loadingBank || 'Cargando banco de preguntas...')}</p>
              {!isActiveTurn && <p className="online-wait">{onlineText.waiting || 'Espera el turno de'} {activePlayer.name}</p>}
            </>
          ) : (
            <>
              <p>{feedback?.correct ? (gameText.correct || '¡Respuesta correcta!') : (gameText.incorrect || '¡Respuesta incorrecta!')}</p>
              <p>{feedback?.playerName || activePlayer.name} · {feedback?.correct ? (gameText.move || 'Avanzas') : (gameText.noMove || 'No avanzas')} {feedback?.steps || 0} {stepLabel(feedback?.steps || 0)}</p>
              {canContinue
                ? <button className="primary" type="button" disabled={busy} onClick={continueTurn}>{gameText.continue || onlineText.continue || 'Continuar'}</button>
                : <p className="online-wait">{onlineText.waiting || 'Esperando a que continúe la partida...'}</p>}
            </>
          )}
        </div>
      </section>
    );
  };

  const renderQuestion = () => (
    <section className="panel question-panel online-question-panel">
      <p className="eyebrow">{question?.steps || 1} {stepLabel(question?.steps || 1)} · {gameText.question || 'Responde para avanzar'}</p>
      <h2>{question?.text}</h2>
      <div className="answers">
        {(question?.options || []).map((option, index) => (
          <button key={question.id + '-' + index} type="button"
            className={selectedAnswer === index ? 'answer selected' : 'answer'}
            disabled={!isMyTurn || busy}
            onClick={() => setSelectedAnswer(index)}>
            <span>{String.fromCharCode(65 + index)}</span>{option.text}
          </button>
        ))}
      </div>
      <p className="reference">{gameText.reference || 'Referencia bíblica'}: {question?.reference}</p>
      {isMyTurn
        ? <button className="primary" type="button" disabled={busy || selectedAnswer === null} onClick={submitAnswer}>{onlineText.answer || gameText.answer || 'Responder'}</button>
        : <p className="online-wait">{onlineText.waiting || 'Espera a que el jugador responda.'}</p>}
    </section>
  );

  const renderFeedback = () => (
    <div className="modal-backdrop online-feedback-backdrop">
      <div className={'feedback-card ' + (feedback?.correct ? 'good' : 'bad')}>
        <div className="feedback-icon">{feedback?.correct ? '✦' : '×'}</div>
        <h2>{feedback?.correct ? (gameText.correct || '¡Respuesta correcta!') : (gameText.incorrect || '¡Respuesta incorrecta!')}</h2>
        <p>{feedback?.correct
          ? ((gameText.move || 'Avanzas') + ' +' + (feedback.steps || 0) + ' ' + (gameText.stepsUnit || 'pasos'))
          : (gameText.noMove || 'No avanzas')}</p>
        {winner && <p className="winner-note">{(gameText.feedbackWinner || '{name} ha llegado primero a Jericó!').replace('{name}', winner.name)}</p>}
      </div>
    </div>
  );

  return (
    <main className={'online-game-root ' + (
      view === 'mapIntro' ? 'screen-map' :
      view === 'routeMap' ? 'screen-routeMap' :
      view === 'board' ? 'online-board-shell' :
      view === 'question' ? 'online-question-shell' :
      view === 'advance' ? 'online-advance-shell' :
      view === 'feedback' ? 'online-feedback-shell' :
      view === 'collapse' ? 'online-collapse-shell' :
      view === 'story' ? 'online-story-shell' : 'online-victory-shell'
    )}>
      <header className="online-game-toolbar">
        <div><b>JERICO · {onlineText.room || 'Sala'} {roomCode}</b><small>{gameText.turn || 'Turno de'} {activePlayer?.name || ''}</small></div>
        <button type="button" className="online-exit-button" disabled={busy} onClick={onExit}>{onlineText.exit || 'Salir de la partida'}</button>
      </header>

      {view === 'mapIntro' && renderMap(false)}
      {view === 'routeMap' && renderMap(true)}
      {view === 'advance' && renderAdvance()}
      {view === 'board' && renderBoard()}
      {view === 'question' && renderQuestion()}
      {view === 'feedback' && renderFeedback()}

      {view === 'collapse' && (
        <section className="collapse-screen light-shake">
          <p className="eyebrow">{gameText.collapseEyebrow || '¡EL PUEBLO HA GRITADO!'}</p>
          <h2>{gameText.victory || '¡Las murallas caen!'}</h2>
          <div className="wall-frame"><img src={ASSET('wall-' + wallFrame + '.webp')} alt={(gameText.wallAlt || 'Derrumbe de las murallas, imagen {frame}').replace('{frame}', wallFrame)} /></div>
          <p>{gameText.collapseCaption || 'Jericó ha sido conquistada'}</p>
        </section>
      )}

      {view === 'story' && (
        <section className="panel parchment story-panel online-story-panel">
          <p className="eyebrow">{gameText.storyEyebrow || 'LA PROMESA SE CUMPLIÓ'}</p>
          <h2>{gameText.storyTitle || 'La conquista de Jericó'}</h2>
          <div className="scripture">
            {(gameText.story || []).map((line, index) => <p key={index}><strong>{index + 1}</strong> {line}</p>)}
          </div>
          <b className="scripture-ref">{gameText.storyReference || 'Josué 6:1–5'}</b>
          <button className="primary" type="button" onClick={() => setView('victory')}>{gameText.continue || 'Continuar'}</button>
        </section>
      )}

      {view === 'victory' && (
        <section className="victory-screen" style={{ backgroundImage: 'linear-gradient(180deg, #281c2a50, #281c2aee), url("' + ASSET('stage-jericho.webp') + '")' }}>
          <div className="victory-overlay">
            <div className="victory-crown">♛</div>
            <p className="eyebrow">{gameText.victoryEyebrow || 'LA CONQUISTA HA TERMINADO'}</p>
            <h1>{gameText.win || '¡Felicidades!'}</h1>
            <h2>{winnerName}</h2>
            <p className="winner-copy">{gameText.conquered || 'Has conquistado Jericó'}</p>
            <div className="invite"><b>{gameText.thank || 'Gracias por participar.'}</b><p>{gameText.bible || ''}</p></div>
            <button className="primary" type="button" disabled={busy} onClick={onExit}>{gameText.return || onlineText.back || 'Volver al menú'}</button>
          </div>
        </section>
      )}
    </main>
  );
}
