import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { cleanupExpiredSessions, markDisconnectedPlayers } from "#/lib/db";
import { forceForfeitDisconnectedPlayers } from "#/lib/db-engine";

export const Route = createFileRoute("/api/cron/cleanup")({
	server: {
		handlers: {
			POST: async () => {
				await markDisconnectedPlayers();

				const db = await import("#/lib/db").then((m) => m.ensureDb());
				const { rows } = await db.execute({
					sql: "SELECT id FROM sessions WHERE expires_at > ?",
					args: [Math.floor(Date.now() / 1000)],
				});

				let forfeited = 0;
				for (const row of rows) {
					const sid = row.id as string;
					if (sid) {
						forfeited += await forceForfeitDisconnectedPlayers(sid);
					}
				}

				const removed = await cleanupExpiredSessions();
				return json({
					ok: true,
					expiredRemoved: removed,
					playersForfeited: forfeited,
					checkedSessions: rows.length,
				});
			},
		},
	},
});
