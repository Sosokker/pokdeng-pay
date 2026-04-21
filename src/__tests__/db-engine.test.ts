import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
	const stores = {
		sessions: new Map<
			string,
			{ data: string; expires_at: number; updated_at: number }
		>(),
		decks: new Map<string, string>(),
		players: new Map<
			string,
			{
				session_id: string;
				player_id: string;
				name: string;
				auth_user_id: string;
				promptpay_id: string | null;
				last_heartbeat: number;
				connected: number;
			}
		>(),
		emojis: new Map<
			string,
			{
				session_id: string;
				player_id: string;
				emoji: string;
				updated_at: number;
			}
		>(),
		settlements: new Map<
			string,
			{
				session_id: string;
				payer_id: string;
				recipient_id: string;
				amount: number;
				status: string;
				updated_at: number;
			}
		>(),
		history: new Map<
			string,
			{
				id: string;
				player_id: string;
				auth_user_id: string;
				player_name: string;
				summary: string;
				balances: string;
				created_at: number;
			}
		>(),
	};

	function pk(sid: string, pid: string) {
		return `${sid}:${pid}`;
	}

	function norm(sql: string) {
		return sql.trim().replace(/\s+/g, " ");
	}

	function execute({ sql, args }: { sql: string; args?: any[] }): {
		rows: any[];
		rowsAffected: number;
	} {
		const a = args ?? [];
		const s = norm(sql);

		if (s.startsWith("SELECT data, updated_at FROM sessions WHERE id = ?")) {
			const row = stores.sessions.get(a[0]);
			if (!row) return { rows: [], rowsAffected: 0 };
			return {
				rows: [{ data: row.data, updated_at: row.updated_at }],
				rowsAffected: 0,
			};
		}

		if (s.startsWith("SELECT updated_at FROM sessions WHERE id = ?")) {
			const row = stores.sessions.get(a[0]);
			if (!row) return { rows: [], rowsAffected: 0 };
			return {
				rows: [{ updated_at: row.updated_at }],
				rowsAffected: 0,
			};
		}

		if (s.includes("UPDATE sessions") && s.includes("AND updated_at = ?")) {
			const [data, expires_at, updated_at, id, expectedVersion] = a;
			const row = stores.sessions.get(id);
			if (!row || row.updated_at !== expectedVersion)
				return { rows: [], rowsAffected: 0 };
			stores.sessions.set(id, { data, expires_at, updated_at });
			return { rows: [], rowsAffected: 1 };
		}

		if (s.startsWith("INSERT INTO sessions") && s.includes("ON CONFLICT")) {
			const [id, data, expires_at, updated_at] = a;
			stores.sessions.set(id, { data, expires_at, updated_at });
			return { rows: [], rowsAffected: 1 };
		}

		if (s.startsWith("UPDATE sessions SET updated_at = ? WHERE id = ?")) {
			const row = stores.sessions.get(a[1]);
			if (row) row.updated_at = a[0];
			return { rows: [], rowsAffected: row ? 1 : 0 };
		}

		if (s.startsWith("SELECT data FROM sessions WHERE expires_at > ?")) {
			const rows: any[] = [];
			for (const row of stores.sessions.values()) {
				if (row.expires_at > a[0]) rows.push({ data: row.data });
			}
			return { rows, rowsAffected: 0 };
		}

		if (s.startsWith("DELETE FROM sessions WHERE id = ?")) {
			const deleted = stores.sessions.delete(a[0]);
			return { rows: [], rowsAffected: deleted ? 1 : 0 };
		}

		if (s.startsWith("SELECT deck FROM session_decks WHERE session_id = ?")) {
			const deck = stores.decks.get(a[0]);
			if (!deck) return { rows: [], rowsAffected: 0 };
			return { rows: [{ deck }], rowsAffected: 0 };
		}

		if (
			s.startsWith("INSERT INTO session_decks") &&
			s.includes("ON CONFLICT")
		) {
			stores.decks.set(a[0], a[1]);
			return { rows: [], rowsAffected: 1 };
		}

		if (s.startsWith("DELETE FROM session_decks")) {
			stores.decks.delete(a[0]);
			return { rows: [], rowsAffected: 1 };
		}

		if (
			s.includes("INSERT INTO session_players") &&
			s.includes("ON CONFLICT")
		) {
			const [session_id, player_id, name, auth_user_id, last_heartbeat] = a;
			const key = pk(session_id, player_id);
			const existing = stores.players.get(key);
			stores.players.set(key, {
				session_id,
				player_id,
				name,
				auth_user_id: auth_user_id ?? "",
				promptpay_id: existing?.promptpay_id ?? null,
				last_heartbeat,
				connected: 1,
			});
			return { rows: [], rowsAffected: 1 };
		}

		if (s.includes("SELECT player_id, promptpay_id FROM session_players")) {
			const rows: any[] = [];
			for (const p of stores.players.values()) {
				if (
					p.session_id === a[0] &&
					p.promptpay_id !== null &&
					p.promptpay_id !== undefined
				) {
					rows.push({
						player_id: p.player_id,
						promptpay_id: p.promptpay_id,
					});
				}
			}
			return { rows, rowsAffected: 0 };
		}

		if (s.includes("SELECT player_id, connected FROM session_players")) {
			const rows: any[] = [];
			for (const p of stores.players.values()) {
				if (p.session_id === a[0]) {
					rows.push({
						player_id: p.player_id,
						connected: p.connected,
					});
				}
			}
			return { rows, rowsAffected: 0 };
		}

		if (
			s.includes("SET connected = 0, last_heartbeat = 0") &&
			s.includes("session_players")
		) {
			const key = pk(a[0], a[1]);
			const p = stores.players.get(key);
			if (p) {
				p.connected = 0;
				p.last_heartbeat = 0;
				return { rows: [], rowsAffected: 1 };
			}
			return { rows: [], rowsAffected: 0 };
		}

		if (
			s.includes("SET last_heartbeat = ?, connected = 1") &&
			s.includes("session_players")
		) {
			const [heartbeat, sessionId, playerId] = a;
			const key = pk(sessionId, playerId);
			const p = stores.players.get(key);
			if (p) {
				p.last_heartbeat = heartbeat;
				p.connected = 1;
				return { rows: [], rowsAffected: 1 };
			}
			return { rows: [], rowsAffected: 0 };
		}

		if (s.includes("SET promptpay_id = ?") && s.includes("session_players")) {
			const [promptpay_id, sessionId, playerId] = a;
			const key = pk(sessionId, playerId);
			const p = stores.players.get(key);
			if (p) {
				p.promptpay_id = promptpay_id || null;
				return { rows: [], rowsAffected: 1 };
			}
			return { rows: [], rowsAffected: 0 };
		}

		if (s.startsWith("SELECT 1 FROM session_players")) {
			const key = pk(a[0], a[1]);
			return {
				rows: stores.players.has(key) ? [{ "1": 1 }] : [],
				rowsAffected: 0,
			};
		}

		if (s.includes("SELECT player_id, auth_user_id FROM session_players")) {
			const rows: any[] = [];
			for (const p of stores.players.values()) {
				if (p.session_id === a[0] && p.auth_user_id && p.auth_user_id !== "") {
					rows.push({
						player_id: p.player_id,
						auth_user_id: p.auth_user_id,
					});
				}
			}
			return { rows, rowsAffected: 0 };
		}

		if (
			s.startsWith(
				"DELETE FROM session_players WHERE session_id = ? AND player_id = ?",
			)
		) {
			const key = pk(a[0], a[1]);
			const deleted = stores.players.delete(key);
			return { rows: [], rowsAffected: deleted ? 1 : 0 };
		}

		if (
			s.includes(
				"SET connected = 0 WHERE session_id = ? AND last_heartbeat < ?",
			)
		) {
			const [sessionId, threshold] = a;
			let affected = 0;
			for (const p of stores.players.values()) {
				if (
					p.session_id === sessionId &&
					p.connected === 1 &&
					p.last_heartbeat < threshold
				) {
					p.connected = 0;
					affected++;
				}
			}
			return { rows: [], rowsAffected: affected };
		}

		if (
			s.includes(
				"UPDATE session_players SET connected = 0 WHERE session_id = ? AND player_id = ?",
			)
		) {
			const key = pk(a[0], a[1]);
			const p = stores.players.get(key);
			if (p) {
				p.connected = 0;
				return { rows: [], rowsAffected: 1 };
			}
			return { rows: [], rowsAffected: 0 };
		}

		if (s.includes("INSERT INTO emojis") && s.includes("ON CONFLICT")) {
			const [session_id, player_id, emoji, updated_at] = a;
			stores.emojis.set(pk(session_id, player_id), {
				session_id,
				player_id,
				emoji,
				updated_at,
			});
			return { rows: [], rowsAffected: 1 };
		}

		if (s.includes("SELECT player_id, emoji, updated_at FROM emojis")) {
			const rows: any[] = [];
			for (const e of stores.emojis.values()) {
				if (e.session_id === a[0]) {
					rows.push({
						player_id: e.player_id,
						emoji: e.emoji,
						updated_at: e.updated_at,
					});
				}
			}
			return { rows, rowsAffected: 0 };
		}

		if (s.includes("INSERT INTO settlements") && s.includes("ON CONFLICT")) {
			const [session_id, payer_id, recipient_id, amount, status] = a;
			const key = `${session_id}:${payer_id}:${recipient_id}`;
			stores.settlements.set(key, {
				session_id,
				payer_id,
				recipient_id,
				amount,
				status,
				updated_at: Math.floor(Date.now() / 1000),
			});
			return { rows: [], rowsAffected: 1 };
		}

		if (
			s.includes(
				"SELECT payer_id, recipient_id, amount, status FROM settlements",
			)
		) {
			const rows: any[] = [];
			for (const st of stores.settlements.values()) {
				if (st.session_id === a[0]) {
					rows.push({
						payer_id: st.payer_id,
						recipient_id: st.recipient_id,
						amount: st.amount,
						status: st.status,
					});
				}
			}
			return { rows, rowsAffected: 0 };
		}

		if (s.startsWith("DELETE FROM settlements")) {
			for (const [key, st] of stores.settlements) {
				if (st.session_id === a[0]) stores.settlements.delete(key);
			}
			return { rows: [], rowsAffected: 1 };
		}

		if (s.includes("INSERT INTO session_history")) {
			stores.history.set(a[0], {
				id: a[0],
				player_id: a[1],
				auth_user_id: a[2],
				player_name: a[3],
				summary: a[4],
				balances: a[5],
				created_at: a[6],
			});
			return { rows: [], rowsAffected: 1 };
		}

		if (s.includes("FROM session_history WHERE auth_user_id = ?")) {
			const rows: any[] = [];
			for (const h of stores.history.values()) {
				if (h.auth_user_id === a[0]) rows.push(h);
			}
			return { rows, rowsAffected: 0 };
		}

		throw new Error(`Unhandled SQL in mock: ${s}`);
	}

	function batch(stmts: any[], _mode: string) {
		let totalAffected = 0;
		for (const stmt of stmts) {
			const result = execute(stmt);
			totalAffected += result.rowsAffected;
		}
		return Promise.resolve({ rows: [], rowsAffected: totalAffected });
	}

	return { stores, execute, batch };
});

const gameEngine = vi.hoisted(() => ({
	evaluateHand: vi.fn(),
	compareHands: vi.fn(),
}));

vi.mock("#/lib/db", () => ({
	initializeDb: vi.fn(),
	ensureDb: vi.fn(() =>
		Promise.resolve({
			execute: mock.execute,
			batch: mock.batch,
		}),
	),
	markDisconnectedPlayers: vi.fn(() => Promise.resolve(0)),
	SESSION_EXPIRY_SECONDS: 1800,
	ROUND_FORFEIT_TIMEOUT_SECONDS: 60,
}));

vi.mock("#/lib/game-engine", () => ({
	evaluateHand: gameEngine.evaluateHand,
	compareHands: gameEngine.compareHands,
}));

import {
	createSession,
	dealCards,
	dealerDraw,
	drawCard,
	getClientView,
	joinSession,
	leaveSession,
	placeBet,
	sanitizeName,
	sendEmoji,
	stand,
	startBetting,
} from "../lib/db-engine";

const defaultEvalResult = {
	score: 5,
	handType: "normal" as const,
	deng: 1,
	cards: [],
};

beforeEach(() => {
	mock.stores.sessions.clear();
	mock.stores.decks.clear();
	mock.stores.players.clear();
	mock.stores.emojis.clear();
	mock.stores.settlements.clear();
	mock.stores.history.clear();
	vi.clearAllMocks();
	gameEngine.evaluateHand.mockReturnValue({ ...defaultEvalResult });
	gameEngine.compareHands.mockReturnValue({
		winner: "player",
		netAmount: 100,
	});
});

async function createSessionWithPlayer() {
	const session = await createSession("Host");
	const joined = await joinSession(session.id, "Alice");
	return { session, hostId: session.hostId, playerId: joined.playerId };
}

async function setupBettingPhase() {
	const { session, hostId, playerId } = await createSessionWithPlayer();
	await startBetting(session.id, hostId);
	return { sessionId: session.id, hostId, playerId };
}

async function setupPlayingPhase() {
	const { sessionId, hostId, playerId } = await setupBettingPhase();
	await placeBet(sessionId, playerId, 100);
	await dealCards(sessionId, hostId);
	return { sessionId, hostId, playerId };
}

describe("sanitizeName", () => {
	it("strips dangerous characters", () => {
		expect(sanitizeName('<script>alert("xss")</script>')).toBe(
			"scriptalert(xss)/scr",
		);
	});

	it("trims whitespace", () => {
		expect(sanitizeName("  hello  ")).toBe("hello");
	});

	it("limits to 20 characters", () => {
		expect(sanitizeName("a".repeat(30))).toBe("a".repeat(20));
	});

	it("strips single and double quotes and ampersand", () => {
		expect(sanitizeName("test'name\"here&stuff")).toBe("testnameherestuff");
	});
});

describe("createSession", () => {
	it("creates a session with the host as dealer", async () => {
		const session = await createSession("Host");

		expect(session.phase).toBe("lobby");
		expect(session.players).toHaveLength(1);
		expect(session.players[0]!.name).toBe("Host");
		expect(session.players[0]!.isDealer).toBe(true);
		expect(session.hostId).toBe(session.players[0]!.id);
		expect(session.dealerId).toBe(session.players[0]!.id);
		expect(session.currentRound).toBeNull();
		expect(session.roundHistory).toHaveLength(0);
		expect(session.version).toBe(1);
	});

	it("sanitizes the host name", async () => {
		const session = await createSession('<script>"Hack"&\'er');
		expect(session.players[0]!.name).toBe("scriptHacker");
	});

	it("stores session and player in the mock DB", async () => {
		const session = await createSession("Host");

		expect(mock.stores.sessions.has(session.id)).toBe(true);
		const stored = JSON.parse(mock.stores.sessions.get(session.id)!.data);
		expect(stored.id).toBe(session.id);

		const playerKeys = [...mock.stores.players.keys()];
		expect(playerKeys).toHaveLength(1);
		expect(playerKeys[0]!.startsWith(session.id)).toBe(true);
	});
});

describe("joinSession", () => {
	it("adds a player to the session", async () => {
		const session = await createSession("Host");
		const result = await joinSession(session.id, "Alice");

		expect(result.playerId).toBeTruthy();
		expect(result.session.players).toHaveLength(2);
		const newPlayer = result.session.players[1]!;
		expect(newPlayer.name).toBe("Alice");
		expect(newPlayer.isDealer).toBe(false);
	});

	it("throws if session not found", async () => {
		await expect(joinSession("nonexistent", "Alice")).rejects.toThrow(
			"Session not found",
		);
	});

	it("throws if game already in progress", async () => {
		const session = await createSession("Host");
		await joinSession(session.id, "Alice");
		await startBetting(session.id, session.hostId);

		await expect(joinSession(session.id, "Bob")).rejects.toThrow(
			"Game already in progress",
		);
	});

	it("throws if name too short after sanitization", async () => {
		const session = await createSession("Host");
		await expect(joinSession(session.id, "<>")).rejects.toThrow(
			"Name too short after sanitization",
		);
	});

	it("handles rejoin with existing player ID", async () => {
		const session = await createSession("Host");
		const { playerId } = await joinSession(session.id, "Alice");

		const result = await joinSession(
			session.id,
			"AliceAgain",
			undefined,
			playerId,
		);
		expect(result.playerId).toBe(playerId);
		expect(result.session.players).toHaveLength(2);
	});

	it("stores promptpay ID when provided", async () => {
		const session = await createSession("Host");
		const { playerId } = await joinSession(session.id, "Alice", "0891234567");

		const key = `${session.id}:${playerId}`;
		expect(mock.stores.players.get(key)!.promptpay_id).toBe("0891234567");
	});
});

describe("startBetting", () => {
	it("creates a round in betting phase", async () => {
		const { session, hostId, playerId } = await createSessionWithPlayer();
		await startBetting(session.id, hostId);

		const stored = JSON.parse(mock.stores.sessions.get(session.id)!.data);
		expect(stored.phase).toBe("betting");
		expect(stored.currentRound).toBeDefined();
		expect(stored.currentRound.phase).toBe("betting");
		expect(stored.currentRound.players).toHaveLength(1);
		expect(stored.currentRound.players[0].playerId).toBe(playerId);
		expect(stored.currentRound.players[0].bet).toBe(0);
		expect(stored.currentRound.dealerHand.playerId).toBe(hostId);
	});

	it("throws if fewer than 2 players", async () => {
		const session = await createSession("Host");
		await expect(startBetting(session.id, session.hostId)).rejects.toThrow(
			"Need at least 2 players",
		);
	});

	it("throws if non-host tries to start first round", async () => {
		const { session, playerId } = await createSessionWithPlayer();
		await expect(startBetting(session.id, playerId)).rejects.toThrow(
			"Only host can start the first round",
		);
	});

	it("throws if current round not completed", async () => {
		const { session, hostId } = await createSessionWithPlayer();
		await startBetting(session.id, hostId);

		await expect(startBetting(session.id, hostId)).rejects.toThrow(
			"Current round must be completed first",
		);
	});

	it("rotates dealer on subsequent rounds", async () => {
		const { sessionId, hostId, playerId } = await setupPlayingPhase();

		await stand(sessionId, playerId);
		await stand(sessionId, hostId);

		const resolved = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		expect(resolved.phase).toBe("reveal");

		await startBetting(sessionId, hostId);
		const after = JSON.parse(mock.stores.sessions.get(sessionId)!.data);

		expect(after.dealerId).toBe(playerId);
		expect(after.currentRound.players).toHaveLength(1);
		expect(after.currentRound.players[0].playerId).toBe(hostId);
	});
});

describe("placeBet", () => {
	it("places a bet for a player", async () => {
		const { sessionId, playerId } = await setupBettingPhase();
		await placeBet(sessionId, playerId, 50);

		const stored = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		expect(stored.currentRound.players[0].bet).toBe(50);
	});

	it("throws if no active round", async () => {
		const session = await createSession("Host");
		await expect(placeBet(session.id, session.hostId, 100)).rejects.toThrow(
			"No active round",
		);
	});

	it("throws if not in betting phase", async () => {
		const { sessionId, playerId } = await setupPlayingPhase();
		await expect(placeBet(sessionId, playerId, 50)).rejects.toThrow(
			"Not in betting phase",
		);
	});

	it("throws if bet already placed", async () => {
		const { sessionId, playerId } = await setupBettingPhase();
		await placeBet(sessionId, playerId, 100);

		await expect(placeBet(sessionId, playerId, 50)).rejects.toThrow(
			"Bet already placed",
		);
	});

	it("throws for invalid bet amounts", async () => {
		const { sessionId, playerId } = await setupBettingPhase();

		await expect(placeBet(sessionId, playerId, 0)).rejects.toThrow(
			"Invalid bet amount",
		);
		await expect(placeBet(sessionId, playerId, -10)).rejects.toThrow(
			"Invalid bet amount",
		);
		await expect(placeBet(sessionId, playerId, 1001)).rejects.toThrow(
			"Invalid bet amount",
		);
		await expect(placeBet(sessionId, playerId, 10.5)).rejects.toThrow(
			"Invalid bet amount",
		);
	});
});

describe("dealCards", () => {
	it("deals cards and sets phase to playing", async () => {
		const { sessionId, hostId, playerId } = await setupBettingPhase();
		await placeBet(sessionId, playerId, 100);
		await dealCards(sessionId, hostId);

		const stored = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		expect(stored.phase).toBe("playing");
		expect(stored.currentRound.phase).toBe("playing");
		expect(stored.currentRound.players[0].cards).toHaveLength(2);
		expect(stored.currentRound.dealerHand.cards).toHaveLength(2);
	});

	it("saves remaining deck", async () => {
		const { sessionId, hostId, playerId } = await setupBettingPhase();
		await placeBet(sessionId, playerId, 100);
		await dealCards(sessionId, hostId);

		expect(mock.stores.decks.has(sessionId)).toBe(true);
		const deck = JSON.parse(mock.stores.decks.get(sessionId)!);
		expect(deck.length).toBeGreaterThan(0);
	});

	it("throws if non-dealer tries to deal", async () => {
		const { sessionId, playerId } = await setupBettingPhase();
		await placeBet(sessionId, playerId, 100);

		await expect(dealCards(sessionId, playerId)).rejects.toThrow(
			"Only dealer can deal",
		);
	});

	it("throws if not all bets placed", async () => {
		const { sessionId, hostId } = await setupBettingPhase();

		await expect(dealCards(sessionId, hostId)).rejects.toThrow(
			"Not all players have placed bets",
		);
	});

	it("auto-resolves when dealer has Pok", async () => {
		const { sessionId, hostId, playerId } = await setupBettingPhase();
		await placeBet(sessionId, playerId, 100);

		gameEngine.evaluateHand.mockReturnValue({
			score: 9,
			handType: "pok",
			deng: 1,
			cards: [],
		});

		await dealCards(sessionId, hostId);

		const stored = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		expect(stored.phase).toBe("reveal");
		expect(stored.currentRound.phase).toBe("reveal");
		expect(stored.roundHistory).toHaveLength(1);
	});

	it("auto-resolves when all players have Pok", async () => {
		const { sessionId, hostId, playerId } = await setupBettingPhase();
		await placeBet(sessionId, playerId, 100);

		gameEngine.evaluateHand
			.mockReturnValueOnce({
				score: 5,
				handType: "normal",
				deng: 1,
				cards: [],
			})
			.mockReturnValueOnce({
				score: 9,
				handType: "pok",
				deng: 2,
				cards: [],
			})
			.mockReturnValueOnce({
				score: 9,
				handType: "pok",
				deng: 2,
				cards: [],
			})
			.mockReturnValue({
				score: 5,
				handType: "normal",
				deng: 1,
				cards: [],
			});

		await dealCards(sessionId, hostId);

		const stored = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		expect(stored.phase).toBe("reveal");
		expect(stored.roundHistory).toHaveLength(1);
	});
});

describe("drawCard", () => {
	it("draws a card for the player", async () => {
		const { sessionId, playerId } = await setupPlayingPhase();

		const card = await drawCard(sessionId, playerId);
		expect(card).toBeDefined();
		expect(card.suit).toBeDefined();
		expect(card.rank).toBeDefined();

		const stored = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		expect(stored.currentRound.players[0].cards).toHaveLength(3);
		expect(stored.currentRound.players[0].hasDrawn).toBe(true);
	});

	it("throws if not in playing phase", async () => {
		const { sessionId, playerId } = await setupBettingPhase();
		await expect(drawCard(sessionId, playerId)).rejects.toThrow(
			"Not in playing phase",
		);
	});

	it("throws if player already acted", async () => {
		const { sessionId, playerId } = await setupPlayingPhase();
		await drawCard(sessionId, playerId);

		await expect(drawCard(sessionId, playerId)).rejects.toThrow(
			"Already acted",
		);
	});

	it("throws if player not in round", async () => {
		const { sessionId, hostId } = await setupPlayingPhase();
		await expect(drawCard(sessionId, "nonexistent")).rejects.toThrow(
			"Player not in round",
		);
	});

	it("auto-resolves when all players and dealer have acted", async () => {
		const { sessionId, hostId, playerId } = await setupPlayingPhase();

		await drawCard(sessionId, playerId);
		await stand(sessionId, hostId);

		const stored = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		expect(stored.phase).toBe("reveal");
	});
});

describe("stand", () => {
	it("marks player as stood", async () => {
		const { sessionId, playerId } = await setupPlayingPhase();
		await stand(sessionId, playerId);

		const stored = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		expect(stored.currentRound.players[0].hasStood).toBe(true);
	});

	it("allows dealer to stand", async () => {
		const { sessionId, hostId, playerId } = await setupPlayingPhase();
		await stand(sessionId, playerId);
		await stand(sessionId, hostId);

		const stored = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		expect(stored.currentRound.dealerHand.hasStood).toBe(true);
		expect(stored.phase).toBe("reveal");
	});

	it("throws if not in playing phase", async () => {
		const { sessionId, playerId } = await setupBettingPhase();
		await expect(stand(sessionId, playerId)).rejects.toThrow(
			"Not in playing phase",
		);
	});

	it("throws if already stood", async () => {
		const { sessionId, playerId } = await setupPlayingPhase();
		await stand(sessionId, playerId);

		await expect(stand(sessionId, playerId)).rejects.toThrow("Already stood");
	});

	it("auto-resolves when all players and dealer stand", async () => {
		const { sessionId, hostId, playerId } = await setupPlayingPhase();

		await stand(sessionId, playerId);
		await stand(sessionId, hostId);

		const stored = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		expect(stored.phase).toBe("reveal");
		expect(stored.roundHistory).toHaveLength(1);
	});
});

describe("dealerDraw", () => {
	it("draws a card for the dealer after all players acted", async () => {
		const { sessionId, hostId, playerId } = await setupPlayingPhase();
		await stand(sessionId, playerId);

		const card = await dealerDraw(sessionId, hostId);
		expect(card).toBeDefined();

		const stored = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		expect(stored.currentRound.dealerHand.cards).toHaveLength(3);
		expect(stored.currentRound.dealerHand.hasDrawn).toBe(true);
	});

	it("throws if not the dealer", async () => {
		const { sessionId, playerId } = await setupPlayingPhase();
		await stand(sessionId, playerId);

		await expect(dealerDraw(sessionId, playerId)).rejects.toThrow(
			"Not the dealer",
		);
	});

	it("throws if not all players have acted", async () => {
		const { sessionId, hostId } = await setupPlayingPhase();

		await expect(dealerDraw(sessionId, hostId)).rejects.toThrow(
			"Not all players have acted",
		);
	});

	it("throws if dealer already drew", async () => {
		const { sessionId, hostId, playerId } = await setupPlayingPhase();
		await stand(sessionId, playerId);
		await dealerDraw(sessionId, hostId);

		await expect(dealerDraw(sessionId, hostId)).rejects.toThrow("Already drew");
	});

	it("auto-resolves after dealer draws when all players acted", async () => {
		const { sessionId, hostId, playerId } = await setupPlayingPhase();
		await stand(sessionId, playerId);
		await dealerDraw(sessionId, hostId);

		const stored = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		expect(stored.phase).toBe("reveal");
	});
});

describe("leaveSession", () => {
	it("disconnects player in lobby without marking leftAt", async () => {
		const session = await createSession("Host");
		const { playerId } = await joinSession(session.id, "Alice");

		await leaveSession(session.id, playerId);

		const key = `${session.id}:${playerId}`;
		expect(mock.stores.players.get(key)!.connected).toBe(0);
	});

	it("marks player as stood during playing phase", async () => {
		const { sessionId, playerId } = await setupPlayingPhase();

		await leaveSession(sessionId, playerId);

		const stored = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		const player = stored.players.find((p: any) => p.id === playerId);
		expect(player.leftAt).toBeDefined();

		const roundPlayer = stored.currentRound.players.find(
			(p: any) => p.playerId === playerId,
		);
		expect(roundPlayer.hasStood).toBe(true);
	});

	it("removes unbettted player from round during betting phase", async () => {
		const { sessionId, playerId } = await setupBettingPhase();

		await leaveSession(sessionId, playerId);

		const stored = JSON.parse(mock.stores.sessions.get(sessionId)!.data);
		expect(stored.currentRound).toBeNull();
		expect(stored.phase).toBe("reveal");
	});
});

describe("sendEmoji", () => {
	it("stores emoji in the mock DB", async () => {
		const { sessionId, hostId } = await setupPlayingPhase();

		await sendEmoji(sessionId, hostId, "👍");

		const key = `${sessionId}:${hostId}`;
		expect(mock.stores.emojis.get(key)!.emoji).toBe("👍");
	});

	it("updates session timestamp", async () => {
		const { sessionId, hostId } = await setupPlayingPhase();
		const beforeTime = mock.stores.sessions.get(sessionId)!.updated_at;

		await sendEmoji(sessionId, hostId, "🎉");

		const afterTime = mock.stores.sessions.get(sessionId)!.updated_at;
		expect(afterTime).toBeGreaterThanOrEqual(beforeTime);
	});
});

describe("getClientView", () => {
	it("returns correct view in lobby phase", async () => {
		const session = await createSession("Host");
		const { playerId } = await joinSession(session.id, "Alice");

		const view = await getClientView(session.id, playerId);

		expect(view.sessionId).toBe(session.id);
		expect(view.phase).toBe("lobby");
		expect(view.hostId).toBe(session.hostId);
		expect(view.players).toHaveLength(2);
		expect(view.roundNumber).toBe(0);
		expect(view.myCards).toHaveLength(0);
		expect(view.roundHistory).toHaveLength(0);
	});

	it("shows own cards during playing phase", async () => {
		const { sessionId, hostId, playerId } = await setupPlayingPhase();

		const view = await getClientView(sessionId, playerId);

		expect(view.phase).toBe("playing");
		expect(view.myCards).toHaveLength(2);

		const me = view.players.find((p) => p.id === playerId)!;
		expect(me.cards).toHaveLength(2);

		const host = view.players.find((p) => p.id === hostId)!;
		expect(host.cards).toBeUndefined();
	});

	it("shows all cards during reveal phase", async () => {
		const { sessionId, hostId, playerId } = await setupPlayingPhase();
		await stand(sessionId, playerId);
		await stand(sessionId, hostId);

		const view = await getClientView(sessionId, playerId);

		expect(view.phase).toBe("reveal");
		expect(view.roundHistory).toHaveLength(1);

		for (const p of view.players) {
			expect(p.cards).toBeDefined();
			expect(p.result).toBeDefined();
		}
	});

	it("computes cumulative balances from round history", async () => {
		const { sessionId, hostId, playerId } = await setupPlayingPhase();
		await stand(sessionId, playerId);
		await stand(sessionId, hostId);

		const view = await getClientView(sessionId, playerId);

		expect(view.cumulativeBalances).toBeDefined();
		expect(view.cumulativeBalances[playerId]).toBeDefined();
		expect(view.cumulativeBalances[hostId]).toBeDefined();
	});
});
