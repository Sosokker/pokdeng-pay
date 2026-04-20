import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowDown,
	CheckCircle,
	Crown,
	DoorOpen,
	HandCoins,
	Layers,
	Play,
	QrCode,
	RotateCcw,
	Square,
	Users,
	Volume2,
	VolumeX,
	Wallet,
	Wifi,
	WifiOff,
	XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardBack, PlayingCard } from "#/components/PlayingCard";
import { useSounds } from "#/hooks/use-sounds";
import { useAuth } from "#/lib/auth";
import { useI18n } from "#/lib/i18n";
import {
	dealCardsFn,
	dealerDrawFn,
	drawCardFn,
	endSessionFn,
	generateQrPayloadFn,
	getGameViewFn,
	heartbeatFn,
	placeBetFn,
	setPromptPayIdFn,
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

const BET_PRESETS = [10, 50, 100, 500];
const POLL_INTERVAL_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 10_000;

function cardAnimStyle(
	deal: boolean,
	reveal: boolean,
	index: number,
): React.CSSProperties | undefined {
	if (deal) return { animation: `deal-in 0.4s ease-out ${index * 0.15}s both` };
	if (reveal)
		return { animation: `reveal-pop 0.5s ease-out ${index * 0.2}s both` };
	return undefined;
}

function GamePage() {
	const { sessionId } = Route.useLoaderData();
	const navigate = useNavigate();
	const { t } = useI18n();
	const { play, muted, toggleMute } = useSounds();
	const { user, updatePromptPayId } = useAuth();

	const [view, setView] = useState<ClientGameView | null>(null);
	const [betAmount, setBetAmount] = useState(50);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [settlement, setSettlement] = useState<Record<
		string,
		{ name: string; balance: number }
	> | null>(null);

	// Per-player QR state: map of playerId -> generated payload
	const [qrPayloads, setQrPayloads] = useState<Record<string, string>>({});
	const [activeQrPlayer, setActiveQrPlayer] = useState<string | null>(null);

	// PromptPay ID editing
	const [promptPayInput, setPromptPayInput] = useState(user?.promptPayId ?? "");
	const [showPromptPayEditor, setShowPromptPayEditor] = useState(false);
	const [savingPromptPay, setSavingPromptPay] = useState(false);

	const [paymentStatus, setPaymentStatus] = useState<
		Record<string, "pending" | "confirmed" | "disputed">
	>({});

	const [dealAnimation, setDealAnimation] = useState(false);
	const [revealAnimation, setRevealAnimation] = useState(false);
	const [drawAnimation, setDrawAnimation] = useState(false);
	const prevPhaseRef = useRef("");
	const prevCardCountRef = useRef(0);
	const loadingRef = useRef(false);
	const reconnecting = useRef(false);

	useEffect(() => {
		loadingRef.current = loading;
	}, [loading]);

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
			reconnecting.current = false;
		} catch (e) {
			if (!reconnecting.current) {
				reconnecting.current = true;
				setError(e instanceof Error ? e.message : t("error.failedLoad"));
			}
		}
	}, [sessionId, getPlayerId, t]);

	// ── Polling ──────────────────────────────────────────────────────────────
	useEffect(() => {
		const playerId = getPlayerId();
		if (!playerId) return;

		refreshView();

		const pollInterval = setInterval(() => {
			if (loadingRef.current) return;
			const pid = getPlayerId();
			if (!pid) return;
			getGameViewFn({ data: { sessionId, playerId: pid } })
				.then((data) => {
					setView((prev) => {
						if (prev && prev.version === data.version) return prev;
						return data;
					});
					setError("");
					reconnecting.current = false;
				})
				.catch(() => {
					// Will retry on next tick; no-op to avoid error flash
				});
		}, POLL_INTERVAL_MS);

		return () => clearInterval(pollInterval);
	}, [sessionId, getPlayerId, refreshView]);

	// ── Heartbeat ─────────────────────────────────────────────────────────────
	useEffect(() => {
		const playerId = getPlayerId();
		if (!playerId) return;

		const hbInterval = setInterval(() => {
			heartbeatFn({ data: { sessionId, playerId } }).catch(() => {});
		}, HEARTBEAT_INTERVAL_MS);

		// Send one immediately
		heartbeatFn({ data: { sessionId, playerId } }).catch(() => {});

		return () => clearInterval(hbInterval);
	}, [sessionId, getPlayerId]);

	// ── Phase / card animations ───────────────────────────────────────────────
	const currentPhase = view?.phase ?? "";
	const myCardCount = view?.myCards.length ?? 0;

	useEffect(() => {
		if (!currentPhase) return;
		const prev = prevPhaseRef.current;
		prevPhaseRef.current = currentPhase;

		if (prev && prev !== currentPhase) {
			if (prev === "betting" && currentPhase === "playing") {
				setDealAnimation(true);
				play("deal");
				setTimeout(() => setDealAnimation(false), 1500);
			}
			if (prev === "playing" && currentPhase === "reveal") {
				setRevealAnimation(true);
				play("win");
				setTimeout(() => setRevealAnimation(false), 2000);
			}
		}
	}, [currentPhase, play]);

	useEffect(() => {
		if (myCardCount === 3 && prevCardCountRef.current === 2) {
			setDrawAnimation(true);
			play("card-flip");
			setTimeout(() => setDrawAnimation(false), 500);
		}
		prevCardCountRef.current = myCardCount;
	}, [myCardCount, play]);

	const myPlayerId = typeof window !== "undefined" ? getPlayerId() : "";
	const isHost = view?.players.find((p) => p.isDealer)?.id === myPlayerId;
	const amDealer =
		view?.players.find((p) => p.id === myPlayerId)?.isDealer ?? false;
	const me = view?.players.find((p) => p.id === myPlayerId);
	const allPlayersActed =
		view?.players
			.filter((p) => !p.isDealer)
			.every((p) => p.hasDrawn || p.hasStood) ?? false;

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
			setError(e instanceof Error ? e.message : t("error.actionFailed"));
		} finally {
			setLoading(false);
		}
	}

	function formatHandType(
		result: { handType: string; deng: number } | undefined,
	): string {
		if (!result) return "";
		const key = `game.handType.${result.handType}` as const;
		const label = t(key);
		const parts: string[] = [];
		if (label) parts.push(label);
		if (result.deng > 1) parts.push(`${result.deng} ${t("game.deng")}`);
		return parts.join(", ");
	}

	function phaseLabel(phase: string): string {
		const key = `game.phase.${phase}` as const;
		return t(key);
	}

	// ── PromptPay helpers ─────────────────────────────────────────────────────

	async function handleSavePromptPay() {
		const pid = getPlayerId();
		if (!pid) return;
		setSavingPromptPay(true);
		try {
			await setPromptPayIdFn({
				data: { sessionId, playerId: pid, promptPayId: promptPayInput.trim() },
			});
			updatePromptPayId(promptPayInput.trim());
			setShowPromptPayEditor(false);
			await refreshView();
		} catch {
			// non-critical — user can retry
		} finally {
			setSavingPromptPay(false);
		}
	}

	/** Generate or show QR for a specific payer → recipient relationship */
	async function showQrFor(
		payerId: string,
		recipientId: string,
		amount: number,
	) {
		const recipientPromptPay = view?.playerPromptPayIds[recipientId];
		if (!recipientPromptPay) return;

		const key = `${payerId}->${recipientId}`;
		if (qrPayloads[key]) {
			setActiveQrPlayer(activeQrPlayer === key ? null : key);
			return;
		}
		try {
			const result = await generateQrPayloadFn({
				data: { targetId: recipientPromptPay, amount },
			});
			setQrPayloads((prev) => ({ ...prev, [key]: result.payload }));
			setActiveQrPlayer(key);
			play("click");
		} catch (e) {
			setError(e instanceof Error ? e.message : t("error.failedQr"));
		}
	}

	if (!view) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<div className="text-[#71717A]">
					{error ? (
						<div className="text-center space-y-3">
							<WifiOff className="w-10 h-10 text-red-400 mx-auto" />
							<p className="text-red-400">{error}</p>
							<button
								type="button"
								onClick={refreshView}
								className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
							>
								{t("game.refresh")}
							</button>
						</div>
					) : (
						t("game.loading")
					)}
				</div>
			</div>
		);
	}

	// ── Calculate settlements per-pair (who owes whom) ────────────────────────
	const dealer = view.players.find((p) => p.isDealer);
	/**
	 * For settlement: each non-dealer with negative balance owes the dealer.
	 * For future: if dealer owes players, dealer pays them.
	 *
	 * Debt pairs: { payerId, recipientId, amount }
	 */
	const debtPairs: Array<{
		payerId: string;
		payerName: string;
		recipientId: string;
		recipientName: string;
		amount: number;
	}> = [];
	if (settlement && dealer) {
		for (const [pid, info] of Object.entries(settlement)) {
			if (pid === dealer.id) continue;
			if (info.balance < 0) {
				// Non-dealer owes dealer
				debtPairs.push({
					payerId: pid,
					payerName: info.name,
					recipientId: dealer.id,
					recipientName: settlement[dealer.id]?.name ?? dealer.name,
					amount: Math.abs(info.balance),
				});
			} else if (info.balance > 0) {
				// Dealer owes non-dealer
				debtPairs.push({
					payerId: dealer.id,
					payerName: settlement[dealer.id]?.name ?? dealer.name,
					recipientId: pid,
					recipientName: info.name,
					amount: info.balance,
				});
			}
		}
	}

	return (
		<div className="max-w-6xl mx-auto space-y-6">
			{/* ── Header ─────────────────────────────────────────────────────── */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-white">
						{t("game.round")} {view.roundNumber || "-"}
					</h1>
					<p className="text-[#A1A1AA] text-sm">
						{t("game.phase")}:{" "}
						<span className="text-white font-medium">
							{phaseLabel(view.phase)}
						</span>{" "}
						&middot; {view.players.length} {t("game.players")}
					</p>
				</div>
				<div className="flex gap-2">
					{/* PromptPay ID button */}
					<button
						type="button"
						onClick={() => setShowPromptPayEditor(!showPromptPayEditor)}
						className={`p-2 border rounded-lg transition-colors ${
							me && view.playerPromptPayIds[myPlayerId]
								? "bg-green-500/20 border-green-500/40 text-green-400 hover:bg-green-500/30"
								: "bg-[#27272A] border-[#3F3F46] hover:bg-[#3F3F46] text-[#A1A1AA]"
						}`}
						title="Set your PromptPay ID"
					>
						<Wallet className="w-4 h-4" />
					</button>
					<button
						type="button"
						onClick={toggleMute}
						className="p-2 bg-[#27272A] border border-[#3F3F46] rounded-lg hover:bg-[#3F3F46] text-[#A1A1AA] transition-colors"
						title={muted ? t("game.unmute") : t("game.mute")}
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
						title={t("game.refresh")}
					>
						<RotateCcw className="w-4 h-4" />
					</button>
					<button
						type="button"
						onClick={() => navigate({ to: "/" })}
						className="p-2 bg-[#27272A] border border-[#3F3F46] rounded-lg hover:bg-[#3F3F46] text-[#A1A1AA] transition-colors"
						title={t("game.leave")}
					>
						<DoorOpen className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* ── PromptPay editor (inline) ───────────────────────────────────── */}
			{showPromptPayEditor && (
				<div className="bg-[#27272A] border border-yellow-500/30 rounded-xl p-4 space-y-3">
					<p className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
						<Wallet className="w-4 h-4" />
						Set your PromptPay ID so others can pay you
					</p>
					<div className="flex gap-3">
						<input
							type="text"
							value={promptPayInput}
							onChange={(e) => setPromptPayInput(e.target.value)}
							placeholder="Phone number or Citizen ID"
							className="flex-1 px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-lg text-white placeholder-[#71717A] focus:outline-none focus:border-yellow-500 text-sm"
						/>
						<button
							type="button"
							onClick={handleSavePromptPay}
							disabled={savingPromptPay}
							className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
						>
							Save
						</button>
						<button
							type="button"
							onClick={() => setShowPromptPayEditor(false)}
							className="px-3 py-2 bg-[#3F3F46] hover:bg-[#52525B] text-white rounded-lg text-sm transition-colors"
						>
							✕
						</button>
					</div>
				</div>
			)}

			{/* ── Error banner ────────────────────────────────────────────────── */}
			{error && (
				<div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
					<WifiOff className="w-4 h-4 shrink-0" />
					{error}
				</div>
			)}

			{/* ── Players & Balances ──────────────────────────────────────────── */}
			<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-4">
				<h3 className="text-sm font-semibold text-[#A1A1AA] mb-3 flex items-center gap-2">
					<Users className="w-4 h-4" />
					{t("game.playersBalances")}
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
								{/* Connection indicator */}
								{p.connected === false ? (
									<WifiOff
										className="w-3 h-3 text-red-400"
										title="Disconnected"
									/>
								) : (
									<Wifi className="w-3 h-3 text-green-400 opacity-50" />
								)}
								<span className="text-white text-sm font-medium truncate">
									{p.name}
									{p.id === myPlayerId && ` ${t("game.you")}`}
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
								<div className="text-xs text-[#71717A] mt-1">
									{t("game.bet")}: {p.bet}
								</div>
							)}
							{/* PromptPay indicator */}
							{view.playerPromptPayIds[p.id] && (
								<div className="flex items-center gap-1 mt-1">
									<Wallet className="w-3 h-3 text-green-400" />
									<span className="text-xs text-green-400 truncate">
										{view.playerPromptPayIds[p.id]}
									</span>
								</div>
							)}
						</div>
					))}
				</div>
			</div>

			{/* ── Dealer hand ─────────────────────────────────────────────────── */}
			{view.phase !== "lobby" && view.phase !== "betting" && (
				<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-4">
					<h3 className="text-sm font-semibold text-[#A1A1AA] mb-3 flex items-center gap-2">
						<Crown className="w-4 h-4 text-yellow-400" />
						{t("game.dealerHand")}
					</h3>
					<div className="flex gap-2">
						{(() => {
							if (!dealer) return null;
							if (dealer.cards && dealer.cards.length > 0) {
								return dealer.cards.map((card, i) => (
									<div
										key={`d-${card.suit}-${card.rank}-${String(i)}`}
										style={cardAnimStyle(dealAnimation, revealAnimation, i)}
									>
										<PlayingCard card={card} />
									</div>
								));
							}
							return Array.from({ length: dealer.cardCount }, (_, i) => (
								<CardBack key={`dealer-back-${String(i)}`} />
							));
						})()}
					</div>
					{view.phase === "reveal" && dealer?.result && (
						<div className="mt-2 text-sm">
							<span className="text-yellow-400 font-medium">
								{t("game.taem")}: {dealer.result.score}
							</span>
							{formatHandType(dealer.result) && (
								<span className="ml-2 text-purple-400">
									{formatHandType(dealer.result)}
								</span>
							)}
						</div>
					)}
				</div>
			)}

			{/* ── My hand ─────────────────────────────────────────────────────── */}
			{!amDealer && view.phase !== "lobby" && view.phase !== "betting" && (
				<div className="bg-[#27272A] border border-blue-500/50 rounded-xl p-4">
					<h3 className="text-sm font-semibold text-blue-400 mb-3">
						{t("game.yourHand")}
					</h3>
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
									key={`my-${card.suit}-${card.rank}-${String(i)}`}
									style={animStyle}
								>
									<PlayingCard card={card} />
								</div>
							);
						})}
					</div>
					{view.myResult && (
						<div className="mt-2 text-sm">
							<span className="text-blue-400 font-medium">
								{t("game.taem")}: {view.myResult.score}
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

			{/* ── Other players' hands (reveal) ───────────────────────────────── */}
			{view.phase === "reveal" && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{view.players
						.filter((p) => !p.isDealer && p.id !== myPlayerId)
						.map((p, pi) => (
							<div
								key={p.id}
								className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-4"
							>
								<h3 className="text-sm font-semibold text-[#A1A1AA] mb-2">
									{p.name}
								</h3>
								<div className="flex gap-2">
									{p.cards?.map((card, ci) => (
										<div
											key={`${p.id}-${card.suit}-${card.rank}-${String(ci)}`}
											style={cardAnimStyle(false, revealAnimation, pi * 3 + ci)}
										>
											<PlayingCard card={card} small />
										</div>
									)) ??
										Array.from({ length: p.cardCount }, (_, i) => (
											<CardBack key={`${p.id}-back-${String(i)}`} small />
										))}
								</div>
								{p.result && (
									<div className="mt-2 text-sm">
										<span className="text-white">
											{t("game.taem")}: {p.result.score}
										</span>
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

			{/* ── Actions ─────────────────────────────────────────────────────── */}
			<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-4">
				<h3 className="text-sm font-semibold text-[#A1A1AA] mb-3">
					{t("game.actions")}
				</h3>
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
							{t("game.startRound")}
						</button>
					)}

					{view.phase === "lobby" && !isHost && (
						<p className="text-[#71717A] text-sm">{t("game.waitingHost")}</p>
					)}

					{view.phase === "betting" && !amDealer && (
						<>
							<div className="flex gap-1.5">
								{BET_PRESETS.map((preset) => (
									<button
										key={preset}
										type="button"
										onClick={() => {
											setBetAmount(preset);
											play("click");
										}}
										className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
											betAmount === preset
												? "bg-yellow-600 text-white"
												: "bg-[#3F3F46] text-[#A1A1AA] hover:bg-[#52525B]"
										}`}
									>
										{preset}
									</button>
								))}
							</div>
							<div className="flex items-center gap-2">
								<label htmlFor="betInput" className="text-[#A1A1AA] text-sm">
									{t("game.bet")}:
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
								{t("game.placeBet")}
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
										dealCardsFn({
											data: { sessionId, playerId: myPlayerId },
										}),
									"deal",
								)
							}
							className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
						>
							<Layers className="w-4 h-4" />
							{t("game.dealCards")}
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
									{t("game.draw")}
								</button>
								<button
									type="button"
									disabled={loading}
									onClick={() =>
										handleAction(
											() =>
												standFn({
													data: { sessionId, playerId: myPlayerId },
												}),
											"click",
										)
									}
									className="flex items-center gap-2 px-4 py-2 bg-[#3F3F46] hover:bg-[#52525B] disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
								>
									<Square className="w-4 h-4" />
									{t("game.stand")}
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
									{t("game.draw")}
								</button>
								<button
									type="button"
									disabled={loading}
									onClick={() =>
										handleAction(
											() =>
												standFn({
													data: { sessionId, playerId: myPlayerId },
												}),
											"click",
										)
									}
									className="flex items-center gap-2 px-4 py-2 bg-[#3F3F46] hover:bg-[#52525B] disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
								>
									<Square className="w-4 h-4" />
									{t("game.stand")}
								</button>
							</>
						)}

					{view.phase === "playing" &&
						!amDealer &&
						me &&
						(me.hasDrawn || me.hasStood) && (
							<p className="text-[#71717A] text-sm">
								{t("game.waitingOthers")}
							</p>
						)}

					{view.phase === "playing" && amDealer && !allPlayersActed && (
						<p className="text-[#71717A] text-sm">{t("game.waitingPlayers")}</p>
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
								{t("game.nextRound")}
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
											e instanceof Error ? e.message : t("error.failedEnd"),
										);
									} finally {
										setLoading(false);
									}
								}}
								className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
							>
								<DoorOpen className="w-4 h-4" />
								{t("game.endSession")}
							</button>
						</>
					)}

					{view.phase === "reveal" && !isHost && (
						<p className="text-[#71717A] text-sm">{t("game.waitingNext")}</p>
					)}
				</div>
			</div>

			{/* ── Settlement ──────────────────────────────────────────────────── */}
			{settlement && (
				<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-6 space-y-6">
					<h2 className="text-xl font-bold text-white">
						{t("settlement.title")}
					</h2>

					{/* Final balances */}
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
											{paymentStatus[pid] === "confirmed"
												? t("settlement.confirmed")
												: t("settlement.disputed")}
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
								{/* Show PromptPay ID if they have one */}
								{view.playerPromptPayIds[pid] && (
									<p className="text-xs text-green-400 mt-1 flex items-center gap-1">
										<Wallet className="w-3 h-3" />
										{view.playerPromptPayIds[pid]}
									</p>
								)}
								{info.balance < 0 && paymentStatus[pid] !== "confirmed" && (
									<p className="text-xs text-[#71717A] mt-1">
										{t("settlement.owesDealer", Math.abs(info.balance))}
									</p>
								)}
							</div>
						))}
					</div>

					{/* ── Per-pair payment resolution ─────────────────────────── */}
					<div className="border-t border-[#3F3F46] pt-6 space-y-4">
						<h3 className="text-lg font-semibold text-white">
							{t("settlement.paymentResolution")}
						</h3>
						<p className="text-[#A1A1AA] text-sm">
							{t("settlement.paymentHint")}
						</p>

						{debtPairs.length === 0 ? (
							<p className="text-[#71717A] text-sm">No outstanding debts.</p>
						) : (
							<div className="space-y-4">
								{debtPairs.map(
									({
										payerId,
										payerName,
										recipientId,
										recipientName,
										amount,
									}) => {
										const pairKey = `${payerId}->${recipientId}`;
										const recipientPromptPay =
											view.playerPromptPayIds[recipientId];
										const qrPayload = qrPayloads[pairKey];
										const isQrActive = activeQrPlayer === pairKey;
										const status = paymentStatus[pairKey];

										return (
											<div
												key={pairKey}
												className="bg-[#18181B] border border-[#3F3F46] rounded-xl p-4 space-y-3"
											>
												<div className="flex items-center justify-between">
													<div>
														<p className="text-white text-sm font-medium">
															<span className="text-red-400">{payerName}</span>
															{" → "}
															<span className="text-green-400">
																{recipientName}
															</span>
														</p>
														<p className="text-[#A1A1AA] text-sm">
															{amount} THB
														</p>
														{recipientPromptPay && (
															<p className="text-xs text-green-400 flex items-center gap-1 mt-1">
																<Wallet className="w-3 h-3" />
																{recipientPromptPay}
															</p>
														)}
														{!recipientPromptPay && (
															<p className="text-xs text-[#71717A] mt-1">
																{recipientName} has not set a PromptPay ID
															</p>
														)}
													</div>

													{/* Status / actions */}
													{status === "confirmed" ? (
														<span className="flex items-center gap-1 text-green-400 text-sm">
															<CheckCircle className="w-4 h-4" />
															{t("settlement.confirmed")}
														</span>
													) : status === "disputed" ? (
														<span className="flex items-center gap-1 text-red-400 text-sm">
															<XCircle className="w-4 h-4" />
															{t("settlement.disputed")}
														</span>
													) : (
														<div className="flex gap-2">
															{recipientPromptPay && (
																<button
																	type="button"
																	onClick={() =>
																		showQrFor(payerId, recipientId, amount)
																	}
																	className="flex items-center gap-1 px-3 py-1.5 bg-[#3F3F46] hover:bg-[#52525B] text-white rounded-lg text-sm transition-colors"
																>
																	<QrCode className="w-3.5 h-3.5" />
																	QR
																</button>
															)}
															<button
																type="button"
																onClick={() => {
																	setPaymentStatus((prev) => ({
																		...prev,
																		[pairKey]: "confirmed",
																	}));
																	play("win");
																}}
																className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
															>
																<CheckCircle className="w-3.5 h-3.5" />
																{t("settlement.received")}
															</button>
															<button
																type="button"
																onClick={() => {
																	setPaymentStatus((prev) => ({
																		...prev,
																		[pairKey]: "disputed",
																	}));
																	play("lose");
																}}
																className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
															>
																<XCircle className="w-3.5 h-3.5" />
																{t("settlement.notReceived")}
															</button>
														</div>
													)}
												</div>

												{/* QR Code */}
												{isQrActive && qrPayload && (
													<div className="flex justify-center">
														<div className="bg-white p-4 rounded-xl text-center">
															<QRCodeSVG value={qrPayload} size={200} />
															<p className="text-black text-xs mt-2">
																{recipientName} · {amount} THB
															</p>
															<p className="text-gray-500 text-xs">
																{t("settlement.scanToPay")}
															</p>
														</div>
													</div>
												)}
											</div>
										);
									},
								)}
							</div>
						)}

						{Object.values(paymentStatus).some((s) => s === "disputed") && (
							<div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
								<p className="text-red-400 text-sm">
									{t("settlement.disputedMsg")}
								</p>
								<button
									type="button"
									onClick={() => {
										setPaymentStatus((prev) => {
											const next = { ...prev };
											for (const key of Object.keys(next)) {
												if (next[key] === "disputed") next[key] = "pending";
											}
											return next;
										});
									}}
									className="mt-2 px-3 py-1.5 bg-[#3F3F46] hover:bg-[#52525B] text-white rounded-lg text-sm transition-colors"
								>
									{t("settlement.resetDisputed")}
								</button>
							</div>
						)}
					</div>

					<button
						type="button"
						onClick={() => navigate({ to: "/" })}
						className="px-4 py-2 bg-[#3F3F46] hover:bg-[#52525B] text-white rounded-lg font-medium transition-colors"
					>
						{t("settlement.backToLobby")}
					</button>
				</div>
			)}

			{/* ── Round history ───────────────────────────────────────────────── */}
			{view.roundHistory.length > 0 && (
				<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-4">
					<h3 className="text-sm font-semibold text-[#A1A1AA] mb-3">
						{t("history.title")}
					</h3>
					<div className="space-y-2">
						{view.roundHistory.map((round) => (
							<div
								key={round.roundNumber}
								className="bg-[#18181B] border border-[#3F3F46] rounded-lg p-3"
							>
								<div className="flex items-center justify-between mb-1">
									<p className="text-white text-sm font-medium">
										{t("game.round")} {round.roundNumber}
									</p>
									<p className="text-yellow-400 text-xs">
										{t("game.dealerHand").replace("'s", "")}: {round.dealerTaem}{" "}
										{t("game.taem").toLowerCase()}
										{round.dealerDeng > 1
											? `, ${round.dealerDeng} ${t("game.deng").toLowerCase()}`
											: ""}
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
												({t("game.taem").toLowerCase()}:{r.taem}
												{r.deng > 1
													? `, ${r.deng}${t("game.deng").toLowerCase().charAt(0)}`
													: ""}
												)
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
