import { describe, expect, it } from "vitest";
import {
	createSessionSchema,
	generateQrSchema,
	joinSessionSchema,
	placeBetSchema,
	sessionIdPlayerIdSchema,
	sessionIdSchema,
	setPromptPayIdSchema,
} from "../lib/validators";

describe("createSessionSchema", () => {
	it("accepts valid input", () => {
		const result = createSessionSchema.safeParse({
			hostName: "Alice",
			promptPayId: "0812345678",
		});
		expect(result.success).toBe(true);
	});

	it("rejects empty name", () => {
		const result = createSessionSchema.safeParse({ hostName: "" });
		expect(result.success).toBe(false);
	});

	it("rejects name too long", () => {
		const result = createSessionSchema.safeParse({
			hostName: "A".repeat(21),
		});
		expect(result.success).toBe(false);
	});

	it("rejects name too short", () => {
		const result = createSessionSchema.safeParse({ hostName: "A" });
		expect(result.success).toBe(false);
	});
});

describe("joinSessionSchema", () => {
	it("accepts valid input", () => {
		const result = joinSessionSchema.safeParse({
			sessionId: "0123456789abcdef",
			playerName: "Bob",
		});
		expect(result.success).toBe(true);
	});

	it("rejects invalid sessionId length", () => {
		const result = joinSessionSchema.safeParse({
			sessionId: "short",
			playerName: "Bob",
		});
		expect(result.success).toBe(false);
	});

	it("rejects missing playerName", () => {
		const result = joinSessionSchema.safeParse({
			sessionId: "0123456789abcdef",
		});
		expect(result.success).toBe(false);
	});
});

describe("placeBetSchema", () => {
	it("accepts valid bet", () => {
		const result = placeBetSchema.safeParse({
			sessionId: "0123456789abcdef",
			playerId: "0123456789abcdef",
			amount: 100,
		});
		expect(result.success).toBe(true);
	});

	it("rejects zero bet", () => {
		const result = placeBetSchema.safeParse({
			sessionId: "0123456789abcdef",
			playerId: "0123456789abcdef",
			amount: 0,
		});
		expect(result.success).toBe(false);
	});

	it("rejects negative bet", () => {
		const result = placeBetSchema.safeParse({
			sessionId: "0123456789abcdef",
			playerId: "0123456789abcdef",
			amount: -50,
		});
		expect(result.success).toBe(false);
	});

	it("rejects bet over 1000", () => {
		const result = placeBetSchema.safeParse({
			sessionId: "0123456789abcdef",
			playerId: "0123456789abcdef",
			amount: 1001,
		});
		expect(result.success).toBe(false);
	});

	it("rejects non-integer bet", () => {
		const result = placeBetSchema.safeParse({
			sessionId: "0123456789abcdef",
			playerId: "0123456789abcdef",
			amount: 10.5,
		});
		expect(result.success).toBe(false);
	});
});

describe("sessionIdPlayerIdSchema", () => {
	it("accepts valid input", () => {
		const result = sessionIdPlayerIdSchema.safeParse({
			sessionId: "0123456789abcdef",
			playerId: "0123456789abcdef",
		});
		expect(result.success).toBe(true);
	});

	it("rejects invalid sessionId", () => {
		const result = sessionIdPlayerIdSchema.safeParse({
			sessionId: "short",
			playerId: "0123456789abcdef",
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid playerId", () => {
		const result = sessionIdPlayerIdSchema.safeParse({
			sessionId: "0123456789abcdef",
			playerId: "short",
		});
		expect(result.success).toBe(false);
	});
});

describe("generateQrSchema", () => {
	it("accepts valid input", () => {
		const result = generateQrSchema.safeParse({
			targetId: "0812345678",
			amount: 100,
		});
		expect(result.success).toBe(true);
	});

	it("rejects zero amount", () => {
		const result = generateQrSchema.safeParse({
			targetId: "0812345678",
			amount: 0,
		});
		expect(result.success).toBe(false);
	});

	it("rejects empty targetId", () => {
		const result = generateQrSchema.safeParse({
			targetId: "",
			amount: 100,
		});
		expect(result.success).toBe(false);
	});
});

describe("setPromptPayIdSchema", () => {
	it("accepts valid input", () => {
		const result = setPromptPayIdSchema.safeParse({
			sessionId: "0123456789abcdef",
			playerId: "0123456789abcdef",
			promptPayId: "0812345678",
		});
		expect(result.success).toBe(true);
	});

	it("rejects empty promptPayId", () => {
		const result = setPromptPayIdSchema.safeParse({
			sessionId: "0123456789abcdef",
			playerId: "0123456789abcdef",
			promptPayId: "",
		});
		expect(result.success).toBe(false);
	});
});

describe("sessionIdSchema", () => {
	it("accepts valid input", () => {
		const result = sessionIdSchema.safeParse({
			sessionId: "0123456789abcdef",
		});
		expect(result.success).toBe(true);
	});

	it("rejects invalid sessionId", () => {
		const result = sessionIdSchema.safeParse({ sessionId: "short" });
		expect(result.success).toBe(false);
	});
});
