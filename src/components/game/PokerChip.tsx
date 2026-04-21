export function PokerChip({
	amount,
	active,
	onClick,
}: {
	amount: number;
	active: boolean;
	onClick: () => void;
}) {
	const colors: Record<number, string> = {
		10: "from-blue-500 to-blue-700 border-blue-400",
		50: "from-purple-500 to-purple-700 border-purple-400",
		100: "from-red-500 to-red-700 border-red-400",
		500: "from-yellow-500 to-yellow-700 border-yellow-400 text-black",
	};
	const defaultColor = "from-gray-600 to-gray-800 border-gray-500";
	const colorClass = colors[amount] || defaultColor;
	const textColor = amount === 500 ? "text-yellow-100" : "text-white";

	return (
		<button
			type="button"
			onClick={onClick}
			className={`relative w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg shadow-xl transition-all duration-300 ${active ? "scale-110 shadow-[0_0_15px_rgba(250,204,21,0.6)] ring-2 ring-yellow-400 z-10" : "hover:scale-105 opacity-90 hover:opacity-100"}`}
		>
			<div
				className={`absolute inset-0 rounded-full bg-gradient-to-br ${colorClass} opacity-90`}
			/>
			<div className="absolute inset-1 rounded-full border-[3px] border-dashed border-white/20" />
			<div className="absolute inset-2 rounded-full border border-white/10" />
			<span className={`relative ${textColor} drop-shadow-md`}>{amount}</span>
		</button>
	);
}
