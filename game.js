import {
  ensureAnonymousLogin,
  createRoom,
  joinRoom,
  watchRoom,
  changeMode,
  startGame,
  takeOpenCard,
  drawDeckCard,
  discardCard,
  pressBell,
  runAutomaticTurn,
  submitCombination,
  autoSubmitMissing,
  advanceAfterResult,
  advanceAfterRound,
  resetFinishedRoom,
  watchConnection,
  getRoom,
  leaveRoom
} from "./firebase.js";

const screens = {
  home: document.querySelector("#homeScreen"),
  lobby: document.querySelector("#lobbyScreen"),
  game: document.querySelector("#gameScreen")
};

const nicknameInput = document.querySelector("#nickname");
const roomCodeInput = document.querySelector("#roomCode");
const createRoomButton = document.querySelector("#createRoomButton");
const joinRoomButton = document.querySelector("#joinRoomButton");
const homeMessage = document.querySelector("#homeMessage");
const rulesButton = document.querySelector("#rulesButton");
const rulesModal = document.querySelector("#rulesModal");
const closeRulesButton = document.querySelector("#closeRulesButton");

const copyRoomCodeButton = document.querySelector("#copyRoomCodeButton");
const leaveRoomButton = document.querySelector("#leaveRoomButton");
const playerCount = document.querySelector("#playerCount");
const connectionStatus = document.querySelector("#connectionStatus");
const playerList = document.querySelector("#playerList");
const modeButtons = [...document.querySelectorAll(".mode-button")];
const startGameButton = document.querySelector("#startGameButton");
const lobbyMessage = document.querySelector("#lobbyMessage");

const gameBoard = document.querySelector("#gameBoard");
const roundLabel = document.querySelector("#roundLabel");
const setLabel = document.querySelector("#setLabel");
const timer = document.querySelector("#timer");
const gameLeaveButton = document.querySelector("#gameLeaveButton");
const gameConnectionBadge = document.querySelector("#gameConnectionBadge");
const gameLogList = document.querySelector("#gameLogList");
const toggleSoundButton = document.querySelector("#toggleSoundButton");
const opponentArea = document.querySelector("#opponentArea");
const turnLabel = document.querySelector("#turnLabel");
const phaseLabel = document.querySelector("#phaseLabel");
const openCardButton = document.querySelector("#openCardButton");
const openCardSlot = document.querySelector("#openCardSlot");
const deckButton = document.querySelector("#deckButton");
const deckCount = document.querySelector("#deckCount");
const bellButton = document.querySelector("#bellButton");
const gameMessage = document.querySelector("#gameMessage");
const handCount = document.querySelector("#handCount");
const handCards = document.querySelector("#handCards");
const confirmDiscardButton = document.querySelector("#confirmDiscardButton");
const submitControls = document.querySelector("#submitControls");
const selectedScorePreview = document.querySelector("#selectedScorePreview");
const submitCombinationButton = document.querySelector("#submitCombinationButton");
const resultPanel = document.querySelector("#resultPanel");
const resultTitle = document.querySelector("#resultTitle");
const resultCountdown = document.querySelector("#resultCountdown");
const scoreBoard = document.querySelector("#scoreBoard");
const lifeResultMessage = document.querySelector("#lifeResultMessage");
const roundPanel = document.querySelector("#roundPanel");
const roundResultTitle = document.querySelector("#roundResultTitle");
const roundCountdown = document.querySelector("#roundCountdown");
const roundScoreBoard = document.querySelector("#roundScoreBoard");
const roundResultMessage = document.querySelector("#roundResultMessage");
const finalPanel = document.querySelector("#finalPanel");
const finalScoreBoard = document.querySelector("#finalScoreBoard");
const returnHomeButton = document.querySelector("#returnHomeButton");

let currentUser = null;
let currentRoomCode = "";
let currentRoom = null;
let unsubscribeRoom = null;
let selectedDiscardCardId = null;
let timerInterval = null;
let lastAutomaticRequestKey = "";
let selectedSubmitCardIds = new Set();
let lastAutoSubmitKey = "";
let lastResultAdvanceKey = "";
let lastRoundAdvanceKey = "";
let unsubscribeConnection = null;
let soundEnabled = localStorage.getItem("bellSoundEnabled") !== "false";
let previousGameSnapshot = null;


function playTone(type) {
  if (!soundEnabled) return;

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    const settings = {
      bell: { frequency: 880, duration: 0.45 },
      draw: { frequency: 420, duration: 0.12 },
      discard: { frequency: 270, duration: 0.15 },
      turn: { frequency: 660, duration: 0.18 },
      lose: { frequency: 160, duration: 0.4 },
      win: { frequency: 740, duration: 0.5 }
    }[type] ?? { frequency: 440, duration: 0.15 };

    oscillator.frequency.value = settings.frequency;
    oscillator.type = type === "bell" ? "sine" : "triangle";

    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + settings.duration
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + settings.duration);
  } catch (error) {
    console.debug("효과음 재생 불가:", error);
  }
}

function addLog(text) {
  if (!text) return;

  const item = document.createElement("li");
  item.textContent = text;
  gameLogList.append(item);

  while (gameLogList.children.length > 12) {
    gameLogList.firstElementChild?.remove();
  }

  gameLogList.scrollTop = gameLogList.scrollHeight;
}

function actionToLog(room) {
  const action = room.game?.lastAction;
  if (!action) return "";

  const name = action.uid
    ? getPlayerName(room, action.uid)
    : "";

  const messages = {
    TAKE_OPEN: `${name}님이 오픈 카드를 가져갔습니다.`,
    DRAW_DECK: `${name}님이 더미 카드를 뽑았습니다.`,
    DISCARD: `${name}님이 카드를 버렸습니다.`,
    AUTO_DRAW_DECK: `${name}님이 자동으로 더미 카드를 뽑았습니다.`,
    AUTO_DISCARD: `${name}님이 자동으로 카드를 버렸습니다.`,
    BELL: `${name}님이 벨을 눌렀습니다!`,
    AUTO_BELL_DECK_EMPTY: "더미가 소진되어 자동 벨이 울렸습니다.",
    NEXT_SET: "다음 세트가 시작됐습니다.",
    NEXT_ROUND: "다음 라운드가 시작됐습니다."
  };

  return messages[action.type] ?? "";
}

function handleGameEffects(room) {
  const currentGame = room.game;
  const previousGame = previousGameSnapshot;

  if (!currentGame) return;

  if (
    previousGame &&
    currentGame.turnUid === currentUser?.uid &&
    previousGame.turnUid !== currentUser?.uid
  ) {
    playTone("turn");

    if ("vibrate" in navigator) {
      navigator.vibrate([120, 60, 120]);
    }
  }

  if (
    previousGame?.lastAction?.at !== currentGame.lastAction?.at
  ) {
    const logText = actionToLog(room);
    addLog(logText);

    const actionType = currentGame.lastAction?.type;

    if (actionType === "BELL" || actionType === "AUTO_BELL_DECK_EMPTY") {
      playTone("bell");
    }

    if (actionType === "DRAW_DECK" || actionType === "AUTO_DRAW_DECK") {
      playTone("draw");
    }

    if (actionType === "DISCARD" || actionType === "AUTO_DISCARD") {
      playTone("discard");
    }
  }

  if (
    previousGame?.phase !== "RESULT" &&
    currentGame.phase === "RESULT"
  ) {
    const myLoss =
      currentGame.result?.lifeLosses?.[currentUser?.uid];

    playTone(myLoss ? "lose" : "win");
  }

  previousGameSnapshot = structuredClone(currentGame);
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => {
    element.classList.toggle("hidden", key !== name);
  });
}

function showMessage(element, text, type = "") {
  element.textContent = text;
  element.className = element === gameMessage
    ? "game-message"
    : `message${type ? ` ${type}` : ""}`;
}

function getNickname() {
  return nicknameInput.value.trim();
}

function normalizeRoomCode(value) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function makeRoomCode(length = 6) {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  return Array.from({ length }, () => {
    const index = Math.floor(Math.random() * characters.length);
    return characters[index];
  }).join("");
}

function setBusy(isBusy) {
  createRoomButton.disabled = isBusy;
  joinRoomButton.disabled = isBusy;
}

function friendlyError(error) {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  if (code.includes("auth/operation-not-allowed")) {
    return "Firebase에서 익명 로그인을 켜주세요.";
  }

  if (code.includes("auth/unauthorized-domain")) {
    return "승인된 도메인에 localhost와 127.0.0.1을 추가해주세요.";
  }

  if (message === "ROOM_NOT_FOUND") return "존재하지 않는 방 코드입니다.";
  if (message === "ROOM_FULL") return "방 인원이 가득 찼습니다.";
  if (message === "GAME_ALREADY_STARTED") return "이미 게임이 시작된 방입니다.";
  if (message === "HOST_ONLY") return "방장만 사용할 수 있습니다.";
  if (message === "START_FAILED") {
    return "인원을 확인해주세요. 2대2는 4명, 3대3은 6명이 필요합니다.";
  }
  if (message === "INVALID_ACTION") return "현재 실행할 수 없는 행동입니다.";

  return message || "알 수 없는 오류가 발생했습니다.";
}

async function login() {
  if (currentUser) return currentUser;
  currentUser = await ensureAnonymousLogin();
  return currentUser;
}

async function enterLobby(roomCode) {
  currentRoomCode = roomCode;
  copyRoomCodeButton.textContent = roomCode;

  localStorage.setItem("bellRoomCode", roomCode);
  localStorage.setItem("bellNickname", getNickname());

  if (unsubscribeRoom) unsubscribeRoom();

  if (unsubscribeConnection) {
    unsubscribeConnection();
  }

  unsubscribeConnection = watchConnection((connected) => {
    connectionStatus.textContent = connected
      ? "실시간 연결됨"
      : "연결 끊김";

    connectionStatus.style.color = connected
      ? "var(--success)"
      : "var(--danger)";

    gameConnectionBadge.textContent = connected
      ? "온라인"
      : "오프라인";

    gameConnectionBadge.classList.toggle("offline", !connected);
  });

  unsubscribeRoom = watchRoom(roomCode, (room) => {
    if (!room) {
      showMessage(lobbyMessage, "방이 종료됐습니다.", "error");
      localStorage.removeItem("bellRoomCode");
      setTimeout(() => showScreen("home"), 900);
      return;
    }

    currentRoom = room;
    renderLobby(room);

    if (room.meta?.status === "PLAYING" && room.game) {
      handleGameEffects(room);
      renderGame(room);
      showScreen("game");
    } else {
      showScreen("lobby");
    }
  });
}

function renderLobby(room) {
  const players = Object.entries(room.players ?? {});
  const hostUid = room.meta?.hostUid;
  const isHost = currentUser?.uid === hostUid;

  playerCount.textContent = `${players.length} / ${room.meta?.maxPlayers ?? 6}명`;
  connectionStatus.textContent = "실시간 연결됨";
  connectionStatus.style.color = "var(--success)";

  playerList.innerHTML = "";

  players
    .sort(([, a], [, b]) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0))
    .forEach(([uid, player]) => {
      const item = document.createElement("li");
      item.className = "player-item";

      const avatar = document.createElement("div");
      avatar.className = "player-avatar";
      avatar.textContent = (player.nickname || "?").slice(0, 1);

      const info = document.createElement("div");
      info.className = "player-info";

      const name = document.createElement("div");
      name.className = "player-name";
      name.append(document.createTextNode(player.nickname || "이름 없음"));

      if (uid === hostUid) {
        const badge = document.createElement("span");
        badge.className = "host-badge";
        badge.textContent = "방장";
        name.append(badge);
      }

      if (uid === currentUser?.uid) {
        const badge = document.createElement("span");
        badge.className = "host-badge";
        badge.textContent = "나";
        name.append(badge);
      }

      const meta = document.createElement("div");
      meta.className = "player-meta";
      const teamText = player.team ? ` · ${player.team}팀` : "";
      meta.textContent =
        `라이프 ${"♥".repeat(player.life ?? 5)}${teamText}`;

      const dot = document.createElement("div");
      dot.className = player.online ? "online-dot" : "online-dot offline-dot";

      info.append(name, meta);
      item.append(avatar, info, dot);
      playerList.append(item);
    });

  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === room.meta?.mode);
    button.disabled = !isHost;
  });

  startGameButton.classList.toggle("hidden", !isHost);

  const mode = room.meta?.mode ?? "SOLO";
  const requiredPlayers =
    mode === "TEAM_2V2"
      ? 4
      : mode === "TEAM_3V3"
        ? 6
        : 2;

  const validCount =
    mode === "SOLO"
      ? players.length >= 2
      : players.length === requiredPlayers;

  startGameButton.disabled = !validCount;
  startGameButton.textContent = validCount
    ? "게임 시작"
    : mode === "SOLO"
      ? "2명 이상 필요합니다"
      : `${requiredPlayers}명이 필요합니다`;
}

function createCardElement(card) {
  const cardElement = document.createElement("span");
  cardElement.className = `card ${card.color}`;
  cardElement.textContent = card.number;
  cardElement.dataset.cardId = card.id;
  return cardElement;
}

function getPlayerName(room, uid) {
  return room.players?.[uid]?.nickname ?? "알 수 없음";
}

function getLastActionMessage(room) {
  const action = room.game?.lastAction;

  if (!action?.automatic) return "";

  const playerName = getPlayerName(room, action.uid);

  if (action.type === "AUTO_DRAW_DECK") {
    return `${playerName}님이 시간 초과로 더미 카드를 자동으로 뽑았습니다.`;
  }

  if (action.type === "AUTO_DISCARD") {
    return `${playerName}님이 시간 초과로 카드 1장을 자동으로 버렸습니다.`;
  }

  if (action.type === "AUTO_TAKE_OPEN") {
    return `${playerName}님이 시간 초과로 오픈 카드를 자동으로 가져갔습니다.`;
  }

  if (action.type === "AUTO_SKIP") {
    return `${playerName}님의 마지막 턴이 자동으로 건너뛰어졌습니다.`;
  }

  if (action.type === "AUTO_BELL_DECK_EMPTY") {
    return "더미가 모두 소진되어 자동으로 벨이 울렸습니다.";
  }

  return "";
}


function calculateSelectedScore(
  hand,
  selectedIds,
  teamMode = false
) {
  const cards = hand.filter((card) => selectedIds.has(card.id));

  if (teamMode && cards.length === 1) {
    return {
      valid: true,
      score: 0,
      sacrifice: true,
      label: "희생 제출 · 본인 라이프 1개 감소"
    };
  }

  if (cards.length < 2) {
    return {
      valid: false,
      score: 0,
      sacrifice: false,
      label: "카드를 2장 이상 선택하세요."
    };
  }

  const sameColor = cards.every(
    (card) => card.color === cards[0].color
  );

  const sameNumber = cards.every(
    (card) => card.number === cards[0].number
  );

  if (!sameColor && !sameNumber) {
    return {
      valid: false,
      score: 0,
      sacrifice: false,
      label: "같은 색 또는 같은 숫자만 제출할 수 있습니다."
    };
  }

  const score = cards.reduce(
    (total, card) => total + Number(card.number),
    0
  );

  return {
    valid: true,
    score,
    sacrifice: false,
    label: `${sameColor ? "같은 색" : "같은 숫자"} 조합 · ${score}점`
  };
}

function renderResult(room) {
  const game = room.game;
  const result = game.result ?? {};
  const scores = result.scores ?? {};
  const lifeLosses = result.lifeLosses ?? {};

  gameBoard.classList.add("showing-result");
  resultPanel.classList.remove("hidden");
  scoreBoard.innerHTML = "";

  const rows = Object.entries(room.players ?? {})
    .sort(([uidA], [uidB]) => {
      return Number(scores[uidB] ?? 0) - Number(scores[uidA] ?? 0);
    });

  for (const [uid, player] of rows) {
    const row = document.createElement("div");
    row.className = "score-row";

    if (result.highestUids?.includes(uid)) {
      row.classList.add("winner");
    }

    if (lifeLosses[uid]) {
      row.classList.add("loser");
    }

    const name = document.createElement("div");
    name.className = "score-name";
    name.textContent = player.nickname;

    if (uid === result.bellOwner) {
      name.textContent += " 🔔";
    }

    const cards = document.createElement("div");
    cards.className = "score-cards";

    const submission = game.submissions?.[uid];
    const selectedIds = submission?.cardIds ?? [];
    const hand = game.hands?.[uid] ?? [];

    for (const card of hand.filter((item) => selectedIds.includes(item.id))) {
      const mini = document.createElement("span");
      mini.className = `mini-card ${card.color}`;
      mini.textContent = card.number;
      cards.append(mini);
    }

    if (selectedIds.length === 0) {
      cards.textContent = "조합 없음";
      cards.classList.add("player-meta");
    }

    const score = document.createElement("div");
    score.className = "score-number";
    score.textContent = submission?.sacrifice
      ? "희생"
      : `${scores[uid] ?? 0}점`;

    row.append(name, cards, score);
    scoreBoard.append(row);
  }

  const messages = [];

  for (const [uid, loss] of Object.entries(lifeLosses)) {
    const name = getPlayerName(room, uid);
    const sacrifice = result.sacrificeDetails?.[uid];

    if (sacrifice) {
      const protectedName = sacrifice.protectedUid
        ? getPlayerName(room, sacrifice.protectedUid)
        : null;

      messages.push(
        protectedName
          ? `${name}: ${protectedName} 대신 희생`
          : `${name}: 희생 카드 제출로 라이프 1개 감소`
      );
    } else if (uid === result.bellOwner && result.bellFailed) {
      messages.push(`${name}: 벨 실패로 라이프 ${loss}개 감소`);
    } else {
      messages.push(`${name}: 최저 점수로 라이프 ${loss}개 감소`);
    }
  }

  lifeResultMessage.textContent =
    messages.length > 0
      ? messages.join(" · ")
      : "라이프 감소 없음";

  resultTitle.textContent =
    result.bellFailed
      ? "벨 실패!"
      : "세트 결과";
}


function renderRoundResult(room) {
  const game = room.game;
  const eliminated = game.eliminatedUids ?? [];
  const survivors = game.survivorUids ?? [];

  roundPanel.classList.remove("hidden");
  roundScoreBoard.innerHTML = "";

  const rows = Object.entries(room.players ?? {})
    .sort(([, playerA], [, playerB]) => {
      return Number(playerB.life ?? 0) - Number(playerA.life ?? 0);
    });

  for (const [uid, player] of rows) {
    const row = document.createElement("div");
    row.className = "score-row";

    if (survivors.includes(uid)) {
      row.classList.add("winner");
    }

    if (eliminated.includes(uid)) {
      row.classList.add("loser");
    }

    const name = document.createElement("div");
    name.className = "score-name";
    name.textContent = player.nickname;

    const isTeamMode =
      room.meta?.mode === "TEAM_2V2" ||
      room.meta?.mode === "TEAM_3V3";

    const teamWon =
      isTeamMode &&
      game.winningTeams?.includes(player.team);

    if ((!isTeamMode && survivors.includes(uid)) || teamWon) {
      const badge = document.createElement("span");
      badge.className = "round-badge";
      badge.textContent = isTeamMode
        ? `${player.team}팀 승리 +1`
        : "라운드 승리 +1";
      name.append(badge);
    }

    const life = document.createElement("div");
    life.className = "score-cards";
    life.textContent =
      Number(player.life ?? 0) > 0
        ? "♥".repeat(Number(player.life))
        : "탈락";

    const wins = document.createElement("div");
    wins.className = "score-number";
    wins.textContent =
      room.meta?.mode === "SOLO"
        ? `${player.roundWins ?? 0}승`
        : `${player.teamRoundWins ?? 0}승`;

    row.append(name, life, wins);
    roundScoreBoard.append(row);
  }

  roundResultTitle.textContent =
    `${room.meta?.round ?? 1}라운드 종료`;

  const eliminatedNames = eliminated.map(
    (uid) => getPlayerName(room, uid)
  );

  roundResultMessage.textContent =
    `${eliminatedNames.join(", ")} 탈락 · 잠시 후 ${
      Number(room.meta?.round ?? 1) >= 5
        ? "최종 결과"
        : "다음 라운드"
    }로 이동합니다.`;
}

function renderFinalResult(room) {
  finalPanel.classList.remove("hidden");
  finalScoreBoard.innerHTML = "";

  const teamMode =
    room.meta?.mode === "TEAM_2V2" ||
    room.meta?.mode === "TEAM_3V3";

  if (teamMode) {
    const ranking = room.game?.finalTeamRanking ?? ["A", "B"];
    const stats = room.game?.finalTeamStats ?? {};

    ranking.forEach((team, index) => {
      const members = Object.values(room.players ?? {})
        .filter((player) => player.team === team)
        .map((player) => player.nickname)
        .join(", ");

      const row = document.createElement("div");
      row.className = "score-row final-row";

      const rank = document.createElement("div");
      rank.className = "final-rank";
      rank.textContent = index + 1;

      const nameWrap = document.createElement("div");

      const name = document.createElement("div");
      name.className = "score-name";
      name.textContent = `${team}팀`;

      const detail = document.createElement("div");
      detail.className = "player-meta";
      detail.textContent =
        `${members} · 생존 라이프 합계 ${
          stats[team]?.totalRemainingLife ?? 0
        }`;

      nameWrap.append(name, detail);

      const wins = document.createElement("div");
      wins.className = "score-number";
      wins.textContent =
        `${stats[team]?.teamRoundWins ?? 0}승`;

      row.append(rank, nameWrap, wins);
      finalScoreBoard.append(row);
    });

    return;
  }

  const ranking =
    room.game?.finalRanking ??
    Object.keys(room.players ?? {});

  ranking.forEach((uid, index) => {
    const player = room.players?.[uid];
    if (!player) return;

    const row = document.createElement("div");
    row.className = "score-row final-row";

    const rank = document.createElement("div");
    rank.className = "final-rank";
    rank.textContent = index + 1;

    const name = document.createElement("div");
    name.className = "score-name";
    name.textContent = player.nickname;

    const stats = document.createElement("div");
    stats.className = "score-number";
    stats.textContent = `${player.roundWins ?? 0}승`;

    const detail = document.createElement("div");
    detail.className = "player-meta";
    detail.textContent =
      `생존 라이프 합계 ${player.totalRemainingLife ?? 0}`;

    const nameWrap = document.createElement("div");
    nameWrap.append(name, detail);

    row.append(rank, nameWrap, stats);
    finalScoreBoard.append(row);
  });
}

function renderGame(room) {
  const game = room.game;
  const myUid = currentUser?.uid;
  const isMyTurn = game.turnUid === myUid;
  const myHand = Array.isArray(game.hands?.[myUid]) ? game.hands[myUid] : [];
  const isDiscardPhase = isMyTurn && game.phase === "DISCARD";
  const isSubmitPhase = game.phase === "SUBMIT";
  const isResultPhase = game.phase === "RESULT";
  const isRoundEndPhase = game.phase === "ROUND_END";
  const isGameEndPhase = game.phase === "GAME_END";
  const isActionPhase =
    isMyTurn &&
    ["TURN_ACTION", "FINAL_TURNS"].includes(game.phase);

  roundLabel.textContent = `라운드 ${room.meta?.round ?? 1} / 5`;
  setLabel.textContent = `세트 ${room.meta?.set ?? 1}`;

  gameBoard.classList.toggle("is-my-turn", isMyTurn);
  gameBoard.classList.toggle(
    "showing-result",
    isResultPhase || isRoundEndPhase || isGameEndPhase
  );
  resultPanel.classList.toggle("hidden", !isResultPhase);
  roundPanel.classList.toggle("hidden", !isRoundEndPhase);
  finalPanel.classList.toggle("hidden", !isGameEndPhase);

  if (isResultPhase) {
    renderResult(room);
  }

  if (isRoundEndPhase) {
    renderRoundResult(room);
  }

  if (isGameEndPhase) {
    renderFinalResult(room);
  }

  turnLabel.textContent = isMyTurn
    ? "내 턴입니다!"
    : `${getPlayerName(room, game.turnUid)}님의 턴`;

  const phaseNames = {
    TURN_ACTION: "행동 선택",
    FINAL_TURNS: "마지막 턴",
    DISCARD: "버릴 카드 선택",
    SUBMIT: "조합 제출",
    RESULT: "세트 결과",
    ROUND_END: "라운드 종료"
  };

  phaseLabel.textContent =
    phaseNames[game.phase] ?? game.phase;

  opponentArea.innerHTML = "";

  for (const [uid, player] of Object.entries(room.players ?? {})) {
    if (uid === myUid) continue;

    const card = document.createElement("div");
    card.className = `opponent-card${uid === game.turnUid ? " active" : ""}`;

    const name = document.createElement("div");
    name.className = "opponent-name";
    name.textContent = player.nickname;

    const life = document.createElement("div");
    life.className = "opponent-life";
    life.textContent = "♥".repeat(player.life ?? 5);

    const handInfo = document.createElement("div");
    handInfo.className = "player-meta";
    const opponentHand = Array.isArray(game.hands?.[uid]) ? game.hands[uid] : [];
    const teamText = player.team ? ` · ${player.team}팀` : "";
    handInfo.textContent = `카드 ${opponentHand.length}장${teamText}`;

    card.append(name, life, handInfo);
    opponentArea.append(card);
  }

  openCardSlot.innerHTML = "";
  if (game.openCard) {
    openCardSlot.append(createCardElement(game.openCard));
  } else {
    openCardSlot.textContent = "가져감";
  }

  deckCount.textContent = `${Array.isArray(game.deck) ? game.deck.length : 0}장`;

  const canAct =
    isMyTurn &&
    ["TURN_ACTION", "FINAL_TURNS"].includes(game.phase);

  openCardButton.disabled = !canAct || !game.openCard;
  deckButton.disabled =
    !canAct ||
    !Array.isArray(game.deck) ||
    game.deck.length === 0;

  bellButton.disabled =
    !(isMyTurn && game.phase === "TURN_ACTION" && !game.bellOwner);

  selectedDiscardCardId = isDiscardPhase ? selectedDiscardCardId : null;
  handCards.innerHTML = "";

  myHand.forEach((card) => {
    const button = document.createElement("button");
    button.className = "hand-card";
    button.type = "button";
    button.append(createCardElement(card));

    if (isDiscardPhase) {
      button.classList.add("selectable");
      button.addEventListener("click", () => {
        selectedDiscardCardId = card.id;
        renderGame(room);
      });
    }

    if (isSubmitPhase && !game.submissions?.[myUid]) {
      button.classList.add("submit-selectable");
      button.addEventListener("click", () => {
        if (selectedSubmitCardIds.has(card.id)) {
          selectedSubmitCardIds.delete(card.id);
        } else {
          selectedSubmitCardIds.add(card.id);
        }

        renderGame(room);
      });
    }

    if (selectedDiscardCardId === card.id) {
      button.classList.add("selected");
    }

    if (selectedSubmitCardIds.has(card.id)) {
      button.classList.add("submit-selected");
    }

    handCards.append(button);
  });

  handCount.textContent = `${myHand.length} / ${isDiscardPhase ? 5 : 4}`;
  confirmDiscardButton.classList.toggle("hidden", !isDiscardPhase);
  confirmDiscardButton.disabled = !selectedDiscardCardId;

  const alreadySubmitted = Boolean(game.submissions?.[myUid]);
  submitControls.classList.toggle("hidden", !isSubmitPhase);

  if (isSubmitPhase) {
    const selectedResult = calculateSelectedScore(
      myHand,
      selectedSubmitCardIds,
      room.meta?.mode === "TEAM_2V2" ||
        room.meta?.mode === "TEAM_3V3"
    );

    selectedScorePreview.textContent = alreadySubmitted
      ? `제출 완료 · ${game.submissions[myUid].score}점`
      : selectedResult.label;

    submitCombinationButton.disabled =
      alreadySubmitted || !selectedResult.valid;

    submitCombinationButton.textContent =
      alreadySubmitted ? "제출 완료" : "조합 제출";
  } else {
    selectedSubmitCardIds.clear();
  }

  const automaticMessage = getLastActionMessage(room);

  if (game.phase === "SUBMIT") {
    const submitted = Object.keys(game.submissions ?? {}).length;
    const totalPlayers = Object.keys(room.players ?? {}).length;

    showMessage(
      gameMessage,
      `조합을 선택해 제출하세요. ${submitted} / ${totalPlayers}명 제출`
    );
  } else if (game.phase === "RESULT") {
    showMessage(gameMessage, "점수와 라이프 결과를 확인하세요.");
  } else if (game.phase === "ROUND_END") {
    showMessage(gameMessage, "플레이어가 탈락해 라운드가 종료됐습니다.");
  } else if (game.phase === "GAME_END") {
    showMessage(gameMessage, "총 5라운드가 모두 끝났습니다.");
  } else if (automaticMessage) {
    showMessage(gameMessage, automaticMessage);
  } else if (game.lastAction?.type === "BELL") {
    showMessage(
      gameMessage,
      `${getPlayerName(room, game.bellOwner)}님이 벨을 눌렀습니다!`
    );
  } else if (isActionPhase) {
    showMessage(
      gameMessage,
      game.phase === "FINAL_TURNS"
        ? "마지막 턴입니다. 오픈 카드 또는 더미를 선택하세요."
        : "벨, 오픈 카드, 더미 중 하나를 선택하세요."
    );
  } else if (isDiscardPhase) {
    showMessage(gameMessage, "방금 뽑은 카드를 포함해 한 장을 버리세요.");
  } else {
    showMessage(gameMessage, "다른 플레이어의 행동을 기다리는 중입니다.");
  }

  startTimer(game);
}

function startTimer(game) {
  if (timerInterval) clearInterval(timerInterval);

  const requestKey =
    `${game.turnUid}:${game.phase}:${game.turnNumber}`;

  const updateTimer = async () => {
    let startedAt = Number(game.turnStartedAt ?? Date.now());
    let duration = 15;

    if (game.phase === "SUBMIT") {
      startedAt = Number(game.submitStartedAt ?? Date.now());
      duration = 15;
    }

    if (game.phase === "RESULT") {
      startedAt = Number(game.resultStartedAt ?? Date.now());
      duration = 5;
    }

    if (game.phase === "ROUND_END") {
      startedAt = Number(game.roundEndedAt ?? Date.now());
      duration = 7;
    }

    const elapsed = Math.floor(
      (Date.now() - startedAt) / 1000
    );

    const remaining = Math.max(0, duration - elapsed);

    timer.textContent = remaining;
    timer.classList.toggle("warning", remaining <= 5);

    if (game.phase === "RESULT") {
      resultCountdown.textContent = remaining;
    }

    if (game.phase === "ROUND_END") {
      roundCountdown.textContent = remaining;
    }

    if (
      remaining === 0 &&
      (
        game.phase === "TURN_ACTION" ||
        game.phase === "FINAL_TURNS" ||
        game.phase === "DISCARD"
      ) &&
      lastAutomaticRequestKey !== requestKey
    ) {
      lastAutomaticRequestKey = requestKey;

      try {
        await runAutomaticTurn(
          currentRoomCode,
          game.turnUid,
          game.phase,
          game.turnNumber
        );
      } catch (error) {
        console.error("자동 진행 오류:", error);
        lastAutomaticRequestKey = "";
      }
    }

    if (
      remaining === 0 &&
      game.phase === "SUBMIT" &&
      lastAutoSubmitKey !== String(game.submitStartedAt)
    ) {
      lastAutoSubmitKey = String(game.submitStartedAt);

      try {
        await autoSubmitMissing(currentRoomCode);
      } catch (error) {
        console.error("자동 제출 오류:", error);
        lastAutoSubmitKey = "";
      }
    }

    if (
      remaining === 0 &&
      game.phase === "RESULT" &&
      lastResultAdvanceKey !== String(game.resultStartedAt)
    ) {
      lastResultAdvanceKey = String(game.resultStartedAt);

      try {
        await advanceAfterResult(currentRoomCode);
      } catch (error) {
        console.error("다음 세트 이동 오류:", error);
        lastResultAdvanceKey = "";
      }
    }

    if (
      remaining === 0 &&
      game.phase === "ROUND_END" &&
      lastRoundAdvanceKey !== String(game.roundEndedAt)
    ) {
      lastRoundAdvanceKey = String(game.roundEndedAt);

      try {
        await advanceAfterRound(currentRoomCode);
      } catch (error) {
        console.error("다음 라운드 이동 오류:", error);
        lastRoundAdvanceKey = "";
      }
    }
  };

  updateTimer();
  timerInterval = setInterval(updateTimer, 250);
}


rulesButton.addEventListener("click", () => {
  rulesModal.classList.remove("hidden");
});

closeRulesButton.addEventListener("click", () => {
  rulesModal.classList.add("hidden");
});

rulesModal.addEventListener("click", (event) => {
  if (event.target === rulesModal) {
    rulesModal.classList.add("hidden");
  }
});

toggleSoundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem(
    "bellSoundEnabled",
    String(soundEnabled)
  );

  toggleSoundButton.textContent =
    soundEnabled ? "🔊" : "🔇";

  if (soundEnabled) {
    playTone("turn");
  }
});

createRoomButton.addEventListener("click", async () => {
  const nickname = getNickname();

  if (!nickname) {
    showMessage(homeMessage, "닉네임을 입력해주세요.", "error");
    nicknameInput.focus();
    return;
  }

  setBusy(true);
  showMessage(homeMessage, "방을 만드는 중입니다...");

  try {
    const user = await login();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const roomCode = makeRoomCode();

      try {
        await createRoom({ roomCode, user, nickname });
        await enterLobby(roomCode);
        return;
      } catch (error) {
        if (error.message !== "ROOM_CODE_COLLISION") throw error;
      }
    }

    throw new Error("방 코드를 생성하지 못했습니다.");
  } catch (error) {
    console.error(error);
    showMessage(homeMessage, friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
});

joinRoomButton.addEventListener("click", async () => {
  const nickname = getNickname();
  const roomCode = normalizeRoomCode(roomCodeInput.value);

  if (!nickname) {
    showMessage(homeMessage, "닉네임을 입력해주세요.", "error");
    return;
  }

  if (roomCode.length !== 6) {
    showMessage(homeMessage, "방 코드 6자리를 입력해주세요.", "error");
    return;
  }

  setBusy(true);

  try {
    const user = await login();
    await joinRoom({ roomCode, user, nickname });
    await enterLobby(roomCode);
  } catch (error) {
    console.error(error);
    showMessage(homeMessage, friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
});

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = normalizeRoomCode(roomCodeInput.value);
});

copyRoomCodeButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentRoomCode);
    showMessage(lobbyMessage, "방 코드를 복사했습니다.", "success");
  } catch {
    showMessage(lobbyMessage, `방 코드: ${currentRoomCode}`);
  }
});

modeButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await changeMode(currentRoomCode, currentUser.uid, button.dataset.mode);
    } catch (error) {
      showMessage(lobbyMessage, friendlyError(error), "error");
    }
  });
});

startGameButton.addEventListener("click", async () => {
  try {
    await startGame(currentRoomCode, currentUser.uid);
  } catch (error) {
    showMessage(lobbyMessage, friendlyError(error), "error");
  }
});

openCardButton.addEventListener("click", async () => {
  try {
    selectedDiscardCardId = null;
    await takeOpenCard(currentRoomCode, currentUser.uid);
  } catch (error) {
    showMessage(gameMessage, friendlyError(error));
  }
});

deckButton.addEventListener("click", async () => {
  try {
    selectedDiscardCardId = null;
    await drawDeckCard(currentRoomCode, currentUser.uid);
  } catch (error) {
    showMessage(gameMessage, friendlyError(error));
  }
});

confirmDiscardButton.addEventListener("click", async () => {
  if (!selectedDiscardCardId) return;

  try {
    await discardCard(currentRoomCode, currentUser.uid, selectedDiscardCardId);
    selectedDiscardCardId = null;
  } catch (error) {
    showMessage(gameMessage, friendlyError(error));
  }
});


submitCombinationButton.addEventListener("click", async () => {
  if (selectedSubmitCardIds.size < 2) return;

  try {
    await submitCombination(
      currentRoomCode,
      currentUser.uid,
      [...selectedSubmitCardIds],
      false
    );

    selectedSubmitCardIds.clear();
  } catch (error) {
    showMessage(gameMessage, friendlyError(error));
  }
});

bellButton.addEventListener("click", async () => {
  try {
    await pressBell(currentRoomCode, currentUser.uid);

    if ("vibrate" in navigator) {
      navigator.vibrate([160, 80, 220]);
    }
  } catch (error) {
    showMessage(gameMessage, friendlyError(error));
  }
});


returnHomeButton.addEventListener("click", async () => {
  try {
    await resetFinishedRoom(
      currentRoomCode,
      currentUser.uid
    );
  } catch (error) {
    console.error(error);
  }

  if (unsubscribeRoom) {
    unsubscribeRoom();
    unsubscribeRoom = null;
  }

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  if (unsubscribeConnection) {
    unsubscribeConnection();
    unsubscribeConnection = null;
  }

  previousGameSnapshot = null;
  gameLogList.innerHTML = "";
  currentRoom = null;
  currentRoomCode = "";
  localStorage.removeItem("bellRoomCode");
  showScreen("home");
});

async function handleLeave() {
  if (currentRoomCode && currentUser) {
    try {
      await leaveRoom(currentRoomCode, currentUser.uid);
    } catch (error) {
      console.error(error);
    }
  }

  if (unsubscribeRoom) {
    unsubscribeRoom();
    unsubscribeRoom = null;
  }

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  if (unsubscribeConnection) {
    unsubscribeConnection();
    unsubscribeConnection = null;
  }

  previousGameSnapshot = null;
  gameLogList.innerHTML = "";
  currentRoom = null;
  currentRoomCode = "";
  localStorage.removeItem("bellRoomCode");
  showScreen("home");
}

leaveRoomButton.addEventListener("click", handleLeave);
gameLeaveButton.addEventListener("click", handleLeave);

const savedNickname = localStorage.getItem("bellNickname");
if (savedNickname) nicknameInput.value = savedNickname;


toggleSoundButton.textContent =
  soundEnabled ? "🔊" : "🔇";


async function attemptReconnect() {
  const savedRoomCode = localStorage.getItem("bellRoomCode");
  const savedNickname = localStorage.getItem("bellNickname");

  if (!savedRoomCode || !savedNickname) return;

  try {
    const user = await login();
    const room = await getRoom(savedRoomCode);

    if (!room?.players?.[user.uid]) {
      localStorage.removeItem("bellRoomCode");
      return;
    }

    nicknameInput.value = savedNickname;
    await enterLobby(savedRoomCode);
  } catch (error) {
    console.warn("재접속 실패:", error);
    localStorage.removeItem("bellRoomCode");
  }
}

attemptReconnect();
