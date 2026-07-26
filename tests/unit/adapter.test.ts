import type {
	BasesEntry,
	BasesEntryGroup,
	BasesPropertyId,
	BasesViewConfig,
	Value,
} from 'obsidian';
import { describe, expect, it } from 'vitest';
import { adapterInternals, normalizeBasesData } from '../../src/bases/adapter';

function value(text: string | null): Value {
	return {
		isEmpty: () => text === null,
		toString: () => text ?? '',
	} as unknown as Value;
}

function entry(path: string, properties: Record<string, string | null>, mtime = 1): BasesEntry {
	return {
		file: {
			basename: path.replace(/\.md$/, ''),
			path,
			stat: { mtime },
		},
		getValue: (property: BasesPropertyId) => value(properties[property] ?? null),
	} as unknown as BasesEntry;
}

function group(status: string | null, entries: BasesEntry[]): BasesEntryGroup {
	return {
		key: value(status),
		entries,
	} as BasesEntryGroup;
}

function config(
	columnOrder = 'Today,In Progress,Inbox,Not Started,Backlog,Completed',
	values: Record<string, unknown> = {},
): Pick<BasesViewConfig, 'get' | 'getDisplayName' | 'getOrder'> {
	return {
		get: (key) => (key === 'columnOrder' ? columnOrder : (values[key] ?? null)),
		getDisplayName: (property) => property.replace(/^[^.]+\./, ''),
		getOrder: () => ['file.name', 'note.Project', 'note.source'],
	};
}

describe('normalizeBasesData', () => {
	it('normalizes grouped entries and preserves configured empty columns', () => {
		const today = entry('todos/Today.md', {
			'note.Status': 'Today',
			'note.Project': null,
			'note.source': 'ticktick',
		});
		const completed = entry('todos/Done.md', {
			'note.Status': 'Completed',
			'note.Project': null,
			'note.source': null,
		});
		const groups = [group('Today', [today]), group('Completed', [completed])];

		const result = normalizeBasesData({
			allProperties: ['note.Status', 'note.Project', 'note.source'],
			config: config(),
			data: {
				data: [today, completed],
				groupedData: groups,
				properties: ['file.name', 'note.Project', 'note.source'],
			},
			revision: 4,
		});

		expect(result.groupProperty).toEqual({ id: 'note.Status', name: 'Status' });
		expect(result.configurationError).toBeNull();
		expect(result.columns.map((column) => column.label)).toEqual([
			'Today',
			'In Progress',
			'Inbox',
			'Not Started',
			'Backlog',
			'Completed',
		]);
		expect(result.columns[1]?.cardIds).toEqual([]);
		expect(result.cards['todos/Today.md']?.fields).toEqual([
			{ id: 'note.source', label: 'source', value: 'ticktick' },
		]);
	});

	it('refuses mutation when more than one property reproduces the grouping', () => {
		const task = entry('todos/Ambiguous.md', {
			'note.Status': 'Today',
			'note.Phase': 'Today',
		});
		const result = normalizeBasesData({
			allProperties: ['note.Status', 'note.Phase'],
			config: config('Today'),
			data: {
				data: [task],
				groupedData: [group('Today', [task])],
				properties: ['file.name'],
			},
			revision: 1,
		});

		expect(result.groupProperty).toBeNull();
		expect(result.configurationError).toMatch(/cannot safely verify/i);
	});

	it('handles empty and unexpected property values without throwing', () => {
		expect(adapterInternals.valueToScalar(value(null))).toBeNull();
		expect(adapterInternals.parseColumnOrder([' Today ', 42, 'Today', ''])).toEqual(['Today']);
	});

	it('applies per-view ranks and color overrides', () => {
		const first = entry('todos/First.md', {
			'note.Status': 'Today',
			'note.source': 'fixture',
		});
		const second = entry('todos/Second.md', {
			'note.Status': 'Today',
			'note.source': 'fixture',
		});
		const result = normalizeBasesData({
			allProperties: ['note.Status', 'note.source'],
			config: config('Today', {
				cardRanks: '{"todos/First.md":"a1","todos/Second.md":"a0"}',
				columnColors: '{"Today":"#123456"}',
			}),
			data: {
				data: [first, second],
				groupedData: [group('Today', [first, second])],
				properties: ['file.name', 'note.source'],
			},
			revision: 1,
		});

		expect(result.columns[0]?.cardIds).toEqual(['todos/Second.md', 'todos/First.md']);
		expect(result.columns[0]?.color).toBe('#123456');
	});
});
