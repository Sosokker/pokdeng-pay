import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";

// Auth types
export type AuthType = "guest" | "google";

export interface User {
	id: string;
	name: string;
	authType: AuthType;
	oauthProvider?: string;
	oauthId?: string;
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
	loginWithGoogle: () => void; // Placeholder for future OAuth
	logout: () => void;
	updatePromptPayId: (promptPayId: string) => void;
	updateName: (name: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Generate a unique guest ID
function generateGuestId(): string {
	const arr = new Uint8Array(16);
	crypto.getRandomValues(arr);
	return `guest_${Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

// Storage keys
const AUTH_STORAGE_KEY = "pokdeng-auth";

export function AuthProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<AuthState>({
		user: null,
		isLoading: true,
		isAuthenticated: false,
	});

	// Load auth state from localStorage on mount
	useEffect(() => {
		if (typeof window === "undefined") {
			setState((prev) => ({ ...prev, isLoading: false }));
			return;
		}

		try {
			const stored = localStorage.getItem(AUTH_STORAGE_KEY);
			if (stored) {
				const user = JSON.parse(stored) as User;
				setState({
					user,
					isLoading: false,
					isAuthenticated: true,
				});
			} else {
				setState((prev) => ({ ...prev, isLoading: false }));
			}
		} catch {
			localStorage.removeItem(AUTH_STORAGE_KEY);
			setState((prev) => ({ ...prev, isLoading: false }));
		}
	}, []);

	const loginAsGuest = useCallback((name: string, promptPayId?: string) => {
		const trimmedName = name.trim();
		if (!trimmedName) return;

		const user: User = {
			id: generateGuestId(),
			name: trimmedName,
			authType: "guest",
			promptPayId: promptPayId?.trim() || undefined,
			createdAt: Date.now(),
		};

		localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
		// Also store name in sessionStorage for backward compatibility
		sessionStorage.setItem("playerName", trimmedName);

		setState({
			user,
			isLoading: false,
			isAuthenticated: true,
		});
	}, []);

	const loginWithGoogle = useCallback(() => {
		// Placeholder for Google OAuth
		// This will be implemented when OAuth is set up
		console.warn("Google OAuth not yet implemented");
	}, []);

	const logout = useCallback(() => {
		localStorage.removeItem(AUTH_STORAGE_KEY);
		sessionStorage.removeItem("playerName");
		setState({
			user: null,
			isLoading: false,
			isAuthenticated: false,
		});
	}, []);

	const updatePromptPayId = useCallback((promptPayId: string) => {
		setState((prev) => {
			if (!prev.user) return prev;

			const updatedUser: User = {
				...prev.user,
				promptPayId: promptPayId.trim() || undefined,
			};

			localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));

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

			localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
			sessionStorage.setItem("playerName", trimmedName);

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
