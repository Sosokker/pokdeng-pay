import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { leaveSession } from "#/lib/db-engine";
import { verifyPlayerToken } from "#/lib/session-token";

export const Route = createFileRoute("/api/leave")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const body = (await request.json()) as {
						data?: {
							sessionId?: string;
							playerId?: string;
							token?: string;
						};
					};
					const sessionId = body?.data?.sessionId;
					const playerId = body?.data?.playerId;
					const token = body?.data?.token;
					if (!sessionId || !playerId) {
						return json(
							{ ok: false, error: "Missing sessionId or playerId" },
							{ status: 400 },
						);
					}
					if (token) {
						const parsed = await verifyPlayerToken(token);
						if (
							!parsed ||
							parsed.sessionId !== sessionId ||
							parsed.playerId !== playerId
						) {
							return json(
								{ ok: false, error: "Unauthorized" },
								{ status: 401 },
							);
						}
					} else {
						const { verifyPlayerInSession } = await import("#/lib/db-engine");
						const ok = await verifyPlayerInSession(sessionId, playerId);
						if (!ok) {
							return json(
								{ ok: false, error: "Player not in session" },
								{ status: 403 },
							);
						}
					}
					await leaveSession(sessionId, playerId);
				} catch (e) {
					const msg = e instanceof Error ? e.message : "Unknown error";
					return json({ ok: false, error: msg }, { status: 500 });
				}
				return json({ ok: true });
			},
		},
	},
});
