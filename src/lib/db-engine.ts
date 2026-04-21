import {
	ensureDb,
	initializeDb,
	markDisconnectedPlayers,
	ROUND_FORFEIT_TIMEOUT_SECONDS,
	SESSION_EXPIRY_SECONDS,
} from "./db";
import { compareHands, evaluateHand } from "./game-engine";
import type {
	Card,
	ClientGameView,
	GameConfig,
	GameSession,
	PlayerInRound,
	RoundSummary,
} from "./types";

function generateId(): string {
	const arr = new Uint8Array(8);
	crypto.getRandomValues(arr);
	return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function sanitizeName(name: string): string {
	return name
		.replace(/[<>&"']/g, "")
		.trim()
		.slice(0, 20);
}

function nowMs(): number {
	return Date.now();
}

function expiresAt(): number {
	return Math.floor(nowMs() / 1000) + SESSION_EXPIRY_SECONDS;
}

async function loadSession(
	sessionId: string,
	expectedVersion?: number,
): Promise<GameSession | null> {
	await initializeDb();
	const db = await ensureDb();
	const rs = await db.execute({
		sql: "SELECT data, updated_at FROM sessions WHERE id = ?",
		args: [sessionId],
	});
	if (rs.rows.length === 0) return null;
	const dbVersion = rs.rows[0]!.updated_at as number;
	if (expectedVersion !== undefined && dbVersion !== expectedVersion) {
		throw new Error(
			"CONFLICT: Session was modified by another request. Please retry.",
		);
	}
	return JSON.parse(rs.rows[0]!.data as string) as GameSession;
}

async function saveSession(
	session: GameSession,
	expectedVersion?: number,
): Promise<number> {
	const db = await ensureDb();
	const version = nowMs();
	if (expectedVersion !== undefined) {
		const rs = await db.execute({
			sql: `UPDATE sessions
			      SET data = ?, expires_at = ?, updated_at = ?
			      WHERE id = ? AND updated_at = ?`,
			args: [
				JSON.stringify(session),
				expiresAt(),
				version,
				session.id,
				expectedVersion,
			],
		});
		if (rs.rowsAffected === 0) {
			throw new Error(
				"CONFLICT: Session was modified by another request. Please retry.",
			);
		}
	} else {
		await db.execute({
			sql: `INSERT INTO sessions (id, data, expires_at, updated_at)
			      VALUES (?, ?, ?, ?)
			      ON CONFLICT(id) DO UPDATE SET
			        data       = excluded.data,
			        expires_at = excluded.expires_at,
			        updated_at = excluded.updated_at`,
			args: [session.id, JSON.stringify(session), expiresAt(), version],
		});
	}
	return version;
}

async function loadDeck(sessionId: string): Promise<Card[]> {
	const db = await ensureDb();
	const rs = await db.execute({
		sql: "SELECT deck FROM session_decks WHERE session_id = ?",
		args: [sessionId],
	});
	if (rs.rows.length === 0) return [];
	return JSON.parse(rs.rows[0]!.deck as string) as Card[];
}

async function saveDeck(sessionId: string, deck: Card[]): Promise<void> {
	const db = await ensureDb();
	await db.execute({
		sql: `INSERT INTO session_decks (session_id, deck)
		      VALUES (?, ?)
		      ON CONFLICT(session_id) DO UPDATE SET deck = excluded.deck`,
		args: [sessionId, JSON.stringify(deck)],
	});
}

async function upsertSessionPlayer(
	sessionId: string,
	playerId: string,
	name: string,
	authUserId?: string,
): Promise<void> {
	await initializeDb();
	const db = await ensureDb();
	await db.execute({
		sql: `INSERT INTO session_players (session_id, player_id, name, auth_user_id, last_heartbeat, connected)
		      VALUES (?, ?, ?, ?, ?, 1)
		      ON CONFLICT(session_id, player_id) DO UPDATE SET
		        name           = excluded.name,
		        last_heartbeat = excluded.last_heartbeat,
		        connected      = 1`,
		args: [
			sessionId,
			playerId,
			name,
			authUserId ?? "",
			Math.floor(nowMs() / 1000),
		],
	});
}

async function loadPromptPayIds(
	sessionId: string,
): Promise<Record<string, string>> {
	const db = await ensureDb();
	const rs = await db.execute({
		sql: "SELECT player_id, promptpay_id FROM session_players WHERE session_id = ? AND promptpay_id IS NOT NULL",
		args: [sessionId],
	});
	const map: Record<string, string> = {};
	for (const row of rs.rows) {
		if (row.player_id && row.promptpay_id) {
			map[row.player_id as string] = row.promptpay_id as string;
		}
	}
	return map;
}

async function loadConnectedStatus(
	sessionId: string,
): Promise<Record<string, boolean>> {
	const db = await ensureDb();
	const rs = await db.execute({
		sql: "SELECT player_id, connected FROM session_players WHERE session_id = ?",
		args: [sessionId],
	});
	const map: Record<string, boolean> = {};
	for (const row of rs.rows) {
		map[row.player_id as string] = (row.connected as number) === 1;
	}
	return map;
}

function bump(session: GameSession): void {
	session.version++;
	session.updatedAt = nowMs();
}

import type { Rank, Suit } from "./types";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = [
	"A",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K",
];

function createDeckOfSize(size: number): Card[] {
	const base: Card[] = [];
	for (const suit of SUITS) {
		for (const rank of RANKS) {
			base.push({ suit, rank });
		}
	}
	while (base.length < size) {
		for (const suit of SUITS) {
			for (const rank of RANKS) {
				base.push({ suit, rank });
				if (base.length >= size) return base;
			}
		}
	}
	return base;
}

function shuffleDeck(deck: Card[]): Card[] {
	const shuffled = [...deck];
	const len = shuffled.length;
	for (let i = len - 1; i > 0; i--) {
		let j: number;
		const limit = 0x100000000 - (0x100000000 % (i + 1));
		const arr = new Uint32Array(1);
		do {
			crypto.getRandomValues(arr);
			j = arr[0]!;
		} while (j >= limit);
		j = j % (i + 1);
		[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
	}
	return shuffled;
}

export async function createSession(
	hostName: string,
	config?: Partial<GameConfig>,
	authUserId?: string,
): Promise<GameSession> {
	await initializeDb();
	const hostId = generateId();
	const sessionId = generateId();
	const now = nowMs();
	const safeName = sanitizeName(hostName);
	const session: GameSession = {
		id: sessionId,
		hostId,
		players: [{ id: hostId, name: safeName, isDealer: true }],
		dealerId: hostId,
		currentRound: null,
		roundHistory: [],
		phase: "lobby",
		config: { allowAceHighStraight: config?.allowAceHighStraight ?? false },
		version: 1,
		createdAt: now,
		updatedAt: now,
	};
	await saveSession(session);
	await upsertSessionPlayer(sessionId, hostId, safeName, authUserId);
	return session;
}

export async function joinSession(
	sessionId: string,
	playerName: string,
	promptPayId?: string,
	existingPlayerId?: string,
	authUserId?: string,
): Promise<{ session: GameSession; playerId: string }> {
	const session = await loadSession(sessionId);
	if (!session) throw new Error("Session not found");
	if (session.phase !== "lobby") throw new Error("Game already in progress");
	if (session.players.length >= 17)
		throw new Error("Session full (max 17 players)");

	const version = await getDbVersion(sessionId);
	const safeName = sanitizeName(playerName);

	if (existingPlayerId) {
		const existing = session.players.find((p) => p.id === existingPlayerId);
		if (existing) {
			await upsertSessionPlayer(
				sessionId,
				existingPlayerId,
				existing.name,
				authUserId,
			);
			if (promptPayId?.trim()) {
				await setPlayerPromptPayId(
					sessionId,
					existingPlayerId,
					promptPayId.trim(),
				);
			}
			return { session, playerId: existingPlayerId };
		}
	}

	if (safeName.length < 2) throw new Error("Name too short after sanitization");

	const playerId = generateId();
	session.players.push({ id: playerId, name: safeName, isDealer: false });
	bump(session);
	await saveSession(session, version);
	await upsertSessionPlayer(sessionId, playerId, safeName, authUserId);

	if (promptPayId?.trim()) {
		await setPlayerPromptPayId(sessionId, playerId, promptPayId.trim());
	}

	return { session, playerId };
}

async function getDbVersion(sessionId: string): Promise<number> {
	const db = await ensureDb();
	const rs = await db.execute({
		sql: "SELECT updated_at FROM sessions WHERE id = ?",
		args: [sessionId],
	});
	if (rs.rows.length === 0) throw new Error("Session not found");
	return rs.rows[0]!.updated_at as number;
}

export async function getSession(
	sessionId: string,
): Promise<GameSession | null> {
	return loadSession(sessionId);
}

export async function listSessions(): Promise<
	Array<{ id: string; hostName: string; playerCount: number; phase: string }>
> {
	await initializeDb();
	const db = await ensureDb();
	const now = Math.floor(nowMs() / 1000);
	const rs = await db.execute({
		sql: "SELECT data FROM sessions WHERE expires_at > ? ORDER BY rowid DESC LIMIT 50",
		args: [now],
	});
	return rs.rows.map((row) => {
		const s = JSON.parse(row.data as string) as GameSession;
		const host = s.players.find((p) => p.id === s.hostId);
		return {
			id: s.id,
			hostName: host?.name ?? "Unknown",
			playerCount: s.players.length,
			phase: s.phase,
		};
	});
}

export async function startBetting(
	sessionId: string,
	playerId: string,
): Promise<void> {
	const dbVersion = await getDbVersion(sessionId);
	const session = await loadSession(sessionId);
	if (!session) throw new Error("Session not found");
	if (session.players.length < 2) throw new Error("Need at least 2 players");

	if (
		session.currentRound &&
		session.currentRound.phase !== "reveal" &&
		session.phase !== "lobby"
	) {
		throw new Error("Current round must be completed first");
	}

	const isDealer = playerId === session.dealerId;
	const isFirstRound = session.roundHistory.length === 0;
	if (isFirstRound && session.hostId !== playerId)
		throw new Error("Only host can start the first round");
	if (!isFirstRound && !isDealer)
		throw new Error("Only dealer can start the next round");

	if (session.roundHistory.length > 0) {
		const activePlayers = session.players.filter((p) => !p.leftAt);
		if (activePlayers.length < 2)
			throw new Error("Need at least 2 active players");

		const prevDealerIdx = activePlayers.findIndex(
			(p) => p.id === session.dealerId,
		);
		const nextDealerIdx =
			prevDealerIdx >= 0 ? (prevDealerIdx + 1) % activePlayers.length : 0;
		for (const p of session.players) {
			p.isDealer = p.id === activePlayers[nextDealerIdx]!.id;
		}
		session.dealerId = activePlayers[nextDealerIdx]!.id;
	}

	const roundNumber = session.roundHistory.length + 1;
	const players: PlayerInRound[] = session.players
		.filter((p) => !p.isDealer && !p.leftAt)
		.map((p) => ({
			playerId: p.id,
			cards: [],
			bet: 0,
			hasDrawn: false,
			hasStood: false,
		}));

	const dealerPlayer: PlayerInRound = {
		playerId: session.dealerId,
		cards: [],
		bet: 0,
		hasDrawn: false,
		hasStood: false,
	};

	session.currentRound = {
		roundNumber,
		phase: "betting",
		players,
		dealerHand: dealerPlayer,
		startedAt: nowMs(),
	};
	session.phase = "betting";
	bump(session);
	await saveSession(session, dbVersion);
}

export async function placeBet(
	sessionId: string,
	playerId: string,
	amount: number,
): Promise<void> {
	const dbVersion = await getDbVersion(sessionId);
	const session = await loadSession(sessionId);
	if (!session?.currentRound) throw new Error("No active round");
	if (session.currentRound.phase !== "betting")
		throw new Error("Not in betting phase");

	const player = session.currentRound.players.find(
		(p) => p.playerId === playerId,
	);
	if (!player) throw new Error("Player not in round");
	if (player.bet > 0) throw new Error("Bet already placed");
	if (!Number.isInteger(amount) || amount <= 0 || amount > 1000)
		throw new Error("Invalid bet amount");

	player.bet = amount;
	bump(session);
	await saveSession(session, dbVersion);
}

export async function dealCards(
	sessionId: string,
	playerId: string,
): Promise<void> {
	const dbVersion = await getDbVersion(sessionId);
	const session = await loadSession(sessionId);
	if (!session?.currentRound) throw new Error("No active round");
	if (session.dealerId !== playerId) throw new Error("Only dealer can deal");

	const allBet = session.currentRound.players.every((p) => p.bet > 0);
	if (!allBet) throw new Error("Not all players have placed bets");
	if (session.currentRound.players.length === 0)
		throw new Error("No players to deal to");

	const numPlayers = session.currentRound.players.length;
	const totalHands = numPlayers + 1;
	const deckSize = Math.max(totalHands * 3, 52);
	const deck = shuffleDeck(createDeckOfSize(deckSize));
	let cardIndex = 0;

	for (const player of session.currentRound.players) {
		player.cards = [deck[cardIndex]!, deck[cardIndex + 1]!];
		cardIndex += 2;
	}

	session.currentRound.dealerHand!.cards = [
		deck[cardIndex]!,
		deck[cardIndex + 1]!,
	];
	cardIndex += 2;

	session.currentRound.phase = "playing";
	session.phase = "playing";
	bump(session);

	const evalOpts = {
		allowAceHighStraight: session.config.allowAceHighStraight,
	};
	const dealerResult = evaluateHand(
		session.currentRound.dealerHand!.cards,
		evalOpts,
	);

	let shouldResolve = false;
	if (dealerResult.handType === "pok") {
		shouldResolve = true;
	} else {
		const anyPlayerPok = session.currentRound.players.some((p) => {
			const r = evaluateHand(p.cards, evalOpts);
			return r.handType === "pok";
		});
		if (anyPlayerPok) {
			for (const p of session.currentRound.players) {
				const r = evaluateHand(p.cards, evalOpts);
				if (r.handType === "pok") p.hasStood = true;
			}
			shouldResolve = session.currentRound.players.every((p) => p.hasStood);
		}
	}

	await saveDeck(sessionId, deck.slice(cardIndex));

	if (shouldResolve) {
		await resolveRoundInline(session, dbVersion);
		return;
	}

	await saveSession(session, dbVersion);
}

export async function drawCard(
	sessionId: string,
	playerId: string,
): Promise<Card> {
	const dbVersion = await getDbVersion(sessionId);
	const session = await loadSession(sessionId);
	if (!session?.currentRound) throw new Error("No active round");
	if (session.currentRound.phase !== "playing")
		throw new Error("Not in playing phase");

	const player = session.currentRound.players.find(
		(p) => p.playerId === playerId,
	);
	if (!player) throw new Error("Player not in round");
	if (player.hasDrawn || player.hasStood) throw new Error("Already acted");
	if (player.cards.length >= 3) throw new Error("Max 3 cards");

	const hand = evaluateHand(player.cards, {
		allowAceHighStraight: session.config.allowAceHighStraight,
	});
	if (hand.handType === "pok") throw new Error("Pok hand cannot draw");

	const deck = await loadDeck(sessionId);
	if (!deck || deck.length === 0) throw new Error("No cards left");

	const card = deck.shift()!;
	player.cards.push(card);
	player.hasDrawn = true;
	bump(session);

	await saveDeck(sessionId, deck);

	const allActed = session.currentRound.players.every(
		(p) => p.hasDrawn || p.hasStood,
	);
	const dealer = session.currentRound.dealerHand!;
	if (allActed && (dealer.hasDrawn || dealer.hasStood)) {
		await resolveRoundInline(session, dbVersion);
		return card;
	}

	await saveSession(session, dbVersion);
	return card;
}

export async function stand(
	sessionId: string,
	playerId: string,
): Promise<void> {
	const dbVersion = await getDbVersion(sessionId);
	const session = await loadSession(sessionId);
	if (!session?.currentRound) throw new Error("No active round");
	if (session.currentRound.phase !== "playing")
		throw new Error("Not in playing phase");

	const isDealer = playerId === session.dealerId;
	const player = isDealer
		? session.currentRound.dealerHand
		: session.currentRound.players.find((p) => p.playerId === playerId);
	if (!player) throw new Error("Player not in round");
	if (player.hasStood) throw new Error("Already stood");

	player.hasStood = true;
	bump(session);

	const allActed = session.currentRound.players.every(
		(p) => p.hasDrawn || p.hasStood,
	);
	const dealer = session.currentRound.dealerHand!;
	if (allActed && (dealer.hasDrawn || dealer.hasStood)) {
		await resolveRoundInline(session, dbVersion);
		return;
	}

	await saveSession(session, dbVersion);
}

export async function dealerDraw(
	sessionId: string,
	playerId: string,
): Promise<Card> {
	const dbVersion = await getDbVersion(sessionId);
	const session = await loadSession(sessionId);
	if (!session?.currentRound) throw new Error("No active round");
	if (playerId !== session.dealerId) throw new Error("Not the dealer");
	if (session.currentRound.dealerHand!.hasDrawn)
		throw new Error("Already drew");
	if (session.currentRound.dealerHand!.cards.length >= 3)
		throw new Error("Max 3 cards");

	const allPlayersActed = session.currentRound.players.every(
		(p) => p.hasDrawn || p.hasStood,
	);
	if (!allPlayersActed) throw new Error("Not all players have acted");

	const deck = await loadDeck(sessionId);
	if (!deck || deck.length === 0) throw new Error("No cards left");

	const card = deck.shift()!;
	session.currentRound.dealerHand!.cards.push(card);
	session.currentRound.dealerHand!.hasDrawn = true;
	bump(session);

	await saveDeck(sessionId, deck);

	const allActed = session.currentRound.players.every(
		(p) => p.hasDrawn || p.hasStood,
	);
	if (allActed) {
		await resolveRoundInline(session, dbVersion);
		return card;
	}

	await saveSession(session, dbVersion);
	return card;
}

async function resolveRoundInline(
	session: GameSession,
	dbVersion: number,
): Promise<void> {
	if (!session.currentRound) return;
	if (session.currentRound.phase === "reveal") return;

	const evalOpts = {
		allowAceHighStraight: session.config.allowAceHighStraight,
	};
	const dealerResult = evaluateHand(
		session.currentRound.dealerHand!.cards,
		evalOpts,
	);
	session.currentRound.dealerHand!.result = dealerResult;

	const roundResults: RoundSummary["results"] = [];
	for (const player of session.currentRound.players) {
		const playerResult = evaluateHand(player.cards, evalOpts);
		player.result = playerResult;
		const comparison = compareHands(playerResult, dealerResult, player.bet);
		player.netAmount = comparison.netAmount;
		const playerInfo = session.players.find((p) => p.id === player.playerId);
		roundResults.push({
			playerId: player.playerId,
			playerName: playerInfo?.name ?? "Unknown",
			bet: player.bet,
			netAmount: comparison.netAmount,
			taem: playerResult.score,
			handType: playerResult.handType,
			deng: playerResult.deng,
		});
	}

	session.roundHistory.push({
		roundNumber: session.currentRound.roundNumber,
		dealerId: session.dealerId,
		dealerTaem: dealerResult.score,
		dealerHandType: dealerResult.handType,
		dealerDeng: dealerResult.deng,
		results: roundResults,
	});

	session.currentRound.phase = "reveal";
	session.phase = "reveal";
	bump(session);
	await saveSession(session, dbVersion);
}

export async function resolveRound(
	sessionId: string,
	playerId: string,
): Promise<void> {
	const dbVersion = await getDbVersion(sessionId);
	const session = await loadSession(sessionId);
	if (!session) throw new Error("Session not found");
	if (session.hostId !== playerId) throw new Error("Only host can resolve");
	await resolveRoundInline(session, dbVersion);
}

export async function endSession(
	sessionId: string,
	playerId: string,
): Promise<Record<string, { name: string; balance: number }>> {
	const dbVersion = await getDbVersion(sessionId);
	const session = await loadSession(sessionId);
	if (!session) throw new Error("Session not found");
	if (session.hostId !== playerId) throw new Error("Only host can end session");

	const balances: Record<string, { name: string; balance: number }> = {};
	for (const p of session.players) {
		balances[p.id] = { name: p.name, balance: 0 };
	}

	for (const round of session.roundHistory) {
		const roundDealerId = round.dealerId;
		for (const result of round.results) {
			if (balances[result.playerId]) {
				balances[result.playerId].balance += result.netAmount;
			}
			if (balances[roundDealerId]) {
				balances[roundDealerId].balance -= result.netAmount;
			}
		}
	}

	session.phase = "ended";
	bump(session);
	await saveSession(session, dbVersion);
	const authUserIds = await loadAuthUserIds(session.id);
	await saveSessionHistory(session, balances, authUserIds);
	return balances;
}

export async function getClientView(
	sessionId: string,
	playerId: string,
): Promise<ClientGameView> {
	const session = await loadSession(sessionId);
	if (!session) throw new Error("Session not found");

	await db_heartbeat(sessionId, playerId);
	await markDisconnectedPlayers(sessionId);
	await forceForfeitDisconnectedPlayers(sessionId);
	await removeAfkBettingPlayers(sessionId);
	await transferHostIfNeeded(sessionId);

	const autoClosed = await checkAutoClose(sessionId);
	if (autoClosed) {
		throw new Error("Session not found");
	}

	const refreshedSession = await loadSession(sessionId);
	if (!refreshedSession) throw new Error("Session not found");
	const s = refreshedSession;

	const round = s.currentRound;
	const isReveal = round?.phase === "reveal";

	const promptPayIds = await loadPromptPayIds(sessionId);
	const connectedStatus = await loadConnectedStatus(sessionId);
	const emojis = await loadEmojis(sessionId);

	const players = s.players.map((p) => {
		const roundPlayer = round?.players.find((rp) => rp.playerId === p.id);
		const isDealer = p.id === s.dealerId;
		const dealerData = isDealer ? round?.dealerHand : undefined;
		const data = isDealer ? dealerData : roundPlayer;
		const isMe = p.id === playerId;
		const showCards = isReveal || isMe;

		return {
			id: p.id,
			name: p.name,
			isDealer,
			isHost: p.id === s.hostId,
			cardCount: data?.cards.length ?? 0,
			hasDrawn: data?.hasDrawn ?? false,
			hasStood: data?.hasStood ?? false,
			cards: showCards ? data?.cards : undefined,
			result: isReveal ? data?.result : undefined,
			netAmount: isReveal ? data?.netAmount : undefined,
			bet: data?.bet ?? 0,
			promptPayId: promptPayIds[p.id],
			connected: connectedStatus[p.id] ?? false,
			emoji: emojis[p.id],
			leftAt: p.leftAt,
		};
	});

	const myRoundData = round?.players.find((rp) => rp.playerId === playerId);
	const amDealer = playerId === s.dealerId;
	const myDealerData = amDealer ? round?.dealerHand : undefined;
	const myData = amDealer ? myDealerData : myRoundData;

	const cumulativeBalances: Record<string, number> = {};
	for (const p of s.players) cumulativeBalances[p.id] = 0;
	for (const r of s.roundHistory) {
		const roundDealerId = r.dealerId;
		for (const result of r.results) {
			if (cumulativeBalances[result.playerId] !== undefined) {
				cumulativeBalances[result.playerId] += result.netAmount;
			}
			if (cumulativeBalances[roundDealerId] !== undefined) {
				cumulativeBalances[roundDealerId] -= result.netAmount;
			}
		}
	}

	return {
		sessionId,
		phase: s.phase,
		turnStartedAt: round?.startedAt,
		version: s.version,
		hostId: s.hostId,
		players,
		myCards: myData?.cards ?? [],
		myResult: isReveal ? myData?.result : undefined,
		roundNumber: round?.roundNumber ?? 0,
		roundHistory: s.roundHistory,
		cumulativeBalances,
		playerPromptPayIds: promptPayIds,
		kickVotes: s.kickVotes ?? {},
	};
}

export async function verifyPlayerInSession(
	sessionId: string,
	playerId: string,
): Promise<boolean> {
	await initializeDb();
	const db = await ensureDb();
	const rs = await db.execute({
		sql: "SELECT 1 FROM session_players WHERE session_id = ? AND player_id = ?",
		args: [sessionId, playerId],
	});
	return rs.rows.length > 0;
}

export async function leaveSession(
	sessionId: string,
	playerId: string,
): Promise<void> {
	await initializeDb();
	const db = await ensureDb();
	await db.execute({
		sql: `UPDATE session_players SET connected = 0, last_heartbeat = 0 WHERE session_id = ? AND player_id = ?`,
		args: [sessionId, playerId],
	});

	const session = await loadSession(sessionId);
	if (!session) return;
	const player = session.players.find((p) => p.id === playerId);
	if (!player) return;

	if (session.phase !== "lobby") {
		const dbVersion = await getDbVersion(sessionId);
		const fresh = await loadSession(sessionId, dbVersion);
		if (!fresh) return;
		const fp = fresh.players.find((p) => p.id === playerId);
		if (!fp) return;
		fp.leftAt = Date.now();

		if (fresh.currentRound?.phase === "betting") {
			const inRound = fresh.currentRound.players.find(
				(p) => p.playerId === playerId,
			);
			if (inRound && inRound.bet === 0) {
				fresh.currentRound.players = fresh.currentRound.players.filter(
					(p) => p.playerId !== playerId,
				);
			}
		} else if (fresh.currentRound?.phase === "playing") {
			const inRound = fresh.currentRound.players.find(
				(p) => p.playerId === playerId,
			);
			if (inRound) {
				inRound.hasStood = true;
			}
			if (playerId === fresh.dealerId && fresh.currentRound.dealerHand) {
				fresh.currentRound.dealerHand.hasStood = true;
			}
		}

		bump(fresh);
		await saveSession(fresh, dbVersion);
	}
}

export async function removeSession(sessionId: string): Promise<void> {
	const db = await ensureDb();
	await db.batch(
		[
			{
				sql: "DELETE FROM session_decks WHERE session_id = ?",
				args: [sessionId],
			},
			{
				sql: "DELETE FROM settlements WHERE session_id = ?",
				args: [sessionId],
			},
			{
				sql: "DELETE FROM session_players WHERE session_id = ?",
				args: [sessionId],
			},
			{
				sql: "DELETE FROM sessions WHERE id = ?",
				args: [sessionId],
			},
		],
		"write",
	);
}

export async function forceForfeitDisconnectedPlayers(
	sessionId: string,
): Promise<number> {
	const session = await loadSession(sessionId);
	if (!session?.currentRound) return 0;
	if (session.currentRound.phase !== "playing") return 0;

	const elapsed = nowMs() - session.currentRound.startedAt;
	if (elapsed < ROUND_FORFEIT_TIMEOUT_SECONDS * 1000) return 0;

	const connected = await loadConnectedStatus(sessionId);
	let forfeited = 0;
	const dbVersion = await getDbVersion(sessionId);
	const freshSession = await loadSession(sessionId, dbVersion);
	if (
		!freshSession?.currentRound ||
		freshSession.currentRound.phase !== "playing"
	)
		return 0;

	for (const player of freshSession.currentRound.players) {
		if (player.hasDrawn || player.hasStood) continue;
		if (!connected[player.playerId]) {
			player.hasStood = true;
			forfeited++;
		}
	}

	const dealer = freshSession.currentRound.dealerHand!;
	if (
		!dealer.hasDrawn &&
		!dealer.hasStood &&
		!connected[freshSession.dealerId] &&
		elapsed >= ROUND_FORFEIT_TIMEOUT_SECONDS * 1000
	) {
		dealer.hasStood = true;
		forfeited++;
	}

	const allActed = freshSession.currentRound.players.every(
		(p) => p.hasDrawn || p.hasStood,
	);

	if (forfeited > 0) {
		bump(freshSession);
		if (allActed && (dealer.hasDrawn || dealer.hasStood)) {
			await resolveRoundInline(freshSession, dbVersion);
		} else {
			await saveSession(freshSession, dbVersion);
		}
	}

	return forfeited;
}

async function transferHostIfNeeded(sessionId: string): Promise<void> {
	const session = await loadSession(sessionId);
	if (!session) return;

	const connected = await loadConnectedStatus(sessionId);
	if (connected[session.hostId]) return;

	const connectedPlayers = session.players.filter(
		(p) => p.id !== session.hostId && connected[p.id],
	);
	if (connectedPlayers.length === 0) return;

	const newHost = connectedPlayers[0]!;
	const dbVersion = await getDbVersion(sessionId);
	const freshSession = await loadSession(sessionId, dbVersion);
	if (!freshSession) return;
	if (freshSession.hostId !== session.hostId) return;

	const freshConnected = await loadConnectedStatus(sessionId);
	if (freshConnected[freshSession.hostId]) return;

	freshSession.hostId = newHost.id;
	bump(freshSession);
	await saveSession(freshSession, dbVersion);
}

export async function db_heartbeat(
	sessionId: string,
	playerId: string,
): Promise<void> {
	await initializeDb();
	const db = await ensureDb();
	await db.execute({
		sql: `UPDATE session_players
		      SET last_heartbeat = ?, connected = 1
		      WHERE session_id = ? AND player_id = ?`,
		args: [Math.floor(nowMs() / 1000), sessionId, playerId],
	});
}

export async function setPlayerPromptPayId(
	sessionId: string,
	playerId: string,
	promptPayId: string,
): Promise<void> {
	await initializeDb();
	const db = await ensureDb();
	await db.execute({
		sql: `UPDATE session_players
		      SET promptpay_id = ?
		      WHERE session_id = ? AND player_id = ?`,
		args: [promptPayId || null, sessionId, playerId],
	});
}

export type SettlementStatus = "pending" | "confirmed" | "disputed";

export async function upsertSettlement(
	sessionId: string,
	payerId: string,
	recipientId: string,
	amount: number,
	status: SettlementStatus,
): Promise<void> {
	await initializeDb();
	const db = await ensureDb();
	await db.execute({
		sql: `INSERT INTO settlements (session_id, payer_id, recipient_id, amount, status, updated_at)
		      VALUES (?, ?, ?, ?, ?, unixepoch())
		      ON CONFLICT(session_id, payer_id, recipient_id) DO UPDATE SET
		        status = excluded.status,
		        updated_at = excluded.updated_at`,
		args: [sessionId, payerId, recipientId, amount, status],
	});
}

export async function loadSettlements(sessionId: string): Promise<
	Array<{
		payerId: string;
		recipientId: string;
		amount: number;
		status: SettlementStatus;
	}>
> {
	await initializeDb();
	const db = await ensureDb();
	const rs = await db.execute({
		sql: "SELECT payer_id, recipient_id, amount, status FROM settlements WHERE session_id = ?",
		args: [sessionId],
	});
	return rs.rows.map((row) => ({
		payerId: row.payer_id as string,
		recipientId: row.recipient_id as string,
		amount: row.amount as number,
		status: row.status as SettlementStatus,
	}));
}

export async function removePlayer(
	sessionId: string,
	playerId: string,
): Promise<void> {
	await initializeDb();
	const dbVersion = await getDbVersion(sessionId);
	const session = await loadSession(sessionId, dbVersion);
	if (!session) return;

	const player = session.players.find((p) => p.id === playerId);
	if (!player) return;

	if (session.phase === "lobby") {
		session.players = session.players.filter((p) => p.id !== playerId);
	} else {
		player.leftAt = Date.now();
	}

	if (session.currentRound) {
		const inRound = session.currentRound.players.find(
			(p) => p.playerId === playerId,
		);
		if (
			inRound &&
			inRound.bet === 0 &&
			session.currentRound.phase === "betting"
		) {
			session.currentRound.players = session.currentRound.players.filter(
				(p) => p.playerId !== playerId,
			);
		} else if (inRound && session.currentRound.phase === "playing") {
			inRound.hasStood = true;
		}
	}

	const allLeft = session.players.every((p) => !!p.leftAt);
	if (allLeft) {
		session.allDisconnectedAt = session.allDisconnectedAt ?? Date.now();
	}

	bump(session);
	await saveSession(session, dbVersion);

	const db = await ensureDb();
	if (session.phase === "lobby") {
		await db.execute({
			sql: "DELETE FROM session_players WHERE session_id = ? AND player_id = ?",
			args: [sessionId, playerId],
		});
	} else {
		await db.execute({
			sql: "UPDATE session_players SET connected = 0 WHERE session_id = ? AND player_id = ?",
			args: [sessionId, playerId],
		});
	}
}

export async function sendEmoji(
	sessionId: string,
	playerId: string,
	emoji: string,
): Promise<void> {
	await initializeDb();
	const db = await ensureDb();
	const now = Date.now();
	await db.execute({
		sql: `INSERT INTO emojis (session_id, player_id, emoji, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(session_id, player_id) DO UPDATE SET emoji = excluded.emoji, updated_at = excluded.updated_at`,
		args: [sessionId, playerId, emoji, now],
	});
	await db.execute({
		sql: "UPDATE sessions SET updated_at = ? WHERE id = ?",
		args: [now, sessionId],
	});
}

export async function saveSessionHistory(
	session: GameSession,
	balances: Record<string, { name: string; balance: number }>,
	authUserIds: Record<string, string>,
): Promise<void> {
	await initializeDb();
	const db = await ensureDb();
	const now = Math.floor(Date.now() / 1000);
	const summary = JSON.stringify(session.roundHistory);
	const balancesJson = JSON.stringify(balances);

	for (const player of session.players) {
		const authId = authUserIds[player.id] ?? "";
		await db.execute({
			sql: `INSERT INTO session_history (id, player_id, auth_user_id, player_name, summary, balances, created_at)
			      VALUES (?, ?, ?, ?, ?, ?, ?)`,
			args: [
				`${session.id}_${player.id}`,
				player.id,
				authId,
				player.name,
				summary,
				balancesJson,
				now,
			],
		});
	}
}

async function loadAuthUserIds(
	sessionId: string,
): Promise<Record<string, string>> {
	await initializeDb();
	const db = await ensureDb();
	const rs = await db.execute({
		sql: "SELECT player_id, auth_user_id FROM session_players WHERE session_id = ? AND auth_user_id != ''",
		args: [sessionId],
	});
	const map: Record<string, string> = {};
	for (const row of rs.rows) {
		if (row.player_id && row.auth_user_id) {
			map[row.player_id as string] = row.auth_user_id as string;
		}
	}
	return map;
}

export async function getPlayerHistory(authUserId: string): Promise<
	Array<{
		id: string;
		playerName: string;
		summary: import("./types").RoundSummary[];
		balances: Record<string, { name: string; balance: number }>;
		createdAt: number;
	}>
> {
	await initializeDb();
	const db = await ensureDb();
	const rs = await db.execute({
		sql: "SELECT id, player_name, summary, balances, created_at FROM session_history WHERE auth_user_id = ? ORDER BY created_at DESC LIMIT 20",
		args: [authUserId],
	});
	return rs.rows.map((row) => ({
		id: row.id as string,
		playerName: row.player_name as string,
		summary: JSON.parse(
			row.summary as string,
		) as import("./types").RoundSummary[],
		balances: JSON.parse(row.balances as string) as Record<
			string,
			{ name: string; balance: number }
		>,
		createdAt: row.created_at as number,
	}));
}

export async function castKickVote(
	sessionId: string,
	voterId: string,
	targetId: string,
): Promise<{ kicked: boolean }> {
	const dbVersion = await getDbVersion(sessionId);
	const session = await loadSession(sessionId, dbVersion);
	if (!session) throw new Error("Session not found");

	const voter = session.players.find((p) => p.id === voterId && !p.leftAt);
	if (!voter) throw new Error("Voter not in session");

	const target = session.players.find((p) => p.id === targetId);
	if (!target) throw new Error("Target not in session");
	if (targetId === voterId) throw new Error("Cannot vote to kick yourself");

	if (!session.kickVotes) session.kickVotes = {};
	if (!session.kickVotes[targetId]) session.kickVotes[targetId] = [];

	const voters = session.kickVotes[targetId]!;
	if (voters.includes(voterId)) throw new Error("Already voted");

	voters.push(voterId);

	const activePlayers = session.players.filter((p) => !p.leftAt);
	const majority = Math.ceil(activePlayers.length / 2);
	let kicked = false;

	if (voters.length >= majority) {
		target.leftAt = Date.now();

		if (session.currentRound) {
			const inRound = session.currentRound.players.find(
				(p) => p.playerId === targetId,
			);
			if (
				inRound &&
				inRound.bet === 0 &&
				session.currentRound.phase === "betting"
			) {
				session.currentRound.players = session.currentRound.players.filter(
					(p) => p.playerId !== targetId,
				);
			} else if (inRound && session.currentRound.phase === "playing") {
				inRound.hasStood = true;
			}

			if (
				targetId === session.dealerId &&
				session.currentRound.phase === "playing" &&
				session.currentRound.dealerHand
			) {
				session.currentRound.dealerHand.hasStood = true;
			}
		}

		delete session.kickVotes[targetId];

		const allLeft = session.players.every((p) => !!p.leftAt);
		if (allLeft) {
			session.allDisconnectedAt = session.allDisconnectedAt ?? Date.now();
		}
		kicked = true;
	}

	bump(session);
	await saveSession(session, dbVersion);

	if (kicked) {
		await initializeDb();
		const db = await ensureDb();
		await db.execute({
			sql: "UPDATE session_players SET connected = 0 WHERE session_id = ? AND player_id = ?",
			args: [sessionId, targetId],
		});
	}

	return { kicked };
}

export async function checkAutoClose(sessionId: string): Promise<boolean> {
	const session = await loadSession(sessionId);
	if (!session || session.phase === "ended") return false;

	const connected = await loadConnectedStatus(sessionId);
	const anyConnected = session.players.some(
		(p) => !p.leftAt && connected[p.id],
	);

	if (anyConnected) {
		if (session.allDisconnectedAt) {
			const dbVersion = await getDbVersion(sessionId);
			const fresh = await loadSession(sessionId, dbVersion);
			if (fresh) {
				delete fresh.allDisconnectedAt;
				bump(fresh);
				await saveSession(fresh, dbVersion);
			}
		}
		return false;
	}

	const allLeftOrDisconnected = session.players.every(
		(p) => !!p.leftAt || !connected[p.id],
	);
	if (!allLeftOrDisconnected) return false;

	const now = Date.now();
	const dbVersion = await getDbVersion(sessionId);
	const fresh = await loadSession(sessionId, dbVersion);
	if (!fresh) return false;

	if (!fresh.allDisconnectedAt) {
		fresh.allDisconnectedAt = now;
		bump(fresh);
		await saveSession(fresh, dbVersion);
		return false;
	}

	if (now - fresh.allDisconnectedAt >= 60_000) {
		if (fresh.roundHistory.length > 0 && fresh.phase !== "ended") {
			const balances = computeBalances(fresh);
			fresh.phase = "ended";
			bump(fresh);
			await saveSession(fresh, dbVersion);
			const authUserIds = await loadAuthUserIds(sessionId);
			await saveSessionHistory(fresh, balances, authUserIds);
		} else {
			await removeSession(sessionId);
		}
		return true;
	}

	return false;
}

export async function removeAfkBettingPlayers(
	sessionId: string,
): Promise<void> {
	const session = await loadSession(sessionId);
	if (!session?.currentRound) return;
	if (session.currentRound.phase !== "betting") return;

	const elapsed = Date.now() - session.currentRound.startedAt;
	if (elapsed < ROUND_FORFEIT_TIMEOUT_SECONDS * 1000) return;

	const connected = await loadConnectedStatus(sessionId);
	let changed = false;

	for (const player of session.currentRound.players) {
		if (player.bet > 0) continue;
		const sessionPlayer = session.players.find((p) => p.id === player.playerId);
		if (sessionPlayer?.leftAt) continue;
		if (!connected[player.playerId]) {
			sessionPlayer!.leftAt = Date.now();
			changed = true;
		}
	}

	if (changed) {
		session.currentRound.players = session.currentRound.players.filter((p) => {
			const sp = session.players.find((s) => s.id === p.playerId);
			return !sp?.leftAt || p.bet > 0;
		});

		const allLeft = session.players.every((p) => !!p.leftAt);
		if (allLeft) {
			session.allDisconnectedAt = session.allDisconnectedAt ?? Date.now();
		}

		const dbVersion = await getDbVersion(sessionId);
		bump(session);
		await saveSession(session, dbVersion);
	}
}

function computeBalances(
	session: GameSession,
): Record<string, { name: string; balance: number }> {
	const balances: Record<string, { name: string; balance: number }> = {};
	for (const p of session.players) {
		balances[p.id] = { name: p.name, balance: 0 };
	}
	for (const round of session.roundHistory) {
		for (const result of round.results) {
			if (balances[result.playerId]) {
				balances[result.playerId].balance += result.netAmount;
			}
			if (balances[round.dealerId]) {
				balances[round.dealerId].balance -= result.netAmount;
			}
		}
	}
	return balances;
}

export async function loadEmojis(
	sessionId: string,
): Promise<Record<string, { emoji: string; timestamp: number }>> {
	const db = await ensureDb();
	const rs = await db.execute({
		sql: "SELECT player_id, emoji, updated_at FROM emojis WHERE session_id = ?",
		args: [sessionId],
	});
	const map: Record<string, { emoji: string; timestamp: number }> = {};
	for (const row of rs.rows) {
		const pid = row.player_id as string;
		const emoji = row.emoji as string;
		const timestamp = row.updated_at as number;
		if (Date.now() - timestamp < 15_000) {
			map[pid] = { emoji, timestamp };
		}
	}
	return map;
}
