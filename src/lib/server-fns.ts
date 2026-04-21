import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cleanupExpiredSessions, markDisconnectedPlayers } from "./db";
import * as engine from "./db-engine";
import { generatePromptPayPayload } from "./promptpay";
import { checkRateLimit, rateLimitKey } from "./rate-limit";
import { withRetry } from "./retry";
import { createPlayerToken, verifyPlayerToken } from "./session-token";
import {
	createSessionSchema,
	generateQrSchema,
	joinSessionSchema,
	placeBetSchema,
	sessionIdPlayerIdSchema,
	setPromptPayIdSchema,
} from "./validators";

function enforceRateLimit(
	sessionId: string,
	playerId: string,
	action: string,
): void {
	const { allowed } = checkRateLimit(rateLimitKey(sessionId, playerId, action));
	if (!allowed) {
		throw new Error("Too many requests. Please wait a moment.");
	}
}

async function verify(
	sessionId: string,
	playerId: string,
	token?: string,
): Promise<void> {
	if (token) {
		const parsed = await verifyPlayerToken(token);
		if (
			!parsed ||
			parsed.sessionId !== sessionId ||
			parsed.playerId !== playerId
		) {
			throw new Error("Invalid or expired player token");
		}
		return;
	}
	const ok = await engine.verifyPlayerInSession(sessionId, playerId);
	if (!ok) throw new Error("Player not in session");
}

const tokenSchema = z.object({ token: z.string().optional() });
const tokenSessionPlayerSchema = sessionIdPlayerIdSchema.merge(tokenSchema);
const tokenBetSchema = placeBetSchema.merge(tokenSchema);
const tokenPromptPaySchema = setPromptPayIdSchema.merge(tokenSchema);

// ── Session management ────────────────────────────────────────────────────────

export const listSessionsFn = createServerFn().handler(async () => {
	return engine.listSessions();
});

export const createSessionFn = createServerFn()
	.inputValidator(createSessionSchema)
	.handler(async ({ data }) => {
		const session = await engine.createSession(
			data.hostName,
			data.config,
			data.authUserId,
		);
		const hostId = session.hostId;
		if (data.promptPayId?.trim()) {
			await engine.setPlayerPromptPayId(
				session.id,
				hostId,
				data.promptPayId.trim(),
			);
		}
		const token = await createPlayerToken(session.id, hostId);
		return { sessionId: session.id, playerId: hostId, token };
	});

export const joinSessionFn = createServerFn()
	.inputValidator(joinSessionSchema)
	.handler(async ({ data }) => {
		const existingPlayerId = data.existingPlayerId as string | undefined;
		const { session, playerId } = await withRetry(() =>
			engine.joinSession(
				data.sessionId,
				data.playerName,
				data.promptPayId,
				existingPlayerId,
				data.authUserId,
			),
		);
		const token = await createPlayerToken(session.id, playerId);
		return { sessionId: session.id, playerId, token };
	});

export const getGameViewFn = createServerFn()
	.inputValidator(tokenSessionPlayerSchema)
	.handler(async ({ data }) => {
		enforceRateLimit(data.sessionId, data.playerId, "view");
		await markDisconnectedPlayers(data.sessionId);
		await verify(data.sessionId, data.playerId, data.token);
		return engine.getClientView(data.sessionId, data.playerId);
	});

// ── Game actions ──────────────────────────────────────────────────────────────

export const startBettingFn = createServerFn()
	.inputValidator(tokenSessionPlayerSchema)
	.handler(async ({ data }) => {
		enforceRateLimit(data.sessionId, data.playerId, "startBetting");
		await verify(data.sessionId, data.playerId, data.token);
		await withRetry(() => engine.startBetting(data.sessionId, data.playerId));
		return { success: true };
	});

export const placeBetFn = createServerFn()
	.inputValidator(tokenBetSchema)
	.handler(async ({ data }) => {
		enforceRateLimit(data.sessionId, data.playerId, "placeBet");
		await verify(data.sessionId, data.playerId, data.token);
		await withRetry(() =>
			engine.placeBet(data.sessionId, data.playerId, data.amount),
		);
		return { success: true };
	});

export const dealCardsFn = createServerFn()
	.inputValidator(tokenSessionPlayerSchema)
	.handler(async ({ data }) => {
		enforceRateLimit(data.sessionId, data.playerId, "dealCards");
		await verify(data.sessionId, data.playerId, data.token);
		await withRetry(() => engine.dealCards(data.sessionId, data.playerId));
		return { success: true };
	});

export const drawCardFn = createServerFn()
	.inputValidator(tokenSessionPlayerSchema)
	.handler(async ({ data }) => {
		enforceRateLimit(data.sessionId, data.playerId, "drawCard");
		await verify(data.sessionId, data.playerId, data.token);
		const card = await withRetry(() =>
			engine.drawCard(data.sessionId, data.playerId),
		);
		return { card };
	});

export const standFn = createServerFn()
	.inputValidator(tokenSessionPlayerSchema)
	.handler(async ({ data }) => {
		enforceRateLimit(data.sessionId, data.playerId, "stand");
		await verify(data.sessionId, data.playerId, data.token);
		await withRetry(() => engine.stand(data.sessionId, data.playerId));
		return { success: true };
	});

export const dealerDrawFn = createServerFn()
	.inputValidator(tokenSessionPlayerSchema)
	.handler(async ({ data }) => {
		enforceRateLimit(data.sessionId, data.playerId, "dealerDraw");
		await verify(data.sessionId, data.playerId, data.token);
		const card = await withRetry(() =>
			engine.dealerDraw(data.sessionId, data.playerId),
		);
		return { card };
	});

export const resolveRoundFn = createServerFn()
	.inputValidator(tokenSessionPlayerSchema)
	.handler(async ({ data }) => {
		await verify(data.sessionId, data.playerId, data.token);
		await withRetry(() => engine.resolveRound(data.sessionId, data.playerId));
		return { success: true };
	});

export const endSessionFn = createServerFn()
	.inputValidator(tokenSessionPlayerSchema)
	.handler(async ({ data }) => {
		await verify(data.sessionId, data.playerId, data.token);
		const balances = await withRetry(() =>
			engine.endSession(data.sessionId, data.playerId),
		);
		return balances;
	});

// ── PromptPay ─────────────────────────────────────────────────────────────────

export const generateQrPayloadFn = createServerFn()
	.inputValidator(generateQrSchema)
	.handler(async ({ data }) => {
		const payload = generatePromptPayPayload(data.targetId, data.amount);
		return { payload };
	});

export const setPromptPayIdFn = createServerFn()
	.inputValidator(tokenPromptPaySchema)
	.handler(async ({ data }) => {
		await verify(data.sessionId, data.playerId, data.token);
		await engine.setPlayerPromptPayId(
			data.sessionId,
			data.playerId,
			data.promptPayId,
		);
		return { success: true };
	});

// ── Heartbeat / reconnect ─────────────────────────────────────────────────────

export const heartbeatFn = createServerFn()
	.inputValidator(tokenSessionPlayerSchema)
	.handler(async ({ data }) => {
		await verify(data.sessionId, data.playerId, data.token);
		await engine.db_heartbeat(data.sessionId, data.playerId);
		return { ok: true };
	});

export const leaveSessionFn = createServerFn()
	.inputValidator(tokenSessionPlayerSchema)
	.handler(async ({ data }) => {
		await verify(data.sessionId, data.playerId, data.token);
		await engine.leaveSession(data.sessionId, data.playerId);
		return { ok: true };
	});

export const updatePromptPayGlobalFn = createServerFn()
	.inputValidator(tokenPromptPaySchema)
	.handler(async ({ data }) => {
		await verify(data.sessionId, data.playerId, data.token);
		await engine.setPlayerPromptPayId(
			data.sessionId,
			data.playerId,
			data.promptPayId,
		);
		return { ok: true };
	});

// ── Maintenance ───────────────────────────────────────────────────────────────

export const cleanupSessionsFn = createServerFn().handler(async () => {
	await markDisconnectedPlayers();
	const removed = await cleanupExpiredSessions();
	return { removed };
});

// ── Settlement ────────────────────────────────────────────────────────────────

const settlementSchema = z.object({
	sessionId: z.string().length(16),
	playerId: z.string().length(16),
	token: z.string().optional(),
	payerId: z.string(),
	recipientId: z.string(),
	amount: z.number().positive(),
	status: z.enum(["confirmed", "disputed", "pending"]),
});

export const updateSettlementFn = createServerFn()
	.inputValidator(settlementSchema)
	.handler(async ({ data }) => {
		await verify(data.sessionId, data.playerId, data.token);
		await engine.upsertSettlement(
			data.sessionId,
			data.payerId,
			data.recipientId,
			data.amount,
			data.status,
		);
		return { ok: true };
	});

export const getSettlementsFn = createServerFn()
	.inputValidator(tokenSessionPlayerSchema)
	.handler(async ({ data }) => {
		await verify(data.sessionId, data.playerId, data.token);
		return engine.loadSettlements(data.sessionId);
	});

export const kickPlayerFn = createServerFn()
	.inputValidator(
		z.object({
			sessionId: z.string(),
			hostId: z.string(),
			token: z.string().optional(),
			targetPlayerId: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		await verify(data.sessionId, data.hostId, data.token);
		const view = await engine.getClientView(data.sessionId, data.hostId);
		if (!view) throw new Error("Session not found");
		if (view.hostId !== data.hostId)
			throw new Error("Only the host can kick players");
		if (view.hostId === data.targetPlayerId)
			throw new Error("Host cannot kick themselves");
		if (view.phase !== "lobby" && view.phase !== "reveal") {
			throw new Error("Can only kick players between rounds");
		}
		await engine.removePlayer(data.sessionId, data.targetPlayerId);
		return { ok: true };
	});

const EMOJI_REGEX = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component})+$/u;

function isValidEmoji(str: string): boolean {
	if (!str || str.length > 20) return false;
	return EMOJI_REGEX.test(str);
}

export const sendEmojiFn = createServerFn()
	.inputValidator(
		z.object({
			sessionId: z.string(),
			playerId: z.string(),
			token: z.string().optional(),
			emoji: z.string().refine(isValidEmoji, {
				message: "Invalid emoji",
			}),
		}),
	)
	.handler(async ({ data }) => {
		enforceRateLimit(data.sessionId, data.playerId, "emoji");
		await verify(data.sessionId, data.playerId, data.token);
		await engine.sendEmoji(data.sessionId, data.playerId, data.emoji);
		return { ok: true };
	});

export const getPlayerHistoryFn = createServerFn()
	.inputValidator(z.object({ authUserId: z.string() }))
	.handler(async ({ data }) => {
		return engine.getPlayerHistory(data.authUserId);
	});

export const voteKickFn = createServerFn()
	.inputValidator(
		z.object({
			sessionId: z.string(),
			playerId: z.string(),
			token: z.string().optional(),
			targetId: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		enforceRateLimit(data.sessionId, data.playerId, "voteKick");
		await verify(data.sessionId, data.playerId, data.token);
		return engine.castKickVote(data.sessionId, data.playerId, data.targetId);
	});
