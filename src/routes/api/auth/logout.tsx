import { createFileRoute } from "@tanstack/react-router";
import {
	clearSessionCookieHeader,
	deleteAuthSession,
	readSessionCookie,
} from "#/lib/auth-session";

export const Route = createFileRoute("/api/auth/logout")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const sessionId = readSessionCookie(request);
				if (sessionId) {
					await deleteAuthSession(sessionId);
				}

				return new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: {
						"Content-Type": "application/json",
						"Set-Cookie": clearSessionCookieHeader(),
					},
				});
			},
		},
	},
});
