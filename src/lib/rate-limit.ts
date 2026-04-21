const WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_WINDOW = 15;

interface RateLimitEntry {
	count: number;
	windowStart: number;
}

const store = new Map<string, RateLimitEntry>();
let lastCleanup = 0;

function cleanup(): void {
	const now = Date.now();
	if (now - lastCleanup < WINDOW_MS) return;
	lastCleanup = now;
	for (const [key, entry] of store) {
		if (now - entry.windowStart > WINDOW_MS * 2) {
			store.delete(key);
		}
	}
}

export function checkRateLimit(
	identifier: string,
	maxRequests: number = MAX_REQUESTS_PER_WINDOW,
	windowMs: number = WINDOW_MS,
): { allowed: boolean; remaining: number; resetIn: number } {
	cleanup();

	const now = Date.now();
	let entry = store.get(identifier);

	if (!entry || now - entry.windowStart > windowMs) {
		entry = { count: 0, windowStart: now };
		store.set(identifier, entry);
	}

	entry.count++;
	const allowed = entry.count <= maxRequests;
	const remaining = Math.max(0, maxRequests - entry.count);
	const resetIn = Math.max(0, windowMs - (now - entry.windowStart));

	return { allowed, remaining, resetIn };
}

export function rateLimitKey(
	sessionId: string,
	playerId: string,
	action: string,
): string {
	return `${sessionId}:${playerId}:${action}`;
}

export function resetRateLimitStore(): void {
	store.clear();
	lastCleanup = 0;
}
