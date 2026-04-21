import { ensureDb, initializeDb } from "./db";

export const SESSION_COOKIE_NAME = "pokdeng-session";
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;

function generateId(): string {
	const arr = new Uint8Array(16);
	crypto.getRandomValues(arr);
	return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createAuthSession(userId: string): Promise<string> {
	await initializeDb();
	const db = await ensureDb();
	const sessionId = generateId();
	const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
	await db.execute({
		sql: "INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
		args: [sessionId, userId, expiresAt],
	});
	return sessionId;
}

export async function verifyAuthSession(
	sessionId: string,
): Promise<{ userId: string } | null> {
	await initializeDb();
	const db = await ensureDb();
	const now = Math.floor(Date.now() / 1000);
	const rs = await db.execute({
		sql: "SELECT user_id, expires_at FROM auth_sessions WHERE id = ?",
		args: [sessionId],
	});
	if (rs.rows.length === 0) return null;
	const row = rs.rows[0]!;
	if ((row.expires_at as number) < now) {
		await db.execute({
			sql: "DELETE FROM auth_sessions WHERE id = ?",
			args: [sessionId],
		});
		return null;
	}
	return { userId: row.user_id as string };
}

export async function deleteAuthSession(sessionId: string): Promise<void> {
	await initializeDb();
	const db = await ensureDb();
	await db.execute({
		sql: "DELETE FROM auth_sessions WHERE id = ?",
		args: [sessionId],
	});
}

export async function getAuthUser(sessionId: string): Promise<{
	id: string;
	name: string;
	oauthProvider: string;
	promptPayId: string | null;
} | null> {
	const session = await verifyAuthSession(sessionId);
	if (!session) return null;

	const db = await ensureDb();
	const rs = await db.execute({
		sql: "SELECT id, name, oauth_provider, promptpay_id FROM users WHERE id = ?",
		args: [session.userId],
	});
	if (rs.rows.length === 0) return null;
	const row = rs.rows[0]!;
	return {
		id: row.id as string,
		name: row.name as string,
		oauthProvider: row.oauth_provider as string,
		promptPayId: (row.promptpay_id as string) || null,
	};
}

export async function upsertUser(opts: {
	oauthProvider: string;
	oauthId: string;
	name: string;
}): Promise<string> {
	await initializeDb();
	const db = await ensureDb();

	const existing = await db.execute({
		sql: "SELECT id FROM users WHERE oauth_provider = ? AND oauth_id = ?",
		args: [opts.oauthProvider, opts.oauthId],
	});

	if (existing.rows.length > 0) {
		const userId = existing.rows[0]!.id as string;
		await db.execute({
			sql: "UPDATE users SET name = ? WHERE id = ?",
			args: [opts.name, userId],
		});
		return userId;
	}

	const userId = generateId();
	const now = Math.floor(Date.now() / 1000);
	await db.execute({
		sql: "INSERT INTO users (id, oauth_provider, oauth_id, name, created_at) VALUES (?, ?, ?, ?, ?)",
		args: [userId, opts.oauthProvider, opts.oauthId, opts.name, now],
	});
	return userId;
}

export function readSessionCookie(request: Request): string | null {
	const cookieHeader = request.headers.get("cookie") ?? "";
	const cookies = cookieHeader.split(";").map((c) => c.trim());
	for (const cookie of cookies) {
		if (cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) {
			return cookie.slice(SESSION_COOKIE_NAME.length + 1);
		}
	}
	return null;
}

export function sessionCookieHeader(
	sessionId: string,
	maxAge: number = SESSION_DURATION_SECONDS,
): string {
	return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookieHeader(): string {
	return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
