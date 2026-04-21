import { Wallet } from "lucide-react";
import { useI18n } from "#/lib/i18n";

interface PromptPayEditorProps {
	promptPayInput: string;
	onPromptPayInputChange: (value: string) => void;
	onSave: () => void;
	saving: boolean;
}

export function PromptPayEditor({
	promptPayInput,
	onPromptPayInputChange,
	onSave,
	saving,
}: PromptPayEditorProps) {
	const { t } = useI18n();

	return (
		<div className="absolute top-16 right-4 z-50 w-80 bg-[#18181B] border border-white/10 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-4">
			<h3 className="text-sm font-semibold text-yellow-400 mb-1 flex items-center gap-2 uppercase tracking-wide">
				<Wallet className="w-4 h-4" /> {t("game.setupPromptPay")}
			</h3>
			<p className="text-[10px] text-gray-500 mb-3">
				{t("auth.promptPayHint")}
			</p>
			<div className="flex gap-2">
				<input
					type="text"
					value={promptPayInput}
					onChange={(e) => onPromptPayInputChange(e.target.value)}
					placeholder={t("auth.promptPayPlaceholder")}
					className="flex-1 px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
				/>
				<button
					type="button"
					onClick={onSave}
					disabled={saving}
					className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-black rounded-lg text-sm font-bold uppercase tracking-wide transition shadow-[0_0_10px_rgba(202,138,4,0.3)]"
				>
					{t("game.save")}
				</button>
			</div>
		</div>
	);
}
