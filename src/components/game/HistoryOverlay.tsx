import { useI18n } from "#/lib/i18n";
import type { ClientGameView } from "#/lib/types";

interface HistoryOverlayProps {
	view: ClientGameView;
}

export function HistoryOverlay({ view }: HistoryOverlayProps) {
	const { t } = useI18n();

	return (
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
	);
}
