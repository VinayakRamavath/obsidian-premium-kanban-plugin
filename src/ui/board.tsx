import {
	closestCenter,
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	TouchSensor,
	pointerWithin,
	useSensor,
	useSensors,
	type CollisionDetection,
	type DragEndEvent,
	type DragOverEvent,
	type DragStartEvent,
} from '@dnd-kit/core';
import { useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { BoardStoreState } from '../board/board-state';
import type { BoardSnapshot } from '../model/types';
import type { MutationService } from '../mutations/mutation-service';
import { animateBoardChange, animateColumnChange, animateDrop } from './animation';
import { CardVisual } from './card';
import { BoardColumn } from './column';

interface PremiumKanbanBoardProps {
	store: StoreApi<BoardStoreState>;
	mutationService: MutationService;
	onOpenCard: (path: string, event: React.MouseEvent) => void;
	onError: (message: string) => void;
	onAddCard: (columnId: string) => void;
	onAddColumn: () => void;
	onCardRankChange: (cardId: string, board: BoardSnapshot) => void;
	onColumnOrderChange: (labels: string[]) => void;
	onConfigureColumnColor: (columnId: string) => void;
}

const collisionDetection: CollisionDetection = (args) => {
	const pointerHits = pointerWithin(args);
	return pointerHits.length > 0 ? pointerHits : closestCenter(args);
};

function targetFromEvent(event: DragOverEvent): { columnId: string; index: number } | null {
	const over = event.over;
	if (!over) return null;
	const data = over.data.current;
	if (!data || typeof data.columnId !== 'string') return null;

	if (data.type === 'column') {
		return { columnId: data.columnId, index: Number.MAX_SAFE_INTEGER };
	}

	const baseIndex = typeof data.index === 'number' ? data.index : 0;
	const translated = event.active.rect.current.translated;
	const activeCenter = translated ? translated.top + translated.height / 2 : 0;
	const after = activeCenter > over.rect.top + over.rect.height / 2;
	return { columnId: data.columnId, index: baseIndex + (after ? 1 : 0) };
}

export function PremiumKanbanBoard({
	store,
	mutationService,
	onOpenCard,
	onError,
	onAddCard,
	onAddColumn,
	onCardRankChange,
	onColumnOrderChange,
	onConfigureColumnColor,
}: PremiumKanbanBoardProps) {
	const board = useStore(store, (state) => state.board);
	const activeDrag = useStore(store, (state) => state.activeDrag);
	const activeColumnDrag = useStore(store, (state) => state.activeColumnDrag);
	const boardElement = useRef<HTMLDivElement>(null);
	const lastPreview = useRef<string | null>(null);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 180, tolerance: 8 },
		}),
		useSensor(KeyboardSensor),
	);
	const activeCard = activeDrag ? board.cards[activeDrag.cardId] : undefined;
	const destinationColumnId = activeCard?.columnId ?? null;
	const activeColumn = activeColumnDrag
		? board.columns.find((column) => column.id === activeColumnDrag.columnId)
		: undefined;
	const columnIds = useMemo(() => board.columns.map((column) => column.id), [board.columns]);

	const onDragStart = (event: DragStartEvent) => {
		if (event.active.data.current?.type === 'column-drag') {
			const columnId = event.active.data.current.columnId;
			if (typeof columnId === 'string') store.getState().startColumnDrag(columnId);
			return;
		}
		const cardId = event.active.data.current?.cardId;
		if (typeof cardId !== 'string') return;
		lastPreview.current = null;
		store.getState().startDrag(cardId);
	};

	const onDragOver = (event: DragOverEvent) => {
		if (event.active.data.current?.type === 'column-drag') {
			const columnId = event.active.data.current.columnId;
			const targetColumnId = event.over?.data.current?.columnId;
			if (
				typeof columnId !== 'string' ||
				typeof targetColumnId !== 'string' ||
				columnId === targetColumnId
			) {
				return;
			}
			animateColumnChange(boardElement.current, () =>
				store.getState().previewColumnMove(columnId, targetColumnId),
			);
			return;
		}
		const cardId = event.active.data.current?.cardId;
		const target = targetFromEvent(event);
		if (typeof cardId !== 'string' || !target) return;

		const current = store.getState();
		const card = current.board.cards[cardId];
		if (!card) return;
		const previewKey = `${target.columnId}:${target.index}`;
		if (lastPreview.current === previewKey) return;
		lastPreview.current = previewKey;

		animateBoardChange(
			boardElement.current,
			[card.columnId, target.columnId],
			() => store.getState().previewMove(cardId, target.columnId, target.index),
			'move',
		);
	};

	const onDragEnd = (event: DragEndEvent) => {
		lastPreview.current = null;
		if (event.active.data.current?.type === 'column-drag') {
			const order = store.getState().commitColumnDrag();
			if (order) onColumnOrderChange(order);
			return;
		}
		const before = store.getState();
		const active = before.activeDrag;
		if (!active) return;
		const cardBeforeCommit = before.board.cards[active.cardId];
		const sourceColumnId = active.sourceColumnId;
		const targetColumnId = cardBeforeCommit?.columnId ?? sourceColumnId;
		const overlay = document.querySelector<HTMLElement>('[data-drag-overlay="true"]');

		const commit = store.getState().commitDrag();
		const target = boardElement.current?.querySelector<HTMLElement>(
			`[data-card-id="${CSS.escape(active.cardId)}"]`,
		);
		animateDrop(overlay, target ?? null);
		if (!commit) return;
		const intent = commit.statusIntent;
		if (!intent) {
			onCardRankChange(commit.cardId, store.getState().board);
			return;
		}

		void mutationService
			.moveCard(intent)
			.then((receipt) => {
				store
					.getState()
					.markMutationSucceeded(intent.filePath, intent.operationId, receipt.mtime);
				onCardRankChange(commit.cardId, store.getState().board);
			})
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : String(error);
				animateBoardChange(
					boardElement.current,
					[sourceColumnId, targetColumnId],
					() => store.getState().markMutationFailed(intent.filePath, intent.operationId),
					'rollback',
				);
				onError(`Could not move “${intent.title}”: ${message}`);
			});
	};

	if (board.columns.length === 0) {
		return (
			<div className="premium-kanban-state">
				<h3>No tasks found</h3>
				<p>This Base has no grouped task results to display.</p>
			</div>
		);
	}

	return (
		<div className="premium-kanban-root">
			{board.configurationError ? (
				<div className="premium-kanban-warning" role="status">
					{board.configurationError}
				</div>
			) : null}
			<DndContext
				autoScroll={{
					acceleration: 10,
					interval: 5,
					threshold: { x: 0.15, y: 0.15 },
				}}
				collisionDetection={collisionDetection}
				onDragCancel={(event) => {
					if (event.active.data.current?.type === 'column-drag') {
						store.getState().cancelColumnDrag();
					} else {
						store.getState().cancelDrag();
					}
				}}
				onDragEnd={onDragEnd}
				onDragOver={onDragOver}
				onDragStart={onDragStart}
				sensors={sensors}
			>
				<div
					aria-label="Premium Kanban board"
					className="premium-kanban-board"
					data-testid="premium-kanban-board"
					ref={boardElement}
					role="region"
				>
					{board.columns.map((column) => (
						<BoardColumn
							columnId={column.id}
							isDestination={activeDrag !== null && destinationColumnId === column.id}
							key={column.id}
							onAddCard={onAddCard}
							onConfigureColumnColor={onConfigureColumnColor}
							onOpenCard={onOpenCard}
							store={store}
						/>
					))}
					<div className="premium-kanban-add-column">
						<button onClick={onAddColumn} type="button">
							<span aria-hidden="true">＋</span> Add column
						</button>
					</div>
				</div>
				<DragOverlay dropAnimation={null}>
					{activeCard ? <CardVisual card={activeCard} overlay /> : null}
					{activeColumn ? (
						<div className="premium-kanban-column-overlay">{activeColumn.label}</div>
					) : null}
				</DragOverlay>
			</DndContext>
			<span className="premium-kanban-sr-only" aria-live="polite">
				{activeDrag && destinationColumnId
					? `Moving ${activeCard?.title ?? 'task'} to ${
							board.columns.find((column) => column.id === destinationColumnId)
								?.label ?? ''
						}`
					: ''}
			</span>
			<span className="premium-kanban-column-order" hidden>
				{columnIds.join(',')}
			</span>
		</div>
	);
}
