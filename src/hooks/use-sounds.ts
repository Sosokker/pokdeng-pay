import { useCallback, useRef, useState } from "react";

type SoundName = "card-flip" | "bet-place" | "win" | "lose" | "deal" | "click";

const SOUND_FILES: Record<SoundName, string> = {
	"card-flip": "/sounds/card-flip.wav",
	"bet-place": "/sounds/bet-place.wav",
	win: "/sounds/win.wav",
	lose: "/sounds/lose.wav",
	deal: "/sounds/deal.wav",
	click: "/sounds/click.wav",
};

export function useSounds() {
	const [muted, setMuted] = useState(() => {
		if (typeof window === "undefined") return false;
		return localStorage.getItem("pokdeng-muted") === "true";
	});
	const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

	const play = useCallback(
		(name: SoundName) => {
			if (muted || typeof window === "undefined") return;
			const src = SOUND_FILES[name];
			if (!src) return;

			try {
				let audio = audioCache.current.get(src);
				if (!audio) {
					audio = new Audio(src);
					audio.volume = 0.3;
					audioCache.current.set(src, audio);
				}
				audio.currentTime = 0;
				audio.play().catch(() => {});
			} catch {
				// Audio not available
			}
		},
		[muted],
	);

	const toggleMute = useCallback(() => {
		setMuted((prev) => {
			const next = !prev;
			localStorage.setItem("pokdeng-muted", String(next));
			return next;
		});
	}, []);

	return { play, muted, toggleMute };
}
