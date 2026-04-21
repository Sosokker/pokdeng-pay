import type React from "react";
import type { Card } from "#/lib/types";

export function dengTooltipText(
	result: { handType: string; deng: number; cards?: Card[] } | undefined,
): string {
	if (!result || result.deng <= 1 || !result.cards || result.cards.length === 0)
		return "";
	const { handType, deng, cards } = result;
	if (handType === "pok")
		return `Pok ${deng === 2 ? "with matching suit or pair" : ""}! Multiplies your win/loss by ${deng}.`;
	if (handType === "tong")
		return `Three of a kind! All three cards match rank. Multiplies your win/loss by ${deng}.`;
	if (handType === "sam-lueang")
		return `Sam Lueang (three face cards)! Automatic win override. Multiplies your win/loss by ${deng}.`;
	if (cards.length === 3) {
		const isFlush = cards.every((c) => c.suit === cards[0]!.suit);
		const ranks = cards.map((c) => c.rank);
		const sorted = [...ranks].sort();
		const isStraight =
			sorted.length === 3 &&
			((sorted[1] === String(Number(sorted[0]) + 1) &&
				sorted[2] === String(Number(sorted[1]) + 1)) ||
				(sorted[0] === "J" && sorted[1] === "Q" && sorted[2] === "K"));
		const hasPair = new Set(ranks).size < 3;
		if (isFlush && isStraight)
			return `Straight flush! Three consecutive cards of the same suit. Multiplies your win/loss by ${deng}.`;
		if (isStraight)
			return `Straight! Three consecutive cards. Multiplies your win/loss by ${deng}.`;
		if (isFlush)
			return `Flush! All three cards share the same suit. Multiplies your win/loss by ${deng}.`;
		if (hasPair)
			return `Pair! Two cards share the same rank. Multiplies your win/loss by ${deng}.`;
	}
	if (cards.length === 2) {
		const isFlush = cards[0]!.suit === cards[1]!.suit;
		const hasPair = cards[0]!.rank === cards[1]!.rank;
		if (hasPair)
			return `Pair! Both cards share the same rank. Multiplies your win/loss by ${deng}.`;
		if (isFlush)
			return `Flush! Both cards share the same suit. Multiplies your win/loss by ${deng}.`;
	}
	return `Multiplies your win/loss by ${deng}.`;
}

export function formatHandType(
	result: { handType: string; deng: number; cards?: Card[] } | undefined,
	t: (key: string) => string,
): React.ReactNode {
	if (!result) return null;
	const key = `game.handType.${result.handType}` as const;
	const label = t(key);
	if (result.deng > 1) {
		return (
			<span className="flex items-center gap-1 group relative">
				<span>{label}</span>
				<span className="text-yellow-400 font-bold bg-yellow-500/20 px-1 rounded cursor-help border border-yellow-500/30">
					{result.deng} Deng
				</span>
				<span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#18181B] border border-white/20 text-gray-300 text-[10px] p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-center font-sans normal-case tracking-normal leading-tight">
					{dengTooltipText(result)}
				</span>
			</span>
		);
	}
	return label;
}
