import { describe, expect, it } from "vitest";
import { compareHands, evaluateHand } from "../lib/game-engine";
import type { Card } from "../lib/types";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
	return { rank, suit };
}

describe("evaluateHand", () => {
	describe("2-card hands", () => {
		it("Pok 9 (no deng) = pok, 1 deng", () => {
			const hand = [c("9", "hearts"), c("10", "spades")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(9);
			expect(result.handType).toBe("pok");
			expect(result.deng).toBe(1);
		});

		it("Pok 9 with pair = pok, 2 deng", () => {
			const hand = [c("9", "hearts"), c("9", "spades")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(8);
			expect(result.handType).toBe("pok");
			expect(result.deng).toBe(2);
		});

		it("Pok 8 (no deng) = pok, 1 deng", () => {
			const hand = [c("3", "hearts"), c("5", "spades")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(8);
			expect(result.handType).toBe("pok");
			expect(result.deng).toBe(1);
		});

		it("Pok 9 with flush = pok, 2 deng", () => {
			const hand = [c("4", "hearts"), c("5", "hearts")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(9);
			expect(result.handType).toBe("pok");
			expect(result.deng).toBe(2);
		});

		it("Non-pok with pair = normal, 2 deng", () => {
			const hand = [c("3", "hearts"), c("3", "spades")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(6);
			expect(result.handType).toBe("normal");
			expect(result.deng).toBe(2);
		});

		it("Non-pok with flush = normal, 2 deng", () => {
			const hand = [c("2", "hearts"), c("5", "hearts")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(7);
			expect(result.handType).toBe("normal");
			expect(result.deng).toBe(2);
		});

		it("Non-pok normal hand = normal, 1 deng", () => {
			const hand = [c("3", "hearts"), c("4", "spades")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(7);
			expect(result.handType).toBe("normal");
			expect(result.deng).toBe(1);
		});
	});

	describe("3-card hands", () => {
		it("Tong (three of a kind) = 5 deng", () => {
			const hand = [c("7", "hearts"), c("7", "diamonds"), c("7", "clubs")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(1);
			expect(result.handType).toBe("tong");
			expect(result.deng).toBe(5);
		});

		it("Sam Lueang (3 face cards) = 3 deng", () => {
			const hand = [c("J", "hearts"), c("Q", "diamonds"), c("K", "clubs")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(0);
			expect(result.handType).toBe("sam-lueang");
			expect(result.deng).toBe(3);
		});

		it("Straight flush (riang plus) = 5 deng", () => {
			const hand = [c("5", "diamonds"), c("6", "diamonds"), c("7", "diamonds")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(8);
			expect(result.handType).toBe("normal");
			expect(result.deng).toBe(5);
		});

		it("Straight (riang) = 3 deng", () => {
			const hand = [c("2", "spades"), c("3", "diamonds"), c("4", "clubs")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(9);
			expect(result.handType).toBe("normal");
			expect(result.deng).toBe(3);
		});

		it("Flush (sam deng) = 3 deng", () => {
			const hand = [c("2", "hearts"), c("5", "hearts"), c("9", "hearts")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(6);
			expect(result.handType).toBe("normal");
			expect(result.deng).toBe(3);
		});

		it("Pair in 3 cards = 2 deng", () => {
			const hand = [c("5", "hearts"), c("5", "spades"), c("3", "clubs")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(3);
			expect(result.handType).toBe("normal");
			expect(result.deng).toBe(2);
		});

		it("Normal 3-card hand = 1 deng", () => {
			const hand = [c("2", "hearts"), c("4", "spades"), c("7", "clubs")];
			const result = evaluateHand(hand);
			expect(result.score).toBe(3);
			expect(result.handType).toBe("normal");
			expect(result.deng).toBe(1);
		});
	});

	describe("Card values (taem)", () => {
		it("A = 1", () => {
			expect(evaluateHand([c("A", "hearts"), c("3", "spades")]).score).toBe(4);
		});

		it("10/J/Q/K = 0 mod 10", () => {
			expect(evaluateHand([c("10", "hearts"), c("K", "spades")]).score).toBe(0);
		});

		it("7 + 8 = 15 -> taem 5", () => {
			expect(evaluateHand([c("7", "hearts"), c("8", "spades")]).score).toBe(5);
		});
	});
});

describe("compareHands", () => {
	const BET = 100;

	it("Pok beats normal hand", () => {
		const pok = evaluateHand([c("5", "hearts"), c("4", "clubs")]); // Pok 9, 1 deng
		const normal = evaluateHand([
			c("3", "hearts"),
			c("6", "spades"),
			c("7", "clubs"),
		]); // 6 taem, normal 1 deng
		const result = compareHands(pok, normal, BET);
		expect(result.winner).toBe("player");
		expect(result.netAmount).toBe(BET * 1);
	});

	it("Pok with 2 deng beats normal, payout = 2x", () => {
		const pokDeng = evaluateHand([c("4", "hearts"), c("5", "hearts")]); // Pok 9, flush = 2 deng
		const normal = evaluateHand([
			c("2", "hearts"),
			c("5", "spades"),
			c("3", "clubs"),
		]); // 0 taem, normal
		const result = compareHands(pokDeng, normal, BET);
		expect(result.winner).toBe("player");
		expect(result.netAmount).toBe(BET * 2);
	});

	it("Higher taem wins within same hand type", () => {
		const pok9 = evaluateHand([c("9", "hearts"), c("10", "spades")]); // Pok 9
		const pok8 = evaluateHand([c("3", "hearts"), c("5", "spades")]); // Pok 8
		const result = compareHands(pok9, pok8, BET);
		expect(result.winner).toBe("player");
	});

	it("Tong beats Sam Lueang, payout = 2x (5-3 deng)", () => {
		const tong = evaluateHand([
			c("K", "hearts"),
			c("K", "diamonds"),
			c("K", "clubs"),
		]);
		const samLueang = evaluateHand([
			c("J", "hearts"),
			c("Q", "diamonds"),
			c("K", "clubs"),
		]);
		const result = compareHands(tong, samLueang, BET);
		expect(result.winner).toBe("player");
		expect(result.netAmount).toBe(BET * 2); // 5 - 3 = 2
	});

	it("Same taem, higher deng wins by difference", () => {
		// Normal 5 taem, 3 deng (flush only, not straight)
		const hand1 = evaluateHand([
			c("2", "clubs"),
			c("4", "clubs"),
			c("9", "clubs"),
		]); // 15→5 taem, flush=3d
		// Normal 5 taem, 1 deng
		const hand2 = evaluateHand([
			c("K", "hearts"),
			c("2", "spades"),
			c("3", "clubs"),
		]); // 15→5 taem, 1d
		const result = compareHands(hand1, hand2, BET);
		expect(result.winner).toBe("player");
		expect(result.netAmount).toBe(BET * 2); // 3 - 1 = 2
	});

	it("Complete tie returns 0", () => {
		const hand1 = evaluateHand([c("3", "hearts"), c("4", "spades")]); // 7, 1 deng
		const hand2 = evaluateHand([c("2", "hearts"), c("5", "spades")]); // 7, 1 deng
		const result = compareHands(hand1, hand2, BET);
		expect(result.winner).toBe("tie");
		expect(result.netAmount).toBe(0);
	});

	it("Dealer wins when hand type is better", () => {
		const player = evaluateHand([
			c("3", "hearts"),
			c("4", "spades"),
			c("7", "clubs"),
		]); // 4 taem, normal
		const dealer = evaluateHand([c("9", "hearts"), c("10", "spades")]); // Pok 9
		const result = compareHands(player, dealer, BET);
		expect(result.winner).toBe("dealer");
	});
});
