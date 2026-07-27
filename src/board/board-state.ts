import { createStore, type StoreApi } from 'zustand/vanilla';
import type {
	ActiveDrag,
	ActiveColumnDrag,
	BoardColumn,
	BoardSnapshot,
	MoveIntent,
	PendingMove,
} from '../model/types';

function cloneSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
	return {
		...snapshot,
		columns: snapshot.columns.map((column) => ({
			...column,
			cardIds: [...column.cardIds],
		})),
		cards: Object.fromEntries(
			Object.entries(snapshot.cards).map(([id, card]) => [
				id,
				{
					...card,
					fields: [...card.fields],
				},
			]),
		),
	};
}

function findColumn(snapshot: BoardSnapshot, columnId: string): BoardColumn | undefined {
	return snapshot.columns.find((column) => column.id === columnId);
}

function cardsAreEqual(
	previous: BoardSnapshot['cards'][string],
	incoming: BoardSnapshot['cards'][string],
): boolean {
	if (
		previous.id !== incoming.id ||
		previous.path !== incoming.path ||
		previous.title !== incoming.title ||
		previous.mtime !== incoming.mtime ||
		previous.columnId !== incoming.columnId ||
		previous.status !== incoming.status ||
		previous.fields.length !== incoming.fields.length
	) {
		return false;
	}

	return previous.fields.every((field, index) => {
		const nextField = incoming.fields[index];
		return (
			nextField !== undefined &&
			field.id === nextField.id &&
			field.label === nextField.label &&
			field.value === nextField.value
		);
	});
}

function columnsAreEqual(previous: BoardColumn, incoming: BoardColumn): boolean {
	return (
		previous.id === incoming.id &&
		previous.label === incoming.label &&
		previous.value === incoming.value &&
		previous.color === incoming.color &&
		previous.cardIds.length === incoming.cardIds.length &&
		previous.cardIds.every((cardId, index) => incoming.cardIds[index] === cardId)
	);
}

function reuseStableRecords(previous: BoardSnapshot, incoming: BoardSnapshot): BoardSnapshot {
	const cards = { ...incoming.cards };
	for (const [cardId, incomingCard] of Object.entries(cards)) {
		const previousCard = previous.cards[cardId];
		if (previousCard && cardsAreEqual(previousCard, incomingCard)) cards[cardId] = previousCard;
	}

	const previousColumns = new Map(previous.columns.map((column) => [column.id, column]));
	const columns = incoming.columns.map((column) => {
		const previousColumn = previousColumns.get(column.id);
		return previousColumn && columnsAreEqual(previousColumn, column) ? previousColumn : column;
	});

	return { ...incoming, cards, columns };
}

function moveCard(snapshot: BoardSnapshot, cardId: string, targetColumnId: string): BoardSnapshot {
	const card = snapshot.cards[cardId];
	const source = snapshot.columns.find((column) => column.cardIds.includes(cardId));
	const target = findColumn(snapshot, targetColumnId);
	if (!card || !source || !target || source.id === target.id) return snapshot;

	const nextSourceIds = source.cardIds.filter((candidate) => candidate !== cardId);
	const nextTargetIds = [...target.cardIds, cardId];

	const columns = snapshot.columns.map((column) => {
		if (column.id === target.id) return { ...column, cardIds: nextTargetIds };
		if (column.id === source.id) return { ...column, cardIds: nextSourceIds };
		return column;
	});

	return {
		...snapshot,
		columns,
		cards: {
			...snapshot.cards,
			[cardId]: {
				...card,
				columnId: target.id,
				status: target.value,
			},
		},
	};
}

function applyPendingMoves(
	snapshot: BoardSnapshot,
	pendingMoves: Record<string, PendingMove>,
): BoardSnapshot {
	let board = snapshot;
	for (const pending of Object.values(pendingMoves)) {
		const target = findColumn(board, pending.toColumnId);
		if (!target || !board.cards[pending.filePath]) continue;
		board = moveCard(board, pending.filePath, target.id);
	}
	return board;
}

function moveColumn(
	snapshot: BoardSnapshot,
	columnId: string,
	targetColumnId: string,
): BoardSnapshot {
	const sourceIndex = snapshot.columns.findIndex((column) => column.id === columnId);
	const targetIndex = snapshot.columns.findIndex((column) => column.id === targetColumnId);
	if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return snapshot;

	const columns = [...snapshot.columns];
	const [moved] = columns.splice(sourceIndex, 1);
	if (!moved) return snapshot;
	columns.splice(targetIndex, 0, moved);
	return { ...snapshot, columns };
}

export interface BoardStoreState {
	confirmed: BoardSnapshot;
	board: BoardSnapshot;
	activeDrag: ActiveDrag | null;
	activeColumnDrag: ActiveColumnDrag | null;
	pendingMoves: Record<string, PendingMove>;
	applySnapshot: (snapshot: BoardSnapshot) => void;
	startDrag: (cardId: string) => void;
	cancelDrag: () => void;
	commitDrag: (targetColumnId: string | null) => MoveIntent | null;
	startColumnDrag: (columnId: string) => void;
	previewColumnMove: (columnId: string, targetColumnId: string) => void;
	cancelColumnDrag: () => void;
	commitColumnDrag: () => string[] | null;
	markMutationSucceeded: (cardId: string, operationId: string, mtime: number) => void;
	markMutationFailed: (cardId: string, operationId: string) => void;
}

const EMPTY_SNAPSHOT: BoardSnapshot = {
	revision: 0,
	columns: [],
	cards: {},
	groupProperty: null,
	configurationError: null,
};

export function createBoardStore(initial = EMPTY_SNAPSHOT): StoreApi<BoardStoreState> {
	return createStore<BoardStoreState>((set, get) => ({
		confirmed: cloneSnapshot(initial),
		board: cloneSnapshot(initial),
		activeDrag: null,
		activeColumnDrag: null,
		pendingMoves: {},

		applySnapshot: (snapshot) => {
			const current = get();
			const stableSnapshot = reuseStableRecords(current.confirmed, snapshot);
			const pendingMoves = { ...current.pendingMoves };

			for (const [cardId, pending] of Object.entries(pendingMoves)) {
				const incomingCard = stableSnapshot.cards[cardId];
				if (!incomingCard) {
					delete pendingMoves[cardId];
					continue;
				}
				if (pending.phase !== 'confirming' || pending.writeMtime === null) continue;

				if (incomingCard.mtime >= pending.writeMtime) {
					delete pendingMoves[cardId];
				}
			}

			set({
				confirmed: stableSnapshot,
				board: applyPendingMoves(stableSnapshot, pendingMoves),
				pendingMoves,
			});
		},

		startDrag: (cardId) => {
			const current = get();
			const column = current.board.columns.find((candidate) =>
				candidate.cardIds.includes(cardId),
			);
			if (!column || current.board.groupProperty === null) return;
			set({
				activeDrag: {
					cardId,
					sourceColumnId: column.id,
				},
			});
		},

		cancelDrag: () => {
			set({ activeDrag: null });
		},

		commitDrag: (targetColumnId) => {
			const current = get();
			const active = current.activeDrag;
			const property = current.board.groupProperty;
			if (!active || !property || !targetColumnId) {
				set({ activeDrag: null });
				return null;
			}

			const card = current.board.cards[active.cardId];
			const sourceColumn = findColumn(current.board, active.sourceColumnId);
			const targetColumn = findColumn(current.board, targetColumnId);
			if (!card || !sourceColumn || !targetColumn || sourceColumn.id === targetColumn.id) {
				set({ activeDrag: null });
				return null;
			}

			const statusIntent: MoveIntent = {
				operationId: crypto.randomUUID(),
				filePath: card.path,
				title: card.title,
				propertyName: property.name,
				fromColumnId: sourceColumn.id,
				fromValue: sourceColumn.value,
				toColumnId: targetColumn.id,
				toValue: targetColumn.value,
			};
			set({
				activeDrag: null,
				board: moveCard(current.board, card.id, targetColumn.id),
				pendingMoves: {
					...current.pendingMoves,
					[card.id]: {
						...statusIntent,
						phase: 'writing',
						writeMtime: null,
					},
				},
			});

			return statusIntent;
		},

		startColumnDrag: (columnId) => {
			const current = get();
			const sourceIndex = current.board.columns.findIndex((column) => column.id === columnId);
			if (sourceIndex < 0) return;
			set({ activeColumnDrag: { columnId, sourceIndex } });
		},

		previewColumnMove: (columnId, targetColumnId) => {
			const current = get();
			if (current.activeColumnDrag?.columnId !== columnId) return;
			set({ board: moveColumn(current.board, columnId, targetColumnId) });
		},

		cancelColumnDrag: () => {
			const current = get();
			set({
				activeColumnDrag: null,
				board: applyPendingMoves(cloneSnapshot(current.confirmed), current.pendingMoves),
			});
		},

		commitColumnDrag: () => {
			const current = get();
			const active = current.activeColumnDrag;
			if (!active) return null;
			const currentIndex = current.board.columns.findIndex(
				(column) => column.id === active.columnId,
			);
			set({ activeColumnDrag: null });
			if (currentIndex === active.sourceIndex) return null;
			return current.board.columns.map((column) => column.label);
		},

		markMutationSucceeded: (cardId, operationId, mtime) => {
			const current = get();
			const pending = current.pendingMoves[cardId];
			if (!pending || pending.operationId !== operationId) return;
			set({
				pendingMoves: {
					...current.pendingMoves,
					[cardId]: {
						...pending,
						phase: 'confirming',
						writeMtime: mtime,
					},
				},
			});
		},

		markMutationFailed: (cardId, operationId) => {
			const current = get();
			const pending = current.pendingMoves[cardId];
			if (!pending || pending.operationId !== operationId) return;

			const pendingMoves = { ...current.pendingMoves };
			delete pendingMoves[cardId];
			const board = applyPendingMoves(cloneSnapshot(current.confirmed), pendingMoves);
			set({ board, pendingMoves, activeDrag: null });
		},
	}));
}

export const boardStateInternals = {
	applyPendingMoves,
	cloneSnapshot,
	moveCard,
	moveColumn,
	reuseStableRecords,
};
