import { defineConfig } from 'vite';

export default defineConfig({
	root: 'tests/interaction',
	server: {
		host: '127.0.0.1',
		port: 4173,
		strictPort: true,
	},
});
