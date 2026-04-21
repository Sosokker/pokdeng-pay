import { createFileRoute } from "@tanstack/react-router";
import { verifyPlayerToken } from "#/lib/session-token";
import { ensureDb, initializeDb } from "#/lib/db";

const SSE_MAX_DURATION_MS = 300_000;
const SSE_POLL_INTERVAL_MS = 2000;

export const Route = createFileRoute("/api/events/$sessionId")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const sessionId = params.sessionId;
				const url = new URL(request.url);
				const playerId = url.searchParams.get("playerId") ?? "";
				const token = url.searchParams.get("token") ?? "";

				if (!sessionId || !playerId) {
					return new Response("Missing sessionId or playerId", { status: 400 });
				}

				if (token) {
					const parsed = await verifyPlayerToken(token);
					if (
						!parsed ||
						parsed.sessionId !== sessionId ||
						parsed.playerId !== playerId
					) {
						return new Response("Unauthorized", { status: 401 });
					}
				}

				let lastVersion = 0;
				let interval: ReturnType<typeof setInterval> | undefined;
				let timeout: ReturnType<typeof setTimeout> | undefined;

				const stream = new ReadableStream({
					async start(controller) {
						const encoder = new TextEncoder();

						const send = (event: string, data: string) => {
							try {
								controller.enqueue(
									encoder.encode(`event: ${event}\ndata: ${data}\n\n`),
								);
							} catch {
								if (interval) clearInterval(interval);
								if (timeout) clearTimeout(timeout);
							}
						};

						const close = () => {
							if (interval) clearInterval(interval);
							if (timeout) clearTimeout(timeout);
							try {
								controller.close();
							} catch {}
						};

						send("connected", JSON.stringify({ sessionId }));

						interval = setInterval(async () => {
							try {
								await initializeDb();
								const db = await ensureDb();
								const rs = await db.execute({
									sql: "SELECT updated_at FROM sessions WHERE id = ?",
									args: [sessionId],
								});
								if (rs.rows.length === 0) {
									send("session-ended", "{}");
									close();
									return;
								}
								const version = rs.rows[0]!.updated_at as number;
								if (version !== lastVersion) {
									lastVersion = version;
									send("version", JSON.stringify({ version, sessionId }));
								}
							} catch {
								// Ignore DB errors, keep trying
							}
						}, SSE_POLL_INTERVAL_MS);

						timeout = setTimeout(() => {
							send("reconnect", JSON.stringify({ reason: "timeout" }));
							close();
						}, SSE_MAX_DURATION_MS);

						request.signal.addEventListener("abort", () => {
							close();
						});
					},
				});

				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
						"Access-Control-Allow-Origin": "*",
					},
				});
			},
		},
	},
});
