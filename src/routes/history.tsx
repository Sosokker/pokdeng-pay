import { createFileRoute } from "@tanstack/react-router";
import { Calendar, History as HistoryIcon, LogIn, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "#/lib/auth";
import { useI18n } from "#/lib/i18n";
import { getPlayerHistoryFn } from "#/lib/server-fns";
import type { RoundSummary } from "#/lib/types";

interface HistoryEntry {
	id: string;
	playerName: string;
	summary: RoundSummary[];
	balances: Record<string, { name: string; balance: number }>;
	createdAt: number;
}

export const Route = createFileRoute("/history")({
	component: HistoryPage,
});

function HistoryPage() {
	const { t } = useI18n();
	const { user, loginWithGoogle } = useAuth();
	const [history, setHistory] = useState<HistoryEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const isGuest = user?.authType === "guest";

	useEffect(() => {
		if (isGuest || !user?.id) {
			setLoading(false);
			return;
		}
		getPlayerHistoryFn()
			.then((data) => setHistory(data as HistoryEntry[]))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [user?.id, isGuest]);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-20">
				<div className="text-[#71717A] animate-pulse">{t("auth.loading")}</div>
			</div>
		);
	}

	if (isGuest || !user) {
		return (
			<div className="max-w-4xl mx-auto space-y-6">
				<div>
					<h1 className="text-3xl font-bold text-white flex items-center gap-3">
						<HistoryIcon className="w-8 h-8 text-blue-400" />
						{t("history.title")}
					</h1>
					<p className="text-[#A1A1AA] mt-1">{t("history.subtitle")}</p>
				</div>

				<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-12 text-center space-y-4">
					<HistoryIcon className="w-12 h-12 text-[#71717A] mx-auto" />
					<p className="text-[#A1A1AA]">{t("history.signInRequired")}</p>
					<button
						type="button"
						onClick={loginWithGoogle}
						className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-100 text-gray-800 rounded-lg font-medium transition-colors"
					>
						<LogIn className="w-4 h-4" />
						{t("auth.continueWithGoogle")}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-4xl mx-auto space-y-6">
			<div>
				<h1 className="text-3xl font-bold text-white flex items-center gap-3">
					<HistoryIcon className="w-8 h-8 text-blue-400" />
					{t("history.title")}
				</h1>
				<p className="text-[#A1A1AA] mt-1">{t("history.subtitle")}</p>
			</div>

			{history.length === 0 ? (
				<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-12 text-center">
					<HistoryIcon className="w-12 h-12 text-[#71717A] mx-auto mb-3" />
					<p className="text-[#71717A]">{t("history.empty")}</p>
				</div>
			) : (
				<div className="space-y-4">
					{history.map((entry) => (
						<HistoryCard key={entry.id} entry={entry} />
					))}
				</div>
			)}
		</div>
	);
}

function HistoryCard({ entry }: { entry: HistoryEntry }) {
	const { t } = useI18n();
	const date = new Date(entry.createdAt * 1000);
	const myBalance = entry.balances
		? (Object.entries(entry.balances).find(
				([_, info]) => info.name === entry.playerName,
			)?.[1]?.balance ?? 0)
		: 0;

	return (
		<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl overflow-hidden">
			<div className="flex items-center justify-between p-4 border-b border-[#3F3F46]">
				<div className="flex items-center gap-3">
					<Calendar className="w-4 h-4 text-[#71717A]" />
					<span className="text-sm text-[#A1A1AA]">
						{date.toLocaleDateString()} {date.toLocaleTimeString()}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Trophy className="w-4 h-4 text-[#71717A]" />
					<span className="text-sm text-[#A1A1AA]">
						{entry.summary.length} {t("game.round").toLowerCase()}s
					</span>
					<span
						className={`font-mono font-bold ${myBalance >= 0 ? "text-green-400" : "text-red-400"}`}
					>
						{myBalance >= 0 ? "+" : ""}
						{myBalance}
					</span>
				</div>
			</div>

			<div className="p-4 space-y-2">
				{entry.summary.map((round) => (
					<div
						key={round.roundNumber}
						className="flex items-center gap-4 text-sm bg-black/30 rounded-lg px-3 py-2"
					>
						<span className="text-yellow-400 font-bold w-8">
							R{round.roundNumber}
						</span>
						<span className="text-[#71717A]">
							{t("game.dealer")}: {round.dealerTaem}
							{round.dealerDeng > 1 ? `x${round.dealerDeng}` : ""}
						</span>
						<div className="flex-1 flex flex-wrap gap-2">
							{round.results.map((r) => (
								<span
									key={r.playerId}
									className={`text-xs px-2 py-0.5 rounded ${r.netAmount >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
								>
									{r.playerName}: {r.netAmount >= 0 ? "+" : ""}
									{r.netAmount}
								</span>
							))}
						</div>
					</div>
				))}

				{entry.balances && (
					<div className="mt-3 pt-3 border-t border-[#3F3F46]">
						<div className="flex flex-wrap gap-3">
							{Object.entries(entry.balances).map(([pid, info]) => (
								<span
									key={pid}
									className={`text-xs font-mono font-bold px-2 py-1 rounded ${info.balance >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
								>
									{info.name}: {info.balance >= 0 ? "+" : ""}
									{info.balance}
								</span>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
