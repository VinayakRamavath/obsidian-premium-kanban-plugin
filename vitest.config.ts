import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			include: ['src/bases/adapter.ts', 'src/board/board-state.ts', 'src/mutations/**/*.ts'],
			reporter: ['text', 'html'],
		},
		include: ['tests/unit/**/*.test.ts'],
	},
});
