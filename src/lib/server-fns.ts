import { createServerFn } from "@tanstack/react-start";
import * as engine from "./game-engine";
import { generatePromptPayPayload } from "./promptpay";

export const listSessionsFn = createServerFn().handler(async () => {
	return engine.listSessions();
});

export const createSessionFn = createServerFn()
	.inputValidator((data: { hostName: string }) => data)
	.handler(async ({ data }) => {
		const session = engine.createSession(data.hostName);
		const hostId = session.hostId;
		return { sessionId: session.id, playerId: hostId };
	});

export const joinSessionFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerName: string }) => data)
	.handler(async ({ data }) => {
		const { session, playerId } = engine.joinSession(
			data.sessionId,
			data.playerName,
		);
		return { sessionId: session.id, playerId };
	});

export const getGameViewFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerId: string }) => data)
	.handler(async ({ data }) => {
		return engine.getClientView(data.sessionId, data.playerId);
	});

export const startBettingFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerId: string }) => data)
	.handler(async ({ data }) => {
		engine.startBetting(data.sessionId, data.playerId);
		return { success: true };
	});

export const placeBetFn = createServerFn()
	.inputValidator(
		(data: { sessionId: string; playerId: string; amount: number }) => data,
	)
	.handler(async ({ data }) => {
		engine.placeBet(data.sessionId, data.playerId, data.amount);
		return { success: true };
	});

export const dealCardsFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerId: string }) => data)
	.handler(async ({ data }) => {
		engine.dealCards(data.sessionId, data.playerId);
		return { success: true };
	});

export const drawCardFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerId: string }) => data)
	.handler(async ({ data }) => {
		const card = engine.drawCard(data.sessionId, data.playerId);
		return { card };
	});

export const standFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerId: string }) => data)
	.handler(async ({ data }) => {
		engine.stand(data.sessionId, data.playerId);
		return { success: true };
	});

export const dealerDrawFn = createServerFn()
	.inputValidator((data: { sessionId: string; playerId: string }) => data)
	.handler(async ({ data }) => {
		const card = engine.dealerDraw(data.sessionId, data.playerId);
		return { card };
	});

export const resolveRoundFn = createServerFn()
	.inputValidator((data: { sessionId: string }) => data)
	.handler(async ({ data }) => {
		engine.resolveRound(data.sessionId);
		return { success: true };
	});

export const endSessionFn = createServerFn()
	.inputValidator((data: { sessionId: string }) => data)
	.handler(async ({ data }) => {
		const balances = engine.endSession(data.sessionId);
		return balances;
	});

export const generateQrPayloadFn = createServerFn()
	.inputValidator((data: { targetId: string; amount: number }) => data)
	.handler(async ({ data }) => {
		const payload = generatePromptPayPayload(data.targetId, data.amount);
		return { payload };
	});
