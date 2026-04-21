import { describe, expect, it } from "vitest";
import { createPlayerToken, verifyPlayerToken } from "../lib/session-token";

describe("session-token", () => {
	it("creates and verifies a valid token", async () => {
		const token = await createPlayerToken("session123", "player456");
		const result = await verifyPlayerToken(token);
		expect(result).not.toBeNull();
		expect(result!.sessionId).toBe("session123");
		expect(result!.playerId).toBe("player456");
	});

	it("rejects tampered token", async () => {
		const token = await createPlayerToken("session123", "player456");
		const tampered = `${token.slice(0, -5)}XXXXX`;
		const result = await verifyPlayerToken(tampered);
		expect(result).toBeNull();
	});

	it("rejects completely invalid token", async () => {
		const result = await verifyPlayerToken("not-a-valid-token");
		expect(result).toBeNull();
	});

	it("token contains correct structure", async () => {
		const token = await createPlayerToken("abc", "def");
		const decoded = atob(token);
		const parts = decoded.split(".");
		expect(parts).toHaveLength(4);
		expect(parts[0]).toBe("abc");
		expect(parts[1]).toBe("def");
		expect(Number(parts[2])).toBeGreaterThan(0);
		expect(parts[3]).toHaveLength(64);
	});
});
