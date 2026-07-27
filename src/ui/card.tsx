import { useDraggable, useDroppable, type DraggableSyntheticListeners } from '@dnd-kit/core';
import { useCombinedRefs } from '@dnd-kit/utilities';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { BoardCard as BoardCardModel } from '../model/types';

interface CardVisualProps {
	card: BoardCardModel;
	dragging?: boolean;
	overlay?: boolean;
	pending?: boolean;
}

export function CardVisual({
	card,
	dragging = false,
	overlay = false,
	pending = false,
}: CardVisualProps) {
	return (
		<div
			className={[
				'premium-kanban-card',
				dragging ? 'is-dragging' : '',
				overlay ? 'is-overlay' : '',
				pending ? 'is-pending' : '',
			]
				.filter(Boolean)
				.join(' ')}
			data-drag-overlay={overlay ? 'true' : undefined}
		>
			<div className="premium-kanban-card-title">{card.title}</div>
			{card.fields.length > 0 ? (
				<div className="premium-kanban-card-fields">
					{card.fields.map((field) => (
						<div className="premium-kanban-card-field" key={field.id}>
							<span className="premium-kanban-card-field-label">{field.label}</span>
							<span className="premium-kanban-card-field-value">{field.value}</span>
						</div>
					))}
				</div>
			) : null}
			{pending ? (
				<span className="premium-kanban-card-saving" aria-label="Saving task status">
					Saving…
				</span>
			) : null}
		</div>
	);
}

interface BoardCardProps {
	card: BoardCardModel;
	columnId: string;
	isDragging: boolean;
	pending: boolean;
	onOpen: (path: string, event: React.MouseEvent) => void;
}

export function BoardCard({ card, columnId, isDragging, pending, onOpen }: BoardCardProps) {
	const draggable = useDraggable({
		id: `card:${card.id}`,
		data: { cardId: card.id, columnId, type: 'card' },
	});
	const droppable = useDroppable({
		id: `drop-card:${card.id}`,
		data: { cardId: card.id, columnId, type: 'card' },
	});
	const setNodeRef = useCombinedRefs(draggable.setNodeRef, droppable.setNodeRef);

	return (
		<div
			{...draggable.attributes}
			{...(draggable.listeners as DraggableSyntheticListeners | SyntheticListenerMap)}
			aria-label={`${card.title}, draggable task`}
			className="premium-kanban-card-shell"
			data-card-id={card.id}
			onClick={(event) => {
				if (!isDragging) onOpen(card.path, event);
			}}
			ref={setNodeRef}
			role="button"
			tabIndex={0}
		>
			<CardVisual card={card} dragging={isDragging} pending={pending} />
		</div>
	);
}
