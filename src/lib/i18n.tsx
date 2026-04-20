import { createContext, useCallback, useContext, useState } from "react";

export type Lang = "en" | "th";

type TranslationValue = string | ((...args: unknown[]) => string);
type TranslationDict = Record<string, TranslationValue>;

const en: TranslationDict = {
	"app.title": "Pok Deng",
	"app.subtitle": "PromptPay Settlement",

	"nav.lobby": "Lobby",
	"nav.history": "History",

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
	"game.you": "(You)",

	"game.handType.pok": "Pok",
	"game.handType.tong": "Tong",
	"game.handType.sam-lueang": "Sam Lueang",
	"game.handType.normal": "",
	"game.deng": "Deng",

	"game.phase.lobby": "Lobby",
	"game.phase.betting": "Betting",
	"game.phase.playing": "Playing",
	"game.phase.reveal": "Reveal",
	"game.phase.ended": "Ended",

	"settlement.title": "Session Settlement",
	"settlement.owesDealer": (amount: number) => `Owes ${amount} THB to dealer`,
	"settlement.paymentResolution": "Payment Resolution",
	"settlement.paymentHint":
		"After sending/receiving payment via PromptPay, confirm receipt below.",
	"settlement.confirmed": "Confirmed",
	"settlement.disputed": "Disputed",
	"settlement.received": "Received",
	"settlement.notReceived": "Not Received",
	"settlement.disputedMsg":
		"Some payments are disputed. Please resolve offline and re-confirm.",
	"settlement.resetDisputed": "Reset Disputed",
	"settlement.generateQr": "Generate PromptPay QR",
	"settlement.recipientLabel": "Recipient PromptPay ID (Phone or Citizen ID)",
	"settlement.qrFor": (name: string, amount: number) =>
		`QR for ${name} (${amount} THB)`,
	"settlement.scanToPay": "Scan to pay with any banking app",
	"settlement.backToLobby": "Back to Lobby",

	"history.title": "Session History",
	"history.subtitle":
		"History is stored per session. View past rounds during an active game.",
	"history.empty":
		"Join a game session to see round-by-round history and settlement details.",

	"error.failedLoad": "Failed to load game",
	"error.actionFailed": "Action failed",
	"error.failedEnd": "Failed to end session",
	"error.failedQr": "Failed to generate QR",

	"lang.toggle": "ภาษาไทย",
};

const th: TranslationDict = {
	"app.title": "ป๊อกเด้ง",
	"app.subtitle": "ชำระเงิน PromptPay",

	"nav.lobby": "ห้องรวม",
	"nav.history": "ประวัติ",

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
	"game.you": "(คุณ)",

	"game.handType.pok": "ป๊อก",
	"game.handType.tong": "ตอง",
	"game.handType.sam-lueang": "สามเหลือง",
	"game.handType.normal": "",
	"game.deng": "เด้ง",

	"game.phase.lobby": "ห้องรวม",
	"game.phase.betting": "วางเดิมพัน",
	"game.phase.playing": "เล่น",
	"game.phase.reveal": "เปิดไพ่",
	"game.phase.ended": "จบ",

	"settlement.title": "สรุปยอดเซสชัน",
	"settlement.owesDealer": (amount: number) => `ต้องจ่าย ${amount} บาทให้เจ้ามือ`,
	"settlement.paymentResolution": "ยืนยันการชำระเงิน",
	"settlement.paymentHint": "หลังจากชำระเงินผ่าน PromptPay กรุณายืนยันด้านล่าง",
	"settlement.confirmed": "ยืนยันแล้ว",
	"settlement.disputed": "มีปัญหา",
	"settlement.received": "ได้รับแล้ว",
	"settlement.notReceived": "ยังไม่ได้รับ",
	"settlement.disputedMsg": "มีการชำระเงินที่มีปัญหา กรุณาแก้ไขแล้วยืนยันใหม่",
	"settlement.resetDisputed": "รีเซ็ตรายการที่มีปัญหา",
	"settlement.generateQr": "สร้าง QR PromptPay",
	"settlement.recipientLabel": "หมายเลข PromptPay (เบอร์โทรหรือบัตรประชาชน)",
	"settlement.qrFor": (name: string, amount: number) =>
		`QR สำหรับ ${name} (${amount} บาท)`,
	"settlement.scanToPay": "สแกนเพื่อชำระผ่านแอปธนาคาร",
	"settlement.backToLobby": "กลับไปห้องรวม",

	"history.title": "ประวัติเซสชัน",
	"history.subtitle": "ประวัติจะเก็บตามเซสชัน ดูรอบที่ผ่านมาในเกมที่เล่นอยู่",
	"history.empty": "เข้าร่วมเซสชันเพื่อดูประวัติรอบและรายละเอียดการชำระเงิน",

	"error.failedLoad": "โหลดเกมไม่สำเร็จ",
	"error.actionFailed": "ดำเนินการไม่สำเร็จ",
	"error.failedEnd": "จบเซสชันไม่สำเร็จ",
	"error.failedQr": "สร้าง QR ไม่สำเร็จ",

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
