import { flushSync } from 'react-dom';
import { Flip } from 'gsap/Flip';
import { gsap } from 'gsap';

gsap.registerPlugin(Flip);

const activeAnimations = new Set<gsap.core.Animation>();

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
