/**
 * PromptPay QR Code Payload Generator
 * Implements EMVCo Merchant-Presented QR Code specification
 * with CRC16-CCITT checksum (Polynomial 0x1021, init 0xFFFF)
 *
 * NO external libraries used for payload generation.
 */

// ── CRC16-CCITT ─────────────────────────────────────────────
function crc16ccitt(data: string): string {
	let crc = 0xffff;
	for (let i = 0; i < data.length; i++) {
		crc ^= data.charCodeAt(i) << 8;
		for (let j = 0; j < 8; j++) {
			if (crc & 0x8000) {
				crc = ((crc << 1) ^ 0x1021) & 0xffff;
			} else {
				crc = (crc << 1) & 0xffff;
			}
		}
	}
	return crc.toString(16).toUpperCase().padStart(4, "0");
}

// ── TLV Helpers ─────────────────────────────────────────────
function tlv(tag: string, value: string): string {
	const length = value.length.toString().padStart(2, "0");
	return `${tag}${length}${value}`;
}

// ── PromptPay ID Formatting ─────────────────────────────────
function formatPromptPayId(id: string): string {
	// Remove dashes, spaces
	const cleaned = id.replace(/[-\s]/g, "");

	if (cleaned.length === 13) {
		// Citizen ID - use as-is
		return cleaned;
	}

	if (cleaned.length === 10 || cleaned.length === 9) {
		// Phone number - convert to international format
		// 0812345678 -> 0066812345678
		const withoutLeadingZero = cleaned.replace(/^0/, "");
		return `0066${withoutLeadingZero}`;
	}

	return cleaned;
}

function getAID(id: string): string {
	const cleaned = id.replace(/[-\s]/g, "");
	if (cleaned.length === 13) {
		return "A000000677010112"; // National ID
	}
	return "A000000677010111"; // Mobile number
}

// ── Payload Generator ───────────────────────────────────────
export function generatePromptPayPayload(
	targetId: string,
	amount: number,
): string {
	const formattedId = formatPromptPayId(targetId);
	const aid = getAID(targetId);

	// Build Merchant Account Information (tag 29)
	const merchantAccountInfo = [
		tlv("00", aid), // Application ID
		tlv("01", formattedId), // PromptPay ID
	].join("");

	// Build main payload (without CRC)
	const payload = [
		tlv("00", "01"), // Payload Format Indicator
		tlv("01", "12"), // Point of Initiation (12 = dynamic, one-time)
		tlv("29", merchantAccountInfo), // Merchant Account Info (PromptPay)
		tlv("53", "764"), // Transaction Currency (764 = THB)
		tlv("54", amount.toFixed(2)), // Transaction Amount
		tlv("58", "TH"), // Country Code
		tlv("63", ""), // CRC placeholder - will be replaced
	].join("");

	// Remove the empty CRC placeholder and add proper one
	const payloadWithoutCrc = payload.slice(0, -4); // remove empty "6304"
	const crcInput = `${payloadWithoutCrc}6304`;
	const crc = crc16ccitt(crcInput);

	return `${crcInput}${crc}`;
}
