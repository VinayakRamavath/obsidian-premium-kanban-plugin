import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseFiles = ['main.js', 'manifest.json', 'styles.css'];
const bundledPackages = [
	'@dnd-kit/accessibility',
	'@dnd-kit/core',
	'@dnd-kit/utilities',
	'gsap',
	'react',
	'react-dom',
	'scheduler',
	'tslib',
	'zustand',
];

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

const notices = fs.readFileSync(path.join(repositoryRoot, 'THIRD_PARTY_NOTICES.md'), 'utf8');

for (const packageName of bundledPackages) {
	const packageJson = JSON.parse(
		fs.readFileSync(
			path.join(repositoryRoot, 'node_modules', packageName, 'package.json'),
			'utf8',
		),
	);
	const hasNotice = notices.split('\n').some((line) => {
		const cells = line.split('|').map((cell) => cell.trim());
		return cells[1] === `\`${packageName}\`` && cells[2] === packageJson.version;
	});

	if (!hasNotice) {
		throw new Error(`THIRD_PARTY_NOTICES.md is missing ${packageName} ${packageJson.version}.`);
	}
}

console.log(`Release artifacts verified: ${releaseFiles.join(', ')}`);
