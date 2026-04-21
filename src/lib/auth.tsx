import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

export type AuthType = "guest" | "google";

export interface User {
	id: string;
	name: string;
	authType: AuthType;
	oauthProvider?: string;
	promptPayId?: string;
	createdAt: number;
}

export interface AuthState {
	user: User | null;
	isLoading: boolean;
	isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
	loginAsGuest: (name: string, promptPayId?: string) => void;
	loginWithGoogle: () => void;
	logout: () => void;
	updatePromptPayId: (promptPayId: string) => void;
	updateName: (name: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function clearStalePlayerData() {
	const keysToRemove: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key && (key.startsWith("player_") || key.startsWith("token_"))) {
			keysToRemove.push(key);
		}
	}
	for (const key of keysToRemove) {
		localStorage.removeItem(key);
	}
	for (let i = 0; i < sessionStorage.length; i++) {
		const key = sessionStorage.key(i);
		if (key?.startsWith("playedAs_")) {
			sessionStorage.removeItem(key);
		}
	}
}

async function fetchAuthUser(): Promise<User | null> {
	try {
		const res = await fetch("/api/auth/me", { credentials: "include" });
		if (!res.ok) return null;
		const data = await res.json();
		if (!data.user) return null;
		return {
			id: data.user.id,
			name: data.user.name,
			authType: "google" as AuthType,
			oauthProvider: data.user.oauthProvider,
			promptPayId: data.user.promptPayId || undefined,
			createdAt: data.user.createdAt || Date.now(),
		};
	} catch {
		return null;
	}
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<AuthState>({
		user: null,
		isLoading: true,
		isAuthenticated: false,
	});

	useEffect(() => {
		if (typeof window === "undefined") {
			setState((prev) => ({ ...prev, isLoading: false }));
			return;
		}

		fetchAuthUser().then((authUser) => {
			if (authUser) {
				setState({
					user: authUser,
					isLoading: false,
					isAuthenticated: true,
				});
				return;
			}

			const guestName = sessionStorage.getItem("playerName");
			if (guestName) {
				setState({
					user: {
						id: "",
						name: guestName,
						authType: "guest",
						createdAt: Date.now(),
					},
					isLoading: false,
					isAuthenticated: true,
				});
			} else {
				setState((prev) => ({ ...prev, isLoading: false }));
			}
		});
	}, []);

	const loginAsGuest = useCallback((name: string, promptPayId?: string) => {
		const trimmedName = name.trim();
		if (!trimmedName) return;

		sessionStorage.setItem("playerName", trimmedName);

		setState({
			user: {
				id: "",
				name: trimmedName,
				authType: "guest",
				promptPayId: promptPayId?.trim() || undefined,
				createdAt: Date.now(),
			},
			isLoading: false,
			isAuthenticated: true,
		});
	}, []);

	const loginWithGoogle = useCallback(() => {
		window.location.href = "/api/auth/login";
	}, []);

	const logout = useCallback(async () => {
		clearStalePlayerData();
		sessionStorage.removeItem("playerName");

		if (state.user?.authType === "google") {
			try {
				await fetch("/api/auth/logout", { method: "POST" });
			} catch {}
		}

		setState({
			user: null,
			isLoading: false,
			isAuthenticated: false,
		});
	}, [state.user?.authType]);

	const updatePromptPayId = useCallback((promptPayId: string) => {
		setState((prev) => {
			if (!prev.user) return prev;

			const updatedUser: User = {
				...prev.user,
				promptPayId: promptPayId.trim() || undefined,
			};

			return {
				...prev,
				user: updatedUser,
			};
		});
	}, []);

	const updateName = useCallback((name: string) => {
		const trimmedName = name.trim();
		if (!trimmedName) return;

		setState((prev) => {
			if (!prev.user) return prev;

			const updatedUser: User = {
				...prev.user,
				name: trimmedName,
			};

			if (prev.user.authType === "guest") {
				sessionStorage.setItem("playerName", trimmedName);
			}

			return {
				...prev,
				user: updatedUser,
			};
		});
	}, []);

	return (
		<AuthContext.Provider
			value={{
				...state,
				loginAsGuest,
				loginWithGoogle,
				logout,
				updatePromptPayId,
				updateName,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return ctx;
}

export function useAuthSafe(): AuthState & {
	loginAsGuest: (name: string, promptPayId?: string) => void;
	logout: () => void;
} {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		return {
			user: null,
			isLoading: false,
			isAuthenticated: false,
			loginAsGuest: () => {},
			logout: () => {},
		};
	}
	return ctx;
}
