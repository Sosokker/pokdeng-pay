import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowDown,
	BookOpen,
	CheckCircle,
	Crown,
	DoorOpen,
	Eye,
	EyeOff,
	HandCoins,
	Layers,
	Link as LinkIcon,
	Play,
	QrCode,
	Square,
	Volume2,
	VolumeX,
	Wallet,
	WifiOff,
	XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmojiPicker } from "#/components/EmojiPicker";
import { EmojiPopup } from "#/components/EmojiPopup";
import { CardBack, PlayingCard, SqueezeCard } from "#/components/PlayingCard";
import { ReconnectingOverlay } from "#/components/ReconnectingOverlay";
import { RulesModal } from "#/components/RulesModal";
import { TurnTimer } from "#/components/TurnTimer";
import { useSounds } from "#/hooks/use-sounds";
import { useSSE } from "#/hooks/use-sse";
import { useAuth } from "#/lib/auth";
import { useI18n, useI18nSafe } from "#/lib/i18n";
import {
	dealCardsFn,
	dealerDrawFn,
	drawCardFn,
	endSessionFn,
	generateQrPayloadFn,
	getGameViewFn,
	heartbeatFn,
	joinSessionFn,
	kickPlayerFn,
	leaveSessionFn,
	placeBetFn,
	sendEmojiFn,
	setPromptPayIdFn,
	standFn,
	startBettingFn,
	updateSettlementFn,
	voteKickFn,
} from "#/lib/server-fns";
import type { Card, ClientGameView } from "#/lib/types";

export const Route = createFileRoute("/game/$sessionId")({
	loader: async ({ params }) => {
		return { sessionId: params.sessionId };
	},
	component: GamePage,
});

const BET_PRESETS = [10, 50, 100, 500];
const POLL_INTERVAL_MS = 8000;
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

// Helper for sleek chip visual
function PokerChip({
	amount,
	active,
	onClick,
}: {
	amount: number;
	active: boolean;
	onClick: () => void;
}) {
	const colors: Record<number, string> = {
		10: "from-blue-500 to-blue-700 border-blue-400",
		50: "from-purple-500 to-purple-700 border-purple-400",
		100: "from-red-500 to-red-700 border-red-400",
		500: "from-yellow-500 to-yellow-700 border-yellow-400 text-black",
	};
	const defaultColor = "from-gray-600 to-gray-800 border-gray-500";
	const colorClass = colors[amount] || defaultColor;
	const textColor = amount === 500 ? "text-yellow-100" : "text-white";

	return (
		<button
			type="button"
			onClick={onClick}
			className={`relative w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg shadow-xl transition-all duration-300 ${active ? "scale-110 shadow-[0_0_15px_rgba(250,204,21,0.6)] ring-2 ring-yellow-400 z-10" : "hover:scale-105 opacity-90 hover:opacity-100"}`}
		>
			<div
				className={`absolute inset-0 rounded-full bg-gradient-to-br ${colorClass} opacity-90`}
			/>
			{/* Dashed outer ring to simulate chip edges */}
			<div className="absolute inset-1 rounded-full border-[3px] border-dashed border-white/20" />
			<div className="absolute inset-2 rounded-full border border-white/10" />
			<span className={`relative ${textColor} drop-shadow-md`}>{amount}</span>
		</button>
	);
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

	useEffect(() => {
		if (settlement) setSavedSettlement(settlement);
	}, [settlement]);

	const [qrPayloads, setQrPayloads] = useState<Record<string, string>>({});
	const [activeQrPlayer, setActiveQrPlayer] = useState<string | null>(null);

	const [promptPayInput, setPromptPayInput] = useState(user?.promptPayId ?? "");
	const [showPromptPayEditor, setShowPromptPayEditor] = useState(false);
	const [savingPromptPay, setSavingPromptPay] = useState(false);

	const [paymentStatus, setPaymentStatus] = useState<
		Record<string, "pending" | "confirmed" | "disputed">
	>({});

	const [dealAnimation, setDealAnimation] = useState(false);
	const [revealAnimation, setRevealAnimation] = useState(false);
	const [drawAnimation, setDrawAnimation] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const [showRules, setShowRules] = useState(false);
	const [savedSettlement, setSavedSettlement] = useState<Record<
		string,
		{ name: string; balance: number }
	> | null>(null);

	const [squeezeEnabled, setSqueezeEnabled] = useState(() => {
		if (typeof window !== "undefined") {
			return localStorage.getItem("squeeze_enabled") !== "false";
		}
		return true;
	});

	const [joinName, setJoinName] = useState(user?.name ?? "");
	const [isJoining, setIsJoining] = useState(false);

	const toggleSqueeze = () => {
		setSqueezeEnabled((prev) => {
			const next = !prev;
			localStorage.setItem("squeeze_enabled", String(next));
			return next;
		});
	};

	const prevPhaseRef = useRef("");
	const prevCardCountRef = useRef(0);
	const loadingRef = useRef(false);
	const reconnecting = useRef(false);

	useEffect(() => {
		loadingRef.current = loading;
	}, [loading]);

	const getPlayerId = useCallback((): string => {
		return localStorage.getItem(`player_${sessionId}`) ?? "";
	}, [sessionId]);

	const getToken = useCallback((): string | undefined => {
		return localStorage.getItem(`token_${sessionId}`) ?? undefined;
	}, [sessionId]);

	const refreshViewRef = useRef<() => void>(() => {});

	const refreshView = useCallback(async () => {
		const playerId = getPlayerId();
		if (!playerId) return;
		try {
			const data = await getGameViewFn({
				data: { sessionId, playerId, token: getToken() },
			});
			setView(data);
			setError("");
			reconnecting.current = false;
		} catch (e) {
			const msg = e instanceof Error ? e.message : t("error.failedLoad");
			if (msg.includes("Session not found")) {
				localStorage.removeItem(`player_${sessionId}`);
			}
			if (!reconnecting.current) {
				reconnecting.current = true;
				setError(msg);
			}
		}
	}, [sessionId, getPlayerId, getToken, t]);

	refreshViewRef.current = refreshView;

	const { isConnected } = useSSE({
		sessionId,
		playerId: getPlayerId(),
		token: getToken(),
		onVersionChange: () => {
			refreshViewRef.current();
		},
		onSessionEnd: () => {
			localStorage.removeItem(`player_${sessionId}`);
			localStorage.removeItem(`token_${sessionId}`);
		},
		onReconnect: () => {
			refreshViewRef.current();
		},
	});

	useEffect(() => {
		const playerId = getPlayerId();
		if (!playerId) return;

		refreshView();

		const pollInterval = setInterval(() => {
			if (loadingRef.current) return;
			const pid = getPlayerId();
			if (!pid) return;
			getGameViewFn({ data: { sessionId, playerId: pid, token: getToken() } })
				.then((data) => {
					setView((prev) => {
						if (prev && prev.version === data.version) return prev;
						return data;
					});
					setError("");
					reconnecting.current = false;
				})
				.catch(() => {});
		}, POLL_INTERVAL_MS);

		return () => clearInterval(pollInterval);
	}, [sessionId, getPlayerId, getToken, refreshView]);

	useEffect(() => {
		const playerId = getPlayerId();
		if (!playerId) return;

		const hbInterval = setInterval(() => {
			heartbeatFn({ data: { sessionId, playerId, token: getToken() } }).catch(
				() => {},
			);
		}, HEARTBEAT_INTERVAL_MS);

		heartbeatFn({ data: { sessionId, playerId, token: getToken() } }).catch(
			() => {},
		);

		return () => clearInterval(hbInterval);
	}, [sessionId, getPlayerId, getToken]);

	useEffect(() => {
		const playerId = getPlayerId();
		if (!playerId) return;

		function handleBeforeUnload() {
			const pid = localStorage.getItem(`player_${sessionId}`);
			if (!pid) return;
			const token = localStorage.getItem(`token_${sessionId}`);
			try {
				const body = JSON.stringify({
					data: { sessionId, playerId: pid, token: token || undefined },
				});
				navigator.sendBeacon?.(
					"/api/leave",
					new Blob([body], { type: "application/json" }),
				);
			} catch {}
		}

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [sessionId, getPlayerId]);

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
	const isHost =
		view?.players.find((p) => p.id === myPlayerId)?.isHost ?? false;
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

	function dengTooltipText(
		result: { handType: string; deng: number; cards?: Card[] } | undefined,
	): string {
		if (
			!result ||
			result.deng <= 1 ||
			!result.cards ||
			result.cards.length === 0
		)
			return "";
		const { handType, deng, cards } = result;
		if (handType === "pok")
			return `Pok ${deng === 2 ? "with matching suit or pair" : ""}! Multiplies your win/loss by ${deng}.`;
		if (handType === "tong")
			return `Three of a kind! All three cards match rank. Multiplies your win/loss by ${deng}.`;
		if (handType === "sam-lueang")
			return `Sam Lueang (three face cards)! Automatic win override. Multiplies your win/loss by ${deng}.`;
		if (cards.length === 3) {
			const isFlush = cards.every((c) => c.suit === cards[0]!.suit);
			const ranks = cards.map((c) => c.rank);
			const sorted = [...ranks].sort();
			const isStraight =
				sorted.length === 3 &&
				((sorted[1] === String(Number(sorted[0]) + 1) &&
					sorted[2] === String(Number(sorted[1]) + 1)) ||
					(sorted[0] === "J" && sorted[1] === "Q" && sorted[2] === "K"));
			const hasPair = new Set(ranks).size < 3;
			if (isFlush && isStraight)
				return `Straight flush! Three consecutive cards of the same suit. Multiplies your win/loss by ${deng}.`;
			if (isStraight)
				return `Straight! Three consecutive cards. Multiplies your win/loss by ${deng}.`;
			if (isFlush)
				return `Flush! All three cards share the same suit. Multiplies your win/loss by ${deng}.`;
			if (hasPair)
				return `Pair! Two cards share the same rank. Multiplies your win/loss by ${deng}.`;
		}
		if (cards.length === 2) {
			const isFlush = cards[0]!.suit === cards[1]!.suit;
			const hasPair = cards[0]!.rank === cards[1]!.rank;
			if (hasPair)
				return `Pair! Both cards share the same rank. Multiplies your win/loss by ${deng}.`;
			if (isFlush)
				return `Flush! Both cards share the same suit. Multiplies your win/loss by ${deng}.`;
		}
		return `Multiplies your win/loss by ${deng}.`;
	}

	function formatHandType(
		result: { handType: string; deng: number } | undefined,
	): React.ReactNode {
		if (!result) return null;
		const key = `game.handType.${result.handType}` as const;
		const label = t(key);
		if (result.deng > 1) {
			return (
				<span className="flex items-center gap-1 group relative">
					<span>{label}</span>
					<span className="text-yellow-400 font-bold bg-yellow-500/20 px-1 rounded cursor-help border border-yellow-500/30">
						{result.deng} Deng
					</span>
					<span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#18181B] border border-white/20 text-gray-300 text-[10px] p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-center font-sans normal-case tracking-normal leading-tight">
						{dengTooltipText(result)}
					</span>
				</span>
			);
		}
		return label;
	}

	function phaseLabel(phase: string): string {
		const key = `game.phase.${phase}` as const;
		return t(key);
	}

	async function handleSavePromptPay() {
		const pid = getPlayerId();
		if (!pid) return;
		setSavingPromptPay(true);
		try {
			await setPromptPayIdFn({
				data: {
					sessionId,
					playerId: pid,
					promptPayId: promptPayInput.trim(),
					token: getToken(),
				},
			});
			updatePromptPayId(promptPayInput.trim());
			setShowPromptPayEditor(false);
			await refreshView();
		} catch {
		} finally {
			setSavingPromptPay(false);
		}
	}

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

	async function handleSendEmoji(emoji: string) {
		const pid = getPlayerId();
		if (!pid) return;
		try {
			await handleAction(
				() =>
					sendEmojiFn({
						data: {
							sessionId,
							playerId: pid,
							token: getToken() ?? "",
							emoji,
						},
					}),
				"click",
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to send emoji");
		}
	}

	async function handleLeave() {
		const pid = getPlayerId();
		const inGame = view?.phase === "betting" || view?.phase === "playing";
		if (inGame) {
			if (
				!window.confirm(
					t("game.confirmLeave") ||
						"Are you sure you want to leave the game mid-round?",
				)
			) {
				return;
			}
		}
		if (pid) {
			try {
				await leaveSessionFn({
					data: { sessionId, playerId: pid, token: getToken() },
				});
			} catch {}
			localStorage.removeItem(`player_${sessionId}`);
			localStorage.removeItem(`token_${sessionId}`);
		}
		navigate({ to: "/" });
	}

	async function handleKickPlayer(targetPlayerId: string, playerName: string) {
		if (
			!window.confirm(
				t("game.confirmKick", { name: playerName }) ||
					`Are you sure you want to kick ${playerName}?`,
			)
		) {
			return;
		}
		try {
			await handleAction(
				() =>
					kickPlayerFn({
						data: {
							sessionId,
							hostId: getPlayerId() || "",
							token: getToken(),
							targetPlayerId,
						},
					}),
				"click",
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : t("error.failedKick"));
		}
	}

	async function handleVoteKick(targetId: string, playerName: string) {
		if (!window.confirm(`${t("game.voteKick")} ${playerName}?`)) {
			return;
		}
		try {
			await handleAction(
				() =>
					voteKickFn({
						data: {
							sessionId,
							playerId: getPlayerId(),
							token: getToken(),
							targetId,
						},
					}),
				"click",
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : t("error.failedKick"));
		}
	}

	function handleCopyLink() {
		const url = `${window.location.origin}/game/${sessionId}`;
		navigator.clipboard.writeText(url).then(() => {
			// Copy success
		});
	}

	const hasPlayerId = typeof window !== "undefined" && getPlayerId();

	if (!view && !hasPlayerId && !error.includes("Session not found")) {
		return (
			<div className="flex items-center justify-center min-h-[100dvh] bg-[#0A0A0B] text-white">
				<div className="flex flex-col items-center space-y-4 w-full max-w-sm px-4">
					<div className="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
					<h2 className="text-xl font-bold text-yellow-400 uppercase tracking-widest">
						{t("lobby.joinGame")}
					</h2>
					<input
						type="text"
						value={joinName}
						onChange={(e) => setJoinName(e.target.value)}
						placeholder={t("lobby.namePlaceholder")}
						maxLength={20}
						className="w-full px-4 py-3 bg-[#18181B] border border-white/10 rounded-xl text-white placeholder-[#71717A] focus:outline-none focus:border-yellow-500 text-center"
					/>
					{error && <p className="text-red-400 text-sm">{error}</p>}
					<button
						type="button"
						disabled={isJoining || joinName.trim().length < 2}
						onClick={async () => {
							setIsJoining(true);
							setError("");
							try {
								const result = await joinSessionFn({
									data: {
										sessionId,
										playerName: joinName.trim(),
										promptPayId: user?.promptPayId,
										authUserId: user?.id,
									},
								});
								localStorage.setItem(
									`player_${result.sessionId}`,
									result.playerId,
								);
								if (result.token) {
									localStorage.setItem(
										`token_${result.sessionId}`,
										result.token,
									);
								}
								sessionStorage.setItem("playerName", joinName.trim());
								if (user?.id) {
									sessionStorage.setItem(`playedAs_${sessionId}`, user.id);
								}
								await refreshView();
							} catch (e) {
								setError(
									e instanceof Error ? e.message : t("lobby.failedJoin"),
								);
							} finally {
								setIsJoining(false);
							}
						}}
						className="w-full px-6 py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-black uppercase tracking-widest rounded-xl shadow-[0_0_15px_rgba(202,138,4,0.4)] disabled:opacity-50 transition-all active:scale-95"
					>
						{isJoining ? t("lobby.loading") : t("lobby.join")}
					</button>
					<button
						type="button"
						onClick={() => navigate({ to: "/" })}
						className="text-[#A1A1AA] hover:text-white text-sm transition-colors"
					>
						{t("lobby.cancel")}
					</button>
				</div>
			</div>
		);
	}

	if (!view) {
		return (
			<div className="flex items-center justify-center min-h-[100dvh] bg-[#0A0A0B] text-white">
				<div className="flex flex-col items-center space-y-4">
					<div className="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
					<p className="text-[#A1A1AA] text-lg tracking-widest uppercase">
						{!hasPlayerId || error.includes("Session not found")
							? error || t("error.sessionExpired")
							: t("game.loading")}
					</p>
					{error && (
						<button
							type="button"
							onClick={() => navigate({ to: "/" })}
							className="px-6 py-2 mt-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-full transition shadow-lg shadow-yellow-600/20 uppercase tracking-wide text-sm font-semibold"
						>
							{t("error.backToLobby")}
						</button>
					)}
				</div>
			</div>
		);
	}

	const dealer = view.players.find((p) => p.isDealer);
	const otherPlayers = view.players.filter(
		(p) => p.id !== myPlayerId && !p.isDealer,
	);

	const activeSettlement =
		settlement ?? (view?.phase === "ended" ? savedSettlement : null);

	const debtPairs: Array<{
		payerId: string;
		payerName: string;
		recipientId: string;
		recipientName: string;
		amount: number;
	}> = [];
	if (activeSettlement && dealer) {
		for (const [pid, info] of Object.entries(activeSettlement)) {
			if (pid === dealer.id) continue;
			if (info.balance < 0) {
				debtPairs.push({
					payerId: pid,
					payerName: info.name,
					recipientId: dealer.id,
					recipientName: activeSettlement[dealer.id]?.name ?? dealer.name,
					amount: Math.abs(info.balance),
				});
			} else if (info.balance > 0) {
				debtPairs.push({
					payerId: dealer.id,
					payerName: activeSettlement[dealer.id]?.name ?? dealer.name,
					recipientId: pid,
					recipientName: info.name,
					amount: info.balance,
				});
			}
		}
	}

	return (
		<div className="flex flex-col min-h-[100dvh] bg-[#09090B] text-white overflow-hidden select-none font-sans relative">
			{/* Immersive Background: Casino Table Gradient */}
			<div className="absolute inset-0 pointer-events-none z-0">
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#113824] via-[#05130b] to-[#000000] opacity-90" />
				<div
					className="absolute inset-0 opacity-[0.03]"
					style={{
						backgroundImage:
							"repeating-conic-gradient(rgba(255,255,255,0.05) 0% 25%, transparent 0% 50%)",
						backgroundSize: "40px 40px",
					}}
				/>
			</div>

			<ReconnectingOverlay isConnected={isConnected} />

			{/* ── Glassmorphic Header ─────────────────────────────────────────── */}
			<header className="relative z-20 w-full px-4 py-3 flex items-center justify-between bg-black/40 backdrop-blur-md border-b border-white/10 shadow-xl">
				<div className="flex items-center gap-4">
					<div>
						<h1 className="text-xl font-black bg-gradient-to-r from-yellow-300 to-yellow-600 bg-clip-text text-transparent uppercase tracking-wider drop-shadow-md">
							{t("game.round")} {view.roundNumber || "-"}
						</h1>
						<div className="flex items-center gap-2 mt-0.5 text-xs text-[#A1A1AA] uppercase tracking-wide font-semibold">
							<span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse" />
							{phaseLabel(view.phase)}
						</div>
					</div>
					{view.phase === "playing" && view.turnStartedAt && (
						<TurnTimer startedAt={view.turnStartedAt} />
					)}
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setShowRules(true)}
						className="p-2.5 rounded-full transition border bg-white/5 hover:bg-white/10 border-white/10 text-gray-300"
						title={t("game.howToPlay")}
					>
						<BookOpen className="w-4 h-4" />
					</button>
					<EmojiPicker onSelect={handleSendEmoji} />
					<button
						type="button"
						onClick={handleCopyLink}
						className="p-2.5 rounded-full transition border bg-white/5 hover:bg-white/10 border-white/10 text-gray-300"
						title={t("game.copyInviteLink")}
					>
						<LinkIcon className="w-4 h-4" />
					</button>
					<button
						type="button"
						onClick={toggleSqueeze}
						className={`p-2.5 rounded-full transition border ${
							squeezeEnabled
								? "bg-blue-500/20 border-blue-500/40 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
								: "bg-white/5 hover:bg-white/10 border-white/10 text-gray-300"
						}`}
						title={
							squeezeEnabled
								? t("game.cardSqueezeOn")
								: t("game.cardSqueezeOff")
						}
					>
						{squeezeEnabled ? (
							<Eye className="w-4 h-4" />
						) : (
							<EyeOff className="w-4 h-4" />
						)}
					</button>
					<button
						type="button"
						onClick={() => setShowHistory(!showHistory)}
						className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition"
					>
						<Layers className="w-4 h-4" />
					</button>
					<button
						type="button"
						onClick={() => {
							if (!settlement) setShowPromptPayEditor(!showPromptPayEditor);
						}}
						className={`p-2.5 rounded-full transition border ${
							me && view.playerPromptPayIds[myPlayerId]
								? "bg-green-500/20 border-green-500/40 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]"
								: "bg-white/5 hover:bg-white/10 border-white/10 text-gray-300"
						}`}
					>
						<Wallet className="w-4 h-4" />
					</button>
					<button
						type="button"
						onClick={toggleMute}
						className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition"
					>
						{muted ? (
							<VolumeX className="w-4 h-4" />
						) : (
							<Volume2 className="w-4 h-4" />
						)}
					</button>
					<button
						type="button"
						onClick={handleLeave}
						className="p-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition"
					>
						<DoorOpen className="w-4 h-4" />
					</button>
				</div>
			</header>

			{/* PromptPay overlay */}
			{showPromptPayEditor && (
				<div className="absolute top-16 right-4 z-50 w-80 bg-[#18181B] border border-white/10 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-4">
					<h3 className="text-sm font-semibold text-yellow-400 mb-1 flex items-center gap-2 uppercase tracking-wide">
						<Wallet className="w-4 h-4" /> {t("game.setupPromptPay")}
					</h3>
					<p className="text-[10px] text-gray-500 mb-3">
						{t("auth.promptPayHint")}
					</p>
					<div className="flex gap-2">
						<input
							type="text"
							value={promptPayInput}
							onChange={(e) => setPromptPayInput(e.target.value)}
							placeholder={t("auth.promptPayPlaceholder")}
							className="flex-1 px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
						/>
						<button
							type="button"
							onClick={handleSavePromptPay}
							disabled={savingPromptPay}
							className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-black rounded-lg text-sm font-bold uppercase tracking-wide transition shadow-[0_0_10px_rgba(202,138,4,0.3)]"
						>
							{t("game.save")}
						</button>
					</div>
				</div>
			)}

			{/* History Overlay */}
			{showHistory && (
				<div className="absolute top-16 left-4 z-50 w-80 bg-[#18181B]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-4 max-h-[60vh] overflow-y-auto">
					<h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wide">
						{t("game.roundHistory")}
					</h3>
					<div className="space-y-3">
						{view.roundHistory.length === 0 ? (
							<p className="text-gray-500 text-sm">{t("game.noHistory")}</p>
						) : (
							view.roundHistory.map((round) => (
								<div
									key={round.roundNumber}
									className="bg-black/40 border border-white/5 rounded-lg p-3"
								>
									<div className="flex items-center justify-between mb-2">
										<p className="text-yellow-400 text-xs font-bold uppercase">
											R{round.roundNumber}
										</p>
										<p className="text-gray-400 text-xs">
											D: {round.dealerTaem}{" "}
											{round.dealerDeng > 1 ? `x${round.dealerDeng}` : ""}
										</p>
									</div>
									<div className="space-y-1">
										{round.results.map((r) => (
											<div
												key={r.playerId}
												className="flex justify-between text-xs"
											>
												<span className="text-gray-300 truncate w-24">
													{r.playerName}
												</span>
												<span className="text-gray-500">
													T:{r.taem}
													{r.deng > 1 ? `x${r.deng}` : ""}
												</span>
												<span
													className={`font-mono font-bold ${r.netAmount >= 0 ? "text-green-400" : "text-red-400"}`}
												>
													{r.netAmount >= 0 ? "+" : ""}
													{r.netAmount}
												</span>
											</div>
										))}
									</div>
								</div>
							))
						)}
					</div>
				</div>
			)}

			{error && (
				<div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg shadow-red-500/20 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
					<WifiOff className="w-4 h-4" /> {error}
				</div>
			)}

			{/* ── Main Gaming Table Area ─────────────────────────────────────── */}
			<main
				className={`flex-1 relative w-full max-w-6xl mx-auto flex flex-col justify-between p-4 z-10 transition-all duration-300 ${activeSettlement ? "opacity-20 pointer-events-none saturate-0" : ""}`}
			>
				{/* 1. DEALER AREA (TOP) */}
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
								{(view.cumulativeBalances[dealer?.id || ""] ?? 0) >= 0
									? "+"
									: ""}
								{view.cumulativeBalances[dealer?.id || ""] ?? 0}
							</span>
						</div>
					</div>

					{/* Dealer Cards */}
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

							{/* Dealer Results Bubble */}
							{view.phase === "reveal" && dealer?.result && (
								<div className="absolute -bottom-8 bg-black/80 border border-yellow-500/50 rounded-full px-4 py-1 flex items-center gap-2 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
									<span className="text-yellow-400 font-bold text-sm">
										{dealer.result.score}
									</span>
									{formatHandType(dealer.result) && (
										<span className="text-purple-300 text-xs font-semibold uppercase tracking-wider border-l border-white/20 pl-2">
											{formatHandType(dealer.result)}
										</span>
									)}
								</div>
							)}
						</div>
					)}
				</div>

				{/* 2. OPPONENTS AREA (MIDDLE SIDES) */}
				<div className="absolute inset-x-0 top-[30%] bottom-[30%] pointer-events-none flex justify-between items-center px-4 md:px-12 z-0">
					{/* Left Side Players */}
					<div className="flex flex-col gap-8 justify-center items-start">
						{otherPlayers
							.slice(0, Math.ceil(otherPlayers.length / 2))
							.map((p, i) => (
								<OpponentHand
									key={p.id}
									player={p}
									view={view}
									revealAnimation={revealAnimation}
									index={i}
									onKick={
										isHost &&
										(view.phase === "lobby" || view.phase === "reveal")
											? handleKickPlayer
											: undefined
									}
									onVoteKick={
										!p.leftAt && p.id !== myPlayerId
											? handleVoteKick
											: undefined
									}
									myPlayerId={myPlayerId}
								/>
							))}
					</div>
					{/* Right Side Players */}
					<div className="flex flex-col gap-8 justify-center items-end">
						{otherPlayers
							.slice(Math.ceil(otherPlayers.length / 2))
							.map((p, i) => (
								<OpponentHand
									key={p.id}
									player={p}
									view={view}
									revealAnimation={revealAnimation}
									index={i + 3}
									alignRight
									onKick={
										isHost &&
										(view.phase === "lobby" || view.phase === "reveal")
											? handleKickPlayer
											: undefined
									}
									onVoteKick={
										!p.leftAt && p.id !== myPlayerId
											? handleVoteKick
											: undefined
									}
									myPlayerId={myPlayerId}
								/>
							))}
					</div>
				</div>

				{/* 3. CURRENT PLAYER AREA (BOTTOM) */}
				<div className="w-full flex flex-col items-center justify-end pb-8 z-10 relative">
					{me?.emoji && (
						<EmojiPopup
							key={me.emoji.timestamp}
							emoji={me.emoji.emoji}
							timestamp={me.emoji.timestamp}
						/>
					)}
					{/* My Cards */}
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
											{/* Use scale to make user cards larger */}
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

							{/* My Result & Win/Loss Float */}
							{view.myResult && (
								<div className="absolute -top-12 bg-blue-900/80 border border-blue-400/50 rounded-full px-5 py-1.5 flex items-center gap-3 backdrop-blur-sm shadow-[0_0_20px_rgba(59,130,246,0.4)] animate-in fade-in slide-in-from-bottom-4">
									<span className="text-white font-bold text-lg">
										{view.myResult.score}
									</span>
									{formatHandType(view.myResult) && (
										<span className="text-purple-200 text-xs font-semibold uppercase tracking-wider border-l border-white/30 pl-3">
											{formatHandType(view.myResult)}
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

					{/* Player Status / Actions Bar */}
					<div className="w-full max-w-xl bg-[#18181B]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-center justify-between gap-4">
						{/* Info */}
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

						{/* Actions Context Menu */}
						<div className="flex gap-2 w-full md:w-auto">
							{/* Betting Phase Actions */}
							{view.phase === "betting" &&
								!amDealer &&
								(me?.bet ?? 0) === 0 && (
									<div className="flex flex-col gap-3 w-full">
										<div className="flex justify-center gap-2">
											{BET_PRESETS.map((preset) => (
												<PokerChip
													key={preset}
													amount={preset}
													active={betAmount === preset}
													onClick={() => {
														setBetAmount(preset);
														play("click");
													}}
												/>
											))}
										</div>
										<div className="flex items-center gap-2">
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
																	token: getToken(),
																},
															}),
														"bet-place",
													)
												}
												className="flex-1 py-3 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-black uppercase tracking-widest rounded-xl shadow-[0_0_15px_rgba(202,138,4,0.4)] disabled:opacity-50 disabled:grayscale transition-all active:scale-95 flex items-center justify-center gap-2"
											>
												<HandCoins className="w-5 h-5" /> Place Bet ({betAmount}
												)
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

							{/* Playing Phase Actions */}
							{view.phase === "playing" &&
								!amDealer &&
								me &&
								!me.hasDrawn &&
								!me.hasStood && (
									<div className="flex gap-2 w-full">
										<button
											type="button"
											disabled={loading}
											onClick={() =>
												handleAction(
													() =>
														drawCardFn({
															data: {
																sessionId,
																playerId: myPlayerId,
																token: getToken(),
															},
														}),
													"card-flip",
												)
											}
											className="flex-1 py-3 bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-bold uppercase tracking-widest rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2"
										>
											<ArrowDown className="w-4 h-4" /> Draw
										</button>
										<button
											type="button"
											disabled={loading}
											onClick={() =>
												handleAction(
													() =>
														standFn({
															data: {
																sessionId,
																playerId: myPlayerId,
																token: getToken(),
															},
														}),
													"click",
												)
											}
											className="flex-1 py-3 bg-gradient-to-br from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 text-white font-bold uppercase tracking-widest rounded-xl border border-gray-600 transition-all active:scale-95 flex items-center justify-center gap-2"
										>
											<Square className="w-4 h-4" /> Stand
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
											onClick={() =>
												handleAction(
													() =>
														dealerDrawFn({
															data: {
																sessionId,
																playerId: myPlayerId,
																token: getToken(),
															},
														}),
													"card-flip",
												)
											}
											className="flex-1 py-3 bg-gradient-to-br from-blue-600 to-blue-800 text-white font-bold uppercase tracking-widest rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2"
										>
											<ArrowDown className="w-4 h-4" /> Draw
										</button>
										<button
											type="button"
											disabled={loading}
											onClick={() =>
												handleAction(
													() =>
														standFn({
															data: {
																sessionId,
																playerId: myPlayerId,
																token: getToken(),
															},
														}),
													"click",
												)
											}
											className="flex-1 py-3 bg-gradient-to-br from-gray-700 to-gray-900 text-white font-bold uppercase tracking-widest rounded-xl border border-gray-600 transition-all active:scale-95 flex items-center justify-center gap-2"
										>
											<Square className="w-4 h-4" /> Stand
										</button>
									</div>
								)}

							{/* Waiting states */}
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

							{/* Host Controls */}
							{isHost && view.phase === "lobby" && (
								<button
									type="button"
									disabled={loading || view.players.length < 2}
									onClick={() =>
										handleAction(
											() =>
												startBettingFn({
													data: {
														sessionId,
														playerId: myPlayerId,
														token: getToken(),
													},
												}),
											"click",
										)
									}
									className="w-full py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-black uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.4)] disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
								>
									<Play className="w-5 h-5 fill-current" />{" "}
									{t("game.startGame")}
								</button>
							)}
							{amDealer && view.phase === "betting" && (
								<button
									type="button"
									disabled={loading}
									onClick={() =>
										handleAction(
											() =>
												dealCardsFn({
													data: {
														sessionId,
														playerId: myPlayerId,
														token: getToken(),
													},
												}),
											"deal",
										)
									}
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
											onClick={() =>
												handleAction(
													() =>
														startBettingFn({
															data: {
																sessionId,
																playerId: myPlayerId,
																token: getToken(),
															},
														}),
													"click",
												)
											}
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
											onClick={async () => {
												setLoading(true);
												try {
													const balances = await endSessionFn({
														data: {
															sessionId,
															playerId: myPlayerId,
															token: getToken(),
														},
													});
													setSettlement(balances);
													play("deal");
												} catch (e) {
													setError(
														e instanceof Error
															? e.message
															: t("error.failedEnd"),
													);
												} finally {
													setLoading(false);
												}
											}}
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
											onClick={() => setSettlement(savedSettlement)}
											className="flex-1 py-3 px-4 bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-bold uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(202,138,4,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
										>
											<Wallet className="w-4 h-4" /> {t("game.viewSettlement")}
										</button>
									)}
									<button
										type="button"
										onClick={handleLeave}
										className="py-3 px-4 bg-gradient-to-r from-gray-700 to-gray-900 text-white font-bold uppercase tracking-wider rounded-xl border border-gray-600 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
									>
										<DoorOpen className="w-4 h-4" /> Leave
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			</main>

			{/* ── Settlement Modal Overlay ────────────────────────────────────── */}
			{activeSettlement && (
				<div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
					<div className="w-full max-w-2xl bg-[#111115] border-2 border-yellow-500/30 rounded-2xl shadow-[0_0_50px_rgba(250,204,21,0.15)] overflow-hidden flex flex-col max-h-[90vh]">
						<div className="bg-gradient-to-r from-yellow-900/40 via-black to-yellow-900/40 p-5 border-b border-yellow-500/20 text-center">
							<h2 className="text-2xl font-black text-yellow-400 uppercase tracking-widest">
								{t("settlement.title")}
							</h2>
						</div>

						<div className="p-6 overflow-y-auto flex-1 space-y-6">
							{/* Final balances */}
							<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
								{Object.entries(activeSettlement).map(([pid, info]) => (
									<div
										key={pid}
										className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${info.balance >= 0 ? "border-green-500/30 bg-green-500/5 shadow-[inset_0_0_20px_rgba(34,197,94,0.05)]" : "border-red-500/30 bg-red-500/5 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]"}`}
									>
										<p className="text-gray-300 font-medium text-sm mb-1">
											{info.name}
										</p>
										<p
											className={`text-2xl font-black font-mono ${info.balance >= 0 ? "text-green-400" : "text-red-400"}`}
										>
											{info.balance >= 0 ? "+" : ""}
											{info.balance}
										</p>
										{view.playerPromptPayIds[pid] && (
											<p className="text-[10px] text-green-500 mt-2 flex items-center gap-1 opacity-80">
												<Wallet className="w-3 h-3" />{" "}
												{view.playerPromptPayIds[pid]}
											</p>
										)}
										{!view.playerPromptPayIds[pid] && (
											<p className="text-[10px] text-orange-400 mt-2 flex items-center gap-1 opacity-80">
												<Wallet className="w-3 h-3" /> {t("game.noPromptPay")}
											</p>
										)}
									</div>
								))}
							</div>

							<hr className="border-white/10" />

							{/* Payments */}
							<div>
								<h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">
									{t("settlement.outstandingPayments")}
								</h3>
								{debtPairs.length === 0 ? (
									<p className="text-gray-500 text-center text-sm italic">
										{t("settlement.allSettled")}
									</p>
								) : (
									<div className="space-y-3">
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
														className="bg-black/50 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4"
													>
														<div className="flex items-center gap-3 w-full md:w-auto">
															<div className="text-right">
																<p className="text-red-400 font-bold">
																	{payerName}
																</p>
															</div>
															<div className="flex flex-col items-center px-4">
																<span className="text-white font-mono font-black text-lg bg-white/10 px-3 py-1 rounded-full">
																	{amount} THB
																</span>
																<ArrowDown className="w-4 h-4 text-gray-500 -rotate-90 md:rotate-0 mt-1" />
															</div>
															<div>
																<p className="text-green-400 font-bold">
																	{recipientName}
																</p>
																{recipientPromptPay && (
																	<p className="text-xs text-green-500/70">
																		{recipientPromptPay}
																	</p>
																)}
															</div>
														</div>

														<div className="flex gap-2">
															{status === "confirmed" ? (
																<span className="px-4 py-2 bg-green-500/10 text-green-400 rounded-lg text-sm font-bold flex items-center gap-2 border border-green-500/20">
																	<CheckCircle className="w-4 h-4" />{" "}
																	{t("settlement.paid")}
																</span>
															) : status === "disputed" ? (
																<span className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-500/20">
																	<XCircle className="w-4 h-4" />{" "}
																	{t("settlement.disputed")}
																</span>
															) : (
																<>
																	{recipientPromptPay && (
																		<button
																			type="button"
																			onClick={() =>
																				showQrFor(payerId, recipientId, amount)
																			}
																			className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition"
																		>
																			<QrCode className="w-5 h-5" />
																		</button>
																	)}
																	<button
																		type="button"
																		onClick={() => {
																			const newStatus = "confirmed" as const;
																			setPaymentStatus((prev) => ({
																				...prev,
																				[pairKey]: newStatus,
																			}));
																			updateSettlementFn({
																				data: {
																					sessionId,
																					playerId: myPlayerId,
																					token: getToken(),
																					payerId,
																					recipientId,
																					amount,
																					status: newStatus,
																				},
																			}).catch(() => {});
																		}}
																		className="p-2 bg-green-600 hover:bg-green-500 rounded-lg text-white transition"
																	>
																		<CheckCircle className="w-5 h-5" />
																	</button>
																	<button
																		type="button"
																		onClick={() => {
																			const newStatus = "disputed" as const;
																			setPaymentStatus((prev) => ({
																				...prev,
																				[pairKey]: newStatus,
																			}));
																			updateSettlementFn({
																				data: {
																					sessionId,
																					playerId: myPlayerId,
																					token: getToken(),
																					payerId,
																					recipientId,
																					amount,
																					status: newStatus,
																				},
																			}).catch(() => {});
																		}}
																		className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition"
																	>
																		<XCircle className="w-5 h-5" />
																	</button>
																</>
															)}
														</div>

														{isQrActive && qrPayload && (
															<div className="w-full mt-4 flex justify-center bg-white p-4 rounded-xl">
																<QRCodeSVG value={qrPayload} size={160} />
															</div>
														)}
													</div>
												);
											},
										)}
									</div>
								)}
							</div>
						</div>

						<div className="p-4 border-t border-white/10 bg-black/40 flex justify-end">
							<button
								type="button"
								onClick={handleLeave}
								className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold uppercase tracking-widest text-sm transition"
							>
								{t("settlement.exitToLobby")}
							</button>
						</div>
					</div>
				</div>
			)}
			{/* Rules Modal */}
			<RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
		</div>
	);
}

// Component for opponent hands around the table
function OpponentHand({
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
			{/* Name Plate */}
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

			{/* Vote kick / no PromptPay labels */}
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

			{/* Cards */}
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

			{/* Result Badge */}
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
