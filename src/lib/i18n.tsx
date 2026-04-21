import { createContext, useCallback, useContext, useState } from "react";

export type Lang = "en" | "th";

type TranslationValue = string | ((...args: any[]) => string);
type TranslationDict = Record<string, TranslationValue>;

const en: TranslationDict = {
	"app.title": "Pok Deng",
	"app.subtitle": "PromptPay Settlement",

	"nav.lobby": "Lobby",
	"nav.history": "History",

	"auth.welcome": "Welcome to Pok Deng",
	"auth.chooseMethod": "Choose how you want to play",
	"auth.loading": "Loading...",
	"auth.guestMode": "Play as Guest",
	"auth.yourName": "Your Display Name",
	"auth.namePlaceholder": "Enter your name...",
	"auth.nameRequired": "Please enter your name",
	"auth.nameTooShort": "Name must be at least 2 characters",
	"auth.nameTooLong": "Name must be 20 characters or less",
	"auth.promptPayId": "PromptPay ID (Optional)",
	"auth.promptPayPlaceholder": "Phone number or Citizen ID",
	"auth.promptPayHint": "Used when others need to pay you",
	"auth.continueAsGuest": "Continue as Guest",
	"auth.showAdvanced": "Show payment settings",
	"auth.hideAdvanced": "Hide payment settings",
	"auth.or": "or",
	"auth.socialLogin": "Sign in with account",
	"auth.continueWithGoogle": "Continue with Google",
	"auth.comingSoon": "Coming Soon",
	"auth.googleComingSoon": "Google sign-in coming soon!",
	"auth.googleNote": "Sign in with Google to save your progress across devices",
	"auth.loggedInAs": (name: string) => `Logged in as ${name}`,
	"auth.logout": "Logout",
	"auth.changeSettings": "Settings",
	"auth.invalidPromptPayId":
		"Invalid PromptPay ID. Must be 10 digits (phone) or 13 digits (Citizen ID)",

	"lobby.title": "Game Lobby",
	"lobby.subtitle": "Create or join a Pok Deng session",
	"lobby.newGame": "New Game",
	"lobby.createGame": "Create New Game",
	"lobby.joinGame": "Join Game",
	"lobby.yourName": "Your Name",
	"lobby.namePlaceholder": "Enter your name...",
	"lobby.nameRequired": "Enter your name",
	"lobby.loading": "Loading...",
	"lobby.create": "Create",
	"lobby.join": "Join",
	"lobby.cancel": "Cancel",
	"lobby.activeSessions": "Active Sessions",
	"lobby.noSessions": "No active sessions. Create one to get started!",
	"lobby.sGame": (name: string) => `${name}'s Game`,
	"lobby.players": (count: number, max: number) => `${count}/${max} players`,
	"lobby.waiting": "Waiting",
	"lobby.inProgress": "In Progress",
	"lobby.failedCreate": "Failed to create session",
	"lobby.failedJoin": "Failed to join session",

	"game.round": "Round",
	"game.phase": "Phase",
	"game.players": "players",
	"game.mute": "Mute",
	"game.unmute": "Unmute",
	"game.refresh": "Refresh",
	"game.leave": "Leave",
	"game.loading": "Loading game...",
	"game.playersBalances": "Players & Balances",
	"game.bet": "Bet",
	"game.dealerHand": "Dealer's Hand",
	"game.yourHand": "Your Hand",
	"game.taem": "Taem",
	"game.actions": "Actions",
	"game.startRound": "Start Round",
	"game.waitingHost": "Waiting for host to start...",
	"game.placeBet": "Place Bet",
	"game.dealCards": "Deal Cards",
	"game.draw": "Draw",
	"game.stand": "Stand",
	"game.waitingOthers": "Waiting for other players and dealer...",
	"game.waitingPlayers": "Waiting for players to act...",
	"game.nextRound": "Next Round",
	"game.endSession": "End Session & Settle",
	"game.waitingNext": "Waiting for host to start next round or end session...",
	"game.confirmLeave": "Are you sure you want to leave the game mid-round?",
	"game.you": "(You)",
	"game.balance": "Balance",
	"game.turnToDeal": (name: string) => `It's ${name} turn to deal!`,
	"game.yourTurnToDeal": "It's your turn to deal!",
	"game.betPlaced": "Bet Placed",
	"game.startGame": "Start Game",
	"game.howToPlay": "How to Play",
	"game.react": "React",
	"game.copyInviteLink": "Copy Invite Link",
	"game.cardSqueezeOn": "Card Squeeze On",
	"game.cardSqueezeOff": "Card Squeeze Off",
	"game.roundHistory": "Round History",
	"game.noHistory": "No history yet.",
	"game.kickPlayer": "Kick Player",
	"game.voteKick": "Vote Kick",
	"game.voteKickCount": (count: number, total: number) =>
		`${count}/${total} votes`,
	"game.playerLeft": "Left",
	"game.noPromptPay": "No PromptPay",
	"game.viewSettlement": "View Settlement",
	"game.end": "End",
	"game.waitingNextRound": "Waiting for next round...",
	"game.dealer": "Dealer",
	"game.setupPromptPay": "Setup PromptPay",
	"game.save": "Save",
	"game.phoneOrId": "Phone / ID",

	"game.handType.pok": "Pok",
	"game.handType.tong": "Tong",
	"game.handType.sam-lueang": "Sam Lueang",
	"game.handType.normal": "Normal",
	"game.deng": "Deng",

	"game.phase.lobby": "Lobby",
	"game.phase.betting": "Betting",
	"game.phase.playing": "Playing",
	"game.phase.reveal": "Reveal",
	"game.phase.ended": "Ended",

	"settlement.title": "Session Settlement",
	"settlement.outstandingPayments": "Outstanding Payments",
	"settlement.allSettled": "All settled. No debts.",
	"settlement.paid": "Paid",
	"settlement.disputed": "Disputed",
	"settlement.exitToLobby": "Exit to Lobby",
	"settlement.owesDealer": (amount: number) => `Owes ${amount} THB to dealer`,
	"settlement.paymentResolution": "Payment Resolution",
	"settlement.paymentHint":
		"After sending/receiving payment via PromptPay, confirm receipt below.",
	"settlement.confirmed": "Confirmed",
	"settlement.disputedMsg":
		"Some payments are disputed. Please resolve offline and re-confirm.",
	"settlement.resetDisputed": "Reset Disputed",
	"settlement.generateQr": "Generate PromptPay QR",
	"settlement.recipientLabel": "Recipient PromptPay ID (Phone or Citizen ID)",
	"settlement.qrFor": (name: string, amount: number) =>
		`QR for ${name} (${amount} THB)`,
	"settlement.scanToPay": "Scan to pay with any banking app",
	"settlement.backToLobby": "Back to Lobby",

	"connection.lost": "Connection Lost",
	"connection.reconnecting": "Reconnecting to the game server... Please wait.",

	"history.title": "Session History",
	"history.subtitle":
		"History is stored per session. View past rounds during an active game.",
	"history.empty":
		"Join a game session to see round-by-round history and settlement details.",

	"error.failedLoad": "Failed to load game",
	"error.actionFailed": "Action failed",
	"error.failedEnd": "Failed to end session",
	"error.failedQr": "Failed to generate QR",
	"error.failedKick": "Failed to kick player",
	"error.sessionExpired": "Session Expired",
	"error.backToLobby": "Back to Lobby",

	"lang.toggle": "ภาษาไทย",
};

const th: TranslationDict = {
	"app.title": "ป๊อกเด้ง",
	"app.subtitle": "ชำระเงิน PromptPay",

	"nav.lobby": "ห้องรวม",
	"nav.history": "ประวัติ",

	"auth.welcome": "ยินดีต้อนรับสู่ป๊อกเด้ง",
	"auth.chooseMethod": "เลือกวิธีการเล่น",
	"auth.loading": "กำลังโหลด...",
	"auth.guestMode": "เล่นแบบแขก",
	"auth.yourName": "ชื่อที่จะแสดง",
	"auth.namePlaceholder": "กรอกชื่อของคุณ...",
	"auth.nameRequired": "กรุณากรอกชื่อ",
	"auth.nameTooShort": "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร",
	"auth.nameTooLong": "ชื่อต้องไม่เกิน 20 ตัวอักษร",
	"auth.promptPayId": "หมายเลข PromptPay (ไม่บังคับ)",
	"auth.promptPayPlaceholder": "เบอร์โทรหรือบัตรประชาชน",
	"auth.promptPayHint": "ใช้เมื่อผู้อื่นต้องจ่ายเงินให้คุณ",
	"auth.continueAsGuest": "เล่นแบบแขก",
	"auth.showAdvanced": "แสดงการตั้งค่าการชำระเงิน",
	"auth.hideAdvanced": "ซ่อนการตั้งค่าการชำระเงิน",
	"auth.or": "หรือ",
	"auth.socialLogin": "ลงชื่อเข้าใช้ด้วยบัญชี",
	"auth.continueWithGoogle": "ลงชื่อเข้าใช้ด้วย Google",
	"auth.comingSoon": "เร็วๆ นี้",
	"auth.googleComingSoon": "การลงชื่อเข้าใช้ Google จะมีเร็วๆ นี้!",
	"auth.googleNote": "ลงชื่อเข้าใช้ด้วย Google เพื่อบันทึกความก้าวหน้าข้ามอุปกรณ์",
	"auth.loggedInAs": (name: string) => `ล็อกอินเป็น ${name}`,
	"auth.logout": "ออกจากระบบ",
	"auth.changeSettings": "ตั้งค่า",
	"auth.invalidPromptPayId":
		"หมายเลข PromptPay ไม่ถูกต้อง ต้องเป็นตัวเลข 10 หลัก (เบอร์โทร) หรือ 13 หลัก (บัตรประชาชน)",

	"lobby.title": "ห้องเกม",
	"lobby.subtitle": "สร้างหรือเข้าร่วมเซสชันป๊อกเด้ง",
	"lobby.newGame": "เกมใหม่",
	"lobby.createGame": "สร้างเกมใหม่",
	"lobby.joinGame": "เข้าร่วมเกม",
	"lobby.yourName": "ชื่อของคุณ",
	"lobby.namePlaceholder": "กรอกชื่อของคุณ...",
	"lobby.nameRequired": "กรุณากรอกชื่อ",
	"lobby.loading": "กำลังโหลด...",
	"lobby.create": "สร้าง",
	"lobby.join": "เข้าร่วม",
	"lobby.cancel": "ยกเลิก",
	"lobby.activeSessions": "เซสชันที่เปิดอยู่",
	"lobby.noSessions": "ไม่มีเซสชัน เริ่มสร้างเลย!",
	"lobby.sGame": (name: string) => `เกมของ ${name}`,
	"lobby.players": (count: number, max: number) => `${count}/${max} ผู้เล่น`,
	"lobby.waiting": "รออยู่",
	"lobby.inProgress": "กำลังเล่น",
	"lobby.failedCreate": "สร้างเซสชันไม่สำเร็จ",
	"lobby.failedJoin": "เข้าร่วมเซสชันไม่สำเร็จ",

	"game.round": "รอบ",
	"game.phase": "ช่วง",
	"game.players": "ผู้เล่น",
	"game.mute": "ปิดเสียง",
	"game.unmute": "เปิดเสียง",
	"game.refresh": "รีเฟรช",
	"game.leave": "ออก",
	"game.loading": "กำลังโหลดเกม...",
	"game.playersBalances": "ผู้เล่นและยอดเงิน",
	"game.bet": "เดิมพัน",
	"game.dealerHand": "ไพ่เจ้ามือ",
	"game.yourHand": "ไพ่คุณ",
	"game.taem": "แต้ม",
	"game.actions": "การกระทำ",
	"game.startRound": "เริ่มรอบ",
	"game.waitingHost": "รอให้เจ้าของเริ่ม...",
	"game.placeBet": "วางเดิมพัน",
	"game.dealCards": "แจกไพ่",
	"game.draw": "จั่ว",
	"game.stand": "อยู่",
	"game.waitingOthers": "รอผู้เล่นคนอื่นและเจ้ามือ...",
	"game.waitingPlayers": "รอผู้เล่นลงมือ...",
	"game.nextRound": "รอบต่อไป",
	"game.endSession": "จบเซสชันและคำนวณ",
	"game.waitingNext": "รอเจ้าของเริ่มรอบใหม่หรือจบเซสชัน...",
	"game.confirmLeave": "คุณแน่ใจหรือไม่ว่าต้องการออกจากเกมระหว่างเล่น?",
	"game.you": "(คุณ)",
	"game.balance": "ยอดเงิน",
	"game.turnToDeal": (name: string) => `ถึงตา ${name} แจกไพ่!`,
	"game.yourTurnToDeal": "ถึงตาคุณแจกไพ่!",
	"game.betPlaced": "วางเดิมพันแล้ว",
	"game.startGame": "เริ่มเกม",
	"game.howToPlay": "วิธีเล่น",
	"game.react": "รีแอ็กต์",
	"game.copyInviteLink": "คัดลอกลิงก์เชิญ",
	"game.cardSqueezeOn": "เปิดบีบไพ่",
	"game.cardSqueezeOff": "ปิดบีบไพ่",
	"game.roundHistory": "ประวัติรอบ",
	"game.noHistory": "ยังไม่มีประวัติ",
	"game.kickPlayer": "เตะผู้เล่น",
	"game.voteKick": "โหวตเตะ",
	"game.voteKickCount": (count: number, total: number) =>
		`${count}/${total} เสียง`,
	"game.playerLeft": "ออกแล้ว",
	"game.noPromptPay": "ไม่มี PromptPay",
	"game.viewSettlement": "ดูสรุปยอด",
	"game.end": "จบ",
	"game.waitingNextRound": "รอรอบต่อไป...",
	"game.dealer": "เจ้ามือ",
	"game.setupPromptPay": "ตั้งค่า PromptPay",
	"game.save": "บันทึก",
	"game.phoneOrId": "เบอร์โทร / บัตร",

	"game.handType.pok": "ป๊อก",
	"game.handType.tong": "ตอง",
	"game.handType.sam-lueang": "สามเหลือง",
	"game.handType.normal": "ปกติ",
	"game.deng": "เด้ง",

	"game.phase.lobby": "ห้องรวม",
	"game.phase.betting": "วางเดิมพัน",
	"game.phase.playing": "เล่น",
	"game.phase.reveal": "เปิดไพ่",
	"game.phase.ended": "จบ",

	"settlement.title": "สรุปยอดเซสชัน",
	"settlement.outstandingPayments": "ยอดที่ต้องชำระ",
	"settlement.allSettled": "เรียบร้อย ไม่มีหนี้ค้าง",
	"settlement.paid": "จ่ายแล้ว",
	"settlement.disputed": "มีปัญหา",
	"settlement.exitToLobby": "กลับไปห้องรวม",
	"settlement.owesDealer": (amount: number) => `ต้องจ่าย ${amount} บาทให้เจ้ามือ`,
	"settlement.paymentResolution": "ยืนยันการชำระเงิน",
	"settlement.paymentHint": "หลังจากชำระเงินผ่าน PromptPay กรุณายืนยันด้านล่าง",
	"settlement.confirmed": "ยืนยันแล้ว",
	"settlement.disputedMsg": "มีการชำระเงินที่มีปัญหา กรุณาแก้ไขแล้วยืนยันใหม่",
	"settlement.resetDisputed": "รีเซ็ตรายการที่มีปัญหา",
	"settlement.generateQr": "สร้าง QR PromptPay",
	"settlement.recipientLabel": "หมายเลข PromptPay (เบอร์โทรหรือบัตรประชาชน)",
	"settlement.qrFor": (name: string, amount: number) =>
		`QR สำหรับ ${name} (${amount} บาท)`,
	"settlement.scanToPay": "สแกนเพื่อชำระผ่านแอปธนาคาร",
	"settlement.backToLobby": "กลับไปห้องรวม",

	"connection.lost": "การเชื่อมต่อขาดหาย",
	"connection.reconnecting": "กำลังเชื่อมต่อใหม่... กรุณารอสักครู่",

	"history.title": "ประวัติเซสชัน",
	"history.subtitle": "ประวัติจะเก็บตามเซสชัน ดูรอบที่ผ่านมาในเกมที่เล่นอยู่",
	"history.empty": "เข้าร่วมเซสชันเพื่อดูประวัติรอบและรายละเอียดการชำระเงิน",

	"error.failedLoad": "โหลดเกมไม่สำเร็จ",
	"error.actionFailed": "ดำเนินการไม่สำเร็จ",
	"error.failedEnd": "จบเซสชันไม่สำเร็จ",
	"error.failedQr": "สร้าง QR ไม่สำเร็จ",
	"error.failedKick": "เตะผู้เล่นไม่สำเร็จ",
	"error.sessionExpired": "เซสชันหมดอายุ",
	"error.backToLobby": "กลับไปห้องรวม",

	"lang.toggle": "English",
};

const dicts: Record<Lang, TranslationDict> = { en, th };

interface I18nContextValue {
	lang: Lang;
	t: (key: string, ...args: unknown[]) => string;
	setLang: (lang: Lang) => void;
	toggleLang: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
	const ctx = useContext(I18nContext);
	if (!ctx) throw new Error("useI18n must be used within I18nProvider");
	return ctx;
}

export function useI18nSafe(): {
	lang: Lang;
	t: (key: string, ...args: unknown[]) => string;
} {
	const ctx = useContext(I18nContext);
	const fallbackLang: Lang = "en";
	const fallbackT = (key: string, ...args: unknown[]): string => {
		const dict = dicts[fallbackLang];
		const val = dict[key];
		if (!val) return key;
		if (typeof val === "function") return val(...args);
		return val;
	};
	if (!ctx) return { lang: fallbackLang, t: fallbackT };
	return ctx;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
	const [lang, setLangState] = useState<Lang>(() => {
		if (typeof window === "undefined") return "en";
		const stored = localStorage.getItem("pokdeng-lang");
		if (stored === "th" || stored === "en") return stored;
		return "en";
	});

	const setLang = useCallback((l: Lang) => {
		setLangState(l);
		if (typeof window !== "undefined") {
			localStorage.setItem("pokdeng-lang", l);
		}
	}, []);

	const toggleLang = useCallback(() => {
		setLang(lang === "en" ? "th" : "en");
	}, [lang, setLang]);

	const t = useCallback(
		(key: string, ...args: unknown[]): string => {
			const dict = dicts[lang];
			const val = dict[key] ?? dicts.en[key];
			if (!val) return key;
			if (typeof val === "function") return val(...args);
			return val;
		},
		[lang],
	);

	return (
		<I18nContext.Provider value={{ lang, t, setLang, toggleLang }}>
			{children}
		</I18nContext.Provider>
	);
}
