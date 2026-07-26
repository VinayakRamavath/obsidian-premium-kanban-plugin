import type { MoveIntent, MutationReceipt } from '../model/types';
import type { MutationService } from './mutation-service';

export interface FrontmatterMutationHost<FileType> {
	getFile(path: string): FileType | null;
	getMtime(file: FileType): number;
	processFrontMatter(
		file: FileType,
		mutate: (frontmatter: Record<string, unknown>) => void,
	): Promise<void>;
}

export class SerializedFrontmatterMutationService<FileType> implements MutationService {
	private readonly queues = new Map<string, Promise<void>>();

	constructor(private readonly host: FrontmatterMutationHost<FileType>) {}

	public moveCard(intent: MoveIntent): Promise<MutationReceipt> {
		const previous = this.queues.get(intent.filePath) ?? Promise.resolve();
		const task = previous.catch(() => undefined).then(() => this.performMove(intent));
		const queueTail = task.then(
			() => undefined,
			() => undefined,
		);
		this.queues.set(intent.filePath, queueTail);

		void queueTail.finally(() => {
			if (this.queues.get(intent.filePath) === queueTail) {
				this.queues.delete(intent.filePath);
			}
		});

		return task;
	}

	private async performMove(intent: MoveIntent): Promise<MutationReceipt> {
		const file = this.host.getFile(intent.filePath);
		if (file === null) throw new Error('The task file no longer exists.');

		await this.host.processFrontMatter(file, (frontmatter) => {
			if (intent.toValue === null) {
				delete frontmatter[intent.propertyName];
			} else {
				frontmatter[intent.propertyName] = intent.toValue;
			}
		});

		return {
			operationId: intent.operationId,
			mtime: this.host.getMtime(file),
		};
	}
}
