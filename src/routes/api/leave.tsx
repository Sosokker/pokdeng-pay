import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { leaveSession } from "#/lib/db-engine";

export const Route = createFileRoute("/api/leave")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const body = (await request.json()) as {
						data?: { sessionId?: string; playerId?: string };
					};
					const sessionId = body?.data?.sessionId;
					const playerId = body?.data?.playerId;
					if (sessionId && playerId) {
						await leaveSession(sessionId, playerId);
					}
				} catch {}
				return json({ ok: true });
			},
		},
	},
});
