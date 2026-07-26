import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/interaction',
	fullyParallel: false,
	use: {
		baseURL: 'http://127.0.0.1:4173',
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: 'npx vite --config vite.config.ts',
		reuseExistingServer: true,
		url: 'http://127.0.0.1:4173',
	},
});
