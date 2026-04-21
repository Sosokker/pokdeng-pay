import { describe, expect, it } from "vitest";
import { checkRateLimit, rateLimitKey } from "../lib/rate-limit";

describe("checkRateLimit", () => {
	it("allows requests within limit", () => {
		const result = checkRateLimit("test", 5, 10_000);
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(4);
	});

	it("blocks requests exceeding limit", () => {
		const key = `block-test-${Date.now()}`;
		for (let i = 0; i < 3; i++) {
			checkRateLimit(key, 3, 10_000);
		}
		const result = checkRateLimit(key, 3, 10_000);
		expect(result.allowed).toBe(false);
	});

	it("resets after window expires", async () => {
		const key = `reset-test-${Date.now()}`;
		for (let i = 0; i < 5; i++) {
			checkRateLimit(key, 5, 50);
		}
		await new Promise((r) => setTimeout(r, 60));
		const result = checkRateLimit(key, 5, 50);
		expect(result.allowed).toBe(true);
	});

	it("tracks different keys independently", () => {
		const r1 = checkRateLimit("key-a", 1, 10_000);
		expect(r1.allowed).toBe(true);
		const r2 = checkRateLimit("key-b", 1, 10_000);
		expect(r2.allowed).toBe(true);
		const r3 = checkRateLimit("key-a", 1, 10_000);
		expect(r3.allowed).toBe(false);
	});
});

describe("rateLimitKey", () => {
	it("produces expected format", () => {
		expect(rateLimitKey("sess", "player", "action")).toBe("sess:player:action");
	});
});
