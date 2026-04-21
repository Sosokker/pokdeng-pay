import { AlertTriangle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ConfirmDialogProps {
	open: boolean;
	title?: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: "danger" | "warning" | "default";
	onConfirm: () => void;
	onCancel: () => void;
}

export function ConfirmDialog({
	open,
	title,
	message,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	variant = "default",
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const confirmRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (open) {
			setTimeout(() => confirmRef.current?.focus(), 50);
		}
	}, [open]);

	useEffect(() => {
		if (!open) return;
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onCancel();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, onCancel]);

	if (!open) return null;

	const iconColor =
		variant === "danger"
			? "text-red-400"
			: variant === "warning"
				? "text-yellow-400"
				: "text-blue-400";
	const btnClass =
		variant === "danger"
			? "bg-red-600 hover:bg-red-700"
			: variant === "warning"
				? "bg-yellow-600 hover:bg-yellow-700"
				: "bg-blue-600 hover:bg-blue-700";

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="bg-[#27272A] border border-[#3F3F46] rounded-xl p-6 w-full max-w-sm mx-4 space-y-4 animate-in fade-in zoom-in-95 duration-150">
				<div className="flex items-start gap-3">
					<AlertTriangle className={`w-5 h-5 ${iconColor} shrink-0 mt-0.5`} />
					<div className="flex-1 space-y-1">
						{title && (
							<h3 className="text-lg font-semibold text-white">{title}</h3>
						)}
						<p className="text-sm text-[#A1A1AA] leading-relaxed">{message}</p>
					</div>
					<button
						type="button"
						onClick={onCancel}
						className="p-1 rounded hover:bg-[#3F3F46] text-[#A1A1AA] shrink-0"
					>
						<X className="w-4 h-4" />
					</button>
				</div>
				<div className="flex gap-3 justify-end">
					<button
						type="button"
						onClick={onCancel}
						className="px-4 py-2 bg-[#3F3F46] hover:bg-[#52525B] text-white rounded-lg text-sm font-medium transition-colors"
					>
						{cancelLabel}
					</button>
					<button
						ref={confirmRef}
						type="button"
						onClick={onConfirm}
						className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${btnClass}`}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}

export function useConfirmDialog() {
	const [state, setState] = useState<{
		open: boolean;
		title?: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: "danger" | "warning" | "default";
		resolve: ((value: boolean) => void) | null;
	}>({
		open: false,
		message: "",
		resolve: null,
	});

	const confirm = useCallback(
		(opts: {
			title?: string;
			message: string;
			confirmLabel?: string;
			cancelLabel?: string;
			variant?: "danger" | "warning" | "default";
		}): Promise<boolean> => {
			return new Promise((resolve) => {
				setState({
					open: true,
					title: opts.title,
					message: opts.message,
					confirmLabel: opts.confirmLabel,
					cancelLabel: opts.cancelLabel,
					variant: opts.variant,
					resolve,
				});
			});
		},
		[],
	);

	const handleConfirm = useCallback(() => {
		state.resolve?.(true);
		setState((prev) => ({ ...prev, open: false, resolve: null }));
	}, [state.resolve]);

	const handleCancel = useCallback(() => {
		state.resolve?.(false);
		setState((prev) => ({ ...prev, open: false, resolve: null }));
	}, [state.resolve]);

	const dialog = (
		<ConfirmDialog
			open={state.open}
			title={state.title}
			message={state.message}
			confirmLabel={state.confirmLabel}
			cancelLabel={state.cancelLabel}
			variant={state.variant}
			onConfirm={handleConfirm}
			onCancel={handleCancel}
		/>
	);

	return { confirm, dialog };
}
