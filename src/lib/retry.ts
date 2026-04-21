const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

export class ConflictError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConflictError";
	}
}

export function isConflictError(e: unknown): boolean {
	if (e instanceof ConflictError) return true;
	if (e instanceof Error && e.message.includes("CONFLICT")) return true;
	return false;
}

export async function withRetry<T>(
	fn: () => Promise<T>,
	maxRetries: number = MAX_RETRIES,
): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (e) {
			lastError = e;
			if (!isConflictError(e)) throw e;
			if (attempt < maxRetries) {
				const delay = BASE_DELAY_MS * 2 ** attempt + Math.random() * 100;
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}
	throw lastError;
}
