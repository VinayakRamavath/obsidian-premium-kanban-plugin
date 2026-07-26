import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(repositoryRoot, 'dev-vault', 'todos', '__load-test');
const countFlag = process.argv.indexOf('--count');
const count = countFlag >= 0 ? Number(process.argv[countFlag + 1]) : 500;
const statuses = ['Inbox', 'Backlog', 'Not Started', 'Today', 'In Progress', 'Completed'];

if (!Number.isInteger(count) || count < 1 || count > 5000) {
	throw new Error('--count must be an integer between 1 and 5000');
}

fs.mkdirSync(outputDirectory, { recursive: true });

for (let index = 1; index <= count; index += 1) {
	const status = statuses[(index - 1) % statuses.length];
	const filename = `Synthetic task ${String(index).padStart(4, '0')}.md`;
	const contents = [
		'---',
		'Project:',
		`Status: ${status}`,
		'source: load-test',
		`fixture-index: ${index}`,
		'---',
		'',
		'Generated performance fixture. Safe to delete.',
		'',
	].join('\n');
	fs.writeFileSync(path.join(outputDirectory, filename), contents, 'utf8');
}

console.log(`Generated ${count} tasks in ${outputDirectory}`);
