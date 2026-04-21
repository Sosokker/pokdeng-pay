import { BookOpen, X } from "lucide-react";
import { useEffect } from "react";

export function RulesModal({
	isOpen,
	onClose,
}: {
	isOpen: boolean;
	onClose: () => void;
}) {
	// Close on escape key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		if (isOpen) window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
			<button
				type="button"
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				onClick={onClose}
				aria-label="Close modal"
			/>
			<div className="relative bg-[#18181B] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
				<div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
					<h2 className="text-xl font-bold text-white flex items-center gap-2">
						<BookOpen className="w-5 h-5 text-blue-400" />
						How to Play Pok Deng
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded-lg text-[#A1A1AA] hover:text-white hover:bg-white/10 transition"
					>
						<X className="w-5 h-5" />
					</button>
				</div>
				<div className="p-6 overflow-y-auto max-h-[70vh] text-sm text-[#A1A1AA] space-y-5">
					<section>
						<h3 className="text-white font-semibold mb-2">The Goal</h3>
						<p>
							Beat the dealer's hand score. Hands are scored from 0 to 9,
							ignoring the tens digit of the total sum.
						</p>
					</section>

					<section>
						<h3 className="text-white font-semibold mb-2">Card Values</h3>
						<ul className="list-disc pl-5 space-y-1">
							<li>
								<span className="text-white font-medium">Ace:</span> 1 point
							</li>
							<li>
								<span className="text-white font-medium">Numbers (2-9):</span>{" "}
								Face value
							</li>
							<li>
								<span className="text-white font-medium">10, J, Q, K:</span> 0
								points
							</li>
						</ul>
					</section>

					<section>
						<h3 className="text-white font-semibold mb-2">Pok (Instant Win)</h3>
						<p>
							If your first two cards total exactly 8 or 9, you have "Pok". This
							is an instant win unless the dealer also has Pok of an equal or
							higher value. You cannot draw a third card if you or the dealer
							has Pok.
						</p>
					</section>

					<section>
						<h3 className="text-white font-semibold mb-2">
							Deng (Multipliers)
						</h3>
						<p>
							Deng refers to your payout multiplier. You win/lose more if you
							have:
						</p>
						<ul className="list-disc pl-5 mt-2 space-y-1">
							<li>
								<span className="text-yellow-400 font-bold">2 Deng:</span> A
								two-card hand with the same suit or same rank (e.g., two 4s or
								two Hearts). Pays 2x!
							</li>
							<li>
								<span className="text-yellow-400 font-bold">3 Deng:</span> A
								three-card hand where all cards share the same suit. Pays 3x!
							</li>
						</ul>
					</section>

					<section>
						<h3 className="text-white font-semibold mb-2">Special Hands</h3>
						<p>
							These are rare 3-card combinations that beat normal scores
							(excluding Pok):
						</p>
						<ul className="list-disc pl-5 mt-2 space-y-1">
							<li>
								<span className="text-blue-400 font-bold">
									Three of a Kind:
								</span>{" "}
								Three matching ranks (e.g., 5-5-5). Pays 5x!
							</li>
							<li>
								<span className="text-blue-400 font-bold">Straight:</span> Three
								consecutive cards (e.g., 2-3-4). Pays 3x!
							</li>
							<li>
								<span className="text-blue-400 font-bold">Straight Flush:</span>{" "}
								Three consecutive cards of the same suit. Pays 5x!
							</li>
							<li>
								<span className="text-blue-400 font-bold">Face Cards:</span> Any
								three cards from J, Q, K (e.g., J-J-Q). Pays 3x!
							</li>
						</ul>
					</section>
				</div>
				<div className="p-4 border-t border-white/10 bg-black/20 flex justify-end">
					<button
						type="button"
						onClick={onClose}
						className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
					>
						Got it!
					</button>
				</div>
			</div>
		</div>
	);
}
