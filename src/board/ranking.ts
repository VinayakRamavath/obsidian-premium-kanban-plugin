import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import type { BoardSnapshot } from '../model/types';

export function parseCardRanks(raw: unknown): Record<string, string> {
	if (typeof raw !== 'string' || raw.length === 0) return {};

	try {
		const parsed: unknown = JSON.parse(raw);
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		return Object.fromEntries(
			Object.entries(parsed)
				.filter(
					(entry): entry is [string, string] =>
						typeof entry[0] === 'string' &&
						typeof entry[1] === 'string' &&
						entry[0].length > 0 &&
						entry[1].length > 0,
				)
				.sort(([left], [right]) => left.localeCompare(right)),
		);
	} catch {
		return {};
	}
}

export function rankCardAtCurrentPosition(
	board: BoardSnapshot,
	cardId: string,
): Record<string, string> {
	const ranks: Record<string, string> = {};

	for (const column of board.columns) {
		let previousRank: string | null = null;
		let index = 0;
		while (index < column.cardIds.length) {
			const id = column.cardIds[index];
			if (!id) break;
			const existing = id === cardId ? null : (board.cards[id]?.rank ?? null);
			if (existing) {
				ranks[id] = existing;
				previousRank = existing;
				index += 1;
				continue;
			}

			let nextIndex = index;
			while (nextIndex < column.cardIds.length) {
				const nextId = column.cardIds[nextIndex];
				if (!nextId) break;
				const nextExisting = nextId === cardId ? null : (board.cards[nextId]?.rank ?? null);
				if (nextExisting) break;
				nextIndex += 1;
			}
			const nextId = column.cardIds[nextIndex];
			const nextRank = nextId ? (board.cards[nextId]?.rank ?? null) : null;
			const generated = generateNKeysBetween(previousRank, nextRank, nextIndex - index);
			for (let offset = 0; offset < generated.length; offset += 1) {
				const missingId = column.cardIds[index + offset];
				const generatedRank = generated[offset];
				if (missingId && generatedRank) ranks[missingId] = generatedRank;
			}
			index = nextIndex;
		}
	}

	const column = board.columns.find((candidate) => candidate.cardIds.includes(cardId));
	if (!column) return ranks;
	const index = column.cardIds.indexOf(cardId);
	const previousId = column.cardIds[index - 1];
	const nextId = column.cardIds[index + 1];
	const previousRank = previousId ? (ranks[previousId] ?? null) : null;
	const nextRank = nextId ? (ranks[nextId] ?? null) : null;
	ranks[cardId] = generateKeyBetween(previousRank, nextRank);

	return Object.fromEntries(
		Object.entries(ranks).sort(([left], [right]) => left.localeCompare(right)),
	);
}

export function serializeCardRanks(ranks: Record<string, string>): string {
	return JSON.stringify(
		Object.fromEntries(
			Object.entries(ranks).sort(([left], [right]) => left.localeCompare(right)),
		),
	);
}
