import { ArrowDown, CheckCircle, QrCode, Wallet, XCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "#/lib/i18n";
import type { ClientGameView } from "#/lib/types";

interface DebtPair {
	payerId: string;
	payerName: string;
	recipientId: string;
	recipientName: string;
	amount: number;
}

interface SettlementModalProps {
	settlement: Record<string, { name: string; balance: number }>;
	view: ClientGameView;
	debtPairs: DebtPair[];
	qrPayloads: Record<string, string>;
	activeQrPlayer: string | null;
	paymentStatus: Record<string, "pending" | "confirmed" | "disputed">;
	onShowQr: (payerId: string, recipientId: string, amount: number) => void;
	onUpdatePayment: (
		pairKey: string,
		payerId: string,
		recipientId: string,
		amount: number,
		status: "confirmed" | "disputed",
	) => void;
	onLeave: () => void;
}

export function SettlementModal({
	settlement,
	view,
	debtPairs,
	qrPayloads,
	activeQrPlayer,
	paymentStatus,
	onShowQr,
	onUpdatePayment,
	onLeave,
}: SettlementModalProps) {
	const { t } = useI18n();

	return (
		<div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
			<div className="w-full max-w-2xl bg-[#111115] border-2 border-yellow-500/30 rounded-2xl shadow-[0_0_50px_rgba(250,204,21,0.15)] overflow-hidden flex flex-col max-h-[90vh]">
				<div className="bg-gradient-to-r from-yellow-900/40 via-black to-yellow-900/40 p-5 border-b border-yellow-500/20 text-center">
					<h2 className="text-2xl font-black text-yellow-400 uppercase tracking-widest">
						{t("settlement.title")}
					</h2>
				</div>

				<div className="p-6 overflow-y-auto flex-1 space-y-6">
					<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
						{Object.entries(settlement).map(([pid, info]) => (
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
																		onShowQr(payerId, recipientId, amount)
																	}
																	className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition"
																>
																	<QrCode className="w-5 h-5" />
																</button>
															)}
															<button
																type="button"
																onClick={() =>
																	onUpdatePayment(
																		pairKey,
																		payerId,
																		recipientId,
																		amount,
																		"confirmed",
																	)
																}
																className="p-2 bg-green-600 hover:bg-green-500 rounded-lg text-white transition"
															>
																<CheckCircle className="w-5 h-5" />
															</button>
															<button
																type="button"
																onClick={() =>
																	onUpdatePayment(
																		pairKey,
																		payerId,
																		recipientId,
																		amount,
																		"disputed",
																	)
																}
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
						onClick={onLeave}
						className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold uppercase tracking-widest text-sm transition"
					>
						{t("settlement.exitToLobby")}
					</button>
				</div>
			</div>
		</div>
	);
}
