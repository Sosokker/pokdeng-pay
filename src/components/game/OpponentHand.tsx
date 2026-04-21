import { WifiOff, XCircle } from "lucide-react";
import { EmojiPopup } from "#/components/EmojiPopup";
import { CardBack, PlayingCard } from "#/components/PlayingCard";
import { useI18nSafe } from "#/lib/i18n";
import type { ClientGameView } from "#/lib/types";
import { cardAnimStyle } from "./card-anim";

export function OpponentHand({
	player,
	view,
	revealAnimation,
	index,
	alignRight = false,
	onKick,
	onVoteKick,
	myPlayerId,
}: {
	player: ClientGameView["players"][number];
	view: ClientGameView;
	revealAnimation: boolean;
	index: number;
	alignRight?: boolean;
	onKick?: (playerId: string, playerName: string) => void;
	onVoteKick?: (targetId: string, playerName: string) => void;
	myPlayerId: string;
}) {
	const { t } = useI18nSafe();
	const isLeft = !!player.leftAt;
	const isDisconnected = player.connected === false;
	const activePlayers = view.players.filter((p) => !p.leftAt);
	const majority = Math.ceil(activePlayers.length / 2);
	const votes = view.kickVotes?.[player.id]?.length ?? 0;
	const alreadyVoted =
		view.kickVotes?.[player.id]?.includes(myPlayerId) ?? false;
	const canVoteKick =
		onVoteKick &&
		!isLeft &&
		player.id !== myPlayerId &&
		(isDisconnected || view.phase === "betting" || view.phase === "playing");

	return (
		<div
			className={`relative flex flex-col ${alignRight ? "items-end" : "items-start"} pointer-events-auto transition-all duration-500 ${view.phase === "reveal" && (player.netAmount ?? 0) > 0 ? "scale-105" : ""} ${isLeft ? "opacity-40 grayscale" : ""}`}
		>
			{player.emoji && !isLeft && (
				<EmojiPopup
					key={player.emoji.timestamp}
					emoji={player.emoji.emoji}
					timestamp={player.emoji.timestamp}
				/>
			)}
			<div
				className={`bg-black/80 border rounded-full px-3 py-1 flex items-center gap-2 mb-1 backdrop-blur-sm z-10 transition-colors duration-500 ${alignRight ? "flex-row-reverse" : ""} ${view.phase === "reveal" && (player.netAmount ?? 0) > 0 ? "border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)] bg-green-500/10" : "border-white/10"}`}
			>
				{isLeft ? (
					<span className="text-[9px] text-red-400 font-bold bg-red-500/20 px-1 rounded">
						{t("game.playerLeft")}
					</span>
				) : isDisconnected ? (
					<WifiOff className="w-3 h-3 text-red-500" />
				) : (
					<div className="w-2 h-2 rounded-full bg-green-500" />
				)}
				<span className="text-white text-xs font-bold uppercase tracking-wider">
					{player.name}
				</span>
				{view.phase !== "lobby" && player.bet > 0 && (
					<span className="text-yellow-400 text-xs font-mono border-l border-white/20 pl-2">
						฿{player.bet}
					</span>
				)}
				{onKick && !isLeft && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onKick(player.id, player.name);
						}}
						className="text-red-400 hover:text-red-300 transition-colors ml-1"
						title={t("game.kickPlayer")}
					>
						<XCircle className="w-3.5 h-3.5" />
					</button>
				)}
			</div>

			{!isLeft && (
				<div className="flex items-center gap-1 mb-1">
					{!player.promptPayId && view.phase === "reveal" && (
						<span className="text-[8px] text-orange-400 bg-orange-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
							{t("game.noPromptPay")}
						</span>
					)}
					{canVoteKick && !alreadyVoted && (
						<button
							type="button"
							onClick={() => onVoteKick?.(player.id, player.name)}
							className="text-[8px] text-red-400 bg-red-500/20 hover:bg-red-500/30 px-1.5 py-0.5 rounded font-bold uppercase transition"
						>
							{t("game.voteKick")}
						</button>
					)}
					{votes > 0 && (
						<span className="text-[8px] text-red-300 bg-red-500/10 px-1 py-0.5 rounded font-mono">
							{t("game.voteKickCount", votes, majority)}
						</span>
					)}
				</div>
			)}

			<div
				className={`flex gap-1 ${alignRight ? "flex-row-reverse" : ""} perspective-[800px]`}
			>
				{view.phase === "reveal"
					? (player.cards?.map((card, ci: number) => (
							<div
								key={`${player.id}-${ci}`}
								style={cardAnimStyle(false, revealAnimation, index * 2 + ci)}
								className="transform scale-75 origin-top shadow-xl"
							>
								<PlayingCard card={card} small />
							</div>
						)) ??
						Array.from({ length: player.cardCount }, (_, i) => (
							<div
								key={`back-${i}`}
								className="transform scale-75 origin-top shadow-xl"
							>
								<CardBack small />
							</div>
						)))
					: Array.from({ length: player.cardCount || 0 }, (_, i) => (
							<div
								key={`back-${i}`}
								className="transform scale-75 origin-top shadow-xl"
							>
								<CardBack small />
							</div>
						))}
			</div>

			{view.phase === "reveal" && player.result && (
				<div
					className={`absolute top-full mt-[-10px] ${alignRight ? "right-0" : "left-0"} bg-black/90 border border-white/20 rounded-lg px-2 py-1 flex flex-col items-center shadow-lg z-20`}
				>
					<div className="flex items-center gap-1">
						<span className="text-white text-xs font-bold">
							{player.result.score}
						</span>
						{player.result.deng > 1 && (
							<span className="text-yellow-400 text-[10px] font-bold bg-yellow-500/20 px-1 rounded">
								{player.result.deng}D
							</span>
						)}
					</div>
					{player.result.handType !== "normal" && (
						<span className="text-purple-300 text-[9px] font-semibold uppercase">
							{t(`game.handType.${player.result.handType}` as const)}
						</span>
					)}
					{player.netAmount !== undefined && (
						<span
							className={`text-sm font-black font-mono ${player.netAmount >= 0 ? "text-green-400" : "text-red-400"}`}
						>
							{player.netAmount >= 0 ? "+" : ""}
							{player.netAmount}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
