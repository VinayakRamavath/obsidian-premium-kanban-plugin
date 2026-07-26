import { describe, expect, it } from 'vitest';
import type { MoveIntent } from '../../src/model/types';
import {
	SerializedFrontmatterMutationService,
	type FrontmatterMutationHost,
} from '../../src/mutations/serialized-frontmatter-service';

interface FakeFile {
	frontmatter: Record<string, unknown>;
	mtime: number;
	path: string;
}

function intent(operationId: string, toValue: string | null): MoveIntent {
	return {
		operationId,
		filePath: 'todos/Task.md',
		title: 'Task',
		propertyName: 'Status',
		fromColumnId: 'status:Today',
		fromValue: 'Today',
		toColumnId: toValue === null ? '__premium-kanban-null__' : `status:${toValue}`,
		toValue,
	};
}

describe('SerializedFrontmatterMutationService', () => {
	it('changes only the intended property and supports deleting Status', async () => {
		const file: FakeFile = {
			frontmatter: { Project: '[[Aurora]]', Status: 'Today', source: 'ticktick' },
			mtime: 1,
			path: 'todos/Task.md',
		};
		const host: FrontmatterMutationHost<FakeFile> = {
			getFile: () => file,
			getMtime: (candidate) => candidate.mtime,
			processFrontMatter: async (candidate, mutate) => {
				mutate(candidate.frontmatter);
				candidate.mtime += 1;
			},
		};
		const service = new SerializedFrontmatterMutationService(host);

		await service.moveCard(intent('one', 'In Progress'));
		expect(file.frontmatter).toEqual({
			Project: '[[Aurora]]',
			Status: 'In Progress',
			source: 'ticktick',
		});

		await service.moveCard(intent('two', null));
		expect(file.frontmatter).toEqual({
			Project: '[[Aurora]]',
			source: 'ticktick',
		});
	});

	it('serializes consecutive mutations for the same file', async () => {
		const file: FakeFile = {
			frontmatter: { Status: 'Today' },
			mtime: 1,
			path: 'todos/Task.md',
		};
		const order: string[] = [];
		let releaseFirst: (() => void) | undefined;
		const firstGate = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		let call = 0;
		const host: FrontmatterMutationHost<FakeFile> = {
			getFile: () => file,
			getMtime: (candidate) => candidate.mtime,
			processFrontMatter: async (candidate, mutate) => {
				call += 1;
				const currentCall = call;
				order.push(`start-${currentCall}`);
				if (currentCall === 1) await firstGate;
				mutate(candidate.frontmatter);
				candidate.mtime += 1;
				order.push(`end-${currentCall}`);
			},
		};
		const service = new SerializedFrontmatterMutationService(host);
		const first = service.moveCard(intent('one', 'In Progress'));
		const second = service.moveCard(intent('two', 'Completed'));

		await Promise.resolve();
		await Promise.resolve();
		expect(order).toEqual(['start-1']);
		releaseFirst?.();
		await Promise.all([first, second]);

		expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
		expect(file.frontmatter.Status).toBe('Completed');
	});

	it('reports a deleted file without attempting a write', async () => {
		const service = new SerializedFrontmatterMutationService<never>({
			getFile: () => null,
			getMtime: () => 0,
			processFrontMatter: async () => undefined,
		});

		await expect(service.moveCard(intent('missing', 'Completed'))).rejects.toThrow(
			/no longer exists/i,
		);
	});
});
