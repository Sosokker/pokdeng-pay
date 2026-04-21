import { useEffect, useState } from "react";

export function EmojiPopup({ emoji }: { emoji: string; timestamp: number }) {
	const [show, setShow] = useState(true);

	useEffect(() => {
		setShow(true);
		const timer = setTimeout(() => setShow(false), 4000);
		return () => clearTimeout(timer);
	}, []);

	if (!show) return null;

	return (
		<div
			className="absolute -top-14 left-1/2 -translate-x-1/2 text-4xl z-40 pointer-events-none"
			style={{
				animation: "emojiFloat 2s ease-out forwards",
			}}
		>
			<div
				style={{
					animation: "emojiBounce 0.6s ease-in-out infinite alternate",
				}}
			>
				{emoji}
			</div>
			<style>{`
				@keyframes emojiFloat {
					0% { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.5); }
					15% { opacity: 1; transform: translateX(-50%) translateY(-10px) scale(1.3); }
					30% { transform: translateX(-50%) translateY(0px) scale(1); }
					80% { opacity: 1; }
					100% { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(0.8); }
				}
				@keyframes emojiBounce {
					from { transform: translateY(0); }
					to { transform: translateY(-4px); }
				}
			`}</style>
		</div>
	);
}
