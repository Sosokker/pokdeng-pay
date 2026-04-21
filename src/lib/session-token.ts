const TOKEN_SEPARATOR = ".";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

let cachedKey: string | null = null;
let warnedInsecure = false;

async function getSigningKey(): Promise<string> {
	if (cachedKey) return cachedKey;
	try {
		// @ts-expect-error
		const cfWorkers = await import("cloudflare:workers");
		const env = (cfWorkers as any).env;
		if (env?.SESSION_SECRET?.value) {
			cachedKey = env.SESSION_SECRET.value;
			return cachedKey as string;
		}
		if (typeof env?.SESSION_SECRET === "string") {
			cachedKey = env.SESSION_SECRET;
			return cachedKey as string;
		}
	} catch {}
	if (typeof process !== "undefined" && process.env.SESSION_SECRET) {
		cachedKey = process.env.SESSION_SECRET;
		return cachedKey as string;
	}
	if (!warnedInsecure) {
		warnedInsecure = true;
		console.error(
			"WARNING: SESSION_SECRET is not set. Using insecure default. " +
				"Set SESSION_SECRET env var for production.",
		);
	}
	cachedKey = "dev-only-secret-change-in-production";
	return cachedKey;
}

async function hmacSign(payload: string, key: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(payload);
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		encoder.encode(key),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export interface PlayerToken {
	sessionId: string;
	playerId: string;
	issuedAt: number;
}

export async function createPlayerToken(
	sessionId: string,
	playerId: string,
): Promise<string> {
	const key = await getSigningKey();
	const issuedAt = Date.now();
	const payload = `${sessionId}${TOKEN_SEPARATOR}${playerId}${TOKEN_SEPARATOR}${issuedAt}`;
	const sig = await hmacSign(payload, key);
	return btoa(`${payload}${TOKEN_SEPARATOR}${sig}`);
}

export async function verifyPlayerToken(
	token: string,
): Promise<PlayerToken | null> {
	try {
		const decoded = atob(token);
		const parts = decoded.split(TOKEN_SEPARATOR);
		if (parts.length !== 4) return null;

		const [sessionId, playerId, issuedAtStr, sig] = parts;
		const issuedAt = Number(issuedAtStr);

		if (Date.now() - issuedAt > TOKEN_TTL_MS) return null;

		const key = await getSigningKey();
		const payload = `${sessionId}${TOKEN_SEPARATOR}${playerId}${TOKEN_SEPARATOR}${issuedAt}`;
		const expectedSig = await hmacSign(payload, key);

		if (!timingSafeEqual(sig!, expectedSig)) return null;

		return { sessionId, playerId: playerId!, issuedAt };
	} catch {
		return null;
	}
}
