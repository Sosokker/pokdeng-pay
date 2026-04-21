import * as arctic from "arctic";

let cachedClient: arctic.Google | null = null;

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

export async function getGoogleOAuthClient(
	redirectUri: string,
): Promise<arctic.Google> {
	if (cachedClient) return cachedClient;

	const clientId = await getEnvValue("GOOGLE_CLIENT_ID");
	const clientSecret = await getEnvValue("GOOGLE_CLIENT_SECRET");

	if (!clientId || !clientSecret) {
		throw new Error(
			"GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set. " +
				"For local dev: add them to .dev.vars. " +
				"For production: run `wrangler secret put GOOGLE_CLIENT_ID` and `wrangler secret put GOOGLE_CLIENT_SECRET`.",
		);
	}

	cachedClient = new arctic.Google(clientId, clientSecret, redirectUri);
	return cachedClient;
}

export { arctic };
