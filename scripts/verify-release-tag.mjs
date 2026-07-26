import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'manifest.json'), 'utf8'));
const releaseTag = process.env.RELEASE_TAG ?? process.argv[2];

if (!releaseTag) {
	throw new Error('Set RELEASE_TAG or pass the release tag as the first argument.');
}

if (!/^\d+\.\d+\.\d+$/.test(releaseTag)) {
	throw new Error(`Release tag must use x.y.z format without a prefix: ${releaseTag}`);
}

if (releaseTag !== manifest.version) {
	throw new Error(
		`Release tag ${releaseTag} does not match manifest version ${manifest.version}.`,
	);
}

console.log(`Release tag ${releaseTag} matches manifest.json.`);
