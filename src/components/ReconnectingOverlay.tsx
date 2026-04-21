import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18nSafe } from "#/lib/i18n";

export function ReconnectingOverlay({ isConnected }: { isConnected: boolean }) {
	const [show, setShow] = useState(false);
	const { t } = useI18nSafe();

	useEffect(() => {
		if (!isConnected) {
			const timer = setTimeout(() => setShow(true), 5000);
			return () => clearTimeout(timer);
		} else {
			setShow(false);
		}
	}, [isConnected]);

	if (!show) return null;

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
			<div className="bg-[#18181B] border border-red-500/30 rounded-2xl p-8 flex flex-col items-center shadow-2xl max-w-sm w-[90%] text-center">
				<div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4 animate-pulse">
					<WifiOff className="w-8 h-8 text-red-500" />
				</div>
				<h2 className="text-xl font-bold text-white mb-2">
					{t("connection.lost")}
				</h2>
				<p className="text-[#A1A1AA]">{t("connection.reconnecting")}</p>
			</div>
		</div>
	);
}
