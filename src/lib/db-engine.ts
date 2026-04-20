/**
 * db-engine.ts
 *
 * Drop-in replacement for the session management parts of game-engine.ts.
 * All pure game logic (evaluateHand, compareHands, …) still lives in
 * game-engine.ts.  This module provides the same public API but persists
 * every session to Turso / libSQL instead of an in-process Map.
 *
 * Architecture:
 *  - sessions table  : full GameSession serialised as JSON + expiry metadata
 *  - session_decks   : remaining card deck JSON per session
 *  - session_players : per-player heartbeat, connection status, PromptPay ID
 */

import { compareHands, evaluateHand } from "./game-engine";
import { SESSION_EXPIRY_SECONDS, getDb, initializeDb } from "./db";
import type {
	Card,
	ClientGameView,
	GameConfig,
	GameSession,
	PlayerInRound,
	RoundSummary,
} from "./types";

// ── Internal helpers ─────────────────────────────────────────────────────────

function generateId(): string {
	const arr = new Uint8Array(8);
	crypto.getRandomValues(arr);
	return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

function expiresAt(): number {
	return nowSeconds() + SESSION_EXPIRY_SECONDS;
}

async function loadSession(sessionId: string): Promise<GameSession | null> {
	await initializeDb();
	const db = getDb();
	const rs = await db.execute({
		sql: "SELECT data FROM sessions WHERE id = ?",
		args: [sessionId],
	});
	if (rs.rows.length === 0) return null;
	return JSON.parse(rs.rows[0]!.data as string) as GameSession;
}

async function saveSession(session: GameSession): Promise<void> {
	const db = getDb();
	const now = nowSeconds();
	await db.execute({
		sql: `INSERT INTO sessions (id, data, expires_at, updated_at)
		      VALUES (?, ?, ?, ?)
		      ON CONFLICT(id) DO UPDATE SET
		        data       = excluded.data,
		        expires_at = excluded.expires_at,
		        updated_at = excluded.updated_at`,
		args: [session.id, JSON.stringify(session), expiresAt(), now],
	});
}

async function loadDeck(sessionId: string): Promise<Card[]> {
	const db = getDb();
	const rs = await db.execute({
		sql: "SELECT deck FROM session_decks WHERE session_id = ?",
		args: [sessionId],
	});
	if (rs.rows.length === 0) return [];
	return JSON.parse(rs.rows[0]!.deck as string) as Card[];
}

async function saveDeck(sessionId: string, deck: Card[]): Promise<void> {
	const db = getDb();
	await db.execute({
		sql: `INSERT INTO session_decks (session_id, deck)
		      VALUES (?, ?)
		      ON CONFLICT(session_id) DO UPDATE SET deck = excluded.deck`,
		args: [sessionId, JSON.stringify(deck)],
	});
}

async function deleteDeck(sessionId: string): Promise<void> {
	const db = getDb();
	await db.execute({
		sql: "DELETE FROM session_decks WHERE session_id = ?",
		args: [sessionId],
	});
}

/** Upsert a row in session_players (name + connected=1, keep existing promptpay) */
async function upsertSessionPlayer(
	sessionId: string,
	playerId: string,
	name: string,
): Promise<void> {
	const db = getDb();
	await db.execute({
		sql: `INSERT INTO session_players (session_id, player_id, name, last_heartbeat, connected)
		      VALUES (?, ?, ?, ?, 1)
		      ON CONFLICT(session_id, player_id) DO UPDATE SET
		        name           = excluded.name,
		        last_heartbeat = excluded.last_heartbeat,
		        connected      = 1`,
		args: [sessionId, playerId, name, nowSeconds()],
	});
}

/** Load PromptPay IDs for all players in a session */
async function loadPromptPayIds(
	sessionId: string,
): Promise<Record<string, string>> {
	const db = getDb();
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

/** Load connected status for all players in a session */
async function loadConnectedStatus(
	sessionId: string,
): Promise<Record<string, boolean>> {
	const db = getDb();
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
	session.updatedAt = Date.now();
}

// ── Deck helpers (pure) ──────────────────────────────────────────────────────

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

function createDeck(): Card[] {
	const deck: Card[] = [];
	for (const suit of SUITS) {
		for (const rank of RANKS) {
			deck.push({ suit, rank });
		}
	}
	return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
	const shuffled = [...deck];
	const randomValues = new Uint32Array(shuffled.length);
	crypto.getRandomValues(randomValues);
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = randomValues[i]! % (i + 1);
		[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
	}
	return shuffled;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function createSession(
	hostName: string,
	config?: Partial<GameConfig>,
): Promise<GameSession> {
	await initializeDb();
	const hostId = generateId();
	const sessionId = generateId();
	const now = Date.now();
	const session: GameSession = {
		id: sessionId,
		hostId,
		players: [{ id: hostId, name: hostName, isDealer: true }],
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
	await upsertSessionPlayer(sessionId, hostId, hostName);
	return session;
}

export async function joinSession(
	sessionId: string,
	playerName: string,
	promptPayId?: string,
): Promise<{ session: GameSession; playerId: string }> {
	const session = await loadSession(sessionId);
	if (!session) throw new Error("Session not found");
	if (session.phase !== "lobby") throw new Error("Game already in progress");
	if (session.players.length >= 17)
		throw new Error("Session full (max 17 players)");

	const playerId = generateId();
	session.players.push({ id: playerId, name: playerName, isDealer: false });
	bump(session);
	await saveSession(session);
	await upsertSessionPlayer(sessionId, playerId, playerName);

	// Store PromptPay ID if provided at join time
	if (promptPayId?.trim()) {
		await setPlayerPromptPayId(sessionId, playerId, promptPayId.trim());
	}

	return { session, playerId };
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
	const db = getDb();
	const now = nowSeconds();
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
	const session = await loadSession(sessionId);
	if (!session) throw new Error("Session not found");
	if (session.hostId !== playerId) throw new Error("Only host can start");
	if (session.players.length < 2) throw new Error("Need at least 2 players");

	const roundNumber = session.roundHistory.length + 1;
	const players: PlayerInRound[] = session.players
		.filter((p) => !p.isDealer)
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
	};
	session.phase = "betting";
	bump(session);
	await saveSession(session);
}

export async function placeBet(
	sessionId: string,
	playerId: string,
	amount: number,
): Promise<void> {
	const session = await loadSession(sessionId);
	if (!session?.currentRound) throw new Error("No active round");
	if (session.currentRound.phase !== "betting")
		throw new Error("Not in betting phase");

	const player = session.currentRound.players.find(
		(p) => p.playerId === playerId,
	);
	if (!player) throw new Error("Player not in round");
	if (amount <= 0 || amount > 1000) throw new Error("Invalid bet amount");

	player.bet = amount;
	bump(session);
	await saveSession(session);
}

export async function dealCards(
	sessionId: string,
	playerId: string,
): Promise<void> {
	const session = await loadSession(sessionId);
	if (!session?.currentRound) throw new Error("No active round");
	if (session.hostId !== playerId) throw new Error("Only host can deal");

	const allBet = session.currentRound.players.every((p) => p.bet > 0);
	if (!allBet) throw new Error("Not all players have placed bets");

	const deck = shuffleDeck(createDeck());
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

	// Check for automatic pok resolution before saving
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

	if (shouldResolve) {
		// Run resolve inline without re-loading
		await saveSession(session);
		await saveDeck(sessionId, deck.slice(cardIndex));
		await resolveRoundInline(session);
		return;
	}

	await saveDeck(sessionId, deck.slice(cardIndex));
	await saveSession(session);
}

export async function drawCard(
	sessionId: string,
	playerId: string,
): Promise<Card> {
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

	// Check if all players + dealer have acted
	const allActed = session.currentRound.players.every(
		(p) => p.hasDrawn || p.hasStood,
	);
	const dealer = session.currentRound.dealerHand!;
	if (allActed && (dealer.hasDrawn || dealer.hasStood)) {
		await saveDeck(sessionId, deck);
		await resolveRoundInline(session);
		return card;
	}

	await saveDeck(sessionId, deck);
	await saveSession(session);
	return card;
}

export async function stand(
	sessionId: string,
	playerId: string,
): Promise<void> {
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
		await resolveRoundInline(session);
		return;
	}

	await saveSession(session);
}

export async function dealerDraw(
	sessionId: string,
	playerId: string,
): Promise<Card> {
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
	await saveSession(session);
	return card;
}

/** Resolve the round inline (no extra DB load) */
async function resolveRoundInline(session: GameSession): Promise<void> {
	if (!session.currentRound) return;

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
		dealerTaem: dealerResult.score,
		dealerHandType: dealerResult.handType,
		dealerDeng: dealerResult.deng,
		results: roundResults,
	});

	session.currentRound.phase = "reveal";
	session.phase = "reveal";
	bump(session);
	await saveSession(session);
}

export async function resolveRound(sessionId: string): Promise<void> {
	const session = await loadSession(sessionId);
	if (!session) throw new Error("Session not found");
	await resolveRoundInline(session);
}

export async function endSession(
	sessionId: string,
): Promise<Record<string, { name: string; balance: number }>> {
	const session = await loadSession(sessionId);
	if (!session) throw new Error("Session not found");

	const balances: Record<string, { name: string; balance: number }> = {};
	for (const p of session.players) {
		balances[p.id] = { name: p.name, balance: 0 };
	}

	for (const round of session.roundHistory) {
		for (const result of round.results) {
			if (balances[result.playerId]) {
				balances[result.playerId].balance += result.netAmount;
			}
			if (balances[session.dealerId]) {
				balances[session.dealerId].balance -= result.netAmount;
			}
		}
	}

	session.phase = "ended";
	bump(session);
	await saveSession(session);
	return balances;
}

export async function getClientView(
	sessionId: string,
	playerId: string,
): Promise<ClientGameView> {
	const session = await loadSession(sessionId);
	if (!session) throw new Error("Session not found");

	// Touch heartbeat + mark reconnected
	await db_heartbeat(sessionId, playerId);

	const round = session.currentRound;
	const isReveal = round?.phase === "reveal";

	const promptPayIds = await loadPromptPayIds(sessionId);
	const connectedStatus = await loadConnectedStatus(sessionId);

	const players = session.players.map((p) => {
		const roundPlayer = round?.players.find((rp) => rp.playerId === p.id);
		const isDealer = p.id === session.dealerId;
		const dealerData = isDealer ? round?.dealerHand : undefined;
		const data = isDealer ? dealerData : roundPlayer;
		const isMe = p.id === playerId;
		const showCards = isReveal || isMe;

		return {
			id: p.id,
			name: p.name,
			isDealer,
			cardCount: data?.cards.length ?? 0,
			hasDrawn: data?.hasDrawn ?? false,
			hasStood: data?.hasStood ?? false,
			cards: showCards ? data?.cards : undefined,
			result: isReveal ? data?.result : undefined,
			netAmount: isReveal ? data?.netAmount : undefined,
			bet: data?.bet ?? 0,
			promptPayId: promptPayIds[p.id],
			connected: connectedStatus[p.id] ?? false,
		};
	});

	const myRoundData = round?.players.find((rp) => rp.playerId === playerId);
	const amDealer = playerId === session.dealerId;
	const myDealerData = amDealer ? round?.dealerHand : undefined;
	const myData = amDealer ? myDealerData : myRoundData;

	const cumulativeBalances: Record<string, number> = {};
	for (const p of session.players) cumulativeBalances[p.id] = 0;
	for (const r of session.roundHistory) {
		for (const result of r.results) {
			if (cumulativeBalances[result.playerId] !== undefined) {
				cumulativeBalances[result.playerId] += result.netAmount;
			}
			if (cumulativeBalances[session.dealerId] !== undefined) {
				cumulativeBalances[session.dealerId] -= result.netAmount;
			}
		}
	}

	return {
		sessionId,
		phase: session.phase,
		version: session.version,
		players,
		myCards: myData?.cards ?? [],
		myResult: isReveal ? myData?.result : undefined,
		roundNumber: round?.roundNumber ?? 0,
		roundHistory: session.roundHistory,
		cumulativeBalances,
		playerPromptPayIds: promptPayIds,
	};
}

export async function removeSession(sessionId: string): Promise<void> {
	const db = getDb();
	await db.execute({
		sql: "DELETE FROM sessions WHERE id = ?",
		args: [sessionId],
	});
}

// ── Heartbeat & PromptPay ────────────────────────────────────────────────────

/** Update last_heartbeat and re-mark connected for a player */
export async function db_heartbeat(
	sessionId: string,
	playerId: string,
): Promise<void> {
	await initializeDb();
	const db = getDb();
	await db.execute({
		sql: `UPDATE session_players
		      SET last_heartbeat = ?, connected = 1
		      WHERE session_id = ? AND player_id = ?`,
		args: [nowSeconds(), sessionId, playerId],
	});
}

/** Persist a player's PromptPay ID for this session */
export async function setPlayerPromptPayId(
	sessionId: string,
	playerId: string,
	promptPayId: string,
): Promise<void> {
	await initializeDb();
	const db = getDb();
	await db.execute({
		sql: `UPDATE session_players
		      SET promptpay_id = ?
		      WHERE session_id = ? AND player_id = ?`,
		args: [promptPayId || null, sessionId, playerId],
	});
}
