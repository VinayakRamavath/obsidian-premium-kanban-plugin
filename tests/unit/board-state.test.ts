import { describe, expect, it, vi } from 'vitest';
import { createBoardStore } from '../../src/board/board-state';
import type { BoardSnapshot } from '../../src/model/types';

function snapshot(status: 'Today' | 'In Progress', mtime = 1): BoardSnapshot {
	const todayCards = status === 'Today' ? ['todos/Task.md'] : [];
	const progressCards = status === 'In Progress' ? ['todos/Task.md'] : [];
	return {
		revision: mtime,
		groupProperty: { id: 'note.Status', name: 'Status' },
		configurationError: null,
		columns: [
			{
				id: 'status:Today',
				label: 'Today',
				value: 'Today',
				color: '#d6a100',
				cardIds: todayCards,
			},
			{
				id: 'status:In%20Progress',
				label: 'In Progress',
				value: 'In Progress',
				color: '#7c5ce7',
				cardIds: progressCards,
			},
		],
		cards: {
			'todos/Task.md': {
				id: 'todos/Task.md',
				path: 'todos/Task.md',
				title: 'Task',
				mtime,
				columnId: status === 'Today' ? 'status:Today' : 'status:In%20Progress',
				status,
				fields: [],
			},
		},
	};
}

describe('board state', () => {
	it('moves optimistically and reconciles to the next confirmed Bases result', () => {
		vi.stubGlobal('crypto', { randomUUID: () => 'operation-1' });
		const store = createBoardStore(snapshot('Today'));

		store.getState().startDrag('todos/Task.md');
		expect(store.getState().board.cards['todos/Task.md']?.status).toBe('Today');
		const intent = store.getState().commitDrag('status:In%20Progress');

		expect(intent?.toValue).toBe('In Progress');
		expect(store.getState().board.cards['todos/Task.md']?.status).toBe('In Progress');
		expect(store.getState().pendingMoves['todos/Task.md']?.phase).toBe('writing');

		store.getState().markMutationSucceeded('todos/Task.md', 'operation-1', 2);
		store.getState().applySnapshot(snapshot('In Progress', 2));

		expect(store.getState().pendingMoves['todos/Task.md']).toBeUndefined();
		expect(store.getState().board.columns[1]?.cardIds).toEqual(['todos/Task.md']);
		vi.unstubAllGlobals();
	});

	it('rolls the latest failed mutation back to its source status', () => {
		vi.stubGlobal('crypto', { randomUUID: () => 'operation-2' });
		const store = createBoardStore(snapshot('Today'));

		store.getState().startDrag('todos/Task.md');
		store.getState().commitDrag('status:In%20Progress');
		store.getState().markMutationFailed('todos/Task.md', 'operation-2');

		expect(store.getState().board.cards['todos/Task.md']?.status).toBe('Today');
		expect(store.getState().pendingMoves).toEqual({});
		vi.unstubAllGlobals();
	});

	it('keeps an optimistic card in place across an older Bases update', () => {
		vi.stubGlobal('crypto', { randomUUID: () => 'operation-3' });
		const store = createBoardStore(snapshot('Today'));

		store.getState().startDrag('todos/Task.md');
		store.getState().commitDrag('status:In%20Progress');
		store.getState().applySnapshot(snapshot('Today', 1));

		expect(store.getState().board.cards['todos/Task.md']?.status).toBe('In Progress');
		expect(store.getState().pendingMoves['todos/Task.md']).toBeDefined();
		vi.unstubAllGlobals();
	});

	it('ignores attempts to reorder cards within a column', () => {
		const initial = snapshot('Today');
		initial.columns[0]?.cardIds.push('todos/Other.md');
		initial.cards['todos/Other.md'] = {
			id: 'todos/Other.md',
			path: 'todos/Other.md',
			title: 'Other',
			mtime: 1,
			columnId: 'status:Today',
			status: 'Today',
			fields: [],
		};
		const store = createBoardStore(initial);

		store.getState().startDrag('todos/Task.md');

		expect(store.getState().commitDrag('status:Today')).toBeNull();
		expect(store.getState().board.columns[0]?.cardIds).toEqual([
			'todos/Task.md',
			'todos/Other.md',
		]);
		expect(store.getState().pendingMoves).toEqual({});
	});

	it('reuses unchanged cards and columns across Bases snapshots', () => {
		const store = createBoardStore(snapshot('Today'));
		store.getState().applySnapshot(snapshot('Today'));
		const previous = store.getState().board;

		store.getState().applySnapshot(snapshot('Today'));
		const current = store.getState().board;

		expect(current.cards['todos/Task.md']).toBe(previous.cards['todos/Task.md']);
		expect(current.columns[0]).toBe(previous.columns[0]);
		expect(current.columns[1]).toBe(previous.columns[1]);
	});

	it('previews and commits column ordering without changing task data', () => {
		const store = createBoardStore(snapshot('Today'));
		store.getState().startColumnDrag('status:Today');
		store.getState().previewColumnMove('status:Today', 'status:In%20Progress');

		expect(store.getState().commitColumnDrag()).toEqual(['In Progress', 'Today']);
		expect(store.getState().board.cards['todos/Task.md']?.status).toBe('Today');
	});
});
