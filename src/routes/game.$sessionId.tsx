import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowDown,
	CheckCircle,
	Crown,
	DoorOpen,
	HandCoins,
	Layers,
	Play,
	RotateCcw,
	Square,
	Users,
	Volume2,
	VolumeX,
	XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useState } from "react";
import { CardBack, PlayingCard } from "#/components/PlayingCard";
import { useSounds } from "#/hooks/use-sounds";
import {
	dealCardsFn,
	dealerDrawFn,
	drawCardFn,
	endSessionFn,
	generateQrPayloadFn,
	getGameViewFn,
	placeBetFn,
	standFn,
	startBettingFn,
} from "#/lib/server-fns";
import type { ClientGameView } from "#/lib/types";

export const Route = createFileRoute("/game/$sessionId")({
	loader: async ({ params }) => {
		return { sessionId: params.sessionId };
	},
	component: GamePage,
});

function GamePage() {
	const { sessionId } = Route.useLoaderData();
	const navigate = useNavigate();
	const { play, muted, toggleMute } = useSounds();
	const [view, setView] = useState<ClientGameView | null>(null);
	const [betAmount, setBetAmount] = useState(50);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [settlement, setSettlement] = useState<Record<
		string,
		{ name: string; balance: number }
	> | null>(null);
	const [qrPayload, setQrPayload] = useState("");
	const [promptPayId, setPromptPayId] = useState("");
	const [showQr, setShowQr] = useState(false);
	const [paymentStatus, setPaymentStatus] = useState<
		Record<string, "pending" | "confirmed" | "disputed">
	>({});

	const getPlayerId = useCallback((): string => {
		return sessionStorage.getItem(`player_${sessionId}`) ?? "";
	}, [sessionId]);

	const refreshView = useCallback(async () => {
		const playerId = getPlayerId();
		if (!playerId) return;
		try {
			const data = await getGameViewFn({ data: { sessionId, playerId } });
			setView(data);
			setError("");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load game");
		}
	}, [sessionId, getPlayerId]);

	const [initialized, setInitialized] = useState(false);
	if (!initialized && typeof window !== "undefined") {
		setInitialized(true);
		setTimeout(() => refreshView(), 0);
	}

	const myPlayerId = typeof window !== "undefined" ? getPlayerId() : "";

	async function handleAction(
		action: () => Promise<unknown>,
		sound?: "card-flip" | "bet-place" | "deal" | "click" | "win" | "lose",
	) {
		setLoading(true);
		setError("");
		try {
			await action();
			if (sound) play(sound);
			await refreshView();
		} catch (e) {
			play("lose");
			setError(e instanceof Error ? e.message : "Action failed");
		} finally {
			setLoading(false);
		}
	}

	const isHost = view?.players.find((p) => p.isDealer)?.id === myPlayerId;
	const amDealer =
		view?.players.find((p) => p.id === myPlayerId)?.isDealer ?? false;
	const me = view?.players.find((p) => p.id === myPlayerId);
	const allPlayersActed =
		view?.players
			.filter((p) => !p.isDealer)
			.every((p) => p.hasDrawn || p.hasStood) ?? false;

	if (!view) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<div className="text-[#71717A]">Loading game...</div>
			</div>
		);
	}

	function formatHandType(
		result: { handType: string; deng: number } | undefined,
	): string {
		if (!result) return "";
		const labels: Record<string, string> = {
			pok: "Pok",
			tong: "Tong",
			"sam-lueang": "Sam Lueang",
			normal: "",
		};
		const label = labels[result.handType] ?? result.handType;
		const parts: string[] = [];
		if (label) parts.push(label);
		if (result.deng > 1) parts.push(`${result.deng} Deng`);
		return parts.join(", ");
	}

	return (
		<div className="max-w-6xl mx-auto space-y-6">
			{/* Header Bar */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-white">
						Round {view.roundNumber || "-"}
					</h1>
					<p className="text-[#A1A1AA] text-sm">
						Phase:{" "}
						<span className="text-white font-medium capitalize">
							{view.phase}
						</span>{" "}
						&middot; {view.players.length} players
					</p>
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={toggleMute}
						className="p-2 bg-[#27272A] border border-[#3F3F46] rounded-lg hover:bg-[#3F3F46] text-[#A1A1AA] transition-colors"
						title={muted ? "Unmute" : "Mute"}
					>
						{muted ? (
							<VolumeX className="w-4 h-4" />
						) : (
							<Volume2 className="w-4 h-4" />
						)}
					</button>
					<button
						type="button"
						onClick={() => refreshView()}
						className="p-2 bg-[#27272A] border border-[#3F3F46] rounded-lg hover:bg-[#3F3F46] text-[#A1A1AA] transition-colors"
						title="Refresh"
					>
						<RotateCcw className="w-4 h-4" />
					</button>
					<button
						type="button"
						onClick={() => navigate({ to: "/" })}
						className="p-2 bg-[#27272A] border border-[#3F3F46] rounded-lg hover:bg-[#3F3F46] text-[#A1A1AA] transition-colors"
						title="Leave"
					>
						<DoorOpen className="w-4 h-4" />
					</button>
				</div>
			</div>

			{error && (
				<div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
					{error}
				</div>
			)}

			{/* Scoreboard */}
			<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-4">
				<h3 className="text-sm font-semibold text-[#A1A1AA] mb-3 flex items-center gap-2">
					<Users className="w-4 h-4" />
					Players & Balances
				</h3>
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
					{view.players.map((p) => (
						<div
							key={p.id}
							className={`p-3 rounded-lg border ${
								p.id === myPlayerId
									? "border-blue-500 bg-blue-500/10"
									: "border-[#3F3F46] bg-[#18181B]"
							}`}
						>
							<div className="flex items-center gap-2 mb-1">
								{p.isDealer && <Crown className="w-3 h-3 text-yellow-400" />}
								<span className="text-white text-sm font-medium truncate">
									{p.name}
									{p.id === myPlayerId && " (You)"}
								</span>
							</div>
							<div
								className={`text-lg font-bold ${
									(view.cumulativeBalances[p.id] ?? 0) >= 0
										? "text-green-400"
										: "text-red-400"
								}`}
							>
								{(view.cumulativeBalances[p.id] ?? 0) >= 0 ? "+" : ""}
								{view.cumulativeBalances[p.id] ?? 0}
							</div>
							{view.phase !== "lobby" && !p.isDealer && (
								<div className="text-xs text-[#71717A] mt-1">Bet: {p.bet}</div>
							)}
						</div>
					))}
				</div>
			</div>

			{/* Dealer's Hand */}
			{view.phase !== "lobby" && view.phase !== "betting" && (
				<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-4">
					<h3 className="text-sm font-semibold text-[#A1A1AA] mb-3 flex items-center gap-2">
						<Crown className="w-4 h-4 text-yellow-400" />
						Dealer&apos;s Hand
					</h3>
					<div className="flex gap-2">
						{(() => {
							const dealer = view.players.find((p) => p.isDealer);
							if (!dealer) return null;
							if (dealer.cards && dealer.cards.length > 0) {
								return dealer.cards.map((card, i) => (
									<PlayingCard
										key={`${card.suit}-${card.rank}-d${String(i)}`}
										card={card}
									/>
								));
							}
							return Array.from({ length: dealer.cardCount }, (_, i) => (
								<CardBack key={`dealer-back-${String(i)}`} />
							));
						})()}
					</div>
					{view.phase === "reveal" &&
						(() => {
							const dealer = view.players.find((p) => p.isDealer);
							if (!dealer?.result) return null;
							return (
								<div className="mt-2 text-sm">
									<span className="text-yellow-400 font-medium">
										Taem: {dealer.result.score}
									</span>
									{formatHandType(dealer.result) && (
										<span className="ml-2 text-purple-400">
											{formatHandType(dealer.result)}
										</span>
									)}
								</div>
							);
						})()}
				</div>
			)}

			{/* My Hand (non-dealer) */}
			{!amDealer && view.phase !== "lobby" && view.phase !== "betting" && (
				<div className="bg-[#27272A] border border-blue-500/50 rounded-xl p-4">
					<h3 className="text-sm font-semibold text-blue-400 mb-3">
						Your Hand
					</h3>
					<div className="flex gap-2">
						{view.myCards.map((card, i) => (
							<PlayingCard
								key={`my-${card.suit}-${card.rank}-${String(i)}`}
								card={card}
							/>
						))}
					</div>
					{view.myResult && (
						<div className="mt-2 text-sm">
							<span className="text-blue-400 font-medium">
								Taem: {view.myResult.score}
							</span>
							{formatHandType(view.myResult) && (
								<span className="ml-2 text-purple-400">
									{formatHandType(view.myResult)}
								</span>
							)}
						</div>
					)}
					{me?.netAmount !== undefined && (
						<div
							className={`mt-1 text-lg font-bold ${
								me.netAmount >= 0 ? "text-green-400" : "text-red-400"
							}`}
						>
							{me.netAmount >= 0 ? "+" : ""}
							{me.netAmount}
						</div>
					)}
				</div>
			)}

			{/* Other Players Hands (during reveal) */}
			{view.phase === "reveal" && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{view.players
						.filter((p) => !p.isDealer && p.id !== myPlayerId)
						.map((p) => (
							<div
								key={p.id}
								className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-4"
							>
								<h3 className="text-sm font-semibold text-[#A1A1AA] mb-2">
									{p.name}
								</h3>
								<div className="flex gap-2">
									{p.cards?.map((card, i) => (
										<PlayingCard
											key={`${p.id}-${card.suit}-${card.rank}-${String(i)}`}
											card={card}
											small
										/>
									)) ??
										Array.from({ length: p.cardCount }, (_, i) => (
											<CardBack key={`${p.id}-back-${String(i)}`} small />
										))}
								</div>
								{p.result && (
									<div className="mt-2 text-sm">
										<span className="text-white">Taem: {p.result.score}</span>
										{formatHandType(p.result) && (
											<span className="ml-2 text-purple-400">
												{formatHandType(p.result)}
											</span>
										)}
										{p.netAmount !== undefined && (
											<span
												className={`ml-2 font-bold ${
													p.netAmount >= 0 ? "text-green-400" : "text-red-400"
												}`}
											>
												{p.netAmount >= 0 ? "+" : ""}
												{p.netAmount}
											</span>
										)}
									</div>
								)}
							</div>
						))}
				</div>
			)}

			{/* Action Buttons */}
			<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-4">
				<h3 className="text-sm font-semibold text-[#A1A1AA] mb-3">Actions</h3>
				<div className="flex flex-wrap gap-3 items-center">
					{view.phase === "lobby" && isHost && (
						<button
							type="button"
							disabled={loading || view.players.length < 2}
							onClick={() =>
								handleAction(
									() =>
										startBettingFn({
											data: { sessionId, playerId: myPlayerId },
										}),
									"click",
								)
							}
							className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
						>
							<Play className="w-4 h-4" />
							Start Round
						</button>
					)}

					{view.phase === "lobby" && !isHost && (
						<p className="text-[#71717A] text-sm">
							Waiting for host to start...
						</p>
					)}

					{view.phase === "betting" && !amDealer && (
						<>
							<div className="flex items-center gap-2">
								<label htmlFor="betInput" className="text-[#A1A1AA] text-sm">
									Bet:
								</label>
								<input
									id="betInput"
									type="number"
									min={1}
									max={1000}
									value={betAmount}
									onChange={(e) => setBetAmount(Number(e.target.value))}
									className="w-24 px-2 py-1.5 bg-[#18181B] border border-[#3F3F46] rounded-lg text-white text-sm"
								/>
							</div>
							<button
								type="button"
								disabled={loading}
								onClick={() =>
									handleAction(
										() =>
											placeBetFn({
												data: {
													sessionId,
													playerId: myPlayerId,
													amount: betAmount,
												},
											}),
										"bet-place",
									)
								}
								className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
							>
								<HandCoins className="w-4 h-4" />
								Place Bet
							</button>
						</>
					)}

					{view.phase === "betting" && isHost && (
						<button
							type="button"
							disabled={loading}
							onClick={() =>
								handleAction(
									() =>
										dealCardsFn({ data: { sessionId, playerId: myPlayerId } }),
									"deal",
								)
							}
							className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
						>
							<Layers className="w-4 h-4" />
							Deal Cards
						</button>
					)}

					{view.phase === "playing" &&
						!amDealer &&
						me &&
						!me.hasDrawn &&
						!me.hasStood && (
							<>
								<button
									type="button"
									disabled={loading}
									onClick={() =>
										handleAction(
											() =>
												drawCardFn({
													data: { sessionId, playerId: myPlayerId },
												}),
											"card-flip",
										)
									}
									className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
								>
									<ArrowDown className="w-4 h-4" />
									Draw
								</button>
								<button
									type="button"
									disabled={loading}
									onClick={() =>
										handleAction(
											() =>
												standFn({ data: { sessionId, playerId: myPlayerId } }),
											"click",
										)
									}
									className="flex items-center gap-2 px-4 py-2 bg-[#3F3F46] hover:bg-[#52525B] disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
								>
									<Square className="w-4 h-4" />
									Stand
								</button>
							</>
						)}

					{view.phase === "playing" &&
						amDealer &&
						allPlayersActed &&
						!me?.hasDrawn &&
						!me?.hasStood && (
							<>
								<button
									type="button"
									disabled={loading}
									onClick={() =>
										handleAction(
											() =>
												dealerDrawFn({
													data: { sessionId, playerId: myPlayerId },
												}),
											"card-flip",
										)
									}
									className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
								>
									<ArrowDown className="w-4 h-4" />
									Draw
								</button>
								<button
									type="button"
									disabled={loading}
									onClick={() =>
										handleAction(
											() =>
												standFn({ data: { sessionId, playerId: myPlayerId } }),
											"click",
										)
									}
									className="flex items-center gap-2 px-4 py-2 bg-[#3F3F46] hover:bg-[#52525B] disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
								>
									<Square className="w-4 h-4" />
									Stand
								</button>
							</>
						)}

					{view.phase === "playing" &&
						!amDealer &&
						me &&
						(me.hasDrawn || me.hasStood) && (
							<p className="text-[#71717A] text-sm">
								Waiting for other players and dealer...
							</p>
						)}

					{view.phase === "playing" && amDealer && !allPlayersActed && (
						<p className="text-[#71717A] text-sm">
							Waiting for players to act...
						</p>
					)}

					{view.phase === "reveal" && isHost && (
						<>
							<button
								type="button"
								disabled={loading}
								onClick={() =>
									handleAction(
										() =>
											startBettingFn({
												data: { sessionId, playerId: myPlayerId },
											}),
										"click",
									)
								}
								className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
							>
								<Play className="w-4 h-4" />
								Next Round
							</button>
							<button
								type="button"
								disabled={loading}
								onClick={async () => {
									setLoading(true);
									try {
										const balances = await endSessionFn({
											data: { sessionId },
										});
										setSettlement(balances);
										play("deal");
									} catch (e) {
										setError(
											e instanceof Error ? e.message : "Failed to end session",
										);
									} finally {
										setLoading(false);
									}
								}}
								className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
							>
								<DoorOpen className="w-4 h-4" />
								End Session &amp; Settle
							</button>
						</>
					)}

					{view.phase === "reveal" && !isHost && (
						<p className="text-[#71717A] text-sm">
							Waiting for host to start next round or end session...
						</p>
					)}
				</div>
			</div>

			{/* Settlement with Manual Payment Resolution */}
			{settlement && (
				<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-6 space-y-6">
					<h2 className="text-xl font-bold text-white">Session Settlement</h2>

					{/* Balance Summary */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{Object.entries(settlement).map(([pid, info]) => (
							<div
								key={pid}
								className={`p-4 rounded-lg border ${
									info.balance >= 0
										? "border-green-500/30 bg-green-500/5"
										: "border-red-500/30 bg-red-500/5"
								}`}
							>
								<div className="flex items-center justify-between">
									<p className="text-white font-medium">{info.name}</p>
									{paymentStatus[pid] && (
										<span
											className={`text-xs px-2 py-0.5 rounded-full ${
												paymentStatus[pid] === "confirmed"
													? "bg-green-500/20 text-green-400"
													: paymentStatus[pid] === "disputed"
														? "bg-red-500/20 text-red-400"
														: "bg-yellow-500/20 text-yellow-400"
											}`}
										>
											{paymentStatus[pid]}
										</span>
									)}
								</div>
								<p
									className={`text-2xl font-bold ${
										info.balance >= 0 ? "text-green-400" : "text-red-400"
									}`}
								>
									{info.balance >= 0 ? "+" : ""}
									{info.balance} THB
								</p>
								{info.balance < 0 && paymentStatus[pid] !== "confirmed" && (
									<p className="text-xs text-[#71717A] mt-1">
										Owes {Math.abs(info.balance)} THB to dealer
									</p>
								)}
							</div>
						))}
					</div>

					{/* Manual Payment Resolution */}
					<div className="border-t border-[#3F3F46] pt-6">
						<h3 className="text-lg font-semibold text-white mb-2">
							Payment Resolution
						</h3>
						<p className="text-[#A1A1AA] text-sm mb-4">
							After sending/receiving payment via PromptPay, confirm receipt
							below.
						</p>

						<div className="space-y-3">
							{Object.entries(settlement)
								.filter(([_, info]) => info.balance < 0)
								.map(([pid, info]) => (
									<div
										key={pid}
										className="flex items-center justify-between p-3 bg-[#18181B] border border-[#3F3F46] rounded-lg"
									>
										<div>
											<p className="text-white text-sm font-medium">
												{info.name}
											</p>
											<p className="text-red-400 text-sm">
												Owes {Math.abs(info.balance)} THB
											</p>
										</div>
										{paymentStatus[pid] === "confirmed" ? (
											<span className="flex items-center gap-1 text-green-400 text-sm">
												<CheckCircle className="w-4 h-4" />
												Confirmed
											</span>
										) : paymentStatus[pid] === "disputed" ? (
											<span className="flex items-center gap-1 text-red-400 text-sm">
												<XCircle className="w-4 h-4" />
												Disputed
											</span>
										) : (
											<div className="flex gap-2">
												<button
													type="button"
													onClick={() => {
														setPaymentStatus((prev) => ({
															...prev,
															[pid]: "confirmed",
														}));
														play("win");
													}}
													className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
												>
													<CheckCircle className="w-3.5 h-3.5" />
													Received
												</button>
												<button
													type="button"
													onClick={() => {
														setPaymentStatus((prev) => ({
															...prev,
															[pid]: "disputed",
														}));
														play("lose");
													}}
													className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
												>
													<XCircle className="w-3.5 h-3.5" />
													Not Received
												</button>
											</div>
										)}
									</div>
								))}
						</div>

						{Object.values(paymentStatus).some((s) => s === "disputed") && (
							<div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
								<p className="text-red-400 text-sm">
									Some payments are disputed. Please resolve offline and
									re-confirm.
								</p>
								<button
									type="button"
									onClick={() => {
										setPaymentStatus((prev) => {
											const next = { ...prev };
											for (const key of Object.keys(next)) {
												if (next[key] === "disputed") {
													next[key] = "pending";
												}
											}
											return next;
										});
									}}
									className="mt-2 px-3 py-1.5 bg-[#3F3F46] hover:bg-[#52525B] text-white rounded-lg text-sm transition-colors"
								>
									Reset Disputed
								</button>
							</div>
						)}
					</div>

					{/* PromptPay QR */}
					<div className="border-t border-[#3F3F46] pt-6">
						<h3 className="text-lg font-semibold text-white mb-4">
							Generate PromptPay QR
						</h3>
						<div className="flex flex-col sm:flex-row gap-4 items-start">
							<div className="space-y-3 flex-1">
								<div>
									<label
										htmlFor="promptPayInput"
										className="block text-sm text-[#A1A1AA] mb-1"
									>
										Recipient PromptPay ID (Phone or Citizen ID)
									</label>
									<input
										id="promptPayInput"
										type="text"
										value={promptPayId}
										onChange={(e) => setPromptPayId(e.target.value)}
										placeholder="0812345678 or 1234567890123"
										className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-lg text-white placeholder-[#71717A] focus:outline-none focus:border-blue-500"
									/>
								</div>
								<div className="space-y-2">
									{Object.entries(settlement)
										.filter(([_, info]) => info.balance < 0)
										.map(([pid, info]) => (
											<button
												type="button"
												key={pid}
												disabled={!promptPayId.trim()}
												onClick={async () => {
													try {
														const result = await generateQrPayloadFn({
															data: {
																targetId: promptPayId,
																amount: Math.abs(info.balance),
															},
														});
														setQrPayload(result.payload);
														setShowQr(true);
														play("click");
													} catch (e) {
														setError(
															e instanceof Error
																? e.message
																: "Failed to generate QR",
														);
													}
												}}
												className="block w-full text-left px-3 py-2 bg-[#3F3F46] hover:bg-[#52525B] disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
											>
												QR for {info.name} ({Math.abs(info.balance)} THB)
											</button>
										))}
								</div>
							</div>
							{showQr && qrPayload && (
								<div className="bg-white p-4 rounded-xl">
									<QRCodeSVG value={qrPayload} size={200} />
									<p className="text-black text-xs text-center mt-2">
										Scan to pay with any banking app
									</p>
								</div>
							)}
						</div>
					</div>

					<button
						type="button"
						onClick={() => navigate({ to: "/" })}
						className="px-4 py-2 bg-[#3F3F46] hover:bg-[#52525B] text-white rounded-lg font-medium transition-colors"
					>
						Back to Lobby
					</button>
				</div>
			)}

			{/* Round History */}
			{view.roundHistory.length > 0 && (
				<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-4">
					<h3 className="text-sm font-semibold text-[#A1A1AA] mb-3">
						Round History
					</h3>
					<div className="space-y-2">
						{view.roundHistory.map((round) => (
							<div
								key={round.roundNumber}
								className="bg-[#18181B] border border-[#3F3F46] rounded-lg p-3"
							>
								<div className="flex items-center justify-between mb-1">
									<p className="text-white text-sm font-medium">
										Round {round.roundNumber}
									</p>
									<p className="text-yellow-400 text-xs">
										Dealer: {round.dealerTaem} taem
										{round.dealerDeng > 1 ? `, ${round.dealerDeng} deng` : ""}
									</p>
								</div>
								<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
									{round.results.map((r) => (
										<div key={r.playerId} className="text-xs">
											<span className="text-[#A1A1AA]">{r.playerName}: </span>
											<span
												className={
													r.netAmount >= 0 ? "text-green-400" : "text-red-400"
												}
											>
												{r.netAmount >= 0 ? "+" : ""}
												{r.netAmount}
											</span>
											<span className="text-[#71717A] ml-1">
												(taem:{r.taem}
												{r.deng > 1 ? `, ${r.deng}d` : ""})
											</span>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
