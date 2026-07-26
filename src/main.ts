import { Plugin, type BasesAllOptions } from 'obsidian';
import {
	PREMIUM_KANBAN_VIEW_TYPE,
	PremiumKanbanBasesView,
	showBasesUnavailableNotice,
} from './bases/premium-kanban-view';

export default class PremiumKanbanPlugin extends Plugin {
	public override onload(): void {
		const registered = this.registerBasesView(PREMIUM_KANBAN_VIEW_TYPE, {
			name: 'Premium Kanban',
			icon: 'lucide-columns-3',
			factory: (controller, containerEl) =>
				new PremiumKanbanBasesView(controller, containerEl),
			options: () => getViewOptions(),
		});

		if (!registered) showBasesUnavailableNotice();
	}
}

function getViewOptions(): BasesAllOptions[] {
	return [
		{
			key: 'columnOrder',
			displayName: 'Column order',
			type: 'text',
			default: '',
			placeholder: 'Today, In Progress, Completed',
			shouldHide: () => true,
		},
		{
			key: 'cardRanks',
			displayName: 'Card ranks',
			type: 'text',
			default: '',
			shouldHide: () => true,
		},
		{
			key: 'columnColors',
			displayName: 'Column colors',
			type: 'text',
			default: '',
			shouldHide: () => true,
		},
	];
}
