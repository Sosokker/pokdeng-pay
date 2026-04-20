import { LogIn, User, Wallet } from "lucide-react";
import { useState } from "react";
import { useAuth } from "#/lib/auth";
import { useI18n } from "#/lib/i18n";

export function LoginForm() {
	const { loginAsGuest, loginWithGoogle, isLoading } = useAuth();
	const { t } = useI18n();
	const [name, setName] = useState("");
	const [promptPayId, setPromptPayId] = useState("");
	const [error, setError] = useState("");
	const [showAdvanced, setShowAdvanced] = useState(false);

	function handleGuestLogin() {
		if (!name.trim()) {
			setError(t("auth.nameRequired"));
			return;
		}
		if (name.trim().length < 2) {
			setError(t("auth.nameTooShort"));
			return;
		}
		if (name.trim().length > 20) {
			setError(t("auth.nameTooLong"));
			return;
		}
		setError("");
		loginAsGuest(name.trim(), promptPayId.trim() || undefined);
	}

	function handleGoogleLogin() {
		// Placeholder - show message that it's coming soon
		setError(t("auth.googleComingSoon"));
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<div className="text-[#71717A]">{t("auth.loading")}</div>
			</div>
		);
	}

	return (
		<div className="max-w-md mx-auto mt-12">
			<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-6 space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-white mb-2">
						{t("auth.welcome")}
					</h1>
					<p className="text-[#A1A1AA] text-sm">{t("auth.chooseMethod")}</p>
				</div>

				{error && (
					<div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
						{error}
					</div>
				)}

				{/* Guest Login */}
				<div className="space-y-4">
					<div className="flex items-center gap-2 text-[#A1A1AA] text-sm">
						<User className="w-4 h-4" />
						{t("auth.guestMode")}
					</div>

					<div>
						<label
							htmlFor="guestName"
							className="block text-sm text-[#A1A1AA] mb-1"
						>
							{t("auth.yourName")}
						</label>
						<input
							id="guestName"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleGuestLogin()}
							placeholder={t("auth.namePlaceholder")}
							className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-lg text-white placeholder-[#71717A] focus:outline-none focus:border-blue-500"
							maxLength={20}
						/>
					</div>

					<button
						type="button"
						onClick={() => setShowAdvanced(!showAdvanced)}
						className="text-xs text-[#71717A] hover:text-[#A1A1AA] transition-colors"
					>
						{showAdvanced ? t("auth.hideAdvanced") : t("auth.showAdvanced")}
					</button>

					{showAdvanced && (
						<div>
							<label
								htmlFor="promptPayId"
								className="block text-sm text-[#A1A1AA] mb-1 flex items-center gap-1"
							>
								<Wallet className="w-3 h-3" />
								{t("auth.promptPayId")}
							</label>
							<input
								id="promptPayId"
								type="text"
								value={promptPayId}
								onChange={(e) => setPromptPayId(e.target.value)}
								placeholder={t("auth.promptPayPlaceholder")}
								className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-lg text-white placeholder-[#71717A] focus:outline-none focus:border-blue-500"
							/>
							<p className="text-xs text-[#71717A] mt-1">
								{t("auth.promptPayHint")}
							</p>
						</div>
					)}

					<button
						type="button"
						onClick={handleGuestLogin}
						className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
					>
						<User className="w-4 h-4" />
						{t("auth.continueAsGuest")}
					</button>
				</div>

				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-[#3F3F46]" />
					</div>
					<div className="relative flex justify-center text-sm">
						<span className="px-2 bg-[#27272A] text-[#71717A]">
							{t("auth.or")}
						</span>
					</div>
				</div>

				{/* Google OAuth Placeholder */}
				<div className="space-y-4">
					<div className="flex items-center gap-2 text-[#A1A1AA] text-sm">
						<LogIn className="w-4 h-4" />
						{t("auth.socialLogin")}
					</div>

					<button
						type="button"
						onClick={handleGoogleLogin}
						disabled
						className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3F3F46] text-[#71717A] rounded-lg font-medium cursor-not-allowed opacity-60"
						title={t("auth.googleComingSoon")}
					>
						<svg
							className="w-4 h-4"
							viewBox="0 0 24 24"
							aria-hidden="true"
							role="img"
						>
							<path
								fill="currentColor"
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							/>
							<path
								fill="currentColor"
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							/>
							<path
								fill="currentColor"
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							/>
							<path
								fill="currentColor"
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							/>
						</svg>
						{t("auth.continueWithGoogle")}
						<span className="text-xs ml-1">({t("auth.comingSoon")})</span>
					</button>

					<p className="text-xs text-[#71717A] text-center">
						{t("auth.googleNote")}
					</p>
				</div>
			</div>
		</div>
	);
}
