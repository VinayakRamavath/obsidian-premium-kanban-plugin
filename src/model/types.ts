import type { BasesPropertyId } from 'obsidian';

export const NULL_COLUMN_ID = '__premium-kanban-null__';

export interface BoardField {
	id: BasesPropertyId;
	label: string;
	value: string;
}

export interface BoardCard {
	id: string;
	path: string;
	title: string;
	mtime: number;
	columnId: string;
	status: string | null;
	fields: BoardField[];
}

export interface BoardColumn {
	id: string;
	label: string;
	value: string | null;
	color: string;
	cardIds: string[];
}

export interface GroupProperty {
	id: BasesPropertyId;
	name: string;
}

export interface BoardSnapshot {
	revision: number;
	columns: BoardColumn[];
	cards: Record<string, BoardCard>;
	groupProperty: GroupProperty | null;
	configurationError: string | null;
}

export interface MoveIntent {
	operationId: string;
	filePath: string;
	title: string;
	propertyName: string;
	fromColumnId: string;
	fromValue: string | null;
	toColumnId: string;
	toValue: string | null;
}

export interface MutationReceipt {
	operationId: string;
	mtime: number;
}

export interface PendingMove extends MoveIntent {
	phase: 'writing' | 'confirming';
	writeMtime: number | null;
}

export interface ActiveDrag {
	cardId: string;
	sourceColumnId: string;
}

export interface ActiveColumnDrag {
	columnId: string;
	sourceIndex: number;
}
