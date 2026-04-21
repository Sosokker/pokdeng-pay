import { z } from "zod";
import { isValidPromptPayId } from "./promptpay-validator";

const promptPayRefinement = z.string().refine(isValidPromptPayId, {
	message:
		"Must be a valid Thai phone number (10 digits) or Citizen ID (13 digits)",
});

export const createSessionSchema = z.object({
	hostName: z
		.string()
		.min(2, "Name must be at least 2 characters")
		.max(20, "Name must be 20 characters or less"),
	promptPayId: promptPayRefinement.optional(),
	config: z.object({ allowAceHighStraight: z.boolean().optional() }).optional(),
});

export const joinSessionSchema = z.object({
	sessionId: z.string().length(16, "Invalid session ID"),
	playerName: z
		.string()
		.min(2, "Name must be at least 2 characters")
		.max(20, "Name must be 20 characters or less"),
	promptPayId: promptPayRefinement.optional(),
	existingPlayerId: z.string().length(16).optional(),
});

export const sessionIdPlayerIdSchema = z.object({
	sessionId: z.string().length(16, "Invalid session ID"),
	playerId: z.string().length(16, "Invalid player ID"),
});

export const placeBetSchema = z.object({
	sessionId: z.string().length(16, "Invalid session ID"),
	playerId: z.string().length(16, "Invalid player ID"),
	amount: z
		.number()
		.int("Bet must be a whole number")
		.min(1, "Bet must be at least 1")
		.max(1000, "Bet cannot exceed 1000"),
});

export const sessionIdSchema = z.object({
	sessionId: z.string().length(16, "Invalid session ID"),
});

export const setPromptPayIdSchema = z.object({
	sessionId: z.string().length(16, "Invalid session ID"),
	playerId: z.string().length(16, "Invalid player ID"),
	promptPayId: promptPayRefinement,
});

export const generateQrSchema = z.object({
	targetId: z.string().min(1, "Target ID is required"),
	amount: z.number().positive("Amount must be positive"),
});
