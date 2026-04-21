import { describe, expect, it, vi } from "vitest";
import { ConflictError, isConflictError, withRetry } from "../lib/retry";

describe("withRetry", () => {
	it("returns result on first success", async () => {
		const result = await withRetry(() => Promise.resolve("ok"));
		expect(result).toBe("ok");
	});

	it("retries on CONFLICT error and succeeds", async () => {
		let attempt = 0;
		const fn = vi.fn(async () => {
			attempt++;
			if (attempt < 3) throw new Error("CONFLICT: retry");
			return "success";
		});

		const result = await withRetry(fn, 3);
		expect(result).toBe("success");
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it("retries on ConflictError and succeeds", async () => {
		let attempt = 0;
		const fn = vi.fn(async () => {
			attempt++;
			if (attempt < 2) throw new ConflictError("conflict");
			return "done";
		});

		const result = await withRetry(fn, 3);
		expect(result).toBe("done");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("throws non-conflict errors immediately", async () => {
		const fn = vi.fn(async () => {
			throw new Error("Not a conflict");
		});

		await expect(withRetry(fn, 3)).rejects.toThrow("Not a conflict");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("throws last error after max retries exhausted", async () => {
		const fn = vi.fn(async () => {
			throw new Error("CONFLICT: exhausted");
		});

		await expect(withRetry(fn, 2)).rejects.toThrow("CONFLICT: exhausted");
		expect(fn).toHaveBeenCalledTimes(3);
	});
});

describe("isConflictError", () => {
	it("recognizes ConflictError", () => {
		expect(isConflictError(new ConflictError("test"))).toBe(true);
	});

	it("recognizes Error with CONFLICT message", () => {
		expect(isConflictError(new Error("CONFLICT: something"))).toBe(true);
	});

	it("returns false for normal errors", () => {
		expect(isConflictError(new Error("normal error"))).toBe(false);
	});

	it("returns false for non-errors", () => {
		expect(isConflictError("string")).toBe(false);
		expect(isConflictError(null)).toBe(false);
	});
});
