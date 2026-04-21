import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "#/lib/auth";
import { useI18n } from "#/lib/i18n";
import { joinSessionFn } from "#/lib/server-fns";

interface JoinScreenProps {
	sessionId: string;
	error: string;
	onError: (error: string) => void;
	onJoined: () => Promise<void>;
}

export function JoinScreen({
	sessionId,
	error,
	onError,
	onJoined,
}: JoinScreenProps) {
	const navigate = useNavigate();
	const { t } = useI18n();
	const { user } = useAuth();
	const [joinName, setJoinName] = useState(user?.name ?? "");
	const [isJoining, setIsJoining] = useState(false);

	return (
		<div className="flex items-center justify-center h-dvh bg-[#0A0A0B] text-white">
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
						onError("");
						try {
							const result = await joinSessionFn({
								data: {
									sessionId,
									playerName: joinName.trim(),
									promptPayId: user?.promptPayId,
								},
							});
							localStorage.setItem(
								`player_${result.sessionId}`,
								result.playerId,
							);
							if (result.token) {
								localStorage.setItem(`token_${result.sessionId}`, result.token);
							}
							sessionStorage.setItem("playerName", joinName.trim());
							if (user?.id) {
								sessionStorage.setItem(`playedAs_${sessionId}`, user.id);
							}
							await onJoined();
						} catch (e) {
							onError(e instanceof Error ? e.message : t("lobby.failedJoin"));
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
