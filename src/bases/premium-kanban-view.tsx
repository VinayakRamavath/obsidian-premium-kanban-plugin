import {
	BasesView,
	Keymap,
	Modal,
	Notice,
	Setting,
	type App,
	type QueryController,
} from 'obsidian';
import { createRoot, type Root } from 'react-dom/client';
import { normalizeBasesData } from './adapter';
import { createBoardStore } from '../board/board-state';
import { ObsidianMutationService } from '../mutations/mutation-service';
import { PremiumKanbanBoard } from '../ui/board';
import { killBoardAnimations } from '../ui/animation';
import { COLOR_PALETTE, parseColumnColors, serializeColors } from '../board/color-config';

export const PREMIUM_KANBAN_VIEW_TYPE = 'premium-kanban';

export class PremiumKanbanBasesView extends BasesView {
	public readonly type = PREMIUM_KANBAN_VIEW_TYPE;

	private readonly containerEl: HTMLElement;
	private readonly reactRoot: Root;
	private readonly store = createBoardStore();
	private readonly mutationService: ObsidianMutationService;
	private revision = 0;

	constructor(controller: QueryController, parentEl: HTMLElement) {
		super(controller);
		this.containerEl = parentEl.createDiv({ cls: 'premium-kanban-view' });
		this.containerEl.tabIndex = -1;
		this.mutationService = new ObsidianMutationService(this.app);
		this.reactRoot = createRoot(this.containerEl);
		this.reactRoot.render(
			<PremiumKanbanBoard
				mutationService={this.mutationService}
				onAddCard={(columnId) => this.promptForTask(columnId)}
				onAddColumn={() => this.promptForColumn()}
				onColumnOrderChange={(labels) => {
					this.config.set('columnOrder', labels.join(','));
				}}
				onConfigureColumnColor={(columnId) => this.configureColumnColor(columnId)}
				onError={(message) => new Notice(message)}
				onOpenCard={(path, event) => {
					void this.app.workspace.openLinkText(
						path,
						'',
						Keymap.isModEvent(event.nativeEvent),
					);
				}}
				store={this.store}
			/>,
		);
	}

	public override onDataUpdated(): void {
		this.revision += 1;
		this.store.getState().applySnapshot(
			normalizeBasesData({
				allProperties: this.allProperties,
				config: this.config,
				data: this.data,
				revision: this.revision,
			}),
		);
	}

	public focus(): void {
		this.containerEl.focus({ preventScroll: true });
	}

	private promptForTask(columnId: string): void {
		const column = this.store
			.getState()
			.board.columns.find((candidate) => candidate.id === columnId);
		if (!column) return;

		new TextPromptModal(this.app, {
			title: `Add task to ${column.label}`,
			placeholder: 'Task title',
			onSubmit: (title) => {
				void this.createTask(title, column.value);
			},
		}).open();
	}

	private async createTask(title: string, status: string | null): Promise<void> {
		try {
			await this.createFileForView(title, (frontmatter) => {
				if (status === null) delete frontmatter.Status;
				else frontmatter.Status = status;
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Could not create “${title}”: ${message}`);
		}
	}

	private promptForColumn(): void {
		new TextPromptModal(this.app, {
			title: 'Add Status column',
			placeholder: 'Status name',
			onSubmit: (label) => {
				const labels = this.store.getState().board.columns.map((column) => column.label);
				if (label.includes(',')) {
					new Notice('Status names cannot contain commas.');
					return;
				}
				if (
					label.toLowerCase() === 'no status' ||
					labels.some((existing) => existing.toLowerCase() === label.toLowerCase())
				) {
					new Notice(`A “${label}” column already exists.`);
					return;
				}
				this.config.set('columnOrder', [...labels, label].join(','));
			},
		}).open();
	}

	private configureColumnColor(columnId: string): void {
		const column = this.store
			.getState()
			.board.columns.find((candidate) => candidate.id === columnId);
		if (!column) return;

		new ColorPickerModal(this.app, `Color for ${column.label}`, column.color, (color) => {
			const colors = parseColumnColors(this.config.get('columnColors'));
			if (color === null) delete colors[column.label];
			else colors[column.label] = color;
			this.config.set('columnColors', serializeColors(colors));
		}).open();
	}

	public override onunload(): void {
		killBoardAnimations();
		this.reactRoot.unmount();
		this.containerEl.remove();
	}
}

interface TextPromptOptions {
	title: string;
	placeholder: string;
	onSubmit: (value: string) => void;
}

class TextPromptModal extends Modal {
	private value = '';

	constructor(
		app: App,
		private readonly options: TextPromptOptions,
	) {
		super(app);
	}

	public override onOpen(): void {
		this.setTitle(this.options.title);
		new Setting(this.contentEl).addText((text) => {
			text.setPlaceholder(this.options.placeholder).onChange((value) => {
				this.value = value.trim();
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
			text.inputEl.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					this.submit();
				}
			});
		});
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText('Create')
					.setCta()
					.onClick(() => this.submit()),
			);
	}

	private submit(): void {
		if (!this.value) return;
		this.options.onSubmit(this.value);
		this.close();
	}
}

class ColorPickerModal extends Modal {
	private selectedColor: string;

	constructor(
		app: App,
		title: string,
		initialColor: string,
		private readonly onSubmit: (color: string | null) => void,
	) {
		super(app);
		this.setTitle(title);
		this.selectedColor = initialColor;
	}

	public override onOpen(): void {
		const palette = this.contentEl.createDiv({ cls: 'premium-kanban-color-palette' });
		for (const color of COLOR_PALETTE) {
			const button = palette.createEl('button', {
				attr: { 'aria-label': `Use color ${color}`, type: 'button' },
				cls: 'premium-kanban-color-swatch',
			});
			button.style.backgroundColor = color;
			button.addEventListener('click', () => {
				this.onSubmit(color);
				this.close();
			});
		}

		new Setting(this.contentEl).setName('Custom color').addColorPicker((picker) =>
			picker.setValue(this.selectedColor).onChange((color) => {
				this.selectedColor = color;
			}),
		);
		new Setting(this.contentEl)
			.addButton((button) =>
				button.setButtonText('Use default').onClick(() => {
					this.onSubmit(null);
					this.close();
				}),
			)
			.addButton((button) =>
				button
					.setButtonText('Apply')
					.setCta()
					.onClick(() => {
						this.onSubmit(this.selectedColor);
						this.close();
					}),
			);
	}
}

export function showBasesUnavailableNotice(): void {
	new Notice('Enable the Bases core plugin to use Premium Kanban.');
}
