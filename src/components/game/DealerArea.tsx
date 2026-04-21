import { Crown } from "lucide-react";
import { EmojiPopup } from "#/components/EmojiPopup";
import { CardBack, PlayingCard } from "#/components/PlayingCard";
import { useI18n } from "#/lib/i18n";
import type { ClientGameView } from "#/lib/types";
import { cardAnimStyle } from "./card-anim";
import { formatHandType } from "./game-utils";

interface DealerAreaProps {
	view: ClientGameView;
	dealer: ClientGameView["players"][number] | undefined;
	myPlayerId: string;
	dealAnimation: boolean;
	revealAnimation: boolean;
}

export function DealerArea({
	view,
	dealer,
	myPlayerId,
	dealAnimation,
	revealAnimation,
}: DealerAreaProps) {
	const { t } = useI18n();

	return (
		<div className="w-full flex flex-col items-center justify-start pt-2">
			{view.phase === "betting" && (
				<div className="mb-2 animate-bounce bg-yellow-500/20 text-yellow-300 px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(234,179,8,0.4)] border border-yellow-500/50 backdrop-blur-sm">
					{dealer?.id === myPlayerId
						? t("game.yourTurnToDeal")
						: t("game.turnToDeal", `${dealer?.name}'s`)}
				</div>
			)}
			<div className="relative mb-2">
				{dealer?.emoji && (
					<EmojiPopup
						key={dealer.emoji.timestamp}
						emoji={dealer.emoji.emoji}
						timestamp={dealer.emoji.timestamp}
					/>
				)}
				<div
					className={`bg-black/60 border rounded-2xl px-6 py-3 flex flex-col items-center backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.5)] transition-colors duration-500 ${view.phase === "reveal" && (dealer?.netAmount ?? 0) > 0 ? "border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.4)] bg-green-500/10" : "border-yellow-500/30"}`}
				>
					<Crown className="w-6 h-6 text-yellow-400 absolute -top-3 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
					<span className="text-white font-bold uppercase tracking-wider text-sm mt-1">
						{dealer?.name || t("game.dealer")}
					</span>
					<span
						className={`text-lg font-black font-mono ${(view.cumulativeBalances[dealer?.id || ""] ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}
					>
						{(view.cumulativeBalances[dealer?.id || ""] ?? 0) >= 0 ? "+" : ""}
						{view.cumulativeBalances[dealer?.id || ""] ?? 0}
					</span>
				</div>
			</div>

			{view.phase !== "lobby" && view.phase !== "betting" && (
				<div className="flex gap-2 justify-center mt-2 relative perspective-[1000px]">
					{(() => {
						if (!dealer) return null;
						if (dealer.cards && dealer.cards.length > 0) {
							return dealer.cards.map((card, i) => (
								<div
									key={`d-${card.suit}-${card.rank}-${i}`}
									style={cardAnimStyle(dealAnimation, revealAnimation, i)}
									className="shadow-2xl"
								>
									<PlayingCard card={card} />
								</div>
							));
						}
						return Array.from({ length: dealer.cardCount }, (_, i) => (
							<div key={`d-back-${i}`} className="shadow-2xl translate-y-2">
								<CardBack />
							</div>
						));
					})()}

					{view.phase === "reveal" && dealer?.result && (
						<div className="absolute -bottom-8 bg-black/80 border border-yellow-500/50 rounded-full px-4 py-1 flex items-center gap-2 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
							<span className="text-yellow-400 font-bold text-sm">
								{dealer.result.score}
							</span>
							{formatHandType(dealer.result, t) && (
								<span className="text-purple-300 text-xs font-semibold uppercase tracking-wider border-l border-white/20 pl-2">
									{formatHandType(dealer.result, t)}
								</span>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
