import type { Card, HandResult, HandType, Rank, Suit } from "./types";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = [
	"A",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K",
];

function cardValue(card: Card): number {
	if (card.rank === "A") return 1;
	if (["J", "Q", "K", "10"].includes(card.rank)) return 10;
	return Number.parseInt(card.rank, 10);
}

export function taem(cards: Card[]): number {
	return cards.reduce((sum, c) => sum + cardValue(c), 0) % 10;
}

const RANK_ORDER: Record<Rank, number> = {
	A: 1,
	"2": 2,
	"3": 3,
	"4": 4,
	"5": 5,
	"6": 6,
	"7": 7,
	"8": 8,
	"9": 9,
	"10": 10,
	J: 11,
	Q: 12,
	K: 13,
};

function isSameSuit(cards: Card[]): boolean {
	return cards.length > 0 && cards.every((c) => c.suit === cards[0]!.suit);
}

function isThreeOfAKind(cards: Card[]): boolean {
	return cards.length === 3 && cards.every((c) => c.rank === cards[0]!.rank);
}

function isPair(cards: Card[]): boolean {
	if (cards.length < 2) return false;
	for (let i = 0; i < cards.length; i++) {
		for (let j = i + 1; j < cards.length; j++) {
			if (cards[i]!.rank === cards[j]!.rank) return true;
		}
	}
	return false;
}

function isFaceCard(card: Card): boolean {
	return ["J", "Q", "K"].includes(card.rank);
}

function isConsecutive(cards: Card[], allowAceHigh = false): boolean {
	if (cards.length !== 3) return false;
	const sorted = cards.map((c) => RANK_ORDER[c.rank]).sort((a, b) => a - b);
	if (sorted[1]! - sorted[0]! === 1 && sorted[2]! - sorted[1]! === 1)
		return true;
	if (allowAceHigh && sorted[0] === 1 && sorted[1] === 12 && sorted[2] === 13)
		return true;
	return false;
}

export function evaluateHand(
	cards: Card[],
	options?: { allowAceHighStraight?: boolean },
): HandResult {
	const score = taem(cards);
	const allowAce = options?.allowAceHighStraight ?? false;

	if (cards.length === 2) {
		const isPok = score >= 8;
		if (isPok && isPair(cards)) {
			return { score, handType: "pok", deng: 2, cards };
		}
		if (isPok && isSameSuit(cards)) {
			return { score, handType: "pok", deng: 2, cards };
		}
		if (isPok) {
			return { score, handType: "pok", deng: 1, cards };
		}
		if (isPair(cards)) {
			return { score, handType: "normal", deng: 2, cards };
		}
		if (isSameSuit(cards)) {
			return { score, handType: "normal", deng: 2, cards };
		}
		return { score, handType: "normal", deng: 1, cards };
	}

	if (isThreeOfAKind(cards)) {
		return { score, handType: "tong", deng: 5, cards };
	}
	if (isConsecutive(cards, allowAce) && isSameSuit(cards)) {
		return { score, handType: "normal", deng: 5, cards };
	}
	if (cards.every(isFaceCard)) {
		return { score, handType: "sam-lueang", deng: 3, cards };
	}
	if (isConsecutive(cards, allowAce)) {
		return { score, handType: "normal", deng: 3, cards };
	}
	if (isSameSuit(cards)) {
		return { score, handType: "normal", deng: 3, cards };
	}
	if (isPair(cards)) {
		return { score, handType: "normal", deng: 2, cards };
	}
	return { score, handType: "normal", deng: 1, cards };
}

const HAND_TYPE_RANK: Record<HandType, number> = {
	pok: 3,
	tong: 2,
	"sam-lueang": 1,
	normal: 0,
};

export function compareHands(
	playerHand: HandResult,
	dealerHand: HandResult,
	bet: number,
): { winner: "player" | "dealer" | "tie"; netAmount: number } {
	const pType = HAND_TYPE_RANK[playerHand.handType];
	const dType = HAND_TYPE_RANK[dealerHand.handType];

	if (playerHand.handType === "tong" && dealerHand.handType === "sam-lueang") {
		return { winner: "player", netAmount: bet * 2 };
	}
	if (dealerHand.handType === "tong" && playerHand.handType === "sam-lueang") {
		return { winner: "dealer", netAmount: -bet * 2 };
	}

	if (pType !== dType) {
		const playerWins = pType > dType;
		const winnerHand = playerWins ? playerHand : dealerHand;
		return {
			winner: playerWins ? "player" : "dealer",
			netAmount: (playerWins ? 1 : -1) * bet * winnerHand.deng,
		};
	}

	if (playerHand.score !== dealerHand.score) {
		const playerWins = playerHand.score > dealerHand.score;
		const winnerHand = playerWins ? playerHand : dealerHand;
		return {
			winner: playerWins ? "player" : "dealer",
			netAmount: (playerWins ? 1 : -1) * bet * winnerHand.deng,
		};
	}

	if (playerHand.deng !== dealerHand.deng) {
		const playerWins = playerHand.deng > dealerHand.deng;
		const dengDiff = Math.abs(playerHand.deng - dealerHand.deng);
		return {
			winner: playerWins ? "player" : "dealer",
			netAmount: (playerWins ? 1 : -1) * bet * dengDiff,
		};
	}

	return { winner: "tie", netAmount: 0 };
}
