import { useCallback, useEffect, useRef, useState } from "react";

interface UseSSEOptions {
	sessionId: string;
	playerId: string;
	token?: string;
	onVersionChange?: (version: number) => void;
	onSessionEnd?: () => void;
	onReconnect?: () => void;
	enabled?: boolean;
}

const RECONNECT_DELAY_MS = 3000;

export function useSSE({
	sessionId,
	playerId,
	token,
	onVersionChange,
	onSessionEnd,
	onReconnect,
	enabled = true,
}: UseSSEOptions) {
	const cbRef = useRef({ onVersionChange, onSessionEnd, onReconnect });
	cbRef.current = { onVersionChange, onSessionEnd, onReconnect };
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mountedRef = useRef(true);
	const [isConnected, setIsConnected] = useState(false);

	const connect = useCallback(() => {
		if (!enabled || !sessionId || !playerId) return;

		const params = new URLSearchParams({ playerId });
		if (token) params.set("token", token);
		const url = `/api/events/${sessionId}?${params}`;

		const es = new EventSource(url);

		es.onopen = () => {
			if (mountedRef.current) setIsConnected(true);
		};

		es.addEventListener("version", (e) => {
			try {
				const data = JSON.parse((e as MessageEvent).data);
				cbRef.current.onVersionChange?.(data.version);
			} catch {}
		});

		es.addEventListener("session-ended", () => {
			cbRef.current.onSessionEnd?.();
			es.close();
		});

		es.addEventListener("reconnect", () => {
			es.close();
			if (mountedRef.current) {
				setIsConnected(false);
				cbRef.current.onReconnect?.();
				reconnectTimerRef.current = setTimeout(() => {
					if (mountedRef.current) {
						connect();
					}
				}, RECONNECT_DELAY_MS);
			}
		});

		es.onerror = () => {
			es.close();
			if (mountedRef.current) {
				setIsConnected(false);
				cbRef.current.onReconnect?.();
				reconnectTimerRef.current = setTimeout(() => {
					if (mountedRef.current) {
						connect();
					}
				}, RECONNECT_DELAY_MS);
			}
		};

		return () => {
			es.close();
		};
	}, [sessionId, playerId, token, enabled]);

	useEffect(() => {
		mountedRef.current = true;
		const cleanup = connect();
		return () => {
			mountedRef.current = false;
			setIsConnected(false);
			if (reconnectTimerRef.current) {
				clearTimeout(reconnectTimerRef.current);
			}
			cleanup?.();
		};
	}, [connect]);

	return { isConnected };
}
