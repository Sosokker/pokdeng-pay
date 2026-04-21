import { type Client, createClient } from "@libsql/client";

let dbClient: Client | null = null;

async function getEnvValue(key: string): Promise<string | undefined> {
	try {
		// @ts-expect-error
		const cfWorkers = await import("cloudflare:workers");
		const env = (cfWorkers as any).env;
		if (env && typeof env === "object" && key in env) {
			const val = env[key];
			if (typeof val === "object" && val !== null && "value" in val) {
				return (val as { value: string }).value;
			}
			return typeof val === "string" ? val : undefined;
		}
	} catch {}
	if (typeof process !== "undefined" && process.env) {
		return process.env[key];
	}
	return undefined;
}

export async function ensureDb(): Promise<Client> {
	if (dbClient) return dbClient;

	const url = await getEnvValue("TURSO_DATABASE_URL");
	const authToken = await getEnvValue("TURSO_AUTH_TOKEN");

	if (!url) {
		throw new Error(
			"TURSO_DATABASE_URL is not set. " +
				"For local dev: add it to .dev.vars. " +
				"For production: run `wrangler secret put TURSO_DATABASE_URL`.",
		);
	}

	dbClient = createClient({ url, authToken });
	return dbClient;
}

export async function ensureDbWithForeignKeys(): Promise<Client> {
	const db = await ensureDb();
	await db.execute("PRAGMA foreign_keys = ON");
	return db;
}

export function getDb(): Client {
	if (!dbClient) {
		throw new Error("Database not initialized. Call ensureDb() first.");
	}
	return dbClient;
}

const SCHEMA_STATEMENTS = [
	`CREATE TABLE IF NOT EXISTS sessions (
		id           TEXT    PRIMARY KEY,
		data         TEXT    NOT NULL,
		expires_at   INTEGER NOT NULL,
		updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
	)`,
	`CREATE TABLE IF NOT EXISTS session_decks (
		session_id TEXT PRIMARY KEY,
		deck       TEXT NOT NULL DEFAULT '[]',
		FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS session_players (
		session_id    TEXT    NOT NULL,
		player_id     TEXT    NOT NULL,
		name          TEXT    NOT NULL,
		auth_user_id  TEXT    NOT NULL DEFAULT '',
		promptpay_id  TEXT,
		last_heartbeat INTEGER NOT NULL DEFAULT (unixepoch()),
		connected     INTEGER NOT NULL DEFAULT 1,
		PRIMARY KEY (session_id, player_id),
		FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
	)`,
	`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
	`CREATE INDEX IF NOT EXISTS idx_sp_heartbeat ON session_players(last_heartbeat)`,
	`CREATE TABLE IF NOT EXISTS settlements (
		session_id   TEXT    NOT NULL,
		payer_id     TEXT    NOT NULL,
		recipient_id TEXT    NOT NULL,
		amount       INTEGER NOT NULL,
		status       TEXT    NOT NULL DEFAULT 'pending',
		updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
		PRIMARY KEY (session_id, payer_id, recipient_id),
		FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS emojis (
		session_id TEXT NOT NULL,
		player_id TEXT NOT NULL,
		emoji TEXT NOT NULL,
		updated_at INTEGER NOT NULL,
		PRIMARY KEY (session_id, player_id),
		FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS session_history (
		id           TEXT PRIMARY KEY,
		player_id    TEXT    NOT NULL,
		auth_user_id TEXT    NOT NULL DEFAULT '',
		player_name  TEXT    NOT NULL,
		summary      TEXT    NOT NULL,
		balances     TEXT    NOT NULL,
		created_at   INTEGER NOT NULL DEFAULT (unixepoch())
	)`,
	`CREATE INDEX IF NOT EXISTS idx_history_player ON session_history(player_id)`,
	`CREATE INDEX IF NOT EXISTS idx_history_auth ON session_history(auth_user_id)`,
];

let schemaInitialised = false;

export async function initializeDb(): Promise<void> {
	if (schemaInitialised) return;
	console.log("[db-debug] initializeDb: starting...");
	const db = await ensureDb();
	console.log("[db-debug] initializeDb: got client, running batch...");
	try {
		await db.batch(SCHEMA_STATEMENTS, "write");
		schemaInitialised = true;
		console.log("[db-debug] initializeDb: schema created successfully");
	} catch (e: any) {
		console.error("[db-debug] initializeDb FAILED:", e?.message, e?.stack);
		throw e;
	}
}

export const SESSION_EXPIRY_SECONDS = 30 * 60;
export const HEARTBEAT_TIMEOUT_SECONDS = 30;
export const ROUND_FORFEIT_TIMEOUT_SECONDS = 60;

export async function cleanupExpiredSessions(): Promise<number> {
	const db = await ensureDb();
	const now = Math.floor(Date.now() / 1000);

	const expired = await db.execute({
		sql: "SELECT id FROM sessions WHERE expires_at < ?",
		args: [now],
	});
	if (expired.rows.length === 0) return 0;

	const batchStmts = [];
	for (const row of expired.rows) {
		const sid = row.id as string;
		batchStmts.push(
			{ sql: "DELETE FROM session_decks WHERE session_id = ?", args: [sid] },
			{ sql: "DELETE FROM settlements WHERE session_id = ?", args: [sid] },
			{ sql: "DELETE FROM session_players WHERE session_id = ?", args: [sid] },
			{ sql: "DELETE FROM sessions WHERE id = ?", args: [sid] },
		);
	}
	if (batchStmts.length > 0) {
		await db.batch(batchStmts, "write");
	}
	return expired.rows.length;
}

export async function markDisconnectedPlayers(
	sessionId?: string,
): Promise<number> {
	const db = await ensureDb();
	const threshold = Math.floor(Date.now() / 1000) - HEARTBEAT_TIMEOUT_SECONDS;
	if (sessionId) {
		const result = await db.execute({
			sql: `UPDATE session_players SET connected = 0 WHERE session_id = ? AND last_heartbeat < ? AND connected = 1`,
			args: [sessionId, threshold],
		});
		return result.rowsAffected;
	}
	const result = await db.execute({
		sql: `UPDATE session_players SET connected = 0 WHERE last_heartbeat < ? AND connected = 1`,
		args: [threshold],
	});
	return result.rowsAffected;
}
// append to SCHEMA_STATEMENTS
