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
	/** PromptPay phone-number or Citizen-ID for this player in this session */
	promptPayId?: string;
	/** Timestamp when player left/was kicked; still tracked for financial settlement */
	leftAt?: number;
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
	startedAt: number;
}

export interface GameSession {
	id: string;
	hostId: string;
	players: Player[];
	dealerId: string;
	currentRound: GameRound | null;
	roundHistory: RoundSummary[];
	phase: SessionPhase;
	config: GameConfig;
	version: number;
	createdAt: number;
	updatedAt: number;
	/** Timestamp when all players disconnected; auto-close after 60s */
	allDisconnectedAt?: number;
	/** Kick votes: targetPlayerId -> voterPlayerIds */
	kickVotes?: Record<string, string[]>;
}

export interface RoundSummary {
	roundNumber: number;
	dealerId: string;
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
	turnStartedAt?: number;
	sessionCreatedAt: number;
	version: number;
	hostId: string;
	players: Array<{
		id: string;
		name: string;
		isDealer: boolean;
		isHost?: boolean;
		cardCount: number;
		hasDrawn: boolean;
		hasStood: boolean;
		cards?: Card[];
		result?: HandResult;
		netAmount?: number;
		bet: number;
		promptPayId?: string;
		connected?: boolean;
		emoji?: { emoji: string; timestamp: number };
		leftAt?: number;
	}>;
	myCards: Card[];
	myResult?: HandResult;
	roundNumber: number;
	roundHistory: RoundSummary[];
	cumulativeBalances: Record<string, number>;
	/** Map of playerId → their PromptPay ID for payment QR generation */
	playerPromptPayIds: Record<string, string>;
	/** Kick votes: targetId -> voterIds */
	kickVotes: Record<string, string[]>;
}

export interface PromptPayConfig {
	targetId: string;
	amount: number;
}

export interface GameConfig {
	allowAceHighStraight: boolean;
}
