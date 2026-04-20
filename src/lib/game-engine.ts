import type {
	Card,
	ClientGameView,
	GameConfig,
	GameSession,
	HandResult,
	HandType,
	PlayerInRound,
	Rank,
	RoundSummary,
	Suit,
} from "./types";

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

function createDeck(): Card[] {
	const deck: Card[] = [];
	for (const suit of SUITS) {
		for (const rank of RANKS) {
			deck.push({ suit, rank });
		}
	}
	return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
	const shuffled = [...deck];
	const randomValues = new Uint32Array(shuffled.length);
	crypto.getRandomValues(randomValues);
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = randomValues[i]! % (i + 1);
		[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
	}
	return shuffled;
}

function cardValue(card: Card): number {
	if (card.rank === "A") return 1;
	if (["J", "Q", "K", "10"].includes(card.rank)) return 10;
	return Number.parseInt(card.rank, 10);
}

function taem(cards: Card[]): number {
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

const sessions = new Map<string, GameSession>();
const sessionDecks = new Map<string, Card[]>();

function generateId(): string {
	const arr = new Uint8Array(8);
	crypto.getRandomValues(arr);
	return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function bump(session: GameSession): void {
	session.version++;
}

export function createSession(
	hostName: string,
	config?: Partial<GameConfig>,
): GameSession {
	const hostId = generateId();
	const sessionId = generateId();
	const session: GameSession = {
		id: sessionId,
		hostId,
		players: [{ id: hostId, name: hostName, isDealer: true }],
		dealerId: hostId,
		currentRound: null,
		roundHistory: [],
		phase: "lobby",
		config: { allowAceHighStraight: config?.allowAceHighStraight ?? false },
		version: 1,
		createdAt: Date.now(),
	};
	sessions.set(sessionId, session);
	return session;
}

export function joinSession(
	sessionId: string,
	playerName: string,
): { session: GameSession; playerId: string } {
	const session = sessions.get(sessionId);
	if (!session) throw new Error("Session not found");
	if (session.phase !== "lobby") throw new Error("Game already in progress");
	if (session.players.length >= 17)
		throw new Error("Session full (max 17 players)");

	const playerId = generateId();
	session.players.push({ id: playerId, name: playerName, isDealer: false });
	bump(session);
	return { session, playerId };
}

export function getSession(sessionId: string): GameSession | undefined {
	return sessions.get(sessionId);
}

export function listSessions(): Array<{
	id: string;
	hostName: string;
	playerCount: number;
	phase: string;
}> {
	const result: Array<{
		id: string;
		hostName: string;
		playerCount: number;
		phase: string;
	}> = [];
	for (const s of sessions.values()) {
		const host = s.players.find((p) => p.id === s.hostId);
		result.push({
			id: s.id,
			hostName: host?.name ?? "Unknown",
			playerCount: s.players.length,
			phase: s.phase,
		});
	}
	return result;
}

export function startBetting(sessionId: string, playerId: string): void {
	const session = sessions.get(sessionId);
	if (!session) throw new Error("Session not found");
	if (session.hostId !== playerId) throw new Error("Only host can start");
	if (session.players.length < 2) throw new Error("Need at least 2 players");

	const roundNumber = session.roundHistory.length + 1;
	const players: PlayerInRound[] = session.players
		.filter((p) => !p.isDealer)
		.map((p) => ({
			playerId: p.id,
			cards: [],
			bet: 0,
			hasDrawn: false,
			hasStood: false,
		}));

	const dealerPlayer: PlayerInRound = {
		playerId: session.dealerId,
		cards: [],
		bet: 0,
		hasDrawn: false,
		hasStood: false,
	};

	session.currentRound = {
		roundNumber,
		phase: "betting",
		players,
		dealerHand: dealerPlayer,
	};
	session.phase = "betting";
	bump(session);
}

export function placeBet(
	sessionId: string,
	playerId: string,
	amount: number,
): void {
	const session = sessions.get(sessionId);
	if (!session?.currentRound) throw new Error("No active round");
	if (session.currentRound.phase !== "betting")
		throw new Error("Not in betting phase");

	const player = session.currentRound.players.find(
		(p) => p.playerId === playerId,
	);
	if (!player) throw new Error("Player not in round");
	if (amount <= 0 || amount > 1000) throw new Error("Invalid bet amount");
	player.bet = amount;
	bump(session);
}

export function dealCards(sessionId: string, playerId: string): void {
	const session = sessions.get(sessionId);
	if (!session?.currentRound) throw new Error("No active round");
	if (session.hostId !== playerId) throw new Error("Only host can deal");

	const allBet = session.currentRound.players.every((p) => p.bet > 0);
	if (!allBet) throw new Error("Not all players have placed bets");

	const deck = shuffleDeck(createDeck());
	sessionDecks.set(sessionId, deck);

	let cardIndex = 0;

	for (const player of session.currentRound.players) {
		player.cards = [deck[cardIndex]!, deck[cardIndex + 1]!];
		cardIndex += 2;
	}

	session.currentRound.dealerHand!.cards = [
		deck[cardIndex]!,
		deck[cardIndex + 1]!,
	];
	cardIndex += 2;

	sessionDecks.set(sessionId, deck.slice(cardIndex));

	session.currentRound.phase = "playing";
	session.phase = "playing";
	bump(session);

	const evalOpts = {
		allowAceHighStraight: session.config.allowAceHighStraight,
	};

	const dealerResult = evaluateHand(
		session.currentRound.dealerHand!.cards,
		evalOpts,
	);
	if (dealerResult.handType === "pok") {
		resolveRound(sessionId);
		return;
	}

	const anyPlayerPok = session.currentRound.players.some((p) => {
		const r = evaluateHand(p.cards, evalOpts);
		return r.handType === "pok";
	});
	if (anyPlayerPok) {
		for (const p of session.currentRound.players) {
			const r = evaluateHand(p.cards, evalOpts);
			if (r.handType === "pok") {
				p.hasStood = true;
			}
		}
		const allPok = session.currentRound.players.every((p) => p.hasStood);
		if (allPok) {
			resolveRound(sessionId);
		}
	}
}

export function drawCard(sessionId: string, playerId: string): Card {
	const session = sessions.get(sessionId);
	if (!session?.currentRound) throw new Error("No active round");
	if (session.currentRound.phase !== "playing")
		throw new Error("Not in playing phase");

	const player = session.currentRound.players.find(
		(p) => p.playerId === playerId,
	);
	if (!player) throw new Error("Player not in round");
	if (player.hasDrawn || player.hasStood) throw new Error("Already acted");
	if (player.cards.length >= 3) throw new Error("Max 3 cards");

	const hand = evaluateHand(player.cards, {
		allowAceHighStraight: session.config.allowAceHighStraight,
	});
	if (hand.handType === "pok") throw new Error("Pok hand cannot draw");

	const deck = sessionDecks.get(sessionId);
	if (!deck || deck.length === 0) throw new Error("No cards left");

	const card = deck.shift()!;
	player.cards.push(card);
	player.hasDrawn = true;
	bump(session);

	checkAllPlayersActed(sessionId);
	return card;
}

export function stand(sessionId: string, playerId: string): void {
	const session = sessions.get(sessionId);
	if (!session?.currentRound) throw new Error("No active round");
	if (session.currentRound.phase !== "playing")
		throw new Error("Not in playing phase");

	const isDealer = playerId === session.dealerId;
	const player = isDealer
		? session.currentRound.dealerHand
		: session.currentRound.players.find((p) => p.playerId === playerId);
	if (!player) throw new Error("Player not in round");
	if (player.hasStood) throw new Error("Already stood");

	player.hasStood = true;
	bump(session);
	checkAllPlayersActed(sessionId);
}

export function dealerDraw(sessionId: string, playerId: string): Card {
	const session = sessions.get(sessionId);
	if (!session?.currentRound) throw new Error("No active round");
	if (playerId !== session.dealerId) throw new Error("Not the dealer");
	if (session.currentRound.dealerHand!.hasDrawn)
		throw new Error("Already drew");
	if (session.currentRound.dealerHand!.cards.length >= 3)
		throw new Error("Max 3 cards");

	const allPlayersActed = session.currentRound.players.every(
		(p) => p.hasDrawn || p.hasStood,
	);
	if (!allPlayersActed) throw new Error("Not all players have acted");

	const deck = sessionDecks.get(sessionId);
	if (!deck || deck.length === 0) throw new Error("No cards left");

	const card = deck.shift()!;
	session.currentRound.dealerHand!.cards.push(card);
	session.currentRound.dealerHand!.hasDrawn = true;
	bump(session);

	return card;
}

function checkAllPlayersActed(sessionId: string): void {
	const session = sessions.get(sessionId);
	if (!session?.currentRound) return;

	const allActed = session.currentRound.players.every(
		(p) => p.hasDrawn || p.hasStood,
	);
	if (!allActed) return;

	const dealer = session.currentRound.dealerHand!;
	if (dealer.hasDrawn || dealer.hasStood) {
		resolveRound(sessionId);
	}
}

export function resolveRound(sessionId: string): void {
	const session = sessions.get(sessionId);
	if (!session?.currentRound) return;

	const evalOpts = {
		allowAceHighStraight: session.config.allowAceHighStraight,
	};

	const dealerResult = evaluateHand(
		session.currentRound.dealerHand!.cards,
		evalOpts,
	);
	session.currentRound.dealerHand!.result = dealerResult;

	const roundResults: RoundSummary["results"] = [];

	for (const player of session.currentRound.players) {
		const playerResult = evaluateHand(player.cards, evalOpts);
		player.result = playerResult;

		const comparison = compareHands(playerResult, dealerResult, player.bet);
		player.netAmount = comparison.netAmount;

		const playerInfo = session.players.find((p) => p.id === player.playerId);
		roundResults.push({
			playerId: player.playerId,
			playerName: playerInfo?.name ?? "Unknown",
			bet: player.bet,
			netAmount: comparison.netAmount,
			taem: playerResult.score,
			handType: playerResult.handType,
			deng: playerResult.deng,
		});
	}

	session.roundHistory.push({
		roundNumber: session.currentRound.roundNumber,
		dealerTaem: dealerResult.score,
		dealerHandType: dealerResult.handType,
		dealerDeng: dealerResult.deng,
		results: roundResults,
	});

	session.currentRound.phase = "reveal";
	session.phase = "reveal";
	bump(session);
}

export function endSession(
	sessionId: string,
): Record<string, { name: string; balance: number }> {
	const session = sessions.get(sessionId);
	if (!session) throw new Error("Session not found");

	const balances: Record<string, { name: string; balance: number }> = {};
	for (const p of session.players) {
		balances[p.id] = { name: p.name, balance: 0 };
	}

	for (const round of session.roundHistory) {
		for (const result of round.results) {
			if (balances[result.playerId]) {
				balances[result.playerId].balance += result.netAmount;
			}
			if (balances[session.dealerId]) {
				balances[session.dealerId].balance -= result.netAmount;
			}
		}
	}

	session.phase = "ended";
	bump(session);
	return balances;
}

export function getClientView(
	sessionId: string,
	playerId: string,
): ClientGameView {
	const session = sessions.get(sessionId);
	if (!session) throw new Error("Session not found");

	const round = session.currentRound;
	const isReveal = round?.phase === "reveal";

	const players = session.players.map((p) => {
		const roundPlayer = round?.players.find((rp) => rp.playerId === p.id);
		const isDealer = p.id === session.dealerId;
		const dealerData = isDealer ? round?.dealerHand : undefined;
		const data = isDealer ? dealerData : roundPlayer;

		const isMe = p.id === playerId;
		const showCards = isReveal || isMe;

		return {
			id: p.id,
			name: p.name,
			isDealer,
			cardCount: data?.cards.length ?? 0,
			hasDrawn: data?.hasDrawn ?? false,
			hasStood: data?.hasStood ?? false,
			cards: showCards ? data?.cards : undefined,
			result: isReveal ? data?.result : undefined,
			netAmount: isReveal ? data?.netAmount : undefined,
			bet: data?.bet ?? 0,
		};
	});

	const myRoundData = round?.players.find((rp) => rp.playerId === playerId);
	const amDealer = playerId === session.dealerId;
	const myDealerData = amDealer ? round?.dealerHand : undefined;
	const myData = amDealer ? myDealerData : myRoundData;

	const cumulativeBalances: Record<string, number> = {};
	for (const p of session.players) {
		cumulativeBalances[p.id] = 0;
	}
	for (const r of session.roundHistory) {
		for (const result of r.results) {
			if (cumulativeBalances[result.playerId] !== undefined) {
				cumulativeBalances[result.playerId] += result.netAmount;
			}
			if (cumulativeBalances[session.dealerId] !== undefined) {
				cumulativeBalances[session.dealerId] -= result.netAmount;
			}
		}
	}

	return {
		sessionId,
		phase: session.phase,
		version: session.version,
		players,
		myCards: myData?.cards ?? [],
		myResult: isReveal ? myData?.result : undefined,
		roundNumber: round?.roundNumber ?? 0,
		roundHistory: session.roundHistory,
		cumulativeBalances,
	};
}

export function removeSession(sessionId: string): void {
	sessions.delete(sessionId);
	sessionDecks.delete(sessionId);
}
