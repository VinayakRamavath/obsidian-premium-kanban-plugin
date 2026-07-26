import { describe, expect, it } from 'vitest';
import type { BoardSnapshot } from '../../src/model/types';
import {
	parseCardRanks,
	rankCardAtCurrentPosition,
	serializeCardRanks,
} from '../../src/board/ranking';

function board(): BoardSnapshot {
	return {
		revision: 1,
		groupProperty: { id: 'note.Status', name: 'Status' },
		configurationError: null,
		columns: [
			{
				id: 'status:Today',
				label: 'Today',
				value: 'Today',
				color: '#d6a100',
				cardIds: ['a.md', 'c.md', 'b.md'],
			},
		],
		cards: Object.fromEntries(
			['a.md', 'b.md', 'c.md'].map((id) => [
				id,
				{
					id,
					path: id,
					title: id,
					mtime: 1,
					columnId: 'status:Today',
					status: 'Today',
					rank: id === 'a.md' ? 'a0' : id === 'b.md' ? 'a1' : null,
					fields: [],
				},
			]),
		),
	};
}

describe('per-view card ranking', () => {
	it('generates a fractional key between destination neighbors', () => {
		const ranks = rankCardAtCurrentPosition(board(), 'c.md');

		expect(ranks['a.md']).toBe('a0');
		expect(ranks['b.md']).toBe('a1');
		expect(ranks['c.md']! > ranks['a.md']!).toBe(true);
		expect(ranks['c.md']! < ranks['b.md']!).toBe(true);
	});

	it('round-trips only valid rank entries', () => {
		const serialized = serializeCardRanks({ 'b.md': 'a1', 'a.md': 'a0' });
		expect(serialized).toBe('{"a.md":"a0","b.md":"a1"}');
		expect(parseCardRanks(serialized)).toEqual({ 'a.md': 'a0', 'b.md': 'a1' });
		expect(parseCardRanks('not-json')).toEqual({});
	});
});
