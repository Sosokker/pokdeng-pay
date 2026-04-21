import {
	ArrowDown,
	CheckCircle,
	Crown,
	DoorOpen,
	HandCoins,
	Layers,
	Play,
	Square,
	Wallet,
} from "lucide-react";
import { EmojiPopup } from "#/components/EmojiPopup";
import { SqueezeCard } from "#/components/PlayingCard";
import { useI18n } from "#/lib/i18n";
import type { ClientGameView } from "#/lib/types";
import { cardAnimStyle } from "./card-anim";
import { formatHandType } from "./game-utils";
import { PokerChip } from "./PokerChip";

const BET_PRESETS = [10, 50, 100, 500];

interface PlayerAreaProps {
	view: ClientGameView;
	me: ClientGameView["players"][number] | undefined;
	myPlayerId: string;
	amDealer: boolean;
	isHost: boolean;
	allPlayersActed: boolean;
	squeezeEnabled: boolean;
	dealAnimation: boolean;
	drawAnimation: boolean;
	loading: boolean;
	betAmount: number;
	onBetAmountChange: (amount: number) => void;
	savedSettlement: Record<string, { name: string; balance: number }> | null;
	onPlaceBet: () => void;
	onDrawCard: () => void;
	onStand: () => void;
	onDealerDraw: () => void;
	onStartBetting: () => void;
	onDealCards: () => void;
	onEndSession: () => void;
	onLeave: () => void;
	onViewSettlement: () => void;
}

export function PlayerArea({
	view,
	me,
	myPlayerId,
	amDealer,
	isHost,
	allPlayersActed,
	squeezeEnabled,
	dealAnimation,
	drawAnimation,
	loading,
	betAmount,
	onBetAmountChange,
	savedSettlement,
	onPlaceBet,
	onDrawCard,
	onStand,
	onDealerDraw,
	onStartBetting,
	onDealCards,
	onEndSession,
	onLeave,
	onViewSettlement,
}: PlayerAreaProps) {
	const { t } = useI18n();

	return (
		<div className="w-full flex flex-col items-center justify-end pb-8 z-10 relative">
			{me?.emoji && (
				<EmojiPopup
					key={me.emoji.timestamp}
					emoji={me.emoji.emoji}
					timestamp={me.emoji.timestamp}
				/>
			)}
			{!amDealer && view.phase !== "lobby" && view.phase !== "betting" && (
				<div className="relative flex justify-center perspective-[1000px] mb-6 mt-12">
					<div className="flex gap-2">
						{view.myCards.map((card, i) => {
							const isThirdCard = i === 2 && view.myCards.length === 3;
							const animStyle =
								cardAnimStyle(dealAnimation, false, i) ??
								(isThirdCard && drawAnimation
									? { animation: "draw-in 0.4s ease-out both" }
									: undefined);
							return (
								<div
									key={`my-${card.suit}-${card.rank}-${i}`}
									style={animStyle}
									className="transform transition-transform hover:-translate-y-4 hover:z-10 shadow-2xl"
								>
									<div className="scale-110 md:scale-125 transform origin-bottom">
										<SqueezeCard
											card={card}
											squeezeEnabled={squeezeEnabled}
											forceReveal={view.phase === "reveal"}
										/>
									</div>
								</div>
							);
						})}
					</div>

					{view.myResult && (
						<div className="absolute -top-12 bg-blue-900/80 border border-blue-400/50 rounded-full px-5 py-1.5 flex items-center gap-3 backdrop-blur-sm shadow-[0_0_20px_rgba(59,130,246,0.4)] animate-in fade-in slide-in-from-bottom-4">
							<span className="text-white font-bold text-lg">
								{view.myResult.score}
							</span>
							{formatHandType(view.myResult, t) && (
								<span className="text-purple-200 text-xs font-semibold uppercase tracking-wider border-l border-white/30 pl-3">
									{formatHandType(view.myResult, t)}
								</span>
							)}
						</div>
					)}
					{me?.netAmount !== undefined && view.phase === "reveal" && (
						<div
							className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl md:text-6xl font-black font-mono tracking-tighter drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] z-50 ${me.netAmount >= 0 ? "text-green-400 animate-[pulse-glow_2s_infinite]" : "text-red-500"}`}
						>
							{me.netAmount >= 0 ? "+" : ""}
							{me.netAmount}
						</div>
					)}
				</div>
			)}

			<div className="w-full max-w-xl bg-[#18181B]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-center justify-between gap-4">
				<div className="flex items-center gap-4">
					<div className="flex flex-col">
						<span className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
							{t("game.yourHand")}
						</span>
						<span className="text-white font-bold text-lg">
							{me?.name || "Player"}{" "}
							{amDealer && (
								<Crown className="w-4 h-4 text-yellow-400 inline ml-1" />
							)}
						</span>
					</div>
					<div className="h-10 w-px bg-white/10 mx-2 hidden md:block" />
					<div className="flex flex-col text-right md:text-left">
						<span className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
							{t("game.balance")}
						</span>
						<span
							className={`font-mono font-bold text-lg ${(view.cumulativeBalances[myPlayerId] ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}
						>
							{(view.cumulativeBalances[myPlayerId] ?? 0) >= 0 ? "+" : ""}
							{view.cumulativeBalances[myPlayerId] ?? 0}
						</span>
					</div>
				</div>

				<div className="flex gap-2 w-full md:w-auto">
					{view.phase === "betting" && !amDealer && (me?.bet ?? 0) === 0 && (
						<div className="flex flex-col gap-3 w-full">
							<div className="flex justify-center gap-2">
								{BET_PRESETS.map((preset) => (
									<PokerChip
										key={preset}
										amount={preset}
										active={betAmount === preset}
										onClick={() => onBetAmountChange(preset)}
									/>
								))}
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									disabled={loading}
									onClick={onPlaceBet}
									className="flex-1 py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-black uppercase tracking-widest rounded-xl shadow-[0_0_15px_rgba(202,138,4,0.4)] disabled:opacity-50 disabled:grayscale transition-all active:scale-95 flex items-center justify-center gap-2"
								>
									<HandCoins className="w-5 h-5" /> {t("game.placeBet")} (
									{betAmount})
								</button>
							</div>
						</div>
					)}

					{view.phase === "betting" && !amDealer && (me?.bet ?? 0) > 0 && (
						<div className="flex-1 py-3 px-6 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 font-bold flex items-center justify-center gap-2">
							<CheckCircle className="w-5 h-5" /> {t("game.betPlaced")}:{" "}
							{me?.bet}
						</div>
					)}

					{view.phase === "playing" &&
						!amDealer &&
						me &&
						!me.hasDrawn &&
						!me.hasStood && (
							<div className="flex gap-2 w-full">
								<button
									type="button"
									disabled={loading}
									onClick={onDrawCard}
									className="flex-1 py-3 bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-bold uppercase tracking-widest rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2"
								>
									<ArrowDown className="w-4 h-4" /> {t("game.draw")}
								</button>
								<button
									type="button"
									disabled={loading}
									onClick={onStand}
									className="flex-1 py-3 bg-gradient-to-br from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 text-white font-bold uppercase tracking-widest rounded-xl border border-gray-600 transition-all active:scale-95 flex items-center justify-center gap-2"
								>
									<Square className="w-4 h-4" /> {t("game.stand")}
								</button>
							</div>
						)}

					{view.phase === "playing" &&
						amDealer &&
						allPlayersActed &&
						!me?.hasDrawn &&
						!me?.hasStood && (
							<div className="flex gap-2 w-full">
								<button
									type="button"
									disabled={loading}
									onClick={onDealerDraw}
									className="flex-1 py-3 bg-gradient-to-br from-blue-600 to-blue-800 text-white font-bold uppercase tracking-widest rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2"
								>
									<ArrowDown className="w-4 h-4" /> {t("game.draw")}
								</button>
								<button
									type="button"
									disabled={loading}
									onClick={onStand}
									className="flex-1 py-3 bg-gradient-to-br from-gray-700 to-gray-900 text-white font-bold uppercase tracking-widest rounded-xl border border-gray-600 transition-all active:scale-95 flex items-center justify-center gap-2"
								>
									<Square className="w-4 h-4" /> {t("game.stand")}
								</button>
							</div>
						)}

					{view.phase === "lobby" && !isHost && (
						<div className="flex-1 py-3 px-6 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-semibold uppercase tracking-widest text-sm flex items-center justify-center text-center animate-pulse">
							{t("game.waitingHost")}
						</div>
					)}
					{view.phase === "playing" &&
						!amDealer &&
						me &&
						(me.hasDrawn || me.hasStood) && (
							<div className="flex-1 py-3 px-6 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-semibold uppercase tracking-widest text-sm flex items-center justify-center text-center animate-pulse">
								{t("game.waitingOthers")}
							</div>
						)}
					{view.phase === "playing" && amDealer && !allPlayersActed && (
						<div className="flex-1 py-3 px-6 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-semibold uppercase tracking-widest text-sm flex items-center justify-center text-center animate-pulse">
							{t("game.waitingPlayers")}
						</div>
					)}

					{isHost && view.phase === "lobby" && (
						<button
							type="button"
							disabled={loading || view.players.length < 2}
							onClick={onStartBetting}
							className="w-full py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-black uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.4)] disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
						>
							<Play className="w-5 h-5 fill-current" /> {t("game.startGame")}
						</button>
					)}
					{amDealer && view.phase === "betting" && (
						<button
							type="button"
							disabled={loading}
							onClick={onDealCards}
							className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2"
						>
							<Layers className="w-5 h-5" /> {t("game.dealCards")}
						</button>
					)}
					{view.phase === "reveal" && (
						<div className="flex gap-2 w-full">
							{amDealer && (
								<button
									type="button"
									disabled={loading}
									onClick={onStartBetting}
									className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-500 text-white font-black uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
								>
									<Play className="w-4 h-4 fill-current" />{" "}
									{t("game.nextRound")}
								</button>
							)}
							{isHost && (
								<button
									type="button"
									disabled={loading}
									onClick={onEndSession}
									className="py-3 px-4 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold uppercase tracking-wider rounded-xl border border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
								>
									{t("game.end")}
								</button>
							)}
							{!amDealer && !isHost && (
								<div className="flex-1 py-3 px-6 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-semibold uppercase tracking-widest text-sm flex items-center justify-center text-center animate-pulse">
									{t("game.waitingNextRound")}
								</div>
							)}
						</div>
					)}
					{view.phase === "ended" && (
						<div className="flex gap-2 w-full">
							{savedSettlement && (
								<button
									type="button"
									onClick={onViewSettlement}
									className="flex-1 py-3 px-4 bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-bold uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(202,138,4,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
								>
									<Wallet className="w-4 h-4" /> {t("game.viewSettlement")}
								</button>
							)}
							<button
								type="button"
								onClick={onLeave}
								className="py-3 px-4 bg-gradient-to-r from-gray-700 to-gray-900 text-white font-bold uppercase tracking-wider rounded-xl border border-gray-600 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
							>
								<DoorOpen className="w-4 h-4" /> {t("game.leave")}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
