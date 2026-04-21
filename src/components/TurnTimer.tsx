import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

export function TurnTimer({
	startedAt,
	timeoutSeconds = 60,
}: {
	startedAt: number;
	timeoutSeconds?: number;
}) {
	const [timeLeft, setTimeLeft] = useState<number>(timeoutSeconds);

	useEffect(() => {
		const interval = setInterval(() => {
			const elapsed = (Date.now() - startedAt) / 1000;
			const remaining = Math.max(0, timeoutSeconds - elapsed);
			setTimeLeft(Math.ceil(remaining));
		}, 1000);
		return () => clearInterval(interval);
	}, [startedAt, timeoutSeconds]);

	if (timeLeft === 0) {
		return (
			<div className="flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-sm font-bold shadow-lg backdrop-blur-sm bg-red-500/20 text-red-400 border border-red-500/50">
				<Clock className="w-4 h-4" />
				Time's up
			</div>
		);
	}

	const isUrgent = timeLeft <= 15;

	return (
		<div
			className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-sm font-bold shadow-lg backdrop-blur-sm transition-colors ${
				isUrgent
					? "bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse"
					: "bg-black/50 text-yellow-400 border border-white/10"
			}`}
		>
			<Clock className="w-4 h-4" />
			{timeLeft}s
		</div>
	);
}
