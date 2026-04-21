import { Timer } from "lucide-react";
import { useEffect, useState } from "react";

function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	}
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function SessionTimer({ createdAt }: { createdAt: number }) {
	const [elapsed, setElapsed] = useState(() => Date.now() - createdAt);

	useEffect(() => {
		const interval = setInterval(() => {
			setElapsed(Date.now() - createdAt);
		}, 1000);
		return () => clearInterval(interval);
	}, [createdAt]);

	const totalMinutes = Math.floor(elapsed / 60000);
	const isWarning = totalMinutes >= 25;

	return (
		<div
			className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-sm font-bold shadow-lg backdrop-blur-sm transition-colors ${
				isWarning
					? "bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse"
					: "bg-black/50 text-[#A1A1AA] border border-white/10"
			}`}
		>
			<Timer className="w-4 h-4" />
			{formatDuration(elapsed)}
		</div>
	);
}
