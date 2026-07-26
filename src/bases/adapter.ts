import type {
	BasesEntry,
	BasesEntryGroup,
	BasesPropertyId,
	BasesQueryResult,
	BasesViewConfig,
	Value,
} from 'obsidian';
import {
	NULL_COLUMN_ID,
	type BoardCard,
	type BoardColumn,
	type BoardSnapshot,
	type GroupProperty,
} from '../model/types';
import { parseCardRanks } from '../board/ranking';
import { defaultColumnColor, parseColumnColors, type ColumnColors } from '../board/color-config';

export interface BasesAdapterInput {
	data: Pick<BasesQueryResult, 'data' | 'groupedData' | 'properties'>;
	config: Pick<BasesViewConfig, 'get' | 'getDisplayName' | 'getOrder'>;
	allProperties: BasesPropertyId[];
	revision: number;
}

function valueToScalar(value: Value | null | undefined): string | null {
	if (value == null) return null;

	const maybeValue = value as Value & { isEmpty?: () => boolean };
	if (typeof maybeValue.isEmpty === 'function' && maybeValue.isEmpty()) return null;
	if (value.constructor.name === 'NullValue') return null;

	const text = value.toString().trim();
	return text.length > 0 ? text : null;
}

function columnIdFor(value: string | null): string {
	return value === null ? NULL_COLUMN_ID : `status:${encodeURIComponent(value)}`;
}

function parseColumnOrder(raw: unknown): string[] {
	const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
	return values
		.filter((value): value is string => typeof value === 'string')
		.map((value) => value.trim())
		.filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
}

function entryMatchesGroup(
	entry: BasesEntry,
	group: BasesEntryGroup,
	property: BasesPropertyId,
): boolean {
	return valueToScalar(entry.getValue(property)) === valueToScalar(group.key);
}

function resolveGroupProperty(
	groups: BasesEntryGroup[],
	allProperties: BasesPropertyId[],
): GroupProperty | null {
	const candidates = allProperties.filter((property) => {
		if (!property.startsWith('note.')) return false;
		return groups.every((group) =>
			group.entries.every((entry) => entryMatchesGroup(entry, group, property)),
		);
	});

	if (candidates.length !== 1 || candidates[0] !== 'note.Status') return null;

	return {
		id: candidates[0],
		name: 'Status',
	};
}

function buildFields(
	entry: BasesEntry,
	order: BasesPropertyId[],
	config: BasesAdapterInput['config'],
): BoardCard['fields'] {
	const fields: BoardCard['fields'] = [];

	for (const property of order) {
		if (property === 'file.name') continue;
		const value = valueToScalar(entry.getValue(property));
		if (value === null) continue;
		fields.push({
			id: property,
			label: config.getDisplayName(property),
			value,
		});
	}

	return fields;
}

function groupToColumn(
	group: BasesEntryGroup,
	order: BasesPropertyId[],
	config: BasesAdapterInput['config'],
	cards: Record<string, BoardCard>,
	cardRanks: Record<string, string>,
	columnColors: ColumnColors,
): BoardColumn {
	const value = valueToScalar(group.key);
	const id = columnIdFor(value);
	const cardIds: string[] = [];

	for (const entry of group.entries) {
		const cardId = entry.file.path;
		cardIds.push(cardId);
		cards[cardId] = {
			id: cardId,
			path: entry.file.path,
			title: entry.file.basename,
			mtime: entry.file.stat.mtime,
			columnId: id,
			status: value,
			rank: cardRanks[cardId] ?? null,
			fields: buildFields(entry, order, config),
		};
	}

	return {
		id,
		label: value ?? 'No status',
		value,
		color: columnColors[value ?? 'No status'] ?? defaultColumnColor(value ?? 'No status'),
		cardIds,
	};
}

export function normalizeBasesData({
	data,
	config,
	allProperties,
	revision,
}: BasesAdapterInput): BoardSnapshot {
	const cards: Record<string, BoardCard> = {};
	const cardRanks = parseCardRanks(config.get('cardRanks'));
	const columnColors = parseColumnColors(config.get('columnColors'));
	const visibleOrder = config.getOrder();
	const returnedColumns = data.groupedData.map((group) =>
		groupToColumn(group, visibleOrder, config, cards, cardRanks, columnColors),
	);
	for (const column of returnedColumns) {
		column.cardIds.sort((leftId, rightId) => {
			const leftRank = cards[leftId]?.rank;
			const rightRank = cards[rightId]?.rank;
			if (leftRank && rightRank) return leftRank.localeCompare(rightRank);
			if (leftRank) return -1;
			if (rightRank) return 1;
			return 0;
		});
	}
	const returnedByLabel = new Map(returnedColumns.map((column) => [column.label, column]));
	const columns: BoardColumn[] = [];

	for (const label of parseColumnOrder(config.get('columnOrder'))) {
		const returned = returnedByLabel.get(label);
		if (returned) {
			columns.push(returned);
			returnedByLabel.delete(label);
		} else {
			columns.push({
				id: columnIdFor(label),
				label,
				value: label,
				color: columnColors[label] ?? defaultColumnColor(label),
				cardIds: [],
			});
		}
	}

	for (const column of returnedColumns) {
		if (returnedByLabel.has(column.label)) {
			columns.push(column);
			returnedByLabel.delete(column.label);
		}
	}

	const groupProperty = resolveGroupProperty(data.groupedData, allProperties);
	const hasEntries = data.data.length > 0;
	const configurationError =
		hasEntries && groupProperty === null
			? 'Dragging is unavailable because this view cannot safely verify that it is grouped by Status.'
			: null;

	return {
		revision,
		columns,
		cards,
		groupProperty,
		configurationError,
	};
}

export const adapterInternals = {
	columnIdFor,
	parseColumnOrder,
	valueToScalar,
};
