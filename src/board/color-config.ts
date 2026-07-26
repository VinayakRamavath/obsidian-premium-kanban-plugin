export const COLOR_PALETTE = [
	'#787c88',
	'#d97706',
	'#d6a100',
	'#16a068',
	'#168aad',
	'#3b82f6',
	'#7c5ce7',
	'#c14c8a',
	'#d14d41',
] as const;

const DEFAULT_COLUMN_COLORS: Record<string, string> = {
	Inbox: '#787c88',
	Backlog: '#d97706',
	'Not Started': '#3b82f6',
	Today: '#d6a100',
	'In Progress': '#7c5ce7',
	Completed: '#16a068',
};

export type ColumnColors = Record<string, string>;

export function normalizeColor(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const color = value.trim().toLowerCase();
	return /^#[0-9a-f]{6}$/.test(color) ? color : null;
}

export function parseColumnColors(raw: unknown): ColumnColors {
	if (typeof raw !== 'string' || raw.length === 0) return {};
	try {
		const parsed: unknown = JSON.parse(raw);
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		return Object.fromEntries(
			Object.entries(parsed)
				.map(([key, value]) => [key, normalizeColor(value)] as const)
				.filter((entry): entry is [string, string] => entry[1] !== null),
		);
	} catch {
		return {};
	}
}

export function defaultColumnColor(label: string): string {
	return DEFAULT_COLUMN_COLORS[label] ?? colorForText(label);
}

function colorForText(text: string): string {
	let hash = 0;
	for (let index = 0; index < text.length; index += 1) {
		hash = (hash * 31 + text.charCodeAt(index)) | 0;
	}
	return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length] ?? COLOR_PALETTE[0];
}

export function serializeColors(colors: ColumnColors): string {
	return JSON.stringify(colors);
}
