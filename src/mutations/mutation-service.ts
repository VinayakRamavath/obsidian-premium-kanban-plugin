import { TFile, type App } from 'obsidian';
import type { MoveIntent, MutationReceipt } from '../model/types';
import { SerializedFrontmatterMutationService } from './serialized-frontmatter-service';

export interface MutationService {
	moveCard(intent: MoveIntent): Promise<MutationReceipt>;
}

export class ObsidianMutationService implements MutationService {
	private readonly delegate: SerializedFrontmatterMutationService<TFile>;

	constructor(app: App) {
		this.delegate = new SerializedFrontmatterMutationService<TFile>({
			getFile: (path) => {
				const file = app.vault.getAbstractFileByPath(path);
				return file instanceof TFile && file.extension === 'md' ? file : null;
			},
			getMtime: (file) => file.stat.mtime,
			processFrontMatter: (file, mutate) =>
				app.fileManager.processFrontMatter(file, (frontmatter) => {
					mutate(frontmatter as Record<string, unknown>);
				}),
		});
	}

	public moveCard(intent: MoveIntent): Promise<MutationReceipt> {
		return this.delegate.moveCard(intent);
	}
}
