import {
	BookOpen,
	DoorOpen,
	Eye,
	EyeOff,
	Layers,
	Link as LinkIcon,
	Volume2,
	VolumeX,
	Wallet,
} from "lucide-react";
import { EmojiPicker } from "#/components/EmojiPicker";
import { SessionTimer } from "#/components/SessionTimer";
import { TurnTimer } from "#/components/TurnTimer";
import { useI18n } from "#/lib/i18n";
import type { ClientGameView } from "#/lib/types";

interface GameHeaderProps {
	view: ClientGameView;
	squeezeEnabled: boolean;
	onToggleSqueeze: () => void;
	muted: boolean;
	onToggleMute: () => void;
	onShowRules: () => void;
	onCopyLink: () => void;
	onSendEmoji: (emoji: string) => void;
	onToggleHistory: () => void;
	onTogglePromptPay: () => void;
	onLeave: () => void;
	promptPayIdSet: boolean;
}

export function GameHeader({
	view,
	squeezeEnabled,
	onToggleSqueeze,
	muted,
	onToggleMute,
	onShowRules,
	onCopyLink,
	onSendEmoji,
	onToggleHistory,
	onTogglePromptPay,
	onLeave,
	promptPayIdSet,
}: GameHeaderProps) {
	const { t } = useI18n();

	function phaseLabel(phase: string): string {
		const key = `game.phase.${phase}` as const;
		return t(key);
	}

	return (
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
				{(view.phase === "playing" || view.phase === "betting") &&
					view.turnStartedAt && <TurnTimer startedAt={view.turnStartedAt} />}
				<SessionTimer createdAt={view.sessionCreatedAt} />
			</div>

			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={onShowRules}
					className="p-2.5 rounded-full transition border bg-white/5 hover:bg-white/10 border-white/10 text-gray-300"
					title={t("game.howToPlay")}
				>
					<BookOpen className="w-4 h-4" />
				</button>
				<EmojiPicker onSelect={onSendEmoji} />
				<button
					type="button"
					onClick={onCopyLink}
					className="p-2.5 rounded-full transition border bg-white/5 hover:bg-white/10 border-white/10 text-gray-300"
					title={t("game.copyInviteLink")}
				>
					<LinkIcon className="w-4 h-4" />
				</button>
				<button
					type="button"
					onClick={onToggleSqueeze}
					className={`p-2.5 rounded-full transition border ${
						squeezeEnabled
							? "bg-blue-500/20 border-blue-500/40 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
							: "bg-white/5 hover:bg-white/10 border-white/10 text-gray-300"
					}`}
					title={
						squeezeEnabled ? t("game.cardSqueezeOn") : t("game.cardSqueezeOff")
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
					onClick={onToggleHistory}
					className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition"
				>
					<Layers className="w-4 h-4" />
				</button>
				<button
					type="button"
					onClick={onTogglePromptPay}
					className={`p-2.5 rounded-full transition border ${
						promptPayIdSet
							? "bg-green-500/20 border-green-500/40 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]"
							: "bg-white/5 hover:bg-white/10 border-white/10 text-gray-300"
					}`}
				>
					<Wallet className="w-4 h-4" />
				</button>
				<button
					type="button"
					onClick={onToggleMute}
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
					onClick={onLeave}
					className="p-2.5 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition"
				>
					<DoorOpen className="w-4 h-4" />
				</button>
			</div>
		</header>
	);
}
