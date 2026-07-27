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
	type Modifier,
} from '@dnd-kit/core';
import { useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { BoardStoreState } from '../board/board-state';
import type { MutationService } from '../mutations/mutation-service';
import { animateColumnChange } from './animation';
import { CardVisual } from './card';
import { BoardColumn } from './column';

interface PremiumKanbanBoardProps {
	store: StoreApi<BoardStoreState>;
	mutationService: MutationService;
	onOpenCard: (path: string, event: React.MouseEvent) => void;
	onError: (message: string) => void;
	onAddCard: (columnId: string) => void;
	onAddColumn: () => void;
	onColumnOrderChange: (labels: string[]) => void;
	onConfigureColumnColor: (columnId: string) => void;
}

const collisionDetection: CollisionDetection = (args) => {
	const pointerHits = pointerWithin(args);
	return pointerHits.length > 0 ? pointerHits : closestCenter(args);
};

function activatorCoordinates(event: Event | null): { x: number; y: number } | null {
	if (!event) return null;
	const pointer = event as Event & { clientX?: unknown; clientY?: unknown };
	if (typeof pointer.clientX === 'number' && typeof pointer.clientY === 'number') {
		return { x: pointer.clientX, y: pointer.clientY };
	}

	const touch =
		(
			event as Event & {
				touches?: ArrayLike<{ clientX: number; clientY: number }>;
				changedTouches?: ArrayLike<{ clientX: number; clientY: number }>;
			}
		).touches?.[0] ??
		(
			event as Event & {
				changedTouches?: ArrayLike<{ clientX: number; clientY: number }>;
			}
		).changedTouches?.[0];
	return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

const placeOverlayBelowPointer: Modifier = ({
	activatorEvent,
	active,
	activeNodeRect,
	transform,
}) => {
	if (active?.data.current?.type !== 'card') return transform;
	const pointer = activatorCoordinates(activatorEvent);
	if (!pointer || !activeNodeRect) return transform;

	return {
		...transform,
		x: transform.x + pointer.x - activeNodeRect.left - activeNodeRect.width / 2,
		y: transform.y + pointer.y - activeNodeRect.top + 12,
	};
};

const dragOverlayModifiers = [placeOverlayBelowPointer];

function targetColumnFromEvent(event: Pick<DragOverEvent, 'over'>): string | null {
	const over = event.over;
	if (!over) return null;
	const data = over.data.current;
	if (!data || typeof data.columnId !== 'string') return null;
	return data.columnId;
}

export function PremiumKanbanBoard({
	store,
	mutationService,
	onOpenCard,
	onError,
	onAddCard,
	onAddColumn,
	onColumnOrderChange,
	onConfigureColumnColor,
}: PremiumKanbanBoardProps) {
	const board = useStore(store, (state) => state.board);
	const activeDrag = useStore(store, (state) => state.activeDrag);
	const activeColumnDrag = useStore(store, (state) => state.activeColumnDrag);
	const boardElement = useRef<HTMLDivElement>(null);
	const [dragTargetColumnId, setDragTargetColumnId] = useState<string | null>(null);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 180, tolerance: 8 },
		}),
		useSensor(KeyboardSensor),
	);
	const activeCard = activeDrag ? board.cards[activeDrag.cardId] : undefined;
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
		setDragTargetColumnId(null);
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
		const targetColumnId = targetColumnFromEvent(event);
		const active = store.getState().activeDrag;
		if (typeof cardId !== 'string' || active?.cardId !== cardId) {
			setDragTargetColumnId(null);
			return;
		}
		setDragTargetColumnId(
			targetColumnId && targetColumnId !== active.sourceColumnId ? targetColumnId : null,
		);
	};

	const onDragEnd = (event: DragEndEvent) => {
		if (event.active.data.current?.type === 'column-drag') {
			const order = store.getState().commitColumnDrag();
			if (order) onColumnOrderChange(order);
			return;
		}
		const targetColumnId = targetColumnFromEvent(event);
		setDragTargetColumnId(null);
		const intent = store.getState().commitDrag(targetColumnId);
		if (!intent) return;

		void mutationService
			.moveCard(intent)
			.then((receipt) => {
				store
					.getState()
					.markMutationSucceeded(intent.filePath, intent.operationId, receipt.mtime);
			})
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : String(error);
				store.getState().markMutationFailed(intent.filePath, intent.operationId);
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
						setDragTargetColumnId(null);
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
							isDestination={activeDrag !== null && dragTargetColumnId === column.id}
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
				<DragOverlay
					className="premium-kanban-drag-overlay"
					dropAnimation={null}
					modifiers={dragOverlayModifiers}
				>
					{activeCard ? <CardVisual card={activeCard} overlay /> : null}
					{activeColumn ? (
						<div className="premium-kanban-column-overlay">{activeColumn.label}</div>
					) : null}
				</DragOverlay>
			</DndContext>
			<span className="premium-kanban-sr-only" aria-live="polite">
				{activeDrag && dragTargetColumnId
					? `Moving ${activeCard?.title ?? 'task'} to ${
							board.columns.find((column) => column.id === dragTargetColumnId)
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
