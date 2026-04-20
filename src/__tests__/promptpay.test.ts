import { describe, expect, it } from "vitest";
import { generatePromptPayPayload } from "../lib/promptpay";

describe("generatePromptPayPayload", () => {
	it("generates a valid EMVCo string ending with CRC", () => {
		const payload = generatePromptPayPayload("0812345678", 100);
		expect(payload).toMatch(/^000201/); // Format indicator
		expect(payload).toMatch(/5303764/); // THB currency
		expect(payload).toMatch(/5802TH/); // Thailand country
		expect(payload.length).toBeGreaterThan(50);
	});

	it("includes correct amount", () => {
		const payload = generatePromptPayPayload("0812345678", 250.5);
		expect(payload).toContain("5406"); // Tag 54, length 6
		expect(payload).toContain("250.50");
	});

	it("formats phone number correctly (0066 prefix)", () => {
		const payload = generatePromptPayPayload("0812345678", 100);
		expect(payload).toContain("0066812345678");
	});

	it("keeps citizen ID as-is", () => {
		const payload = generatePromptPayPayload("1234567890123", 100);
		expect(payload).toContain("1234567890123");
	});

	it("uses mobile AID for phone numbers", () => {
		const payload = generatePromptPayPayload("0812345678", 100);
		expect(payload).toContain("A000000677010111");
	});

	it("uses national ID AID for citizen IDs", () => {
		const payload = generatePromptPayPayload("1234567890123", 100);
		expect(payload).toContain("A000000677010112");
	});

	it("CRC is 4 hex characters", () => {
		const payload = generatePromptPayPayload("0812345678", 100);
		const crc = payload.slice(-4);
		expect(crc).toMatch(/^[0-9A-F]{4}$/);
	});

	it("different amounts produce different payloads", () => {
		const p1 = generatePromptPayPayload("0812345678", 100);
		const p2 = generatePromptPayPayload("0812345678", 200);
		expect(p1).not.toBe(p2);
	});
});
