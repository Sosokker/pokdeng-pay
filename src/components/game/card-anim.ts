import type { CSSProperties } from "react";

export function cardAnimStyle(
	deal: boolean,
	reveal: boolean,
	index: number,
): CSSProperties | undefined {
	if (deal) return { animation: `deal-in 0.4s ease-out ${index * 0.15}s both` };
	if (reveal)
		return { animation: `reveal-pop 0.5s ease-out ${index * 0.2}s both` };
	return undefined;
}
