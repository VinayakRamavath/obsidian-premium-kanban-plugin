import { expect, test, type Page } from '@playwright/test';

async function dragAlphaToProgress(page: Page) {
	const source = page.getByText('Alpha task');
	const destination = page.locator('[data-column-id="status:In%20Progress"]');
	const sourceBox = await source.boundingBox();
	const destinationBox = await destination.boundingBox();
	if (!sourceBox || !destinationBox) throw new Error('Expected visible drag geometry');

	await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(
		destinationBox.x + destinationBox.width / 2,
		destinationBox.y + destinationBox.height - 40,
		{ steps: 14 },
	);
	await page.mouse.up();
}

test('keeps one pointer-aligned card and stationary lists while dragging', async ({ page }) => {
	await page.goto('/');
	const source = page.locator('[data-card-id="todos/Alpha.md"]');
	const sourceBox = await source.boundingBox();
	const destination = page.locator('[data-column-id="status:In%20Progress"]');
	const destinationBox = await destination.boundingBox();
	if (!sourceBox || !destinationBox) throw new Error('Expected visible drag geometry');

	const pointerX = sourceBox.x + sourceBox.width / 2;
	const pointerY = sourceBox.y + 24;
	await page.mouse.move(pointerX, pointerY);
	await page.mouse.down();

	const overlay = page.locator('[data-drag-overlay="true"]');
	const positions = [
		{ x: pointerX + 12, y: pointerY + 12 },
		{ x: pointerX + 70, y: pointerY + 45 },
		{ x: destinationBox.x + destinationBox.width / 2, y: destinationBox.y + 110 },
	];
	const offsets: Array<{ x: number; y: number }> = [];
	for (const position of positions) {
		await page.mouse.move(position.x, position.y, { steps: 5 });
		await expect(overlay).toHaveCount(1);
		await expect(overlay).toBeVisible();
		const overlayBox = await overlay.boundingBox();
		if (!overlayBox) throw new Error('Expected visible drag-overlay geometry');
		offsets.push({
			x: overlayBox.x + overlayBox.width / 2 - position.x,
			y: overlayBox.y - position.y,
		});
	}

	await expect(source.locator('.premium-kanban-card')).toHaveCSS('visibility', 'hidden');
	await expect(
		page.locator('[data-column-id="status:Today"] [data-card-id="todos/Alpha.md"]'),
	).toHaveCount(1);
	await expect(
		page.locator('[data-column-id="status:In%20Progress"] [data-card-id="todos/Alpha.md"]'),
	).toHaveCount(0);
	expect(
		Math.max(...offsets.map(({ x }) => x)) - Math.min(...offsets.map(({ x }) => x)),
	).toBeLessThan(2);
	expect(
		Math.max(...offsets.map(({ y }) => y)) - Math.min(...offsets.map(({ y }) => y)),
	).toBeLessThan(2);
	expect(Math.abs(offsets[0]?.x ?? Number.POSITIVE_INFINITY)).toBeLessThan(4);
	expect(offsets[0]?.y).toBeGreaterThan(8);

	await page.mouse.move(pointerX, pointerY, { steps: 5 });
	await page.mouse.up();
});

test('moves a card optimistically and reconciles after persistence', async ({ page }) => {
	await page.goto('/');
	await dragAlphaToProgress(page);

	const destination = page.locator('[data-column-id="status:In%20Progress"]');
	await expect(destination.getByText('Alpha task')).toBeVisible();
	await expect(destination.getByText('Saving…')).toBeVisible();
	await expect(destination.getByText('Saving…')).toBeHidden({ timeout: 2000 });
});

test('rolls a failed write back to the source column', async ({ page }) => {
	await page.goto('/?fail=1');
	await dragAlphaToProgress(page);

	await expect(
		page.locator('[data-column-id="status:Today"]').getByText('Alpha task'),
	).toBeVisible({
		timeout: 2000,
	});
	await expect
		.poll(() => page.locator('body').getAttribute('data-error'))
		.toContain('Synthetic write failure');
});

test('exposes task creation and the column color control', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Add task to Today' }).click();
	await expect
		.poll(() => page.locator('body').getAttribute('data-add-card'))
		.toBe('status:Today');

	const colorControl = page.getByRole('button', { name: 'Configure Today color' });
	await expect(colorControl).toHaveCSS('background-color', 'rgb(214, 161, 0)');
	await colorControl.click();
	await expect
		.poll(() => page.locator('body').getAttribute('data-column-color'))
		.toBe('status:Today');

	await page.getByRole('button', { name: 'Add column' }).click();
	await expect.poll(() => page.locator('body').getAttribute('data-add-column')).toBe('true');
});

test('reorders columns with the drag handle', async ({ page }) => {
	await page.goto('/');
	const handle = page.getByRole('button', { name: 'Reorder Today column' });
	const destination = page.locator('[data-column-id="status:Completed"]');
	const handleBox = await handle.boundingBox();
	const destinationBox = await destination.boundingBox();
	if (!handleBox || !destinationBox) throw new Error('Expected visible column geometry');

	await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(destinationBox.x + destinationBox.width / 2, destinationBox.y + 30, {
		steps: 14,
	});
	await page.mouse.up();

	await expect
		.poll(() => page.locator('body').getAttribute('data-column-order'))
		.toContain('In Progress,Completed,Today');
});

test.describe('touch', () => {
	test.use({ hasTouch: true });

	async function touchSession(page: Page) {
		const cdp = await page.context().newCDPSession(page);
		return {
			start: (x: number, y: number) =>
				cdp.send('Input.dispatchTouchEvent', {
					type: 'touchStart',
					touchPoints: [{ x, y }],
				}),
			move: (x: number, y: number) =>
				cdp.send('Input.dispatchTouchEvent', {
					type: 'touchMove',
					touchPoints: [{ x, y }],
				}),
			end: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
		};
	}

	test('scrolls the board instead of lifting a card on a quick swipe', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 800 });
		await page.goto('/');
		// The harness has no .premium-kanban-view wrapper, so give columns their real width.
		await page.addStyleTag({ content: '#root { --pk-column-width: 300px; }' });
		const source = page.locator('[data-card-id="todos/Alpha.md"]');
		const sourceBox = await source.boundingBox();
		if (!sourceBox) throw new Error('Expected visible card geometry');

		const touch = await touchSession(page);
		const x = sourceBox.x + sourceBox.width / 2;
		const y = sourceBox.y + sourceBox.height / 2;
		await touch.start(x, y);
		for (let step = 1; step <= 10; step++) {
			await touch.move(x - step * 20, y);
		}
		await expect(page.locator('[data-drag-overlay="true"]')).toHaveCount(0);
		await touch.end();

		await expect
			.poll(async () => (await source.boundingBox())?.x ?? sourceBox.x)
			.toBeLessThan(sourceBox.x - 50);
		await expect(
			page.locator('[data-column-id="status:Today"] [data-card-id="todos/Alpha.md"]'),
		).toHaveCount(1);
	});

	test('moves a card after press and hold', async ({ page }) => {
		await page.goto('/');
		const sourceBox = await page.locator('[data-card-id="todos/Alpha.md"]').boundingBox();
		const destinationBox = await page
			.locator('[data-column-id="status:In%20Progress"]')
			.boundingBox();
		if (!sourceBox || !destinationBox) throw new Error('Expected visible drag geometry');

		const touch = await touchSession(page);
		const x = sourceBox.x + sourceBox.width / 2;
		const y = sourceBox.y + sourceBox.height / 2;
		await touch.start(x, y);
		await page.waitForTimeout(250);
		await expect(page.locator('[data-drag-overlay="true"]')).toHaveCount(0);
		await page.waitForTimeout(400);

		const targetX = destinationBox.x + destinationBox.width / 2;
		const targetY = destinationBox.y + destinationBox.height - 40;
		for (let step = 1; step <= 14; step++) {
			await touch.move(x + ((targetX - x) * step) / 14, y + ((targetY - y) * step) / 14);
		}
		await expect(page.locator('[data-drag-overlay="true"]')).toBeVisible();
		await touch.end();

		await expect(
			page.locator('[data-column-id="status:In%20Progress"]').getByText('Alpha task'),
		).toBeVisible();
	});

	test('opens a card on tap', async ({ page }) => {
		await page.goto('/');
		await page.getByText('Alpha task').tap();
		await expect
			.poll(() => page.locator('body').getAttribute('data-open-card'))
			.toBe('todos/Alpha.md');
	});
});
