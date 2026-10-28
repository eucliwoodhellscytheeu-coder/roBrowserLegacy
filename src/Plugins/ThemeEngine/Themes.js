// Asset-preserving UI color treatments. The WebGL scene is never filtered.
import { skinThemes } from './SkinAssets.js';

export const themes = {
	classic: { label: 'Classic (original)', filter: 'none' },
	midnight: { label: 'Midnight', filter: 'invert(0.88) hue-rotate(180deg) brightness(0.85)' },
	sepia: { label: 'Sepia', filter: 'sepia(0.65) saturate(0.85)' },
	frost: { label: 'Frost', filter: 'sepia(0.25) hue-rotate(165deg) saturate(1.3)' },
	...skinThemes
};

const key = 'roBrowser.ThemeEngine.theme.v1';

export function readTheme() {
	try {
		const id = localStorage.getItem(key);
		return Object.hasOwn(themes, id) ? id : 'classic';
	} catch {
		return 'classic';
	}
}

export function saveTheme(id) {
	try {
		localStorage.setItem(key, id);
	} catch {
		// Switching still works when browser storage is unavailable.
	}
}
