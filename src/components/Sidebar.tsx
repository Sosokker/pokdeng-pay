import { Link } from "@tanstack/react-router";
import {
	CreditCard,
	Gamepad2,
	Globe,
	History,
	Home,
	LogOut,
	Menu,
	Settings,
	User,
	Wallet,
	X,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "#/lib/auth";
import { useI18n } from "#/lib/i18n";
import { updatePromptPayGlobalFn } from "#/lib/server-fns";
import { useSidebarMobile } from "#/routes/__root";

const NAV_KEYS = [
	{ to: "/" as const, labelKey: "nav.lobby", icon: Home },
	{ to: "/history" as const, labelKey: "nav.history", icon: History },
] as const;

export function Sidebar() {
	const [collapsed, setCollapsed] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [promptPayInput, setPromptPayInput] = useState("");
	const { t, toggleLang } = useI18n();
	const { user, logout, updatePromptPayId } = useAuth();
	const mobile = useSidebarMobile();

	async function handleSavePromptPay() {
		updatePromptPayId(promptPayInput);
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith("player_")) {
				const sessionId = key.replace("player_", "");
				const playerId = localStorage.getItem(key);
				const token = localStorage.getItem(`token_${sessionId}`);
				if (sessionId && playerId) {
					try {
						await updatePromptPayGlobalFn({
							data: {
								sessionId,
								playerId,
								promptPayId: promptPayInput.trim(),
								token: token || undefined,
							},
						});
					} catch {}
				}
			}
		}
		setShowSettings(false);
	}

	function handleNavClick() {
		mobile.close();
	}

	const sidebarContent = (
		<>
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
					onClick={() => {
						if (window.innerWidth < 768) {
							mobile.close();
						} else {
							setCollapsed(!collapsed);
						}
					}}
					className="p-1 rounded hover:bg-[#3F3F46] text-[#A1A1AA]"
				>
					{collapsed && !mobile.isOpen ? (
						<Menu className="w-5 h-5" />
					) : (
						<X className="w-5 h-5" />
					)}
				</button>
			</div>

			<nav className="flex-1 p-2 space-y-1">
				{NAV_KEYS.map((item) => (
					<Link
						key={item.to}
						to={item.to}
						onClick={handleNavClick}
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
				{user && !collapsed && (
					<div className="px-3 py-2 rounded-lg bg-[#3F3F46]/40">
						<div className="flex items-center gap-2">
							<User className="w-4 h-4 text-blue-400 shrink-0" />
							<span className="text-sm text-white font-medium truncate">
								{user.name}
							</span>
						</div>
						{user.promptPayId && (
							<div className="flex items-center gap-1 mt-1">
								<Wallet className="w-3 h-3 text-green-400 shrink-0" />
								<span className="text-xs text-[#71717A] truncate">
									{user.promptPayId}
								</span>
							</div>
						)}
					</div>
				)}
				{user && collapsed && (
					<div className="flex items-center justify-center py-1">
						<User className="w-5 h-5 text-blue-400" />
					</div>
				)}

				<button
					type="button"
					onClick={() => setShowSettings(true)}
					className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#A1A1AA] hover:bg-[#3F3F46] hover:text-white transition-colors w-full"
				>
					<Settings className="w-5 h-5 shrink-0" />
					{!collapsed && (
						<span className="text-sm font-medium">
							{t("auth.changeSettings")}
						</span>
					)}
				</button>

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

				<button
					type="button"
					onClick={logout}
					className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#A1A1AA] hover:bg-red-500/20 hover:text-red-400 transition-colors w-full"
				>
					<LogOut className="w-5 h-5 shrink-0" />
					{!collapsed && (
						<span className="text-sm font-medium">{t("auth.logout")}</span>
					)}
				</button>

				{!collapsed && (
					<div className="flex items-center gap-2 px-3 py-1 text-xs text-[#71717A]">
						<CreditCard className="w-4 h-4" />
						<span>{t("app.subtitle")}</span>
					</div>
				)}
			</div>
		</>
	);

	return (
		<>
			{/* Desktop sidebar */}
			<aside
				className={`hidden md:flex ${collapsed ? "w-16" : "w-56"} bg-[#27272A] border-r border-[#3F3F46] min-h-screen flex-col transition-all duration-200 shrink-0`}
			>
				{sidebarContent}
			</aside>

			{/* Mobile overlay sidebar */}
			{mobile.isOpen && (
				<>
					<button
						type="button"
						aria-label="Close menu"
						className="md:hidden fixed inset-0 z-40 bg-black/60 cursor-default"
						onClick={mobile.close}
					/>
					<aside className="md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[#27272A] border-r border-[#3F3F46] flex flex-col transform transition-transform duration-200">
						{sidebarContent}
					</aside>
				</>
			)}

			{/* Settings modal */}
			{showSettings && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
					<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-6 w-full max-w-sm mx-4 space-y-4">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-semibold text-white">
								{t("auth.changeSettings")}
							</h2>
							<button
								type="button"
								onClick={() => setShowSettings(false)}
								className="p-1 rounded hover:bg-[#3F3F46] text-[#A1A1AA]"
							>
								<X className="w-5 h-5" />
							</button>
						</div>

						{user && (
							<div className="space-y-1">
								<p className="text-sm text-[#A1A1AA]">
									{t("auth.loggedInAs", user.name)}
								</p>
								<p className="text-xs text-[#71717A]">
									{user.authType === "guest"
										? t("auth.guestMode")
										: `${user.oauthProvider} account`}
								</p>
							</div>
						)}

						<div>
							<label
								htmlFor="sidebarPromptPay"
								className="block text-sm text-[#A1A1AA] mb-1 flex items-center gap-1"
							>
								<Wallet className="w-3 h-3" />
								{t("auth.promptPayId")}
							</label>
							<input
								id="sidebarPromptPay"
								type="text"
								defaultValue={user?.promptPayId ?? ""}
								onChange={(e) => setPromptPayInput(e.target.value)}
								placeholder={t("auth.promptPayPlaceholder")}
								className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-lg text-white placeholder-[#71717A] focus:outline-none focus:border-blue-500 text-sm"
							/>
							<p className="text-xs text-[#71717A] mt-1">
								{t("auth.promptPayHint")}
							</p>
						</div>

						<div className="flex gap-3">
							<button
								type="button"
								onClick={handleSavePromptPay}
								className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
							>
								{t("game.save")}
							</button>
							<button
								type="button"
								onClick={() => setShowSettings(false)}
								className="px-4 py-2 bg-[#3F3F46] hover:bg-[#52525B] text-white rounded-lg text-sm font-medium transition-colors"
							>
								{t("lobby.cancel")}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
