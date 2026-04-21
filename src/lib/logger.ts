type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
	context?: Record<string, unknown>;
}

function formatTimestamp(): string {
	return new Date().toISOString();
}

function createLogEntry(
	level: LogLevel,
	message: string,
	context?: Record<string, unknown>,
): LogEntry {
	return {
		level,
		message,
		timestamp: formatTimestamp(),
		...(context && { context }),
	};
}

export const log = {
	debug(message: string, context?: Record<string, unknown>) {
		const entry = createLogEntry("debug", message, context);
		console.log(JSON.stringify(entry));
	},
	info(message: string, context?: Record<string, unknown>) {
		const entry = createLogEntry("info", message, context);
		console.log(JSON.stringify(entry));
	},
	warn(message: string, context?: Record<string, unknown>) {
		const entry = createLogEntry("warn", message, context);
		console.warn(JSON.stringify(entry));
	},
	error(message: string, context?: Record<string, unknown>) {
		const entry = createLogEntry("error", message, context);
		console.error(JSON.stringify(entry));
	},
};
