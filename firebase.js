import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  onValue,
  onDisconnect,
  runTransaction,
  serverTimestamp,
  push,
  query,
  limitToLast
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCIZjUTbbujbI4V6nU16A0wXQscfja2DaQ",
  authDomain: "bell-card-game-9e7bf.firebaseapp.com",
  databaseURL: "https://bell-card-game-9e7bf-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bell-card-game-9e7bf",
  storageBucket: "bell-card-game-9e7bf.firebasestorage.app",
  messagingSenderId: "824687727007",
  appId: "1:824687727007:web:172471a2110aee892fedaa"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

export async function ensureAnonymousLogin() {
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export function waitForAuth() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (!user) return;
        unsubscribe();
        resolve(user);
      },
      reject
    );
  });
}

export async function createRoom({ roomCode, user, nickname }) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (currentRoom) => {
    if (currentRoom !== null) return;

    return {
      meta: {
        hostUid: user.uid,
        status: "WAITING",
        mode: "SOLO",
        round: 0,
        set: 0,
        maxPlayers: 6,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      players: {
        [user.uid]: {
          nickname,
          life: 5,
          team: null,
          ready: true,
          online: true,
          roundWins: 0,
          teamRoundWins: 0,
          totalRemainingLife: 0,
          joinedAt: Date.now()
        }
      }
    };
  });

  if (!result.committed) throw new Error("ROOM_CODE_COLLISION");
  await registerDisconnect(roomCode, user.uid);
}

export async function joinRoom({ roomCode, user, nickname }) {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const roomSnapshot = await get(roomRef);

  if (!roomSnapshot.exists()) throw new Error("ROOM_NOT_FOUND");

  const room = roomSnapshot.val();

  if (room.meta?.status !== "WAITING") throw new Error("GAME_ALREADY_STARTED");

  const players = room.players ?? {};
  const isReturningPlayer = Boolean(players[user.uid]);
  const playerCount = Object.keys(players).length;

  const duplicateNickname = Object.entries(players)
    .some(([playerUid, player]) => {
      return (
        playerUid !== user.uid &&
        String(player.nickname ?? "").trim().toLowerCase() ===
          String(nickname).trim().toLowerCase()
      );
    });

  if (duplicateNickname) {
    throw new Error("DUPLICATE_NICKNAME");
  }

  if (!isReturningPlayer && playerCount >= 6) throw new Error("ROOM_FULL");

  await set(ref(db, `rooms/${roomCode}/players/${user.uid}`), {
    nickname,
    life: players[user.uid]?.life ?? 5,
    team: players[user.uid]?.team ?? null,
    ready: false,
    online: true,
    roundWins: players[user.uid]?.roundWins ?? 0,
    teamRoundWins: players[user.uid]?.teamRoundWins ?? 0,
    totalRemainingLife: players[user.uid]?.totalRemainingLife ?? 0,
    joinedAt: players[user.uid]?.joinedAt ?? Date.now()
  });

  await registerDisconnect(roomCode, user.uid);
}

export async function registerDisconnect(roomCode, uid) {
  const onlineRef = ref(db, `rooms/${roomCode}/players/${uid}/online`);
  await set(onlineRef, true);
  await onDisconnect(onlineRef).set(false);
}

export function watchRoom(roomCode, callback) {
  return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  });
}

export function watchConnection(callback) {
  return onValue(ref(db, ".info/connected"), (snapshot) => {
    callback(snapshot.val() === true);
  });
}

export async function getRoom(roomCode) {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  return snapshot.exists() ? snapshot.val() : null;
}

export function watchChat(roomCode, callback) {
  const chatRef = query(
    ref(db, `rooms/${roomCode}/chat`),
    limitToLast(50)
  );

  return onValue(chatRef, (snapshot) => {
    const messages = [];

    snapshot.forEach((child) => {
      messages.push({
        id: child.key,
        ...child.val()
      });
    });

    callback(messages);
  });
}

export async function sendChatMessage(
  roomCode,
  uid,
  nickname,
  text
) {
  const normalized = String(text ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);

  if (!normalized) {
    throw new Error("EMPTY_CHAT");
  }

  const playerSnapshot = await get(
    ref(db, `rooms/${roomCode}/players/${uid}`)
  );

  if (!playerSnapshot.exists()) {
    throw new Error("PLAYER_NOT_FOUND");
  }

  const chatRef = push(
    ref(db, `rooms/${roomCode}/chat`)
  );

  await set(chatRef, {
    uid,
    nickname: String(nickname ?? "플레이어").slice(0, 10),
    text: normalized,
    createdAt: Date.now()
  });
}


export async function changeMode(roomCode, uid, mode) {
  const hostSnapshot = await get(ref(db, `rooms/${roomCode}/meta/hostUid`));

  if (hostSnapshot.val() !== uid) throw new Error("HOST_ONLY");

  const roomRef = ref(db, `rooms/${roomCode}`);

  await runTransaction(roomRef, (room) => {
    if (!room || room.meta?.hostUid !== uid) return;

    room.meta.mode = mode;
    room.meta.updatedAt = Date.now();

    const playerIds = Object.entries(room.players ?? {})
      .sort(([, playerA], [, playerB]) => {
        return Number(playerA.joinedAt ?? 0) -
          Number(playerB.joinedAt ?? 0);
      })
      .map(([playerUid]) => playerUid);

    playerIds.forEach((playerUid, index) => {
      room.players[playerUid].ready =
        playerUid === uid;

      room.players[playerUid].team =
        mode === "SOLO"
          ? null
          : index % 2 === 0
            ? "A"
            : "B";
    });

    return room;
  });
}


function isTeamMode(mode) {
  return mode === "TEAM_2V2" || mode === "TEAM_3V3";
}

function requiredPlayersForMode(mode) {
  if (mode === "TEAM_2V2") return 4;
  if (mode === "TEAM_3V3") return 6;
  return 2;
}

function assignTeams(room, orderedPlayerIds) {
  const mode = room.meta?.mode ?? "SOLO";

  if (!isTeamMode(mode)) {
    for (const uid of orderedPlayerIds) {
      room.players[uid].team = null;
    }
    return;
  }

  orderedPlayerIds.forEach((uid, index) => {
    room.players[uid].team = index % 2 === 0 ? "A" : "B";
  });
}

function isValidCombination(cards) {
  if (!Array.isArray(cards) || cards.length < 1) return false;

  if (cards.length === 1) {
    return true;
  }

  const sameColor = cards.every(
    (card) => card.color === cards[0].color
  );

  const sameNumber = cards.every(
    (card) => card.number === cards[0].number
  );

  return sameColor || sameNumber;
}

function combinationScore(cards) {
  if (!isValidCombination(cards)) return 0;

  return cards.reduce(
    (total, card) => total + Number(card.number),
    0
  );
}

function bestCombination(hand) {
  const cards = Array.isArray(hand) ? hand : [];
  let bestCards = [];
  let bestScore = 0;

  const subsetCount = 1 << cards.length;

  for (let mask = 0; mask < subsetCount; mask += 1) {
    const selected = cards.filter(
      (_, index) => (mask & (1 << index)) !== 0
    );

    const score = combinationScore(selected);

    if (
      score > bestScore ||
      (score === bestScore && selected.length > bestCards.length)
    ) {
      bestCards = selected;
      bestScore = score;
    }
  }

  return {
    cardIds: bestCards.map((card) => card.id),
    score: bestScore,
    sacrifice: false
  };
}

function selectedSubmission(hand, cardIds, teamMode) {
  const selectedIds = Array.isArray(cardIds) ? cardIds : [];
  const selected = (Array.isArray(hand) ? hand : [])
    .filter((card) => selectedIds.includes(card.id));

  if (teamMode && selected.length === 1) {
    return {
      cardIds: [selected[0].id],
      score: 0,
      sacrifice: true
    };
  }

  if (!isValidCombination(selected)) {
    return {
      cardIds: [],
      score: 0,
      sacrifice: false
    };
  }

  return {
    cardIds: selected.map((card) => card.id),
    score: combinationScore(selected),
    sacrifice: false
  };
}

function prepareSubmitPhase(game) {
  game.phase = "SUBMIT";
  game.turnUid = null;
  game.turnStartedAt = Date.now();
  game.submitStartedAt = Date.now();
  game.submissions = {};
  game.result = null;
}

function selectProtectedTeammate(room, sacrificerUid, threatenedUids) {
  const players = room.players ?? {};
  const team = players[sacrificerUid]?.team;

  const candidates = threatenedUids
    .filter((uid) => uid !== sacrificerUid)
    .filter((uid) => players[uid]?.team === team)
    .sort((uidA, uidB) => {
      return Number(players[uidA]?.life ?? 0) -
        Number(players[uidB]?.life ?? 0);
    });

  return candidates[0] ?? null;
}

function evaluateSet(room) {
  const game = room.game;
  const players = room.players ?? {};
  const playerIds = Object.keys(players);
  const submissions = game.submissions ?? {};
  const teamMode = isTeamMode(room.meta?.mode);

  const normalPlayerIds = playerIds.filter(
    (uid) => !submissions[uid]?.sacrifice
  );

  const scores = {};

  for (const uid of playerIds) {
    scores[uid] = Number(submissions[uid]?.score ?? 0);
  }

  const comparisonIds =
    normalPlayerIds.length > 0 ? normalPlayerIds : playerIds;

  const comparisonScores = comparisonIds.map(
    (uid) => scores[uid]
  );

  const highestScore = Math.max(...comparisonScores);
  const lowestScore = Math.min(...comparisonScores);

  const highestUids = comparisonIds.filter(
    (uid) => scores[uid] === highestScore
  );

  const initialLowestUids = comparisonIds.filter(
    (uid) => scores[uid] === lowestScore
  );

  const protectedUids = [];
  const sacrificeDetails = {};
  const lifeLosses = {};

  if (teamMode) {
    const sacrificers = playerIds.filter(
      (uid) => submissions[uid]?.sacrifice
    );

    for (const sacrificerUid of sacrificers) {
      // 카드 한 장 제출은 실제 희생이므로 항상 본인이 라이프 1개를 잃음.
      lifeLosses[sacrificerUid] =
        Math.max(lifeLosses[sacrificerUid] ?? 0, 1);

      const protectedUid = selectProtectedTeammate(
        room,
        sacrificerUid,
        initialLowestUids.filter(
          (uid) => !protectedUids.includes(uid)
        )
      );

      if (protectedUid) {
        protectedUids.push(protectedUid);
      }

      sacrificeDetails[sacrificerUid] = {
        protectedUid,
        cardId: submissions[sacrificerUid]?.cardIds?.[0] ?? null
      };
    }
  }

  const lowestUids = initialLowestUids.filter(
    (uid) => !protectedUids.includes(uid)
  );

  const bellOwner = game.bellOwner ?? null;
  const bellFailed =
    Boolean(bellOwner) &&
    !highestUids.includes(bellOwner);

  if (bellFailed) {
    lifeLosses[bellOwner] = 2;
  }

  for (const uid of lowestUids) {
    if (uid === bellOwner && bellFailed) continue;
    lifeLosses[uid] = Math.max(lifeLosses[uid] ?? 0, 1);
  }

  for (const [uid, loss] of Object.entries(lifeLosses)) {
    players[uid].life = Math.max(
      0,
      Number(players[uid].life ?? 5) - Number(loss)
    );
  }

  game.phase = "RESULT";
  game.resultStartedAt = Date.now();
  game.result = {
    scores,
    highestScore,
    lowestScore,
    highestUids,
    initialLowestUids,
    lowestUids,
    protectedUids,
    sacrificeDetails,
    lifeLosses,
    bellOwner,
    bellFailed
  };

  return room;
}

function beginNextSet(room) {
  const game = room.game;
  const players = room.players ?? {};
  const playerIds = Object.keys(players);
  const teamMode = isTeamMode(room.meta?.mode);

  const eliminated = playerIds.filter(
    (uid) => Number(players[uid].life ?? 0) <= 0
  );

  if (eliminated.length > 0) {
    const survivors = playerIds.filter(
      (uid) => !eliminated.includes(uid)
    );

    if (teamMode) {
      const losingTeams = new Set(
        eliminated.map((uid) => players[uid]?.team)
      );

      const winningTeams = new Set(
        playerIds
          .map((uid) => players[uid]?.team)
          .filter((team) => team && !losingTeams.has(team))
      );

      for (const uid of playerIds) {
        if (winningTeams.has(players[uid]?.team)) {
          players[uid].teamRoundWins =
            Number(players[uid].teamRoundWins ?? 0) + 1;
        }

        if (survivors.includes(uid)) {
          players[uid].totalRemainingLife =
            Number(players[uid].totalRemainingLife ?? 0) +
            Number(players[uid].life ?? 0);
        }
      }

      game.winningTeams = [...winningTeams];
    } else {
      for (const uid of survivors) {
        players[uid].roundWins =
          Number(players[uid].roundWins ?? 0) + 1;

        players[uid].totalRemainingLife =
          Number(players[uid].totalRemainingLife ?? 0) +
          Number(players[uid].life ?? 0);
      }
    }

    game.phase = "ROUND_END";
    game.turnUid = null;
    game.roundEndedAt = Date.now();
    game.eliminatedUids = eliminated;
    game.survivorUids = survivors;
    return room;
  }

  const previousWinner =
    game.result?.highestUids?.[0] ??
    game.turnOrder?.[0];

  const newDeck = shuffleDeck(createDeck());
  const newHands = {};

  for (const uid of playerIds) {
    newHands[uid] = newDeck.splice(0, 4);
  }

  const openCard = newDeck.shift();
  const turnOrder = Array.isArray(game.turnOrder)
    ? game.turnOrder
    : playerIds;

  const nextTurnIndex = Math.max(
    0,
    turnOrder.indexOf(previousWinner)
  );

  room.meta.set = Number(room.meta.set ?? 1) + 1;

  room.game = {
    phase: "TURN_ACTION",
    deck: newDeck,
    openCard,
    hands: newHands,
    turnOrder,
    turnIndex: nextTurnIndex,
    turnUid: turnOrder[nextTurnIndex],
    turnStartedAt: Date.now(),
    turnNumber: Number(game.turnNumber ?? 0) + 1,
    bellOwner: null,
    autoBell: false,
    submissions: {},
    result: null,
    lastAction: {
      type: "NEXT_SET",
      uid: turnOrder[nextTurnIndex],
      automatic: true,
      at: Date.now()
    }
  };

  return room;
}

function createDeck() {
  const colors = ["red", "yellow", "green", "blue"];
  const deck = [];

  for (const color of colors) {
    for (let number = 1; number <= 10; number += 1) {
      deck.push({
        id: `${color}-${number}`,
        color,
        number
      });
    }
  }

  return deck;
}

function shuffleDeck(deck) {
  const copy = [...deck];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}

function buildPlayersAfter(turnOrder, uid, includeCurrent = false) {
  const order = Array.isArray(turnOrder) ? turnOrder : [];
  const currentIndex = order.indexOf(uid);

  if (currentIndex < 0 || order.length === 0) return [];

  const queue = [];

  if (includeCurrent) {
    queue.push(uid);
  }

  for (let offset = 1; offset < order.length; offset += 1) {
    queue.push(order[(currentIndex + offset) % order.length]);
  }

  return queue;
}

function startFinalTurns(game, {
  bellOwner = null,
  autoBell = false,
  includeCurrent = false
} = {}) {
  const queue = buildPlayersAfter(
    game.turnOrder,
    game.turnUid,
    includeCurrent
  );

  game.bellOwner = bellOwner;
  game.autoBell = autoBell;
  game.finalTurnQueue = queue;
  game.finalTurnIndex = 0;

  if (queue.length === 0) {
    prepareSubmitPhase(game);
    return;
  }

  game.phase = "FINAL_TURNS";
  game.turnUid = queue[0];
  game.turnStartedAt = Date.now();
  game.turnNumber = Number(game.turnNumber ?? 0) + 1;
}

function finishCurrentTurn(game, uid) {
  const previousPhase = game.previousPhase ?? "TURN_ACTION";

  game.drawSource = null;
  game.previousPhase = null;

  if (previousPhase === "FINAL_TURNS") {
    const queue = Array.isArray(game.finalTurnQueue)
      ? game.finalTurnQueue
      : [];

    const nextIndex = Number(game.finalTurnIndex ?? 0) + 1;
    game.finalTurnIndex = nextIndex;

    if (nextIndex >= queue.length) {
      prepareSubmitPhase(game);
      return;
    }

    game.phase = "FINAL_TURNS";
    game.turnUid = queue[nextIndex];
    game.turnStartedAt = Date.now();
    game.turnNumber = Number(game.turnNumber ?? 0) + 1;
    return;
  }

  // 일반 턴에서 더미가 소진되면 방금 행동한 사람을 제외하고 자동 마지막 턴.
  if (Array.isArray(game.deck) && game.deck.length === 0) {
    startFinalTurns(game, {
      bellOwner: null,
      autoBell: true,
      includeCurrent: false
    });
    return;
  }

  const turnOrder = Array.isArray(game.turnOrder)
    ? game.turnOrder
    : [];

  game.phase = "TURN_ACTION";
  game.turnIndex =
    (Number(game.turnIndex) + 1) % turnOrder.length;
  game.turnUid = turnOrder[game.turnIndex];
  game.turnStartedAt = Date.now();
  game.turnNumber = Number(game.turnNumber ?? 0) + 1;
}


export async function setPlayerReady(roomCode, uid, ready) {
  const playerRef = ref(
    db,
    `rooms/${roomCode}/players/${uid}`
  );

  const snapshot = await get(playerRef);

  if (!snapshot.exists()) {
    throw new Error("PLAYER_NOT_FOUND");
  }

  await update(playerRef, {
    ready: Boolean(ready)
  });
}

export async function shuffleTeams(roomCode, uid) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room || room.meta?.hostUid !== uid) return;
    if (room.meta?.status !== "WAITING") return;

    const mode = room.meta?.mode ?? "SOLO";

    if (mode === "SOLO") return;

    const playerIds = Object.entries(room.players ?? {})
      .sort(([, playerA], [, playerB]) => {
        return Number(playerA.joinedAt ?? 0) -
          Number(playerB.joinedAt ?? 0);
      })
      .map(([playerUid]) => playerUid);

    // Fisher-Yates
    for (let index = playerIds.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(
        Math.random() * (index + 1)
      );

      [playerIds[index], playerIds[randomIndex]] =
        [playerIds[randomIndex], playerIds[index]];
    }

    playerIds.forEach((playerUid, index) => {
      room.players[playerUid].team =
        index % 2 === 0 ? "A" : "B";

      // 팀이 바뀌면 다시 준비하도록 함
      room.players[playerUid].ready =
        playerUid === room.meta.hostUid;
    });

    room.meta.updatedAt = Date.now();

    return room;
  });

  if (!result.committed) {
    throw new Error("HOST_ONLY");
  }
}

export async function kickPlayer(
  roomCode,
  hostUid,
  targetUid
) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room || room.meta?.hostUid !== hostUid) return;
    if (room.meta?.status !== "WAITING") return;
    if (targetUid === hostUid) return;
    if (!room.players?.[targetUid]) return;

    delete room.players[targetUid];

    room.meta.updatedAt = Date.now();
    room.meta.kicked = room.meta.kicked ?? {};
    room.meta.kicked[targetUid] = Date.now();

    return room;
  });

  if (!result.committed) {
    throw new Error("KICK_FAILED");
  }
}

export async function startGame(roomCode, uid) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room) return;
    if (room.meta?.hostUid !== uid) return;
    if (room.meta?.status !== "WAITING") return;

    const players = Object.entries(room.players ?? {})
      .sort(([, a], [, b]) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0));

    const mode = room.meta?.mode ?? "SOLO";
    const requiredPlayers = requiredPlayersForMode(mode);

    if (mode === "SOLO" && players.length < 2) return;
    if (isTeamMode(mode) && players.length !== requiredPlayers) return;

    const orderedPlayerIds = players.map(([playerUid]) => playerUid);

    const everyoneReady = players.every(
      ([playerUid, player]) => {
        return (
          playerUid === room.meta.hostUid ||
          player.ready === true
        );
      }
    );

    if (!everyoneReady) return;

    assignTeams(room, orderedPlayerIds);

    const deck = shuffleDeck(createDeck());
    const hands = {};

    for (const [playerUid] of players) {
      hands[playerUid] = deck.splice(0, 4);
      room.players[playerUid].life = 5;
    }

    const openCard = deck.shift();
    const turnOrder = orderedPlayerIds;
    const firstTurnIndex = Math.floor(Math.random() * turnOrder.length);

    room.meta.status = "PLAYING";
    room.meta.round = 1;
    room.meta.set = 1;
    room.meta.startedAt = Date.now();

    room.game = {
      phase: "TURN_ACTION",
      deck,
      openCard,
      hands,
      turnOrder,
      turnIndex: firstTurnIndex,
      turnUid: turnOrder[firstTurnIndex],
      turnStartedAt: Date.now(),
      turnNumber: 1,
      bellOwner: null,
      submissions: {},
      result: null
    };

    return room;
  });

  if (!result.committed) throw new Error("START_FAILED");
}

export async function takeOpenCard(roomCode, uid) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room?.game) return;
    const game = room.game;

    if (
      !["TURN_ACTION", "FINAL_TURNS"].includes(game.phase) ||
      game.turnUid !== uid ||
      !game.openCard
    ) {
      return;
    }

    const sourcePhase = game.phase;

    const hand = Array.isArray(game.hands?.[uid]) ? [...game.hands[uid]] : [];
    hand.push(game.openCard);

    game.hands[uid] = hand;
    game.openCard = null;
    game.phase = "DISCARD";
    game.previousPhase = sourcePhase;
    game.drawSource = "OPEN";
    game.turnStartedAt = Date.now();
    game.lastAction = {
      type: "TAKE_OPEN",
      uid,
      automatic: false,
      at: Date.now()
    };

    return room;
  });

  if (!result.committed) throw new Error("INVALID_ACTION");
}

export async function drawDeckCard(roomCode, uid) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room?.game) return;
    const game = room.game;

    if (
      !["TURN_ACTION", "FINAL_TURNS"].includes(game.phase) ||
      game.turnUid !== uid
    ) return;

    const sourcePhase = game.phase;
    const deck = Array.isArray(game.deck) ? [...game.deck] : [];

    if (deck.length === 0) {
      if (sourcePhase === "TURN_ACTION") {
        startFinalTurns(game, {
          bellOwner: null,
          autoBell: true,
          includeCurrent: true
        });

        game.lastAction = {
          type: "AUTO_BELL_DECK_EMPTY",
          uid: null,
          automatic: true,
          at: Date.now()
        };

        return room;
      }

      return;
    }

    const drawnCard = deck.shift();
    const hand = Array.isArray(game.hands?.[uid]) ? [...game.hands[uid]] : [];
    hand.push(drawnCard);

    game.deck = deck;
    game.hands[uid] = hand;
    game.phase = "DISCARD";
    game.previousPhase = sourcePhase;
    game.drawSource = "DECK";
    game.turnStartedAt = Date.now();
    game.lastAction = {
      type: "DRAW_DECK",
      uid,
      automatic: false,
      at: Date.now()
    };

    return room;
  });

  if (!result.committed) throw new Error("INVALID_ACTION");
}

export async function discardCard(roomCode, uid, cardId) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room?.game) return;
    const game = room.game;

    if (game.phase !== "DISCARD" || game.turnUid !== uid) return;

    const hand = Array.isArray(game.hands?.[uid]) ? [...game.hands[uid]] : [];
    const cardIndex = hand.findIndex((card) => card.id === cardId);

    if (hand.length !== 5 || cardIndex < 0) return;

    const [discardedCard] = hand.splice(cardIndex, 1);

    game.hands[uid] = hand;
    game.openCard = discardedCard;
    game.lastAction = {
      type: "DISCARD",
      uid,
      cardId: discardedCard.id,
      automatic: false,
      at: Date.now()
    };

    finishCurrentTurn(game, uid);

    return room;
  });

  if (!result.committed) throw new Error("INVALID_ACTION");
}



export async function pressBell(roomCode, uid) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room?.game) return;

    const game = room.game;

    if (
      game.phase !== "TURN_ACTION" ||
      game.turnUid !== uid ||
      game.bellOwner
    ) {
      return;
    }

    const bellPlayerName =
      room.players?.[uid]?.nickname ?? "플레이어";

    startFinalTurns(game, {
      bellOwner: uid,
      autoBell: false,
      includeCurrent: false
    });

    game.lastAction = {
      type: "BELL",
      uid,
      nickname: bellPlayerName,
      automatic: false,
      at: Date.now()
    };

    return room;
  });

  if (!result.committed) throw new Error("INVALID_ACTION");
}

function automaticDiscardIndex(hand, turnNumber) {
  const source = hand
    .map((card) => card.id)
    .join("|") + `|${turnNumber}`;

  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash) % hand.length;
}

export async function runAutomaticTurn(
  roomCode,
  expectedTurnUid,
  expectedPhase,
  expectedTurnNumber
) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room?.game) return;

    const game = room.game;

    if (
      game.turnUid !== expectedTurnUid ||
      game.phase !== expectedPhase ||
      Number(game.turnNumber) !== Number(expectedTurnNumber)
    ) {
      return;
    }

    if (
      expectedPhase === "TURN_ACTION" ||
      expectedPhase === "FINAL_TURNS"
    ) {
      const deck = Array.isArray(game.deck) ? [...game.deck] : [];

      if (deck.length === 0) {
        if (expectedPhase === "TURN_ACTION") {
          startFinalTurns(game, {
            bellOwner: null,
            autoBell: true,
            includeCurrent: true
          });

          game.lastAction = {
            type: "AUTO_BELL_DECK_EMPTY",
            uid: null,
            automatic: true,
            at: Date.now()
          };

          return room;
        }

        // 마지막 턴 중 더미가 없으면 오픈 카드를 자동 선택.
        if (game.openCard) {
          const hand = Array.isArray(game.hands?.[expectedTurnUid])
            ? [...game.hands[expectedTurnUid]]
            : [];

          hand.push(game.openCard);
          game.hands[expectedTurnUid] = hand;
          game.openCard = null;
          game.phase = "DISCARD";
          game.previousPhase = "FINAL_TURNS";
          game.drawSource = "AUTO_OPEN";
          game.turnStartedAt = Date.now();
          game.lastAction = {
            type: "AUTO_TAKE_OPEN",
            uid: expectedTurnUid,
            automatic: true,
            at: Date.now()
          };

          return room;
        }

        // 가져올 카드가 전혀 없으면 마지막 턴을 건너뜀.
        game.previousPhase = "FINAL_TURNS";
        finishCurrentTurn(game, expectedTurnUid);
        game.lastAction = {
          type: "AUTO_SKIP",
          uid: expectedTurnUid,
          automatic: true,
          at: Date.now()
        };

        return room;
      }

      const sourcePhase = expectedPhase;

      const drawnCard = deck.shift();
      const hand = Array.isArray(game.hands?.[expectedTurnUid])
        ? [...game.hands[expectedTurnUid]]
        : [];

      hand.push(drawnCard);

      game.deck = deck;
      game.hands[expectedTurnUid] = hand;
      game.phase = "DISCARD";
      game.previousPhase = sourcePhase;
      game.drawSource = "AUTO_DECK";
      game.turnStartedAt = Date.now();
      game.lastAction = {
        type: "AUTO_DRAW_DECK",
        uid: expectedTurnUid,
        automatic: true,
        at: Date.now()
      };

      return room;
    }

    if (expectedPhase === "DISCARD") {
      const hand = Array.isArray(game.hands?.[expectedTurnUid])
        ? [...game.hands[expectedTurnUid]]
        : [];

      if (hand.length !== 5) return;

      const discardIndex = automaticDiscardIndex(
        hand,
        Number(game.turnNumber ?? 0)
      );

      const [discardedCard] = hand.splice(discardIndex, 1);

      game.hands[expectedTurnUid] = hand;
      game.openCard = discardedCard;
      game.lastAction = {
        type: "AUTO_DISCARD",
        uid: expectedTurnUid,
        cardId: discardedCard.id,
        automatic: true,
        at: Date.now()
      };

      finishCurrentTurn(game, expectedTurnUid);

      return room;
    }

    return;
  });

  return result.committed;
}


export async function submitCombination(
  roomCode,
  uid,
  cardIds,
  automatic = false
) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room?.game || room.game.phase !== "SUBMIT") return;
    if (room.game.submissions?.[uid]) return;

    const hand = Array.isArray(room.game.hands?.[uid])
      ? room.game.hands[uid]
      : [];

    const teamMode = isTeamMode(room.meta?.mode);

    const evaluated = automatic
      ? bestCombination(hand)
      : selectedSubmission(hand, cardIds, teamMode);

    room.game.submissions = room.game.submissions ?? {};
    room.game.submissions[uid] = {
      cardIds: evaluated.cardIds,
      score: evaluated.score,
      sacrifice: evaluated.sacrifice,
      automatic,
      submittedAt: Date.now()
    };

    const playerIds = Object.keys(room.players ?? {});
    const submittedIds = Object.keys(room.game.submissions);

    if (playerIds.every((playerUid) => submittedIds.includes(playerUid))) {
      evaluateSet(room);
    }

    return room;
  });

  return result.committed;
}

export async function autoSubmitMissing(roomCode) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room?.game || room.game.phase !== "SUBMIT") return;

    const players = room.players ?? {};
    const submissions = room.game.submissions ?? {};

    for (const uid of Object.keys(players)) {
      if (submissions[uid]) continue;

      const hand = Array.isArray(room.game.hands?.[uid])
        ? room.game.hands[uid]
        : [];

      const evaluated = bestCombination(hand);

      submissions[uid] = {
        cardIds: evaluated.cardIds,
        score: evaluated.score,
        sacrifice: false,
        automatic: true,
        submittedAt: Date.now()
      };
    }

    room.game.submissions = submissions;
    evaluateSet(room);

    return room;
  });

  return result.committed;
}

export async function advanceAfterResult(roomCode) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room?.game || room.game.phase !== "RESULT") return;
    beginNextSet(room);
    return room;
  });

  return result.committed;
}

export async function advanceAfterRound(roomCode) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room?.game || room.game.phase !== "ROUND_END") return;

    const currentRound = Number(room.meta?.round ?? 1);
    const playerIds = Object.keys(room.players ?? {});
    const teamMode = isTeamMode(room.meta?.mode);

    if (currentRound >= 5) {
      room.meta.status = "FINISHED";
      room.game.phase = "GAME_END";
      room.game.turnUid = null;
      room.game.gameEndedAt = Date.now();

      if (teamMode) {
        const teamStats = {};

        for (const uid of playerIds) {
          const team = room.players[uid]?.team;
          if (!team) continue;

          teamStats[team] = teamStats[team] ?? {
            teamRoundWins: 0,
            totalRemainingLife: 0
          };

          teamStats[team].teamRoundWins = Math.max(
            teamStats[team].teamRoundWins,
            Number(room.players[uid].teamRoundWins ?? 0)
          );

          teamStats[team].totalRemainingLife +=
            Number(room.players[uid].totalRemainingLife ?? 0);
        }

        room.game.finalTeamRanking = Object.keys(teamStats)
          .sort((teamA, teamB) => {
            const wins =
              teamStats[teamB].teamRoundWins -
              teamStats[teamA].teamRoundWins;

            if (wins !== 0) return wins;

            return (
              teamStats[teamB].totalRemainingLife -
              teamStats[teamA].totalRemainingLife
            );
          });

        room.game.finalTeamStats = teamStats;
      } else {
        room.game.finalRanking = [...playerIds].sort((uidA, uidB) => {
          const playerA = room.players[uidA];
          const playerB = room.players[uidB];

          const wins =
            Number(playerB.roundWins ?? 0) -
            Number(playerA.roundWins ?? 0);

          if (wins !== 0) return wins;

          return (
            Number(playerB.totalRemainingLife ?? 0) -
            Number(playerA.totalRemainingLife ?? 0)
          );
        });
      }

      return room;
    }

    room.meta.round = currentRound + 1;
    room.meta.set = 1;

    const deck = shuffleDeck(createDeck());
    const hands = {};

    for (const uid of playerIds) {
      room.players[uid].life = 5;
      hands[uid] = deck.splice(0, 4);
    }

    const openCard = deck.shift();
    const turnOrder = [...playerIds];
    const firstTurnIndex = Math.floor(
      Math.random() * turnOrder.length
    );

    room.game = {
      phase: "TURN_ACTION",
      deck,
      openCard,
      hands,
      turnOrder,
      turnIndex: firstTurnIndex,
      turnUid: turnOrder[firstTurnIndex],
      turnStartedAt: Date.now(),
      turnNumber: 1,
      bellOwner: null,
      autoBell: false,
      submissions: {},
      result: null,
      lastAction: {
        type: "NEXT_ROUND",
        uid: turnOrder[firstTurnIndex],
        automatic: true,
        at: Date.now()
      }
    };

    return room;
  });

  return result.committed;
}


export async function returnFinishedGameToLobby(
  roomCode,
  uid
) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  const result = await runTransaction(roomRef, (room) => {
    if (!room) return;
    if (!room.players?.[uid]) return;

    const gamePhase = room.game?.phase;
    const finished =
      room.meta?.status === "FINISHED" ||
      gamePhase === "GAME_END";

    if (!finished) return;

    const hostUid = room.meta?.hostUid;

    room.meta.status = "WAITING";
    room.meta.round = 0;
    room.meta.set = 0;
    room.meta.updatedAt = Date.now();

    for (const [playerUid, player] of Object.entries(
      room.players ?? {}
    )) {
      player.life = 5;
      player.ready = playerUid === hostUid;
      player.roundWins = 0;
      player.teamRoundWins = 0;
      player.totalRemainingLife = 0;
    }

    room.game = null;

    return room;
  });

  if (!result.committed) {
    throw new Error("RETURN_TO_LOBBY_FAILED");
  }
}

export async function resetFinishedRoom(roomCode, uid) {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) return;

  const room = snapshot.val();

  if (room.meta?.hostUid === uid) {
    await remove(roomRef);
  }
}

export async function leaveRoom(roomCode, uid) {
  const roomRef = ref(db, `rooms/${roomCode}`);

  await runTransaction(roomRef, (room) => {
    if (!room) return null;

    const players = room.players ?? {};

    if (!players[uid]) return room;

    delete players[uid];

    const remainingIds = Object.keys(players);

    if (remainingIds.length === 0) {
      return null;
    }

    room.players = players;
    room.meta.updatedAt = Date.now();

    if (room.meta?.hostUid === uid) {
      const nextHostUid = remainingIds
        .sort((uidA, uidB) => {
          return Number(players[uidA]?.joinedAt ?? 0) -
            Number(players[uidB]?.joinedAt ?? 0);
        })[0];

      room.meta.hostUid = nextHostUid;
      room.meta.hostChangedAt = Date.now();

      room.game = room.game ?? {};
      room.game.lastAction = {
        type: "HOST_CHANGED",
        uid: nextHostUid,
        automatic: true,
        at: Date.now()
      };
    }

    return room;
  });
}
