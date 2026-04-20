import type { Card, Suit } from "#/lib/types";

const SUIT_SYMBOLS: Record<Suit, string> = {
	hearts: "\u2665",
	diamonds: "\u2666",
	clubs: "\u2663",
	spades: "\u2660",
};

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
			>
				<div className="w-3/4 h-3/4 rounded border border-blue-400 bg-blue-800 opacity-60" />
			</div>
		);
	}

	const color = isRed(card.suit) ? "suit-red" : "suit-black";
	const symbol = SUIT_SYMBOLS[card.suit];

	return (
		<div
			className={`${w} rounded-lg bg-white border border-[#3F3F46] flex flex-col justify-between p-1.5 shadow-lg relative select-none`}
		>
			{/* Top-left rank + suit */}
			<div className={`flex flex-col items-start leading-none ${color}`}>
				<span className={`${textSize} font-bold`}>{card.rank}</span>
				<span className="text-xs">{symbol}</span>
			</div>
			{/* Center suit */}
			<div
				className={`absolute inset-0 flex items-center justify-center ${color}`}
			>
				<span className={suitSize}>{symbol}</span>
			</div>
			{/* Bottom-right rank + suit (rotated) */}
			<div
				className={`flex flex-col items-end leading-none rotate-180 ${color}`}
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
