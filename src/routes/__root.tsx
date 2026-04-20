import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { AuthProvider, useAuth } from "#/lib/auth";
import { I18nProvider } from "#/lib/i18n";
import { LoginForm } from "../components/LoginForm";
import { Sidebar } from "../components/Sidebar";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Pok Deng - Online Card Game" },
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

function AppShell() {
	const { isAuthenticated, isLoading } = useAuth();

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

	return (
		<div className="flex min-h-screen">
			<Sidebar />
			<main className="flex-1 p-6 overflow-auto">
				<Outlet />
			</main>
		</div>
	);
}

function RootComponent() {
	return (
		<I18nProvider>
			<AuthProvider>
				<AppShell />
			</AuthProvider>
		</I18nProvider>
	);
}
