import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBoardStore, boardStateInternals } from '../../src/board/board-state';
import type { BoardSnapshot, MoveIntent, MutationReceipt } from '../../src/model/types';
import type { MutationService } from '../../src/mutations/mutation-service';
import { PremiumKanbanBoard } from '../../src/ui/board';
import '../../styles.css';
import './theme.css';

const initialSnapshot: BoardSnapshot = {
	revision: 1,
	groupProperty: { id: 'note.Status', name: 'Status' },
	configurationError: null,
	columns: [
		{
			id: 'status:Today',
			label: 'Today',
			value: 'Today',
			color: '#d6a100',
			cardIds: ['todos/Alpha.md'],
		},
		{
			id: 'status:In%20Progress',
			label: 'In Progress',
			value: 'In Progress',
			color: '#7c5ce7',
			cardIds: ['todos/Beta.md'],
		},
		{
			id: 'status:Completed',
			label: 'Completed',
			value: 'Completed',
			color: '#16a068',
			cardIds: [],
		},
	],
	cards: {
		'todos/Alpha.md': {
			id: 'todos/Alpha.md',
			path: 'todos/Alpha.md',
			title: 'Alpha task',
			mtime: 1,
			columnId: 'status:Today',
			status: 'Today',
			rank: null,
			fields: [{ id: 'note.source', label: 'Source', value: 'fixture' }],
		},
		'todos/Beta.md': {
			id: 'todos/Beta.md',
			path: 'todos/Beta.md',
			title: 'Beta task',
			mtime: 1,
			columnId: 'status:In%20Progress',
			status: 'In Progress',
			rank: null,
			fields: [],
		},
	},
};

const store = createBoardStore(initialSnapshot);
const shouldFail = new URLSearchParams(window.location.search).has('fail');

const mutationService: MutationService = {
	async moveCard(intent: MoveIntent): Promise<MutationReceipt> {
		await new Promise((resolve) => window.setTimeout(resolve, 180));
		if (shouldFail) throw new Error('Synthetic write failure');

		window.setTimeout(() => {
			const confirmed = boardStateInternals.moveCard(
				store.getState().confirmed,
				intent.filePath,
				intent.toColumnId,
				Number.MAX_SAFE_INTEGER,
			);
			const card = confirmed.cards[intent.filePath];
			if (card) card.mtime = 2;
			confirmed.revision = 2;
			store.getState().applySnapshot(confirmed);
		}, 20);

		return { operationId: intent.operationId, mtime: 2 };
	},
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing root element');

createRoot(rootElement).render(
	<React.StrictMode>
		<PremiumKanbanBoard
			mutationService={mutationService}
			onAddCard={(columnId) => {
				document.body.dataset.addCard = columnId;
			}}
			onAddColumn={() => {
				document.body.dataset.addColumn = 'true';
			}}
			onCardRankChange={(cardId) => {
				document.body.dataset.rankedCard = cardId;
			}}
			onColumnOrderChange={(labels) => {
				document.body.dataset.columnOrder = labels.join(',');
			}}
			onConfigureColumnColor={(columnId) => {
				document.body.dataset.columnColor = columnId;
			}}
			onError={(message) => {
				document.body.dataset.error = message;
			}}
			onOpenCard={() => undefined}
			store={store}
		/>
	</React.StrictMode>,
);
