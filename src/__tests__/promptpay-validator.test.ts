import { describe, expect, it } from "vitest";
import {
	isValidPromptPayId,
	sanitizePromptPayId,
} from "../lib/promptpay-validator";

describe("isValidPromptPayId", () => {
	it("accepts valid 10-digit phone number", () => {
		expect(isValidPromptPayId("0812345678")).toBe(true);
	});

	it("accepts valid 13-digit citizen ID", () => {
		expect(isValidPromptPayId("1234567890123")).toBe(true);
	});

	it("accepts phone number with dashes", () => {
		expect(isValidPromptPayId("081-234-5678")).toBe(true);
	});

	it("accepts citizen ID with spaces", () => {
		expect(isValidPromptPayId("1 2345 67890 12 3")).toBe(true);
	});

	it("rejects too short", () => {
		expect(isValidPromptPayId("081234567")).toBe(false);
	});

	it("rejects letters", () => {
		expect(isValidPromptPayId("abcdefghij")).toBe(false);
	});

	it("rejects empty string", () => {
		expect(isValidPromptPayId("")).toBe(false);
	});

	it("rejects 11 digits", () => {
		expect(isValidPromptPayId("08123456789")).toBe(false);
	});
});

describe("sanitizePromptPayId", () => {
	it("removes dashes and spaces", () => {
		expect(sanitizePromptPayId("081-234 5678")).toBe("0812345678");
	});

	it("returns clean input as-is", () => {
		expect(sanitizePromptPayId("0812345678")).toBe("0812345678");
	});
});
