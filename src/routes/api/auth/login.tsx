import { createFileRoute } from "@tanstack/react-router";
import { arctic, getGoogleOAuthClient } from "#/lib/oauth";

const STATE_COOKIE = "pokdeng-oauth-state";
const VERIFIER_COOKIE = "pokdeng-oauth-verifier";

export const Route = createFileRoute("/api/auth/login")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url);
				const origin = url.origin;
				const redirectUri = `${origin}/api/auth/callback`;

				const google = await getGoogleOAuthClient(redirectUri);
				const state = arctic.generateState();
				const codeVerifier = arctic.generateCodeVerifier();
				const authUrl = google.createAuthorizationURL(state, codeVerifier, [
					"openid",
					"profile",
				]);

				const stateCookie = `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;
				const verifierCookie = `${VERIFIER_COOKIE}=${codeVerifier}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;

				return new Response(null, {
					status: 302,
					headers: {
						Location: authUrl.toString(),
						"Set-Cookie": `${stateCookie}, ${verifierCookie}`,
					},
				});
			},
		},
	},
});
