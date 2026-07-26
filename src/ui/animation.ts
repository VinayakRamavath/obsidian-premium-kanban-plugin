import { flushSync } from 'react-dom';
import { Flip } from 'gsap/Flip';
import { gsap } from 'gsap';

gsap.registerPlugin(Flip);

const activeAnimations = new Set<gsap.core.Animation>();

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function cardElementsInColumns(container: HTMLElement, columnIds: string[]): HTMLElement[] {
	const allowed = new Set(columnIds);
	return Array.from(container.querySelectorAll<HTMLElement>('[data-flip-card]')).filter(
		(element) => {
			const column = element.closest<HTMLElement>('[data-column-id]');
			return column?.dataset.columnId !== undefined && allowed.has(column.dataset.columnId);
		},
	);
}

export function animateBoardChange(
	container: HTMLElement | null,
	columnIds: string[],
	update: () => void,
	variant: 'move' | 'rollback' = 'move',
): void {
	if (!container || prefersReducedMotion()) {
		flushSync(update);
		return;
	}

	const elements = cardElementsInColumns(container, columnIds);
	const state = Flip.getState(elements);
	flushSync(update);

	const animation = Flip.from(state, {
		absolute: false,
		duration: variant === 'rollback' ? 0.24 : 0.18,
		ease: variant === 'rollback' ? 'back.out(1.35)' : 'power2.out',
		nested: true,
		onComplete: () => activeAnimations.delete(animation),
		prune: true,
		simple: true,
	});
	activeAnimations.add(animation);
}

export function animateColumnChange(container: HTMLElement | null, update: () => void): void {
	if (!container || prefersReducedMotion()) {
		flushSync(update);
		return;
	}

	const state = Flip.getState(
		Array.from(container.querySelectorAll<HTMLElement>('[data-column-id]')),
	);
	flushSync(update);
	const animation = Flip.from(state, {
		duration: 0.22,
		ease: 'power2.out',
		onComplete: () => activeAnimations.delete(animation),
		prune: true,
		simple: true,
	});
	activeAnimations.add(animation);
}

export function killBoardAnimations(): void {
	for (const animation of activeAnimations) animation.kill();
	activeAnimations.clear();
}
