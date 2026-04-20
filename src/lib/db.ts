import { createClient, type Client } from "@libsql/client";

let dbClient: Client | null = null;

export function getDb(): Client {
	if (!dbClient) {
		const url = process.env.TURSO_DATABASE_URL;
		const authToken = process.env.TURSO_AUTH_TOKEN;

		if (!url) {
			console.warn(
				"TURSO_DATABASE_URL not set — using in-memory SQLite (dev mode)",
			);
			dbClient = createClient({ url: ":memory:" });
		} else {
			dbClient = createClient({ url, authToken });
		}
	}
	return dbClient;
}

// ── Schema ────────────────────────────────────────────────────────────────────
// Using JSON blobs for game state keeps all existing game-engine logic intact
// while adding the persistence layer.  Separate session_players tracks heartbeats.

const SCHEMA_STATEMENTS = [
	// Full session state stored as JSON for easy round-tripping with game-engine
	`CREATE TABLE IF NOT EXISTS sessions (
		id           TEXT    PRIMARY KEY,
		data         TEXT    NOT NULL,
		expires_at   INTEGER NOT NULL,
		updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
	)`,

	// Remaining deck per session (serialised JSON array)
	`CREATE TABLE IF NOT EXISTS session_decks (
		session_id TEXT PRIMARY KEY,
		deck       TEXT NOT NULL DEFAULT '[]',
		FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
	)`,

	// Per-player presence, PromptPay info, and heartbeat tracking
	`CREATE TABLE IF NOT EXISTS session_players (
		session_id    TEXT    NOT NULL,
		player_id     TEXT    NOT NULL,
		name          TEXT    NOT NULL,
		promptpay_id  TEXT,
		last_heartbeat INTEGER NOT NULL DEFAULT (unixepoch()),
		connected     INTEGER NOT NULL DEFAULT 1,
		PRIMARY KEY (session_id, player_id),
		FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
	)`,

	`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
		ON sessions(expires_at)`,
	`CREATE INDEX IF NOT EXISTS idx_sp_heartbeat
		ON session_players(last_heartbeat)`,
];

let schemaInitialised = false;

export async function initializeDb(): Promise<void> {
	if (schemaInitialised) return;
	const db = getDb();
	await db.batch(SCHEMA_STATEMENTS, "write");
	schemaInitialised = true;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Session TTL — 2 hours of inactivity */
export const SESSION_EXPIRY_SECONDS = 2 * 60 * 60;

/** Mark a player disconnected after 30 s without a heartbeat */
export const HEARTBEAT_TIMEOUT_SECONDS = 30;

// ── Cleanup helpers ───────────────────────────────────────────────────────────

export async function cleanupExpiredSessions(): Promise<number> {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);
	const result = await db.execute({
		sql: "DELETE FROM sessions WHERE expires_at < ?",
		args: [now],
	});
	return result.rowsAffected;
}

export async function markDisconnectedPlayers(): Promise<number> {
	const db = getDb();
	const threshold = Math.floor(Date.now() / 1000) - HEARTBEAT_TIMEOUT_SECONDS;
	const result = await db.execute({
		sql: `UPDATE session_players SET connected = 0
		      WHERE last_heartbeat < ? AND connected = 1`,
		args: [threshold],
	});
	return result.rowsAffected;
}
