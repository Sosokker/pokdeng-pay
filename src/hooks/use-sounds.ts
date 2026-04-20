import { useCallback, useRef, useState } from "react";

type SoundName = "card-flip" | "bet-place" | "win" | "lose" | "deal" | "click";

export function useSounds() {
	const [muted, setMuted] = useState(() => {
		if (typeof window === "undefined") return false;
		return localStorage.getItem("pokdeng-muted") === "true";
	});
	const ctxRef = useRef<AudioContext | null>(null);

	const getCtx = useCallback((): AudioContext | null => {
		if (typeof window === "undefined") return null;
		if (!ctxRef.current) {
			try {
				ctxRef.current = new AudioContext();
			} catch {
				return null;
			}
		}
		if (ctxRef.current.state === "suspended") {
			ctxRef.current.resume().catch(() => {});
		}
		return ctxRef.current;
	}, []);

	const play = useCallback(
		(name: SoundName) => {
			if (muted) return;
			const ctx = getCtx();
			if (!ctx) return;

			try {
				switch (name) {
					case "card-flip":
						playCardFlip(ctx);
						break;
					case "bet-place":
						playBetPlace(ctx);
						break;
					case "win":
						playWin(ctx);
						break;
					case "lose":
						playLose(ctx);
						break;
					case "deal":
						playDeal(ctx);
						break;
					case "click":
						playClick(ctx);
						break;
				}
			} catch {
				// Audio not available
			}
		},
		[muted, getCtx],
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

function playCardFlip(ctx: AudioContext) {
	const duration = 0.08;
	const bufferSize = Math.floor(ctx.sampleRate * duration);
	const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < bufferSize; i++) {
		const t = i / bufferSize;
		data[i] = (Math.random() * 2 - 1) * (1 - t) ** 4 * 0.5;
	}
	const source = ctx.createBufferSource();
	source.buffer = buffer;
	const filter = ctx.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = 3000;
	filter.Q.value = 1;
	const gain = ctx.createGain();
	gain.gain.value = 0.4;
	source.connect(filter);
	filter.connect(gain);
	gain.connect(ctx.destination);
	source.start();
}

function playBetPlace(ctx: AudioContext) {
	const times = [0, 0.06];
	const freqs = [1200, 1800];
	for (let i = 0; i < times.length; i++) {
		const osc = ctx.createOscillator();
		osc.type = "sine";
		osc.frequency.value = freqs[i]!;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.15, ctx.currentTime + times[i]!);
		gain.gain.exponentialRampToValueAtTime(
			0.001,
			ctx.currentTime + times[i]! + 0.1,
		);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(ctx.currentTime + times[i]!);
		osc.stop(ctx.currentTime + times[i]! + 0.12);
	}
}

function playWin(ctx: AudioContext) {
	const notes = [523, 659, 784, 1047];
	for (let i = 0; i < notes.length; i++) {
		const osc = ctx.createOscillator();
		osc.type = "sine";
		osc.frequency.value = notes[i]!;
		const gain = ctx.createGain();
		const time = ctx.currentTime + i * 0.12;
		gain.gain.setValueAtTime(0.15, time);
		gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(time);
		osc.stop(time + 0.35);
	}
}

function playLose(ctx: AudioContext) {
	const osc = ctx.createOscillator();
	osc.type = "sawtooth";
	osc.frequency.setValueAtTime(400, ctx.currentTime);
	osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.4);
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(0.1, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
	const filter = ctx.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.value = 800;
	osc.connect(filter);
	filter.connect(gain);
	gain.connect(ctx.destination);
	osc.start();
	osc.stop(ctx.currentTime + 0.5);
}

function playDeal(ctx: AudioContext) {
	for (let i = 0; i < 3; i++) {
		const time = ctx.currentTime + i * 0.08;
		const duration = 0.04;
		const bufferSize = Math.floor(ctx.sampleRate * duration);
		const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let j = 0; j < bufferSize; j++) {
			const t = j / bufferSize;
			data[j] = (Math.random() * 2 - 1) * (1 - t) ** 2;
		}
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		const gain = ctx.createGain();
		gain.gain.value = 0.25;
		source.connect(gain);
		gain.connect(ctx.destination);
		source.start(time);
	}
}

function playClick(ctx: AudioContext) {
	const osc = ctx.createOscillator();
	osc.type = "sine";
	osc.frequency.value = 1000;
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(0.1, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.start();
	osc.stop(ctx.currentTime + 0.06);
}
