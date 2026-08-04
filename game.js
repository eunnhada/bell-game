import {
  ensureAnonymousLogin,
  createRoom,
  joinRoom,
  watchRoom,
  changeMode,
  setPlayerReady,
  shuffleTeams,
  kickPlayer,
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
  returnFinishedGameToLobby,
  resetFinishedRoom,
  watchConnection,
  getRoom,
  watchChat,
  sendChatMessage,
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
const inviteNotice = document.querySelector("#inviteNotice");
const rulesButton = document.querySelector("#rulesButton");
const settingsButton = document.querySelector("#settingsButton");
const settingsModal = document.querySelector("#settingsModal");
const closeSettingsButton = document.querySelector("#closeSettingsButton");
const colorSymbolToggle = document.querySelector("#colorSymbolToggle");
const largeTextToggle = document.querySelector("#largeTextToggle");
const reducedMotionToggle = document.querySelector("#reducedMotionToggle");
const wakeLockToggle = document.querySelector("#wakeLockToggle");
const orientationNotice = document.querySelector("#orientationNotice");
const dismissOrientationButton = document.querySelector("#dismissOrientationButton");
const installAppButton = document.querySelector("#installAppButton");
const updateToast = document.querySelector("#updateToast");
const reloadAppButton = document.querySelector("#reloadAppButton");
const rulesModal = document.querySelector("#rulesModal");
const closeRulesButton = document.querySelector("#closeRulesButton");

const copyRoomCodeButton = document.querySelector("#copyRoomCodeButton");
const leaveRoomButton = document.querySelector("#leaveRoomButton");
const shareRoomButton = document.querySelector("#shareRoomButton");
const shareModal = document.querySelector("#shareModal");
const closeShareButton = document.querySelector("#closeShareButton");
const shareLinkInput = document.querySelector("#shareLinkInput");
const copyShareLinkButton = document.querySelector("#copyShareLinkButton");
const nativeShareButton = document.querySelector("#nativeShareButton");
const playerCount = document.querySelector("#playerCount");
const connectionStatus = document.querySelector("#connectionStatus");
const playerList = document.querySelector("#playerList");
const modeButtons = [...document.querySelectorAll(".mode-button")];
const startGameButton = document.querySelector("#startGameButton");
const readyButton = document.querySelector("#readyButton");
const shuffleTeamsButton = document.querySelector("#shuffleTeamsButton");
const kickModal = document.querySelector("#kickModal");
const closeKickButton = document.querySelector("#closeKickButton");
const cancelKickButton = document.querySelector("#cancelKickButton");
const confirmKickButton = document.querySelector("#confirmKickButton");
const kickTargetText = document.querySelector("#kickTargetText");
const lobbyMessage = document.querySelector("#lobbyMessage");

const gameBoard = document.querySelector("#gameBoard");
const roundLabel = document.querySelector("#roundLabel");
const setLabel = document.querySelector("#setLabel");
const timer = document.querySelector("#timer");
const gameLeaveButton = document.querySelector("#gameLeaveButton");
const fullscreenButton = document.querySelector("#fullscreenButton");
const gameConnectionBadge = document.querySelector("#gameConnectionBadge");
const gameLogList = document.querySelector("#gameLogList");
const gameEffectOverlay = document.querySelector("#gameEffectOverlay");
const gameEffectText = document.querySelector("#gameEffectText");
const logTabButton = document.querySelector("#logTabButton");
const chatTabButton = document.querySelector("#chatTabButton");
const logTabPanel = document.querySelector("#logTabPanel");
const chatTabPanel = document.querySelector("#chatTabPanel");
const chatUnreadBadge = document.querySelector("#chatUnreadBadge");
const chatMessageList = document.querySelector("#chatMessageList");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const sendChatButton = document.querySelector("#sendChatButton");
const quickChatButtons = [...document.querySelectorAll(".quick-chat-button")];
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
const myPlayerName = document.querySelector("#myPlayerName");
const myLifeDisplay = document.querySelector("#myLifeDisplay");
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
const returnLobbyButton = document.querySelector("#returnLobbyButton");

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
let unsubscribeChat = null;
let soundEnabled = localStorage.getItem("bellSoundEnabled") !== "false";
let previousGameSnapshot = null;
let previousHandSize = 0;
let previousOpenCardId = "";
let chatMessages = [];
let unreadChatCount = 0;
let activeSideTab = "log";
let effectTimeout = null;
let lastDangerSecond = null;
let previousMyLife = null;
let deferredInstallPrompt = null;
let kickTargetUid = null;
let wakeLock = null;

const accessibilitySettings = {
  colorSymbols:
    localStorage.getItem("bellColorSymbols") === "true",
  largeText:
    localStorage.getItem("bellLargeText") === "true",
  reducedMotion:
    localStorage.getItem("bellReducedMotion") === "true",
  wakeLock:
    localStorage.getItem("bellWakeLock") !== "false"
};



function applyAccessibilitySettings() {
  document.body.classList.toggle(
    "color-symbols",
    accessibilitySettings.colorSymbols
  );

  document.body.classList.toggle(
    "large-text",
    accessibilitySettings.largeText
  );

  document.body.classList.toggle(
    "reduced-motion",
    accessibilitySettings.reducedMotion
  );

  colorSymbolToggle.checked =
    accessibilitySettings.colorSymbols;

  largeTextToggle.checked =
    accessibilitySettings.largeText;

  reducedMotionToggle.checked =
    accessibilitySettings.reducedMotion;

  wakeLockToggle.checked =
    accessibilitySettings.wakeLock;
}

async function requestWakeLock() {
  if (
    !accessibilitySettings.wakeLock ||
    !("wakeLock" in navigator) ||
    document.visibilityState !== "visible"
  ) {
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch (error) {
    console.debug("화면 꺼짐 방지 사용 불가:", error);
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;

  try {
    await wakeLock.release();
  } catch {
    // 이미 해제된 경우 무시
  }

  wakeLock = null;
}

function updateOrientationNotice() {
  const isSmallScreen =
    Math.min(window.innerWidth, window.innerHeight) < 700;

  const isPortrait =
    window.matchMedia("(orientation: portrait)").matches;

  const dismissed =
    sessionStorage.getItem("bellOrientationDismissed") === "true";

  const gameVisible =
    !screens.game.classList.contains("hidden");

  orientationNotice.classList.toggle(
    "hidden",
    !isSmallScreen ||
      !isPortrait ||
      dismissed ||
      !gameVisible
  );
}


function showGameEffect(text, type = "") {
  if (effectTimeout) {
    clearTimeout(effectTimeout);
  }

  gameEffectText.textContent = text;
  gameEffectOverlay.className =
    `game-effect-overlay${type ? ` ${type}` : ""}`;

  gameEffectOverlay.classList.remove("hidden");

  effectTimeout = setTimeout(() => {
    gameEffectOverlay.classList.add("hidden");
    gameEffectOverlay.className =
      "game-effect-overlay hidden";
  }, type === "bell-flash" ? 700 : 1050);
}

function triggerBellImpact() {
  gameBoard.classList.remove("bell-impact");
  void gameBoard.offsetWidth;
  gameBoard.classList.add("bell-impact");

  setTimeout(() => {
    gameBoard.classList.remove("bell-impact");
  }, 500);
}

function setSideTab(tab) {
  activeSideTab = tab;

  const chatActive = tab === "chat";

  logTabButton.classList.toggle("active", !chatActive);
  chatTabButton.classList.toggle("active", chatActive);

  logTabPanel.classList.toggle("hidden", chatActive);
  chatTabPanel.classList.toggle("hidden", !chatActive);

  if (chatActive) {
    unreadChatCount = 0;
    updateUnreadBadge();
    requestAnimationFrame(() => {
      chatMessageList.scrollTop =
        chatMessageList.scrollHeight;
    });
  }
}

function updateUnreadBadge() {
  chatUnreadBadge.textContent = unreadChatCount;
  chatUnreadBadge.classList.toggle(
    "hidden",
    unreadChatCount <= 0
  );
}

function formatChatTime(timestamp) {
  if (!timestamp) return "";

  return new Date(timestamp).toLocaleTimeString(
    "ko-KR",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

function renderChat(messages) {
  const previousLastId =
    chatMessages.at(-1)?.id ?? null;

  chatMessages = messages;
  chatMessageList.innerHTML = "";

  for (const message of messages) {
    const item = document.createElement("div");
    item.className = "chat-message";

    if (message.uid === currentUser?.uid) {
      item.classList.add("mine");
    }

    const meta = document.createElement("div");
    meta.className = "chat-meta";

    const name = document.createElement("span");
    name.textContent = message.nickname ?? "플레이어";

    const time = document.createElement("span");
    time.textContent = formatChatTime(message.createdAt);

    const text = document.createElement("div");
    text.className = "chat-text";
    text.textContent = message.text ?? "";

    meta.append(name, time);
    item.append(meta, text);
    chatMessageList.append(item);
  }

  const newLastId = messages.at(-1)?.id ?? null;

  if (
    previousLastId &&
    newLastId &&
    previousLastId !== newLastId &&
    activeSideTab !== "chat"
  ) {
    unreadChatCount += 1;
    updateUnreadBadge();
  }

  chatMessageList.scrollTop =
    chatMessageList.scrollHeight;
}

async function submitChat(text) {
  const normalized = String(text ?? "").trim();

  if (!normalized) return;

  sendChatButton.disabled = true;

  try {
    await sendChatMessage(
      currentRoomCode,
      currentUser.uid,
      currentRoom?.players?.[currentUser.uid]?.nickname ??
        nicknameInput.value.trim() ??
        "플레이어",
      normalized
    );

    chatInput.value = "";
  } catch (error) {
    showMessage(
      gameMessage,
      friendlyError(error)
    );
  } finally {
    sendChatButton.disabled = false;
  }
}

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
      win: { frequency: 740, duration: 0.5 },
      chat: { frequency: 520, duration: 0.08 },
      countdown: { frequency: 760, duration: 0.07 }
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
    NEXT_ROUND: "다음 라운드가 시작됐습니다.",
    HOST_CHANGED: `${name}님이 새 방장이 됐습니다.`
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
    showGameEffect("내 차례!");

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
      triggerBellImpact();
      showGameEffect("🔔 BELL!", "bell-flash");
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

    showGameEffect(
      myLoss ? "라이프 감소" : "세트 생존!",
      myLoss ? "lose-flash" : "win-flash"
    );
  }

  previousGameSnapshot = structuredClone(currentGame);
}


function buildInviteLink(roomCode) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", roomCode);
  return url.toString();
}

function readRoomCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return normalizeRoomCode(params.get("room") ?? "");
}

function clearRoomCodeFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("room");
  window.history.replaceState({}, "", url);
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => {
    element.classList.toggle("hidden", key !== name);
  });

  updateOrientationNotice();

  if (name === "game") {
    requestWakeLock();
  } else {
    releaseWakeLock();
  }
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
  if (message === "DUPLICATE_NICKNAME") return "이미 사용 중인 닉네임입니다.";
  if (message === "PLAYER_NOT_FOUND") return "플레이어 정보를 찾지 못했습니다.";
  if (message === "EMPTY_CHAT") return "메시지를 입력해주세요.";
  if (message === "KICK_FAILED") return "플레이어를 내보내지 못했습니다.";
  if (message === "GAME_ALREADY_STARTED") return "이미 게임이 시작된 방입니다.";
  if (message === "HOST_ONLY") return "방장만 사용할 수 있습니다.";
  if (message === "START_FAILED") {
    return "인원을 확인해주세요. 2대2는 4명, 3대3은 6명이 필요합니다.";
  }
  if (message === "INVALID_ACTION") return "현재 실행할 수 없는 행동입니다.";
  if (message === "RETURN_TO_LOBBY_FAILED") return "대기실로 돌아가지 못했습니다.";

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
  clearRoomCodeFromUrl();

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

  if (unsubscribeChat) {
    unsubscribeChat();
  }

  unsubscribeChat = watchChat(
    roomCode,
    (messages) => {
      renderChat(messages);

      const newest = messages.at(-1);

      if (
        newest &&
        newest.uid !== currentUser?.uid &&
        activeSideTab !== "chat"
      ) {
        playTone("chat");
      }
    }
  );

  unsubscribeRoom = watchRoom(roomCode, (room) => {
    if (!room) {
      showMessage(lobbyMessage, "방이 종료됐습니다.", "error");
      localStorage.removeItem("bellRoomCode");
      setTimeout(() => showScreen("home"), 900);
      return;
    }

    if (!room.players?.[currentUser?.uid]) {
      showMessage(
        homeMessage,
        "방에서 나갔거나 방장에 의해 내보내졌습니다.",
        "error"
      );

      localStorage.removeItem("bellRoomCode");

      if (unsubscribeRoom) {
        unsubscribeRoom();
        unsubscribeRoom = null;
      }

      currentRoom = null;
      currentRoomCode = "";
      showScreen("home");
      return;
    }

    currentRoom = room;
    renderLobby(room);

    const shouldShowGame =
      Boolean(room.game) &&
      (
        room.meta?.status === "PLAYING" ||
        room.meta?.status === "FINISHED" ||
        room.game?.phase === "GAME_END"
      );

    if (shouldShowGame) {
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
      meta.textContent =
        `라이프 ${"♥".repeat(player.life ?? 5)}`;

      if (player.team) {
        const teamChip = document.createElement("span");
        teamChip.className =
          `team-chip ${
            player.team === "A"
              ? "team-a-chip"
              : "team-b-chip"
          }`;

        teamChip.textContent = `${player.team}팀`;
        name.append(teamChip);
      }

      const readyBadge = document.createElement("span");
      readyBadge.className = player.ready
        ? "ready-badge"
        : "not-ready-badge";

      readyBadge.textContent = player.ready
        ? "준비"
        : "대기";

      name.append(readyBadge);

      const dot = document.createElement("div");
      dot.className = player.online ? "online-dot" : "online-dot offline-dot";

      info.append(name, meta);
      item.append(avatar, info, dot);

      if (
        isHost &&
        uid !== currentUser?.uid &&
        room.meta?.status === "WAITING"
      ) {
        const kickButton = document.createElement("button");
        kickButton.className = "kick-button";
        kickButton.type = "button";
        kickButton.textContent = "내보내기";

        kickButton.addEventListener("click", () => {
          kickTargetUid = uid;
          kickTargetText.textContent =
            `${player.nickname}님을 방에서 내보낼까요?`;

          kickModal.classList.remove("hidden");
        });

        item.append(kickButton);
      }

      playerList.append(item);
    });

  
modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === room.meta?.mode);
    button.disabled = !isHost;
  });

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

  const everyoneReady = players.every(
    ([uid, player]) => {
      return (
        uid === hostUid ||
        player.ready === true
      );
    }
  );

  const myPlayer = room.players?.[currentUser?.uid];
  const myReady = myPlayer?.ready === true;

  readyButton.classList.toggle("hidden", isHost);
  readyButton.textContent = myReady
    ? "준비 취소"
    : "준비하기";

  readyButton.classList.toggle("primary", myReady);
  readyButton.classList.toggle("secondary", !myReady);

  shuffleTeamsButton.classList.toggle(
    "hidden",
    !isHost || mode === "SOLO"
  );

  startGameButton.classList.toggle("hidden", !isHost);
  startGameButton.disabled =
    !validCount || !everyoneReady;

  if (!validCount) {
    startGameButton.textContent =
      mode === "SOLO"
        ? "2명 이상 필요합니다"
        : `${requiredPlayers}명이 필요합니다`;
  } else if (!everyoneReady) {
    startGameButton.textContent =
      "모든 플레이어의 준비를 기다리는 중";
  } else {
    startGameButton.textContent = "게임 시작";
  }
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
  const cards = hand.filter(
    (card) => selectedIds.has(card.id)
  );

  if (cards.length < 1) {
    return {
      valid: false,
      score: 0,
      sacrifice: false,
      label: "카드를 1장 이상 선택하세요."
    };
  }

  if (teamMode && cards.length === 1) {
    return {
      valid: true,
      score: 0,
      sacrifice: true,
      label: "희생 제출 · 본인 라이프 1개 감소"
    };
  }

  if (cards.length === 1) {
    return {
      valid: true,
      score: Number(cards[0].number),
      sacrifice: false,
      fourOfAKind: false,
      label: `한 장 조합 · ${cards[0].number}점`
    };
  }

  const fourOfAKind =
    cards.length === 4 &&
    cards.every(
      (card) => card.number === cards[0].number
    );

  if (fourOfAKind) {
    return {
      valid: true,
      score: cards.reduce(
        (total, card) => total + Number(card.number),
        0
      ),
      sacrifice: false,
      fourOfAKind: true,
      label: `포카드 ${cards[0].number} · 모든 일반 조합보다 강함`
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
      label: "2장 이상은 같은 색 또는 같은 숫자만 가능합니다."
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
    if (submission?.sacrifice) {
      score.textContent = "희생";
    } else if (
      submission?.combinationType === "FOUR_OF_A_KIND"
    ) {
      const fourNumber =
        submission.rankValue ??
        hand.find(
          (card) => selectedIds.includes(card.id)
        )?.number ??
        "";

      score.textContent = `포카드 ${fourNumber}`;
      row.classList.add("four-kind-row");
    } else {
      score.textContent = `${scores[uid] ?? 0}점`;
    }

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
  returnLobbyButton.disabled = false;

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


function renderMyLife(room) {
  const myPlayer =
    room.players?.[currentUser?.uid];

  const life = Math.max(
    0,
    Number(myPlayer?.life ?? 0)
  );

  myPlayerName.textContent =
    myPlayer?.nickname ?? "플레이어";

  myLifeDisplay.innerHTML = "";

  if (life <= 0) {
    const empty = document.createElement("span");
    empty.textContent = "라이프 0 · 탈락";
    myLifeDisplay.append(empty);
    myLifeDisplay.classList.add("no-life");
  } else {
    myLifeDisplay.classList.remove("no-life");

    for (let index = 0; index < life; index += 1) {
      const heart = document.createElement("span");
      heart.className = "life-heart";
      heart.textContent = "♥";
      myLifeDisplay.append(heart);
    }
  }

  myLifeDisplay.setAttribute(
    "aria-label",
    `내 라이프 ${life}개`
  );

  if (
    previousMyLife !== null &&
    life < previousMyLife
  ) {
    myLifeDisplay.classList.remove("life-lost");
    void myLifeDisplay.offsetWidth;
    myLifeDisplay.classList.add("life-lost");

    setTimeout(() => {
      myLifeDisplay.classList.remove("life-lost");
    }, 700);
  }

  previousMyLife = life;
}

function renderGame(room) {
  const game = room.game;
  const myUid = currentUser?.uid;

  renderMyLife(room);
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

  const currentOpenCardId = game.openCard?.id ?? "";
  const openCardChanged =
    previousOpenCardId &&
    currentOpenCardId &&
    previousOpenCardId !== currentOpenCardId;

  openCardSlot.innerHTML = "";

  if (game.openCard) {
    const openCardElement = createCardElement(game.openCard);

    if (openCardChanged) {
      openCardElement.classList.add("open-card-change");
    }

    openCardSlot.append(openCardElement);
  } else {
    openCardSlot.textContent = "가져감";
  }

  previousOpenCardId = currentOpenCardId;

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
  const handGrew = myHand.length > previousHandSize;
  handCards.innerHTML = "";

  myHand.forEach((card, cardIndex) => {
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

    if (handGrew && cardIndex === myHand.length - 1) {
      button.classList.add("card-enter");
    }

    handCards.append(button);
  });

  previousHandSize = myHand.length;

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

    if (
      remaining <= 5 &&
      remaining > 0 &&
      lastDangerSecond !== remaining
    ) {
      lastDangerSecond = remaining;
      timer.classList.remove("tick-danger");
      void timer.offsetWidth;
      timer.classList.add("tick-danger");
      playTone("countdown");
    }

    if (remaining > 5) {
      lastDangerSecond = null;
    }

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



window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installAppButton.classList.remove("hidden");
});

installAppButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    showMessage(
      homeMessage,
      "브라우저 메뉴에서 홈 화면에 추가를 선택해주세요."
    );
    return;
  }

  deferredInstallPrompt.prompt();

  try {
    await deferredInstallPrompt.userChoice;
  } finally {
    deferredInstallPrompt = null;
    installAppButton.classList.add("hidden");
  }
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installAppButton.classList.add("hidden");
  showMessage(homeMessage, "BELL이 홈 화면에 설치됐습니다.", "success");
});

reloadAppButton.addEventListener("click", () => {
  window.location.reload();
});

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register(
      "./sw.js",
      { scope: "./" }
    );

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;

      worker.addEventListener("statechange", () => {
        if (
          worker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          updateToast.classList.remove("hidden");
        }
      });
    });
  } catch (error) {
    console.warn("서비스 워커 등록 실패:", error);
  }
}

registerServiceWorker();




logTabButton.addEventListener("click", () => {
  setSideTab("log");
});

chatTabButton.addEventListener("click", () => {
  setSideTab("chat");
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitChat(chatInput.value);
});

quickChatButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    await submitChat(button.dataset.message);
  });
});

settingsButton.addEventListener("click", () => {
  settingsModal.classList.remove("hidden");
});

closeSettingsButton.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    settingsModal.classList.add("hidden");
  }
});

colorSymbolToggle.addEventListener("change", () => {
  accessibilitySettings.colorSymbols =
    colorSymbolToggle.checked;

  localStorage.setItem(
    "bellColorSymbols",
    String(accessibilitySettings.colorSymbols)
  );

  applyAccessibilitySettings();
});

largeTextToggle.addEventListener("change", () => {
  accessibilitySettings.largeText =
    largeTextToggle.checked;

  localStorage.setItem(
    "bellLargeText",
    String(accessibilitySettings.largeText)
  );

  applyAccessibilitySettings();
});

reducedMotionToggle.addEventListener("change", () => {
  accessibilitySettings.reducedMotion =
    reducedMotionToggle.checked;

  localStorage.setItem(
    "bellReducedMotion",
    String(accessibilitySettings.reducedMotion)
  );

  applyAccessibilitySettings();
});

wakeLockToggle.addEventListener("change", async () => {
  accessibilitySettings.wakeLock =
    wakeLockToggle.checked;

  localStorage.setItem(
    "bellWakeLock",
    String(accessibilitySettings.wakeLock)
  );

  if (accessibilitySettings.wakeLock) {
    await requestWakeLock();
  } else {
    await releaseWakeLock();
  }
});

fullscreenButton.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    showMessage(
      gameMessage,
      "이 브라우저에서는 전체화면을 사용할 수 없습니다."
    );
  }
});

dismissOrientationButton.addEventListener("click", () => {
  sessionStorage.setItem(
    "bellOrientationDismissed",
    "true"
  );

  orientationNotice.classList.add("hidden");
});

window.addEventListener("resize", updateOrientationNotice);
window.addEventListener("orientationchange", updateOrientationNotice);

document.addEventListener("visibilitychange", () => {
  if (
    document.visibilityState === "visible" &&
    !screens.game.classList.contains("hidden")
  ) {
    requestWakeLock();
  }
});

shareRoomButton.addEventListener("click", () => {
  if (!currentRoomCode) return;

  shareLinkInput.value = buildInviteLink(currentRoomCode);
  shareModal.classList.remove("hidden");
});

closeShareButton.addEventListener("click", () => {
  shareModal.classList.add("hidden");
});

shareModal.addEventListener("click", (event) => {
  if (event.target === shareModal) {
    shareModal.classList.add("hidden");
  }
});

copyShareLinkButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    copyShareLinkButton.textContent = "복사됨";
    setTimeout(() => {
      copyShareLinkButton.textContent = "복사";
    }, 1200);
  } catch {
    shareLinkInput.select();
    document.execCommand("copy");
  }
});

nativeShareButton.addEventListener("click", async () => {
  const url = shareLinkInput.value || buildInviteLink(currentRoomCode);

  if (!navigator.share) {
    try {
      await navigator.clipboard.writeText(url);
      showMessage(lobbyMessage, "초대 링크를 복사했습니다.", "success");
    } catch {
      showMessage(lobbyMessage, "링크를 직접 복사해주세요.");
    }
    return;
  }

  try {
    await navigator.share({
      title: "BELL 카드게임",
      text: `방 코드 ${currentRoomCode}에 참가하세요.`,
      url
    });
  } catch (error) {
    if (error.name !== "AbortError") {
      console.warn("공유 실패:", error);
    }
  }
});

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


readyButton.addEventListener("click", async () => {
  if (
    !currentUser ||
    !currentRoomCode ||
    !currentRoom?.players?.[currentUser.uid]
  ) {
    showMessage(
      lobbyMessage,
      "플레이어 연결을 다시 확인해주세요.",
      "error"
    );
    return;
  }

  const currentReady =
    currentRoom.players[currentUser.uid].ready === true;

  readyButton.disabled = true;

  try {
    await setPlayerReady(
      currentRoomCode,
      currentUser.uid,
      !currentReady
    );
  } catch (error) {
    console.error("준비 상태 변경 실패:", error);

    showMessage(
      lobbyMessage,
      friendlyError(error),
      "error"
    );
  } finally {
    readyButton.disabled = false;
  }
});

shuffleTeamsButton.addEventListener("click", async () => {
  shuffleTeamsButton.disabled = true;

  try {
    await shuffleTeams(
      currentRoomCode,
      currentUser.uid
    );

    showMessage(
      lobbyMessage,
      "팀을 다시 섞었습니다. 전원이 다시 준비해야 합니다.",
      "success"
    );
  } catch (error) {
    showMessage(
      lobbyMessage,
      friendlyError(error),
      "error"
    );
  } finally {
    shuffleTeamsButton.disabled = false;
  }
});

closeKickButton.addEventListener("click", () => {
  kickTargetUid = null;
  kickModal.classList.add("hidden");
});

cancelKickButton.addEventListener("click", () => {
  kickTargetUid = null;
  kickModal.classList.add("hidden");
});

kickModal.addEventListener("click", (event) => {
  if (event.target === kickModal) {
    kickTargetUid = null;
    kickModal.classList.add("hidden");
  }
});

confirmKickButton.addEventListener("click", async () => {
  if (!kickTargetUid) return;

  confirmKickButton.disabled = true;

  try {
    await kickPlayer(
      currentRoomCode,
      currentUser.uid,
      kickTargetUid
    );

    kickTargetUid = null;
    kickModal.classList.add("hidden");

    showMessage(
      lobbyMessage,
      "플레이어를 방에서 내보냈습니다.",
      "success"
    );
  } catch (error) {
    showMessage(
      lobbyMessage,
      friendlyError(error),
      "error"
    );
  } finally {
    confirmKickButton.disabled = false;
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



returnLobbyButton.addEventListener("click", async () => {
  returnLobbyButton.disabled = true;

  try {
    await returnFinishedGameToLobby(
      currentRoomCode,
      currentUser.uid
    );

    selectedDiscardCardId = null;
    selectedSubmitCardIds.clear();
    previousGameSnapshot = null;
    previousMyLife = null;
    gameLogList.innerHTML = "";
    setSideTab("log");

    showMessage(
      lobbyMessage,
      "같은 방 대기실로 돌아왔습니다.",
      "success"
    );
  } catch (error) {
    showMessage(
      gameMessage,
      friendlyError(error)
    );
  } finally {
    returnLobbyButton.disabled = false;
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

  if (unsubscribeChat) {
    unsubscribeChat();
    unsubscribeChat = null;
  }

  chatMessages = [];
  unreadChatCount = 0;
  updateUnreadBadge();
  previousGameSnapshot = null;
  previousMyLife = null;
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

  if (unsubscribeChat) {
    unsubscribeChat();
    unsubscribeChat = null;
  }

  chatMessages = [];
  unreadChatCount = 0;
  updateUnreadBadge();
  previousGameSnapshot = null;
  previousMyLife = null;
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



const invitedRoomCode = readRoomCodeFromUrl();

if (invitedRoomCode.length === 6) {
  roomCodeInput.value = invitedRoomCode;
  inviteNotice.classList.remove("hidden");
}

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

applyAccessibilitySettings();
setSideTab("log");
updateOrientationNotice();
attemptReconnect();
