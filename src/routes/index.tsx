import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Gamepad2, LogIn, Plus, Users } from "lucide-react";
import { useState } from "react";
import {
	createSessionFn,
	joinSessionFn,
	listSessionsFn,
} from "#/lib/server-fns";

export const Route = createFileRoute("/")({
	loader: () => listSessionsFn(),
	component: LobbyPage,
});

function LobbyPage() {
	const sessions = Route.useLoaderData();
	const navigate = useNavigate();
	const [playerName, setPlayerName] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [showJoin, setShowJoin] = useState<string | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleCreate() {
		if (!playerName.trim()) {
			setError("Enter your name");
			return;
		}
		setLoading(true);
		setError("");
		try {
			const result = await createSessionFn({
				data: { hostName: playerName.trim() },
			});
			sessionStorage.setItem(`player_${result.sessionId}`, result.playerId);
			sessionStorage.setItem("playerName", playerName.trim());
			navigate({
				to: "/game/$sessionId",
				params: { sessionId: result.sessionId },
			});
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to create session");
		} finally {
			setLoading(false);
		}
	}

	async function handleJoin(sessionId: string) {
		if (!playerName.trim()) {
			setError("Enter your name");
			return;
		}
		setLoading(true);
		setError("");
		try {
			const result = await joinSessionFn({
				data: { sessionId, playerName: playerName.trim() },
			});
			sessionStorage.setItem(`player_${result.sessionId}`, result.playerId);
			sessionStorage.setItem("playerName", playerName.trim());
			navigate({
				to: "/game/$sessionId",
				params: { sessionId: result.sessionId },
			});
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to join session");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="max-w-4xl mx-auto space-y-8">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-white flex items-center gap-3">
						<Gamepad2 className="w-8 h-8 text-blue-400" />
						Game Lobby
					</h1>
					<p className="text-[#A1A1AA] mt-1">
						Create or join a Pok Deng session
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
				>
					<Plus className="w-4 h-4" />
					New Game
				</button>
			</div>

			{(showCreate || showJoin) && (
				<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-6 space-y-4">
					<h2 className="text-lg font-semibold text-white">
						{showCreate ? "Create New Game" : "Join Game"}
					</h2>
					<div>
						<label
							htmlFor="playerName"
							className="block text-sm text-[#A1A1AA] mb-1"
						>
							Your Name
						</label>
						<input
							id="playerName"
							type="text"
							value={playerName}
							onChange={(e) => setPlayerName(e.target.value)}
							placeholder="Enter your name..."
							className="w-full px-3 py-2 bg-[#18181B] border border-[#3F3F46] rounded-lg text-white placeholder-[#71717A] focus:outline-none focus:border-blue-500"
							maxLength={20}
						/>
					</div>
					{error && <p className="text-red-400 text-sm">{error}</p>}
					<div className="flex gap-3">
						<button
							type="button"
							onClick={() =>
								showCreate ? handleCreate() : showJoin && handleJoin(showJoin)
							}
							disabled={loading}
							className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
						>
							{loading ? "Loading..." : showCreate ? "Create" : "Join"}
						</button>
						<button
							type="button"
							onClick={() => {
								setShowCreate(false);
								setShowJoin(null);
								setError("");
							}}
							className="px-4 py-2 bg-[#3F3F46] hover:bg-[#52525B] text-white rounded-lg font-medium transition-colors"
						>
							Cancel
						</button>
					</div>
				</div>
			)}

			<div className="space-y-3">
				<h2 className="text-lg font-semibold text-[#A1A1AA]">
					Active Sessions
				</h2>
				{sessions.length === 0 ? (
					<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-12 text-center">
						<Gamepad2 className="w-12 h-12 text-[#71717A] mx-auto mb-3" />
						<p className="text-[#71717A]">
							No active sessions. Create one to get started!
						</p>
					</div>
				) : (
					<div className="grid gap-3">
						{sessions.map((s) => (
							<div
								key={s.id}
								className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-4 flex items-center justify-between"
							>
								<div className="flex items-center gap-4">
									<div className="w-10 h-10 bg-[#3F3F46] rounded-lg flex items-center justify-center">
										<Users className="w-5 h-5 text-blue-400" />
									</div>
									<div>
										<p className="text-white font-medium">
											{s.hostName}&apos;s Game
										</p>
										<p className="text-[#71717A] text-sm">
											{s.playerCount}/8 players &middot;{" "}
											<span
												className={
													s.phase === "lobby"
														? "text-green-400"
														: "text-yellow-400"
												}
											>
												{s.phase === "lobby" ? "Waiting" : "In Progress"}
											</span>
										</p>
									</div>
								</div>
								{s.phase === "lobby" && (
									<button
										type="button"
										onClick={() => {
											setShowJoin(s.id);
											setShowCreate(false);
										}}
										className="flex items-center gap-2 px-3 py-2 bg-[#3F3F46] hover:bg-[#52525B] text-white rounded-lg text-sm font-medium transition-colors"
									>
										<LogIn className="w-4 h-4" />
										Join
									</button>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
