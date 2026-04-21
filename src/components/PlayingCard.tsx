import { useEffect, useState } from "react";
import { useI18nSafe } from "#/lib/i18n";
import type { Card, Suit } from "#/lib/types";

const SUIT_SYMBOLS: Record<Suit, string> = {
	hearts: "\u2665",
	diamonds: "\u2666",
	clubs: "\u2663",
	spades: "\u2660",
};

function suitColor(suit: Suit): string {
	return isRed(suit) ? "#EF4444" : "#1a1a1a";
}

function isRed(suit: Suit): boolean {
	return suit === "hearts" || suit === "diamonds";
}

export function PlayingCard({
	card,
	faceDown = false,
	small = false,
}: {
	card: Card;
	faceDown?: boolean;
	small?: boolean;
}) {
	const w = small ? "w-16 h-24" : "w-24 h-36";
	const textSize = small ? "text-sm" : "text-lg";
	const suitSize = small ? "text-xl" : "text-3xl";

	if (faceDown) {
		return (
			<div
				className={`${w} rounded-lg bg-gradient-to-br from-blue-700 to-blue-900 border-2 border-blue-500 flex items-center justify-center shadow-lg`}
				role="img"
				aria-label="Face-down card"
			>
				<div className="w-3/4 h-3/4 rounded border border-blue-400 bg-blue-800 opacity-60" />
			</div>
		);
	}

	const color = suitColor(card.suit);
	const symbol = SUIT_SYMBOLS[card.suit];

	return (
		<div
			className={`${w} rounded-lg bg-white border border-[#3F3F46] flex flex-col justify-between p-1.5 shadow-lg relative select-none`}
			role="img"
			aria-label={`${card.rank} of ${card.suit}`}
		>
			<div
				className="flex flex-col items-start leading-none"
				style={{ color }}
				aria-hidden="true"
			>
				<span className={`${textSize} font-bold`}>{card.rank}</span>
				<span className="text-xs">{symbol}</span>
			</div>
			<div
				className="absolute inset-0 flex items-center justify-center"
				style={{ color }}
				aria-hidden="true"
			>
				<span className={suitSize}>{symbol}</span>
			</div>
			<div
				className="flex flex-col items-end leading-none rotate-180"
				style={{ color }}
				aria-hidden="true"
			>
				<span className={`${textSize} font-bold`}>{card.rank}</span>
				<span className="text-xs">{symbol}</span>
			</div>
		</div>
	);
}

export function CardBack({ small = false }: { small?: boolean }) {
	const w = small ? "w-16 h-24" : "w-24 h-36";
	return (
		<div
			className={`${w} rounded-lg bg-gradient-to-br from-blue-700 to-blue-900 border-2 border-blue-500 flex items-center justify-center shadow-lg`}
		>
			<div className="w-3/4 h-3/4 rounded border border-blue-400 bg-blue-800 opacity-60" />
		</div>
	);
}

export function SqueezeCard({
	card,
	squeezeEnabled,
	forceReveal,
	small = false,
}: {
	card: Card;
	squeezeEnabled: boolean;
	forceReveal?: boolean;
	small?: boolean;
}) {
	const [revealed, setRevealed] = useState(!squeezeEnabled || forceReveal);
	const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
		null,
	);
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		if (!squeezeEnabled || forceReveal) {
			setRevealed(true);
		}
	}, [squeezeEnabled, forceReveal]);

	if (revealed) {
		return <PlayingCard card={card} small={small} />;
	}

	const handlePointerDown = (e: React.PointerEvent) => {
		setDragStart({ x: e.clientX, y: e.clientY });
		e.currentTarget.setPointerCapture(e.pointerId);
	};

	const handlePointerMove = (e: React.PointerEvent) => {
		if (!dragStart) return;
		const deltaX = dragStart.x - e.clientX;
		const p = Math.max(0, Math.min(1, Math.abs(deltaX) / 120)); // 120px to full reveal
		setProgress(p);
		if (p > 0.85) {
			setRevealed(true);
		}
	};

	const handlePointerUp = () => {
		if (!dragStart) return;
		setDragStart(null);
		if (progress < 0.05 || progress > 0.4) {
			setRevealed(true);
		} else {
			setProgress(0);
		}
	};

	const angle = progress * 180;
	const w = small ? "w-16 h-24" : "w-24 h-36";

	return (
		<div
			className={`${w} relative touch-none cursor-grab active:cursor-grabbing group rounded-lg`}
			style={{ perspective: "1000px" }}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
		>
			<div
				className="w-full h-full absolute inset-0"
				style={{
					transformStyle: "preserve-3d",
					transform: `rotateY(${angle}deg) scale(${dragStart ? 1.05 : 1})`,
					transition: dragStart
						? "none"
						: "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
					willChange: "transform",
				}}
			>
				<div
					className="absolute inset-0"
					style={{
						backfaceVisibility: "hidden",
						WebkitBackfaceVisibility: "hidden",
					}}
				>
					<CardBack small={small} />
					<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30 rounded-lg pointer-events-none">
						<span className="text-white text-[10px] font-bold px-2 py-1 bg-black/60 rounded-full">
							Peel
						</span>
					</div>
				</div>
				<div
					className="absolute inset-0"
					style={{
						backfaceVisibility: "hidden",
						WebkitBackfaceVisibility: "hidden",
						transform: "rotateY(180deg)",
					}}
				>
					{revealed ? (
						<PlayingCard card={card} small={small} />
					) : (
						<div
							className={`${small ? "w-16 h-24" : "w-24 h-36"} rounded-lg bg-white border border-[#3F3F46] shadow-lg`}
							role="img"
							aria-label="Hidden card"
						/>
					)}
				</div>
			</div>
		</div>
	);
}
