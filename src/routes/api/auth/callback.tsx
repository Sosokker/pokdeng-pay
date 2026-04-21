import { createFileRoute } from "@tanstack/react-router";
import {
	createAuthSession,
	sessionCookieHeader,
	upsertUser,
} from "#/lib/auth-session";
import { arctic, getGoogleOAuthClient } from "#/lib/oauth";

const STATE_COOKIE = "pokdeng-oauth-state";
const VERIFIER_COOKIE = "pokdeng-oauth-verifier";

function readCookie(request: Request, name: string): string | null {
	const header = request.headers.get("cookie") ?? "";
	for (const part of header.split(";")) {
		const trimmed = part.trim();
		if (trimmed.startsWith(`${name}=`)) {
			return trimmed.slice(name.length + 1);
		}
	}
	return null;
}

export const Route = createFileRoute("/api/auth/callback")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url);
				const code = url.searchParams.get("code");
				const state = url.searchParams.get("state");

				const storedState = readCookie(request, STATE_COOKIE);
				const storedVerifier = readCookie(request, VERIFIER_COOKIE);

				if (
					!code ||
					!state ||
					!storedState ||
					state !== storedState ||
					!storedVerifier
				) {
					return new Response("Invalid OAuth callback", { status: 400 });
				}

				try {
					const origin = url.origin;
					const redirectUri = `${origin}/api/auth/callback`;
					const google = await getGoogleOAuthClient(redirectUri);

					const tokens = await google.validateAuthorizationCode(
						code,
						storedVerifier,
					);
					const idToken = tokens.idToken();
					if (!idToken) {
						return new Response("No ID token", { status: 400 });
					}

					const claims = arctic.decodeIdToken(idToken) as {
						sub: string;
						name: string;
					};

					const userId = await upsertUser({
						oauthProvider: "google",
						oauthId: claims.sub,
						name: claims.name || "Player",
					});

					const sessionId = await createAuthSession(userId);

					const clearOAuthCookies = [
						`${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
						`${VERIFIER_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
					].join(", ");

					return new Response(null, {
						status: 302,
						headers: {
							Location: "/",
							"Set-Cookie": `${sessionCookieHeader(sessionId)}, ${clearOAuthCookies}`,
						},
					});
				} catch (e) {
					console.error("OAuth callback error:", e);
					return new Response("OAuth authentication failed", { status: 500 });
				}
			},
		},
	},
});
