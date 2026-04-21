const PHONE_REGEX = /^0[0-9]{9}$/;
const CITIZEN_ID_REGEX = /^[0-9]{13}$/;

export function isValidPromptPayId(id: string): boolean {
	const cleaned = id.replace(/[-\s]/g, "");
	return PHONE_REGEX.test(cleaned) || CITIZEN_ID_REGEX.test(cleaned);
}

export function sanitizePromptPayId(id: string): string {
	return id.replace(/[-\s]/g, "");
}
