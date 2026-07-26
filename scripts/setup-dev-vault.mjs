import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginsDirectory = path.join(repositoryRoot, 'dev-vault', '.obsidian', 'plugins');
const pluginLink = path.join(pluginsDirectory, 'premium-kanban');

fs.mkdirSync(pluginsDirectory, { recursive: true });

if (fs.existsSync(pluginLink)) {
	const existingTarget = fs.realpathSync(pluginLink);
	if (existingTarget !== repositoryRoot) {
		throw new Error(`${pluginLink} already points to ${existingTarget}`);
	}
	console.log(`Development plugin link already exists: ${pluginLink}`);
	process.exit(0);
}

fs.symlinkSync(repositoryRoot, pluginLink, process.platform === 'win32' ? 'junction' : 'dir');
console.log(`Linked ${pluginLink} -> ${repositoryRoot}`);
console.log('Install and enable pjeby/hot-reload in the development vault for automatic reloads.');
