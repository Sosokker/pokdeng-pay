import { createFileRoute } from "@tanstack/react-router";
import { History as HistoryIcon } from "lucide-react";
import { useI18n } from "#/lib/i18n";

export const Route = createFileRoute("/history")({
	component: HistoryPage,
});

function HistoryPage() {
	const { t } = useI18n();

	return (
		<div className="max-w-4xl mx-auto space-y-8">
			<div>
				<h1 className="text-3xl font-bold text-white flex items-center gap-3">
					<HistoryIcon className="w-8 h-8 text-blue-400" />
					{t("history.title")}
				</h1>
				<p className="text-[#A1A1AA] mt-1">{t("history.subtitle")}</p>
			</div>

			<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-12 text-center">
				<HistoryIcon className="w-12 h-12 text-[#71717A] mx-auto mb-3" />
				<p className="text-[#71717A]">{t("history.empty")}</p>
			</div>
		</div>
	);
}
