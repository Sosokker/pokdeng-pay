import { Link } from "@tanstack/react-router";
import {
	CreditCard,
	Gamepad2,
	Globe,
	History,
	Home,
	Menu,
	X,
} from "lucide-react";
import { useState } from "react";
import { useI18n } from "#/lib/i18n";

const NAV_KEYS = [
	{ to: "/" as const, labelKey: "nav.lobby", icon: Home },
	{ to: "/history" as const, labelKey: "nav.history", icon: History },
] as const;

export function Sidebar() {
	const [collapsed, setCollapsed] = useState(false);
	const { t, lang, toggleLang } = useI18n();

	return (
		<aside
			className={`${collapsed ? "w-16" : "w-56"} bg-[#27272A] border-r border-[#3F3F46] min-h-screen flex flex-col transition-all duration-200`}
		>
			<div className="flex items-center justify-between p-4 border-b border-[#3F3F46]">
				{!collapsed && (
					<div className="flex items-center gap-2">
						<Gamepad2 className="w-6 h-6 text-blue-400" />
						<span className="font-bold text-white text-lg">
							{t("app.title")}
						</span>
					</div>
				)}
				<button
					type="button"
					onClick={() => setCollapsed(!collapsed)}
					className="p-1 rounded hover:bg-[#3F3F46] text-[#A1A1AA]"
				>
					{collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
				</button>
			</div>

			<nav className="flex-1 p-2 space-y-1">
				{NAV_KEYS.map((item) => (
					<Link
						key={item.to}
						to={item.to}
						className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#A1A1AA] hover:bg-[#3F3F46] hover:text-white transition-colors [&.active]:bg-[#3F3F46] [&.active]:text-white"
						activeProps={{ className: "active bg-[#3F3F46] text-white" }}
					>
						<item.icon className="w-5 h-5 shrink-0" />
						{!collapsed && (
							<span className="text-sm font-medium">{t(item.labelKey)}</span>
						)}
					</Link>
				))}
			</nav>

			<div className="p-2 border-t border-[#3F3F46] space-y-1">
				<button
					type="button"
					onClick={toggleLang}
					className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#A1A1AA] hover:bg-[#3F3F46] hover:text-white transition-colors w-full"
				>
					<Globe className="w-5 h-5 shrink-0" />
					{!collapsed && (
						<span className="text-sm font-medium">{t("lang.toggle")}</span>
					)}
				</button>
				{!collapsed && (
					<div className="flex items-center gap-2 px-3 py-1 text-xs text-[#71717A]">
						<CreditCard className="w-4 h-4" />
						<span>{t("app.subtitle")}</span>
					</div>
				)}
			</div>
		</aside>
	);
}
