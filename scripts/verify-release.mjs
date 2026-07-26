import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseFiles = ['main.js', 'manifest.json', 'styles.css'];

for (const file of releaseFiles) {
	const filePath = path.join(repositoryRoot, file);
	if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
		throw new Error(`Missing release artifact: ${file}`);
	}
}

const unexpectedMaps = fs
	.readdirSync(repositoryRoot)
	.filter((file) => file.endsWith('.map') || file === 'node_modules.js');

if (unexpectedMaps.length > 0) {
	throw new Error(`Unexpected release artifacts: ${unexpectedMaps.join(', ')}`);
}

console.log(`Release artifacts verified: ${releaseFiles.join(', ')}`);
