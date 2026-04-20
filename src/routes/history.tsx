import { createFileRoute } from "@tanstack/react-router";
import { History as HistoryIcon } from "lucide-react";

export const Route = createFileRoute("/history")({
	component: HistoryPage,
});

function HistoryPage() {
	return (
		<div className="max-w-4xl mx-auto space-y-8">
			<div>
				<h1 className="text-3xl font-bold text-white flex items-center gap-3">
					<HistoryIcon className="w-8 h-8 text-blue-400" />
					Session History
				</h1>
				<p className="text-[#A1A1AA] mt-1">
					History is stored per session. View past rounds during an active game.
				</p>
			</div>

			<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-12 text-center">
				<HistoryIcon className="w-12 h-12 text-[#71717A] mx-auto mb-3" />
				<p className="text-[#71717A]">
					Join a game session to see round-by-round history and settlement
					details.
				</p>
			</div>
		</div>
	);
}
