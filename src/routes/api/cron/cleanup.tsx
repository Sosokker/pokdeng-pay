import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { cleanupExpiredSessions, markDisconnectedPlayers } from "#/lib/db";
import { forceForfeitDisconnectedPlayers } from "#/lib/db-engine";

async function getCronSecret(): Promise<string> {
	try {
		// @ts-expect-error
		const cfWorkers = await import("cloudflare:workers");
		const env = (cfWorkers as any).env;
		if (env?.CRON_SECRET?.value) return env.CRON_SECRET.value;
		if (typeof env?.CRON_SECRET === "string") return env.CRON_SECRET;
	} catch {}
	if (typeof process !== "undefined" && process.env.CRON_SECRET) {
		return process.env.CRON_SECRET;
	}
	return "";
}

export const Route = createFileRoute("/api/cron/cleanup")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const authHeader = request.headers.get("Authorization") ?? "";
				const token = authHeader.startsWith("Bearer ")
					? authHeader.slice(7)
					: "";
				const secret = await getCronSecret();
				if (secret && token !== secret) {
					return json({ ok: false, error: "Unauthorized" }, { status: 401 });
				}

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
