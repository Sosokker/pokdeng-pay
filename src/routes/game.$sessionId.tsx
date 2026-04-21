import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConfirmDialog } from "#/components/ConfirmDialog";
import { DealerArea } from "#/components/game/DealerArea";
import { GameHeader } from "#/components/game/GameHeader";
import { HistoryOverlay } from "#/components/game/HistoryOverlay";
import { JoinScreen } from "#/components/game/JoinScreen";
import { OpponentHand } from "#/components/game/OpponentHand";
import { PlayerArea } from "#/components/game/PlayerArea";
import { PromptPayEditor } from "#/components/game/PromptPayEditor";
import { SettlementModal } from "#/components/game/SettlementModal";
import { ReconnectingOverlay } from "#/components/ReconnectingOverlay";
import { RulesModal } from "#/components/RulesModal";
import { useSounds } from "#/hooks/use-sounds";
import { useSSE } from "#/hooks/use-sse";
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
import type { ClientGameView } from "#/lib/types";

export const Route = createFileRoute("/game/$sessionId")({
	loader: async ({ params }) => {
		return { sessionId: params.sessionId };
	},
	component: GamePage,
});

const POLL_INTERVAL_MS = 8000;
const HEARTBEAT_INTERVAL_MS = 10_000;

function GamePage() {
	const { sessionId } = Route.useLoaderData();
	const navigate = useNavigate();
	const { t } = useI18n();
	const { play, muted, toggleMute } = useSounds();
	const { user, updatePromptPayId } = useAuth();
	const confirmDialog = useConfirmDialog();

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
	const explicitLeaveRef = useRef(false);

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

		const fallbackPollInterval = setInterval(() => {
			if (loadingRef.current) return;
			if (isConnected) return;
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

		return () => clearInterval(fallbackPollInterval);
	}, [sessionId, getPlayerId, getToken, refreshView, isConnected]);

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

		function sendLeaveBeacon() {
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

		let pageUnloading = false;

		function handleBeforeUnload() {
			pageUnloading = true;
			sendLeaveBeacon();
		}

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
			if (!pageUnloading && !explicitLeaveRef.current) {
				sendLeaveBeacon();
			}
		};
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
		explicitLeaveRef.current = true;
		const pid = getPlayerId();
		const inGame = view?.phase === "betting" || view?.phase === "playing";
		if (inGame) {
			const ok = await confirmDialog.confirm({
				title: t("game.leave"),
				message: t("game.confirmLeave"),
				confirmLabel: t("game.leave"),
				cancelLabel: t("lobby.cancel"),
				variant: "danger",
			});
			if (!ok) {
				explicitLeaveRef.current = false;
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
		const ok = await confirmDialog.confirm({
			title: t("game.kickPlayer"),
			message: t("game.confirmKick", playerName),
			confirmLabel: t("game.kickPlayer"),
			cancelLabel: t("lobby.cancel"),
			variant: "danger",
		});
		if (!ok) return;
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
		const ok = await confirmDialog.confirm({
			title: t("game.voteKick"),
			message: t("game.confirmVoteKick", playerName),
			confirmLabel: t("game.voteKick"),
			cancelLabel: t("lobby.cancel"),
			variant: "warning",
		});
		if (!ok) return;
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
		navigator.clipboard.writeText(url).then(() => {});
	}

	function handlePaymentStatusUpdate(
		pairKey: string,
		payerId: string,
		recipientId: string,
		amount: number,
		status: "confirmed" | "disputed",
	) {
		setPaymentStatus((prev) => ({ ...prev, [pairKey]: status }));
		updateSettlementFn({
			data: {
				sessionId,
				playerId: myPlayerId,
				token: getToken(),
				payerId,
				recipientId,
				amount,
				status,
			},
		}).catch(() => {});
	}

	const handleBetAmountChange = (amount: number) => {
		setBetAmount(amount);
		play("click");
	};

	const handlePlaceBet = () =>
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
		);

	const handleDrawCard = () =>
		handleAction(
			() =>
				drawCardFn({
					data: { sessionId, playerId: myPlayerId, token: getToken() },
				}),
			"card-flip",
		);

	const handleStand = () =>
		handleAction(
			() =>
				standFn({
					data: { sessionId, playerId: myPlayerId, token: getToken() },
				}),
			"click",
		);

	const handleDealerDraw = () =>
		handleAction(
			() =>
				dealerDrawFn({
					data: { sessionId, playerId: myPlayerId, token: getToken() },
				}),
			"card-flip",
		);

	const handleStartBetting = () =>
		handleAction(
			() =>
				startBettingFn({
					data: { sessionId, playerId: myPlayerId, token: getToken() },
				}),
			"click",
		);

	const handleDealCards = () =>
		handleAction(
			() =>
				dealCardsFn({
					data: { sessionId, playerId: myPlayerId, token: getToken() },
				}),
			"deal",
		);

	const handleEndSession = async () => {
		setLoading(true);
		try {
			const balances = await endSessionFn({
				data: { sessionId, playerId: myPlayerId, token: getToken() },
			});
			setSettlement(balances);
			play("deal");
		} catch (e) {
			setError(e instanceof Error ? e.message : t("error.failedEnd"));
		} finally {
			setLoading(false);
		}
	};

	const hasPlayerId = typeof window !== "undefined" && getPlayerId();

	if (!view && !hasPlayerId && !error.includes("Session not found")) {
		return (
			<JoinScreen
				sessionId={sessionId}
				error={error}
				onError={setError}
				onJoined={refreshView}
			/>
		);
	}

	if (!view) {
		return (
			<div className="flex items-center justify-center h-dvh bg-[#0A0A0B] text-white">
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
		<div className="flex flex-col h-dvh bg-[#09090B] text-white overflow-hidden select-none font-sans relative">
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

			<GameHeader
				view={view}
				squeezeEnabled={squeezeEnabled}
				onToggleSqueeze={toggleSqueeze}
				muted={muted}
				onToggleMute={toggleMute}
				onShowRules={() => setShowRules(true)}
				onCopyLink={handleCopyLink}
				onSendEmoji={handleSendEmoji}
				onToggleHistory={() => setShowHistory(!showHistory)}
				onTogglePromptPay={() => {
					if (!settlement) setShowPromptPayEditor(!showPromptPayEditor);
				}}
				onLeave={handleLeave}
				promptPayIdSet={!!(me && view.playerPromptPayIds[myPlayerId])}
			/>

			{showPromptPayEditor && (
				<PromptPayEditor
					promptPayInput={promptPayInput}
					onPromptPayInputChange={setPromptPayInput}
					onSave={handleSavePromptPay}
					saving={savingPromptPay}
				/>
			)}

			{showHistory && <HistoryOverlay view={view} />}

			{error && (
				<div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg shadow-red-500/20 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
					<WifiOff className="w-4 h-4" /> {error}
				</div>
			)}

			<main
				className={`flex-1 relative w-full max-w-6xl mx-auto flex flex-col justify-between p-4 z-10 transition-all duration-300 ${activeSettlement ? "opacity-20 pointer-events-none saturate-0" : ""}`}
			>
				<DealerArea
					view={view}
					dealer={dealer}
					myPlayerId={myPlayerId}
					dealAnimation={dealAnimation}
					revealAnimation={revealAnimation}
				/>

				<div className="absolute inset-x-0 top-[30%] bottom-[30%] pointer-events-none flex justify-between items-center px-4 md:px-12 z-0">
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

				<PlayerArea
					view={view}
					me={me}
					myPlayerId={myPlayerId}
					amDealer={amDealer}
					isHost={isHost}
					allPlayersActed={allPlayersActed}
					squeezeEnabled={squeezeEnabled}
					dealAnimation={dealAnimation}
					drawAnimation={drawAnimation}
					loading={loading}
					betAmount={betAmount}
					onBetAmountChange={handleBetAmountChange}
					savedSettlement={savedSettlement}
					onPlaceBet={handlePlaceBet}
					onDrawCard={handleDrawCard}
					onStand={handleStand}
					onDealerDraw={handleDealerDraw}
					onStartBetting={handleStartBetting}
					onDealCards={handleDealCards}
					onEndSession={handleEndSession}
					onLeave={handleLeave}
					onViewSettlement={() => setSettlement(savedSettlement)}
				/>
			</main>

			{activeSettlement && (
				<SettlementModal
					settlement={activeSettlement}
					view={view}
					debtPairs={debtPairs}
					qrPayloads={qrPayloads}
					activeQrPlayer={activeQrPlayer}
					paymentStatus={paymentStatus}
					onShowQr={showQrFor}
					onUpdatePayment={handlePaymentStatusUpdate}
					onLeave={handleLeave}
				/>
			)}
			<RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
			{confirmDialog.dialog}
		</div>
	);
}
