import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { AlertTriangle, Menu, RefreshCw } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "#/lib/auth";
import { I18nProvider, useI18n } from "#/lib/i18n";
import { LoginForm } from "../components/LoginForm";
import { Sidebar } from "../components/Sidebar";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

interface SidebarMobileContextValue {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
}

const SidebarMobileContext = createContext<SidebarMobileContextValue>({
	isOpen: false,
	open: () => {},
	close: () => {},
	toggle: () => {},
});

export function useSidebarMobile() {
	return useContext(SidebarMobileContext);
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Pok Deng - Online Card Game" },
			{
				httpEquiv: "X-Content-Type-Options",
				content: "nosniff",
			},
			{
				httpEquiv: "X-Frame-Options",
				content: "DENY",
			},
			{
				httpEquiv: "Referrer-Policy",
				content: "strict-origin-when-cross-origin",
			},
			{
				httpEquiv: "Permissions-Policy",
				content: "camera=(), microphone=(), geolocation=()",
			},
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
			},
		],
	}),
	component: RootComponent,
	shellComponent: RootDocument,
	errorComponent: RootErrorComponent,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="font-sans antialiased bg-[#18181B] text-[#FAFAFA]">
				{children}
				<Scripts />
			</body>
		</html>
	);
}

function RootErrorComponent({ error }: { error: Error }) {
	return (
		<div className="flex items-center justify-center min-h-screen p-6">
			<div className="max-w-md w-full bg-[#27272A] border border-[#3F3F46] rounded-xl p-6 space-y-4 text-center">
				<AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto" />
				<h1 className="text-xl font-bold text-white">Something went wrong</h1>
				<p className="text-sm text-[#A1A1AA] break-words">
					{error.message || "An unexpected error occurred."}
				</p>
				<button
					type="button"
					onClick={() => window.location.reload()}
					className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
				>
					<RefreshCw className="w-4 h-4" />
					Reload
				</button>
			</div>
		</div>
	);
}

function AppShell() {
	const { isAuthenticated, isLoading } = useAuth();
	const [sidebarOpen, setSidebarOpen] = useState(false);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-[#71717A] animate-pulse">Loading…</div>
			</div>
		);
	}

	if (!isAuthenticated) {
		return (
			<div className="min-h-screen p-6">
				<LoginForm />
			</div>
		);
	}

	const ctx: SidebarMobileContextValue = {
		isOpen: sidebarOpen,
		open: () => setSidebarOpen(true),
		close: () => setSidebarOpen(false),
		toggle: () => setSidebarOpen((v) => !v),
	};

	return (
		<SidebarMobileContext.Provider value={ctx}>
			<div className="flex min-h-screen">
				<Sidebar />
				<main className="flex-1 p-4 md:p-6 overflow-auto">
					<button
						type="button"
						onClick={ctx.toggle}
						className="md:hidden fixed top-3 left-3 z-40 p-2 bg-[#27272A] border border-[#3F3F46] rounded-lg text-[#A1A1AA] hover:bg-[#3F3F46] transition-colors"
					>
						<Menu className="w-5 h-5" />
					</button>
					<Outlet />
				</main>
			</div>
		</SidebarMobileContext.Provider>
	);
}

function RootComponent() {
	return (
		<I18nProvider>
			<LangUpdater />
			<AuthProvider>
				<AppShell />
			</AuthProvider>
		</I18nProvider>
	);
}

function LangUpdater() {
	const { lang } = useI18n();
	useEffect(() => {
		document.documentElement.lang = lang;
	}, [lang]);
	return null;
}
