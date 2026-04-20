export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
	| "A"
	| "2"
	| "3"
	| "4"
	| "5"
	| "6"
	| "7"
	| "8"
	| "9"
	| "10"
	| "J"
	| "Q"
	| "K";

export interface Card {
	suit: Suit;
	rank: Rank;
}

// ── Hand Types (per Wikipedia Pok Deng rules) ───────────────
export type HandType = "pok" | "tong" | "sam-lueang" | "normal";

export interface HandResult {
	score: number; // taem: 0-9 (ones digit of sum)
	handType: HandType; // pok > tong > sam-lueang > normal
	deng: number; // bet multiplier: 1-5
	cards: Card[];
}

// ── Player ──────────────────────────────────────────────────
export interface Player {
	id: string;
	name: string;
	isDealer: boolean;
}

export interface PlayerInRound {
	playerId: string;
	cards: Card[];
	bet: number;
	hasDrawn: boolean;
	hasStood: boolean;
	result?: HandResult;
	netAmount?: number;
}

// ── Game Session ────────────────────────────────────────────
export type SessionPhase = "lobby" | "betting" | "playing" | "reveal" | "ended";

export interface GameRound {
	roundNumber: number;
	phase: SessionPhase;
	players: PlayerInRound[];
	dealerHand?: PlayerInRound;
}

export interface GameSession {
	id: string;
	hostId: string;
	players: Player[];
	dealerId: string;
	currentRound: GameRound | null;
	roundHistory: RoundSummary[];
	phase: SessionPhase;
	createdAt: number;
}

export interface RoundSummary {
	roundNumber: number;
	dealerTaem: number;
	dealerHandType: HandType;
	dealerDeng: number;
	results: Array<{
		playerId: string;
		playerName: string;
		bet: number;
		netAmount: number;
		taem: number;
		handType: HandType;
		deng: number;
	}>;
}

// ── Client View ─────────────────────────────────────────────
export interface ClientGameView {
	sessionId: string;
	phase: SessionPhase;
	players: Array<{
		id: string;
		name: string;
		isDealer: boolean;
		cardCount: number;
		hasDrawn: boolean;
		hasStood: boolean;
		cards?: Card[];
		result?: HandResult;
		netAmount?: number;
		bet: number;
	}>;
	myCards: Card[];
	myResult?: HandResult;
	roundNumber: number;
	roundHistory: RoundSummary[];
	cumulativeBalances: Record<string, number>;
}

export interface PromptPayConfig {
	targetId: string;
	amount: number;
}
