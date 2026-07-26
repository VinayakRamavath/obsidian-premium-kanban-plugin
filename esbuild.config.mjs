import builtins from 'builtin-modules';
import esbuild from 'esbuild';
import process from 'node:process';

const production = process.argv[2] === 'production';

const context = await esbuild.context({
	banner: {
		js: '/* Premium Kanban project code is MIT-licensed. Bundled dependencies retain their own licenses; see THIRD_PARTY_NOTICES.md. */',
	},
	bundle: true,
	entryPoints: ['src/main.ts'],
	external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*', ...builtins],
	format: 'cjs',
	legalComments: 'eof',
	logLevel: 'info',
	minify: production,
	outfile: 'main.js',
	platform: 'browser',
	sourcemap: production ? false : 'inline',
	target: 'es2022',
	treeShaking: true,
});

if (production) {
	await context.rebuild();
	await context.dispose();
} else {
	await context.watch();
}
