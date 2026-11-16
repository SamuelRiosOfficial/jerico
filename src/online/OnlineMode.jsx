import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { resolveAnswer, selectQuestionForTurn } from '../gameEngine.js';
import { getAvailableCharacters, getFirstAvailableCharacter, getCharacterSpritePosition } from './characterSelection.js';
import {
  createRoom, createRoomCode, ensureAnonymousSession, fetchRoom, isOnlineConfigured,
  joinRoom, leaveRoom, startRoom, subscribeToRoom, updateGameState, getRoomOccupiedCharacters
} from './onlineService.js';
import './online.css';
import OnlineGameView from './OnlineGameView.jsx';

const TEXTS = {
  es: {
    title:'Jugar en línea', subtitle:'Conecta hasta cuatro dispositivos a una misma partida.',
    create:'Crear partida', join:'Unirme a una partida', back:'Volver al menú',
    name:'Tu nombre', character:'Elige tu personaje', code:'Código de partida',
    createRoom:'Crear sala', joinRoom:'Entrar a la sala', lobby:'Sala de espera',
    waiting:'Comparte el QR o el enlace para que se unan los demás jugadores.',
    copy:'Copiar enlace', copied:'Enlace copiado', start:'Iniciar partida',
    players:'Jugadores', host:'Anfitrión', startHint:'Se necesitan al menos dos jugadores.',
    difficulty:'Elige la dificultad', easy:'Fácil', medium:'Medio', hard:'Difícil',
    step:'paso(s)', answer:'Confirmar respuesta', moved:'avanzó', player:'Jugador',
    correct:'¡Respuesta correcta!', wrong:'Respuesta incorrecta',
    winner:'¡Jericó ha sido conquistada!', finished:'La partida terminó.',
    exit:'Salir de la partida', noConfig:'El modo en línea necesita configuración.',
    setupHint:'Falta conectar el proyecto de Supabase y definir las variables de compilación.',
    loading:'Conectando…', error:'No se pudo completar la operación',
    max:'La sala ya tiene cuatro jugadores.', occupied:'Ese personaje ya fue elegido.',
    unavailable:'La sala no existe, está llena o ya comenzó.', confirm:'Confirmar personaje',
    chosen:'Elegido', turn:'Turno de', question:'Responde para avanzar', unavailableCharacter:'No disponible',
    continue:'Continuar', home:'Elige cómo quieres jugar', enterCode:'Introduce el código',
    retry:'Volver a intentar', room:'Sala', online:'Conectado'
  },
  en: {
    title:'Play online', subtitle:'Connect up to four devices to the same game.',
    create:'Create game', join:'Join a game', back:'Back to menu',
    name:'Your name', character:'Choose your character', code:'Game code',
    createRoom:'Create room', joinRoom:'Join room', lobby:'Waiting room',
    waiting:'Share the QR code or link so others can join.',
    copy:'Copy link', copied:'Link copied', start:'Start game',
    players:'Players', host:'Host', startHint:'At least two players are required.',
    difficulty:'Choose difficulty', easy:'Easy', medium:'Medium', hard:'Hard',
    step:'step(s)', answer:'Submit answer', moved:'moved', player:'Player',
    correct:'Correct answer!', wrong:'Incorrect answer',
    winner:'Jericho has been conquered!', finished:'The game has ended.',
    exit:'Leave game', noConfig:'Online mode needs configuration.',
    setupHint:'Connect the Supabase project and add its build variables.',
    loading:'Connecting…', error:'The operation could not be completed',
    max:'The room already has four players.', occupied:'That character is taken.',
    unavailable:'The room is missing, full, or already started.', confirm:'Confirm character',
    chosen:'Chosen', turn:'Turn:', question:'Answer to move forward', unavailableCharacter:'Unavailable',
    continue:'Continue', home:'Choose how to play', enterCode:'Enter the code',
    retry:'Try again', room:'Room', online:'Connected'
  },
  pt: {
    title:'Jogar online', subtitle:'Conecte até quatro dispositivos à mesma partida.',
    create:'Criar partida', join:'Entrar em uma partida', back:'Voltar ao menu',
    name:'Seu nome', character:'Escolha seu personagem', code:'Código da partida',
    createRoom:'Criar sala', joinRoom:'Entrar na sala', lobby:'Sala de espera',
    waiting:'Compartilhe o QR ou o link para os outros jogadores entrarem.',
    copy:'Copiar link', copied:'Link copiado', start:'Iniciar partida',
    players:'Jogadores', host:'Anfitrião', startHint:'São necessários pelo menos dois jogadores.',
    difficulty:'Escolha a dificuldade', easy:'Fácil', medium:'Médio', hard:'Difícil',
    step:'passo(s)', answer:'Confirmar resposta', moved:'avançou', player:'Jogador',
    correct:'Resposta correta!', wrong:'Resposta incorreta',
    winner:'Jericó foi conquistada!', finished:'A partida terminou.',
    exit:'Sair da partida', noConfig:'O modo on-line precisa de configuração.',
    setupHint:'Conecte o projeto Supabase e adicione as variáveis de compilação.',
    loading:'Conectando…', error:'Não foi possível concluir a operação',
    max:'A sala já tem quatro jogadores.', occupied:'Esse personagem já foi escolhido.',
    unavailable:'A sala não existe, está cheia ou já começou.', confirm:'Confirmar personagem',
    chosen:'Escolhido', turn:'Vez de', question:'Responda para avançar', unavailableCharacter:'Indisponível',
    continue:'Continuar', home:'Escolha como deseja jogar', enterCode:'Digite o código',
    retry:'Tentar novamente', room:'Sala', online:'Conectado'
  }
};

const DIFFICULTIES = [
  { id:'facil', steps:1, color:'easy' },
  { id:'medio', steps:2, color:'medium' },
  { id:'dificil', steps:3, color:'hard' }
];
const emptyUsed = () => ({ facil:[], medio:[], dificil:[] });
function OnlineAvatar({ characterId, walking = false }) {
  return <span className={'online-avatar' + (walking ? ' walking' : '')} style={{
    '--avatar-position': getCharacterSpritePosition(characterId) + '%',
    backgroundImage:`url("${import.meta.env.BASE_URL}assets/characters-sprites.webp")`
  }} aria-hidden="true" />;
}

export default function OnlineMode({ onExit, questionBank, language = 'es', characters = [], scenes = [], gameText = {} }) {
  const t = TEXTS[language] || TEXTS.es;
  const initialCode = new URLSearchParams(window.location.search).get('room') || '';
  const [page, setPage] = useState(initialCode ? 'join' : 'home');
  const [name, setName] = useState('');
  const [characterId, setCharacterId] = useState('warrior');
  const [code, setCode] = useState(initialCode.toUpperCase().slice(0,8));
  const [roomId, setRoomId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [presence, setPresence] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [copied, setCopied] = useState(false);
  const [roomOccupiedCharacters, setRoomOccupiedCharacters] = useState([]);
  const [checkingRoom, setCheckingRoom] = useState(false);
  const [roomLookupFailed, setRoomLookupFailed] = useState(false);

  const gameState = room?.game_state || null;
  const currentPlayer = players.find((player) => player.user_id === userId);
  const isHost = Boolean(currentPlayer?.is_host);
  const activePlayer = gameState?.players?.[gameState.turn] || null;
  const myTurn = Boolean(activePlayer && activePlayer.id === userId);
  const question = gameState?.question || null;
  const joinUrl = useMemo(() => {
    if (!room?.code) return '';
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', room.code);
    return url.toString();
  }, [room?.code]);
  const occupiedCharacters = page === 'join'
    ? roomOccupiedCharacters
    : players.filter(p => p.user_id !== userId).map(p => p.character_id);
  const availableCharacters = getAvailableCharacters(characters, occupiedCharacters);

  useEffect(() => {
    if (page !== 'join' || code.length !== 8 || !userId) {
      setRoomOccupiedCharacters([]);
      setCheckingRoom(false);
      setRoomLookupFailed(false);
      return undefined;
    }
    let active = true;
    setCheckingRoom(true);
    setRoomLookupFailed(false);
    const timer = window.setTimeout(async () => {
      try {
        const occupied = await getRoomOccupiedCharacters(code);
        if (active) {
          setRoomOccupiedCharacters(occupied);
          setRoomLookupFailed(false);
          setCharacterId(current => occupied.includes(current)
            ? getFirstAvailableCharacter(characters, occupied)
            : current);
        }
      } catch {
        if (active) {
          setRoomOccupiedCharacters([]);
          setRoomLookupFailed(true);
        }
      } finally {
        if (active) setCheckingRoom(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [page, code, userId]);

  const refreshRoom = useCallback(async () => {
    if (!roomId) return;
    const data = await fetchRoom(roomId);
    setRoom(data.room);
    setPlayers(data.players);
    if (data.room.status === 'playing' || data.room.status === 'finished') setPage('game');
  }, [roomId]);

  useEffect(() => {
    if (!isOnlineConfigured) return undefined;
    let cancelled = false;
    ensureAnonymousSession().then(user => { if (!cancelled) setUserId(user.id); })
      .catch(err => { if (!cancelled) setError(err.message || t.error); });
    return () => { cancelled = true; };
  }, [t.error]);

  useEffect(() => {
    if (!roomId || !userId) return undefined;
    let active = true;
    const sync = async () => {
      try { await refreshRoom(); }
      catch (err) { if (active) setError(err.message || t.error); }
    };
    sync();
    const unsubscribe = subscribeToRoom(roomId, userId, sync, setPresence);
    return () => { active = false; unsubscribe(); };
  }, [roomId, userId, refreshRoom, t.error]);

  const runCreate = async () => {
    if (!name.trim()) { setError(t.name); return; }
    if (!isOnlineConfigured) { setError(t.setupHint); return; }
    setBusy(true); setError('');
    try {
      const result = await createRoom({ code:createRoomCode(), name:name.trim().slice(0,12), characterId });
      setRoomId(result.roomId);
      setUserId(result.userId);
      const data = await fetchRoom(result.roomId);
      setRoom(data.room); setPlayers(data.players); setPage('lobby');
    } catch (err) { setError(err.message || t.error); }
    finally { setBusy(false); }
  };

  const runJoin = async () => {
    if (!name.trim()) { setError(t.name); return; }
    if (!code.trim()) { setError(t.code); return; }
    if (checkingRoom || roomLookupFailed || occupiedCharacters.includes(characterId) || !characterId) { setError(t.occupied); return; }
    if (!isOnlineConfigured) { setError(t.setupHint); return; }
    setBusy(true); setError('');
    try {
      const result = await joinRoom({ code:code.trim().toUpperCase(), name:name.trim().slice(0,12), characterId });
      setRoomId(result.roomId);
      setUserId(result.userId);
      const data = await fetchRoom(result.roomId);
      setRoom(data.room); setPlayers(data.players); setPage('lobby');
    } catch (err) {
      const message = err.message || '';
      setError(/character already taken/i.test(message) ? t.occupied : message || t.unavailable);
      if (/character already taken/i.test(message)) {
        try { setRoomOccupiedCharacters(await getRoomOccupiedCharacters(code)); } catch { /* Keep the last availability snapshot. */ }
      }
    }
    finally { setBusy(false); }
  };

  const startGame = async () => {
    if (!isHost || players.length < 2) return;
    setBusy(true); setError('');
    try { await startRoom(roomId); await refreshRoom(); }
    catch (err) { setError(err.message || t.error); }
    finally { setBusy(false); }
  };

  const publishState = async (next) => {
    if (!room || !roomId) return;
    setBusy(true); setError('');
    try {
      await updateGameState(roomId, room.revision, next);
      await refreshRoom();
      setSelectedAnswer(null);
    } catch (err) {
      setError(err.message || t.error);
      try { await refreshRoom(); } catch { /* Keep the last visible snapshot. */ }
    } finally { setBusy(false); }
  };

  const askQuestion = (difficulty) => {
    if (!myTurn || !questionBank || !gameState || gameState.phase !== 'board') return;
    try {
      const selection = selectQuestionForTurn(
        questionBank, difficulty.id, gameState.usedQuestionIds || emptyUsed(), Math.random, language
      );
      const selected = selection.question;
      publishState({
        ...gameState,
        phase:'question',
        usedQuestionIds:selection.usedIds,
        question:{
          id:selected.id,
          text:selected.question,
          options:selection.options,
          reference:selected.biblicalReference,
          steps:difficulty.steps
        },
        feedback:null
      });
    } catch (err) { setError(err.message || t.error); }
  };

  const submitAnswer = () => {
    if (!myTurn || !question || selectedAnswer === null || gameState.phase !== 'question') return;
    const correct = question.options[selectedAnswer]?.correct === true;
    const outcome = resolveAnswer(activePlayer.steps, correct, question.steps);
    const nextPlayers = gameState.players.map((player, index) =>
      index === gameState.turn ? { ...player, steps:outcome.steps } : player
    );
    const winner = outcome.won ? nextPlayers[gameState.turn] : null;
    publishState({
      ...gameState,
      phase:winner ? 'finished' : 'feedback',
      players:nextPlayers,
      question:null,
      winner,
      feedback:{ correct, steps:correct ? question.steps : 0, playerName:activePlayer.name }
    });
  };

  const continueTurn = () => {
    if (!gameState || (gameState.phase !== 'feedback') || (!isHost && !myTurn)) return;
    publishState({
      ...gameState,
      phase:'board',
      turn:(gameState.turn + 1) % gameState.players.length,
      question:null,
      feedback:null,
      winner:null
    });
  };

  const exitRoom = async () => {
    setBusy(true);
    try { if (roomId) await leaveRoom(roomId); }
    catch (err) { setError(err.message || t.error); }
    finally {
      setRoomId(null); setRoom(null); setPlayers([]); setPage('home'); setBusy(false);
      onExit();
    }
  };

  const copyInvite = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch { setError('No se pudo copiar el enlace.'); }
  };

  const namesByCharacter = characters.reduce((result, c) => ({ ...result, [c.id]:c.name }), {});
  const onlineIds = new Set(Object.keys(presence || {}));
  const roomIsActive = room?.status === 'playing';
  const roomIsFinished = room?.status === 'finished';

  return page === 'game' && room && gameState ? (
    <OnlineGameView
      gameState={gameState}
      roomCode={room.code}
      userId={userId}
      language={language}
      scenes={scenes}
      gameText={gameText}
      onlineText={t}
      questionBank={questionBank}
      busy={busy}
      selectedAnswer={selectedAnswer}
      setSelectedAnswer={setSelectedAnswer}
      askQuestion={askQuestion}
      submitAnswer={submitAnswer}
      continueTurn={continueTurn}
      canContinue={isHost || myTurn}
      onExit={exitRoom}
    />
  ) : (
    <section className="panel parchment online-panel">
      <div className="online-heading">
        <div><p className="eyebrow">JERICO · MULTIJUGADOR</p><h2>{t.title}</h2><p>{t.subtitle}</p></div>
      </div>

      {!isOnlineConfigured && (
        <div className="online-warning">
          <b>{t.noConfig}</b>
          <p>{t.setupHint}</p>
        </div>
      )}

      {page === 'home' && (
        <div className="online-actions">
          <h3>{t.home}</h3>
          <button className="primary" type="button" disabled={!isOnlineConfigured || busy} onClick={() => { setPage('create'); setError(''); }}>{t.create}</button>
          <button className="secondary" type="button" disabled={!isOnlineConfigured || busy} onClick={() => { setPage('join'); setError(''); }}>{t.join}</button>
        </div>
      )}

      {(page === 'create' || page === 'join') && (
        <div className="online-form">
          <label>{t.name}
            <input maxLength={12} value={name} onChange={e => setName(e.target.value.slice(0,12))} placeholder="12 caracteres máximo" />
          </label>
          {page === 'join' && <label>{t.code}
            <input maxLength={8} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8))} placeholder="ABCD1234" />
          </label>}
          <div className="online-character-picker">
            <div className="online-character-picker-heading">
              <b>{t.character}</b>
              {page === 'join' && <small>{checkingRoom ? t.loading : roomLookupFailed ? t.unavailable : t.chosen + ': ' + occupiedCharacters.length}</small>}
            </div>
            <div className="online-character-featured">
              <OnlineAvatar characterId={characterId || availableCharacters[0]?.id || 'warrior'} />
              <strong>{characters.find(c => c.id === characterId)?.name || t.occupied}</strong>
            </div>
            <div className="online-character-grid">
              {characters.map(character => {
                const taken = occupiedCharacters.includes(character.id);
                return <button key={character.id} type="button"
                  className={'online-character-card' + (characterId === character.id ? ' selected' : '') + (taken ? ' taken' : '')}
                  disabled={taken || (page === 'join' && (checkingRoom || roomLookupFailed)) || busy}
                  onClick={() => setCharacterId(character.id)}>
                  <OnlineAvatar characterId={character.id} />
                  <b>{character.name}</b>
                  {taken && <small>{t.unavailableCharacter}</small>}
                </button>;
              })}
            </div>
          </div>
          <button className="primary" type="button" disabled={busy || !name.trim() || (page === 'join' && (code.length !== 8 || checkingRoom || roomLookupFailed || !characterId || occupiedCharacters.includes(characterId)))} onClick={page === 'create' ? runCreate : runJoin}>
            {busy ? t.loading : page === 'create' ? t.createRoom : t.joinRoom}
          </button>
        </div>
      )}

      {page === 'lobby' && room && (
        <div className="online-lobby">
          <h3>{t.lobby} · {room.code}</h3>
          <p>{t.waiting}</p>
          <div className="online-invite">
            <QRCodeSVG value={joinUrl} size={176} level="M" includeMargin />
            <div><b>{room.code}</b><button className="secondary" type="button" onClick={copyInvite}>{copied ? t.copied : t.copy}</button><small>{joinUrl}</small></div>
          </div>
          <h3>{t.players} ({players.length}/4)</h3>
          <div className="online-player-list">
            {players.map(player => (
              <div className="online-player" key={player.user_id}>
                <OnlineAvatar characterId={player.character_id} />
                <span><b>{player.name}</b><small>{player.is_host ? t.host : t.player || 'Jugador'} · {onlineIds.has(player.user_id) ? t.online : '—'}</small></span>
                {player.is_host && <strong>★</strong>}
              </div>
            ))}
          </div>
          {isHost ? (
            <button className="primary" type="button" disabled={busy || players.length < 2 || players.length > 4} onClick={startGame}>{busy ? t.loading : t.start}</button>
          ) : <p className="online-wait">{t.waiting}</p>}
          <small>{t.startHint}</small>
        </div>
      )}

      {error && <div className="online-error" role="alert">{error}</div>}
      <button className="online-menu-back" type="button" onClick={exitRoom} disabled={busy}>{t.back}</button>
    </section>
  );
}
