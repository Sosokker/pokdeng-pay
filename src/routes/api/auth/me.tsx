import { createFileRoute } from "@tanstack/react-router";
import { getAuthUser, readSessionCookie } from "#/lib/auth-session";

export const Route = createFileRoute("/api/auth/me")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const sessionId = readSessionCookie(request);
				if (!sessionId) {
					return new Response(JSON.stringify({ user: null }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				const user = await getAuthUser(sessionId);
				if (!user) {
					return new Response(JSON.stringify({ user: null }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}

				return new Response(JSON.stringify({ user }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
