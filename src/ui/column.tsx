import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useCombinedRefs } from '@dnd-kit/utilities';
import { memo } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { BoardStoreState } from '../board/board-state';
import { BoardCard } from './card';

interface BoardColumnProps {
	columnId: string;
	store: StoreApi<BoardStoreState>;
	isDestination: boolean;
	onOpenCard: (path: string, event: React.MouseEvent) => void;
	onAddCard: (columnId: string) => void;
	onConfigureColumnColor: (columnId: string) => void;
}

export const BoardColumn = memo(function BoardColumn({
	columnId,
	store,
	isDestination,
	onOpenCard,
	onAddCard,
	onConfigureColumnColor,
}: BoardColumnProps) {
	const column = useStore(store, (state) =>
		state.board.columns.find((candidate) => candidate.id === columnId),
	);
	const droppable = useDroppable({
		id: `column:${columnId}`,
		data: { columnId, type: 'column' },
	});
	const draggable = useDraggable({
		id: `column-drag:${columnId}`,
		data: { columnId, type: 'column-drag' },
	});
	const setNodeRef = useCombinedRefs(droppable.setNodeRef, draggable.setNodeRef);
	if (!column) return null;

	return (
		<section
			aria-label={`${column.label}, ${column.cardIds.length} tasks`}
			className={`premium-kanban-column ${isDestination ? 'is-destination' : ''}`}
			data-column-id={column.id}
			ref={setNodeRef}
			style={{ '--pk-column-color': column.color } as React.CSSProperties}
		>
			<header className="premium-kanban-column-header">
				<button
					{...draggable.attributes}
					{...draggable.listeners}
					aria-label={`Reorder ${column.label} column`}
					className="premium-kanban-column-handle"
					type="button"
				>
					<span aria-hidden="true">⠿</span>
				</button>
				<button
					aria-label={`Configure ${column.label} color`}
					className="premium-kanban-column-dot"
					onClick={() => onConfigureColumnColor(column.id)}
					type="button"
				/>
				<h3>{column.label}</h3>
				<span className="premium-kanban-column-count">{column.cardIds.length}</span>
				<button
					aria-label={`Add task to ${column.label}`}
					className="premium-kanban-column-action"
					onClick={() => onAddCard(column.id)}
					type="button"
				>
					<span aria-hidden="true">＋</span>
				</button>
			</header>
			<div
				className="premium-kanban-column-cards"
				data-column-drop-zone
				ref={droppable.setNodeRef}
			>
				{column.cardIds.map((cardId, index) => {
					return (
						<ConnectedBoardCard
							cardId={cardId}
							columnId={column.id}
							index={index}
							key={cardId}
							onOpen={onOpenCard}
							store={store}
						/>
					);
				})}
				{column.cardIds.length === 0 ? (
					<div className="premium-kanban-empty-column">Drop a task here</div>
				) : null}
			</div>
		</section>
	);
});

interface ConnectedBoardCardProps {
	cardId: string;
	columnId: string;
	index: number;
	store: StoreApi<BoardStoreState>;
	onOpen: (path: string, event: React.MouseEvent) => void;
}

const ConnectedBoardCard = memo(function ConnectedBoardCard({
	cardId,
	columnId,
	index,
	store,
	onOpen,
}: ConnectedBoardCardProps) {
	const card = useStore(store, (state) => state.board.cards[cardId]);
	const isDragging = useStore(store, (state) => state.activeDrag?.cardId === cardId);
	const pending = useStore(store, (state) => state.pendingMoves[cardId] !== undefined);
	if (!card) return null;

	return (
		<BoardCard
			card={card}
			columnId={columnId}
			index={index}
			isDragging={isDragging}
			onOpen={onOpen}
			pending={pending}
		/>
	);
});
