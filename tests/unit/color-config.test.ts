import { describe, expect, it } from 'vitest';
import {
	defaultColumnColor,
	normalizeColor,
	parseColumnColors,
} from '../../src/board/color-config';

describe('view color configuration', () => {
	it('uses stable defaults for known Status columns', () => {
		expect(defaultColumnColor('Today')).toBe('#d6a100');
		expect(defaultColumnColor('Completed')).toBe('#16a068');
		expect(defaultColumnColor('Custom')).toMatch(/^#[0-9a-f]{6}$/);
	});

	it('accepts only six-digit hex overrides', () => {
		expect(normalizeColor('#ABCDEF')).toBe('#abcdef');
		expect(normalizeColor('red')).toBeNull();
		expect(parseColumnColors('{"Today":"#123456","Bad":"javascript:alert(1)"}')).toEqual({
			Today: '#123456',
		});
	});
});
