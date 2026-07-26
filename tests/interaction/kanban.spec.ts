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

test('shows one pointer-aligned card while dragging', async ({ page }) => {
	await page.goto('/');
	const source = page.locator('[data-card-id="todos/Alpha.md"]');
	const sourceBox = await source.boundingBox();
	if (!sourceBox) throw new Error('Expected visible card geometry');

	const pointerX = sourceBox.x + sourceBox.width / 2;
	const pointerY = sourceBox.y + 24;
	await page.mouse.move(pointerX, pointerY);
	await page.mouse.down();
	await page.mouse.move(pointerX + 12, pointerY + 12, { steps: 4 });

	const overlay = page.locator('[data-drag-overlay="true"]');
	await expect(overlay).toHaveCount(1);
	await expect(overlay).toBeVisible();
	await expect(source.locator('.premium-kanban-card')).toHaveCSS('visibility', 'hidden');

	const overlayBox = await overlay.boundingBox();
	if (!overlayBox) throw new Error('Expected visible drag-overlay geometry');
	expect(Math.abs(overlayBox.x + overlayBox.width / 2 - (pointerX + 12))).toBeLessThan(4);
	expect(overlayBox.y).toBeGreaterThan(pointerY + 18);

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
