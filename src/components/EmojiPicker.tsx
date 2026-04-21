import { Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18nSafe } from "#/lib/i18n";

const EMOJIS = [
	"👍",
	"👎",
	"😂",
	"😢",
	"😡",
	"👀",
	"💰",
	"💸",
	"🎉",
	"🔥",
	"🤔",
	"👏",
];

export function EmojiPicker({
	onSelect,
}: {
	onSelect: (emoji: string) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const { t } = useI18nSafe();

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};
		if (isOpen) document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	return (
		<div className="relative" ref={ref}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="p-2.5 rounded-full transition border bg-white/5 hover:bg-white/10 border-white/10 text-gray-300"
				title={t("game.react")}
			>
				<Smile className="w-4 h-4" />
			</button>

			{isOpen && (
				<div className="absolute bottom-full right-0 mb-2 p-2 bg-[#18181B] border border-white/10 rounded-xl shadow-2xl z-50 grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-bottom-2">
					{EMOJIS.map((emoji) => (
						<button
							key={emoji}
							type="button"
							onClick={() => {
								onSelect(emoji);
								setIsOpen(false);
							}}
							className="w-10 h-10 flex items-center justify-center text-xl hover:bg-white/10 rounded-lg transition-colors hover:scale-110 active:scale-95"
						>
							{emoji}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
