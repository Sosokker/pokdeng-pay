import { createServerFn } from "@tanstack/react-start";
import * as engine from "./db-engine";
import { generatePromptPayPayload } from "./promptpay";
import { cleanupExpiredSessions } from "./db";

// ── Session management ────────────────────────────────────────────────────────

export const listSessionsFn = createServerFn().handler(async () => {
	return engine.listSessions();
});

export const createSessionFn = createServerFn()
	.inputValidator(
		(data: {
			hostName: string;
			promptPayId?: string;
			config?: { allowAceHighStraight?: boolean };
		}) => data,
	)
	.handler(async ({ data }) => {
		const session = await engine.createSession(data.hostName, data.config);
		const hostId = session.hostId;
		// Store PromptPay ID for the host if provided
		if (data.promptPayId?.trim()) {
			await engine.setPlayerPromptPayId(
				session.id,
				hostId,
				data.promptPayId.trim(),
			);
		}
		return { sessionId: session.id, playerId: hostId };
	});

export const joinSessionFn = createServerFn()
	.inputValidator(
		(data: { sessionId: string; playerName: string; promptPayId?: string }) =>
			data,
	)
	.handler(async ({ data }) => {
		const { session, playerId } = await engine.joinSession(
			data.sessionId,
			data.playerName,
			data.promptPayId,
		);
		return { sessionId: session.id, playerId };
	});

export const getGameViewFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerId: string }) => data)
	.handler(async ({ data }) => {
		return engine.getClientView(data.sessionId, data.playerId);
	});

// ── Game actions ──────────────────────────────────────────────────────────────

export const startBettingFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerId: string }) => data)
	.handler(async ({ data }) => {
		await engine.startBetting(data.sessionId, data.playerId);
		return { success: true };
	});

export const placeBetFn = createServerFn()
	.inputValidator(
		(data: { sessionId: string; playerId: string; amount: number }) => data,
	)
	.handler(async ({ data }) => {
		await engine.placeBet(data.sessionId, data.playerId, data.amount);
		return { success: true };
	});

export const dealCardsFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerId: string }) => data)
	.handler(async ({ data }) => {
		await engine.dealCards(data.sessionId, data.playerId);
		return { success: true };
	});

export const drawCardFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerId: string }) => data)
	.handler(async ({ data }) => {
		const card = await engine.drawCard(data.sessionId, data.playerId);
		return { card };
	});

export const standFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerId: string }) => data)
	.handler(async ({ data }) => {
		await engine.stand(data.sessionId, data.playerId);
		return { success: true };
	});

export const dealerDrawFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerId: string }) => data)
	.handler(async ({ data }) => {
		const card = await engine.dealerDraw(data.sessionId, data.playerId);
		return { card };
	});

export const resolveRoundFn = createServerFn()
	.inputValidator((data: { sessionId: string }) => data)
	.handler(async ({ data }) => {
		await engine.resolveRound(data.sessionId);
		return { success: true };
	});

export const endSessionFn = createServerFn()
	.inputValidator((data: { sessionId: string }) => data)
	.handler(async ({ data }) => {
		const balances = await engine.endSession(data.sessionId);
		return balances;
	});

// ── PromptPay ─────────────────────────────────────────────────────────────────

export const generateQrPayloadFn = createServerFn()
	.inputValidator((data: { targetId: string; amount: number }) => data)
	.handler(async ({ data }) => {
		const payload = generatePromptPayPayload(data.targetId, data.amount);
		return { payload };
	});

/** Save the calling player's PromptPay ID for this session */
export const setPromptPayIdFn = createServerFn()
	.inputValidator(
		(data: { sessionId: string; playerId: string; promptPayId: string }) =>
			data,
	)
	.handler(async ({ data }) => {
		await engine.setPlayerPromptPayId(
			data.sessionId,
			data.playerId,
			data.promptPayId,
		);
		return { success: true };
	});

// ── Heartbeat / reconnect ─────────────────────────────────────────────────────

/** Called by the client every ~10 s to signal it is still alive */
export const heartbeatFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerId: string }) => data)
	.handler(async ({ data }) => {
		await engine.db_heartbeat(data.sessionId, data.playerId);
		return { ok: true };
	});

// ── Maintenance ───────────────────────────────────────────────────────────────

/** Trigger session cleanup — call this from a periodic task or on app startup */
export const cleanupSessionsFn = createServerFn().handler(async () => {
	const removed = await cleanupExpiredSessions();
	return { removed };
});
