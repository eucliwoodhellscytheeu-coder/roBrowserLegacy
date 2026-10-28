import { createSkinCSS } from './SkinStyles.js';
import Client from 'Core/Client.js';
import DB from 'DB/DBManager.js';
import { discoverSkins, skinId } from './SkinCatalog.js';

// Vite packages root skin files as hashed assets for portable deployment.
const files = import.meta.glob('./skins/**/*.{png,jpg,jpeg,gif}', {
	eager: true,
	query: '?url',
	import: 'default'
});
const catalog = discoverSkins(files);
const bundled = new Map(catalog);
export const skinThemes = Object.fromEntries(
	[...catalog].map(([id, skin]) => [id, { label: skin.label, filter: 'none' }])
);
const cache = new Map();
const originals = new Map();
const available = new Set(
	Object.keys(files).map(path =>
		path
			.split('/')
			.slice(3)
			.join('/')
			.replace(/\.bmp\.png$/i, '.bmp')
			.toLowerCase()
	)
);

export function registerSkin(name, assets) {
	const id = skinId(name);
	catalog.set(id, { label: name, filter: 'none', assets });
	skinThemes[id] = { label: name, filter: 'none' };
	refreshAvailable();
	cache.delete(id);
	return id;
}

export function unregisterSkin(id) {
	if (bundled.has(id)) {
		catalog.set(id, bundled.get(id));
		skinThemes[id] = { label: bundled.get(id).label, filter: 'none' };
	} else {
		catalog.delete(id);
		delete skinThemes[id];
	}
	refreshAvailable();
	cache.delete(id);
}

function refreshAvailable() {
	available.clear();
	for (const skin of catalog.values()) {
		for (const path of Object.keys(skin.assets)) {
			available.add(path);
		}
	}
	for (const path of originals.keys()) {
		if (!available.has(path)) {
			originals.delete(path);
		}
	}
}

export function observeSkinAssets(onChange) {
	const loadFile = Client.loadFile;
	let pending = false;
	Client.loadFile = function (filename, onload, ...args) {
		const path = filename.replaceAll('\\', '/');
		const prefix = DB.INTERFACE_PATH.replaceAll('\\', '/');
		const relative = path.startsWith(prefix) ? path.slice(prefix.length).toLowerCase() : '';
		if (!available.has(relative) || typeof onload !== 'function') {
			return loadFile.call(this, filename, onload, ...args);
		}
		return loadFile.call(
			this,
			filename,
			data => {
				if (typeof data === 'string') {
					const urls = originals.get(relative) || new Set();
					if (!urls.has(data)) {
						urls.add(data);
						originals.set(relative, urls);
						cache.clear();
						if (!pending) {
							pending = true;
							setTimeout(() => {
								pending = false;
								onChange();
							}, 100);
						}
					}
				}
				onload(data);
			},
			...args
		);
	};
}

export function skinCSS(id) {
	if (!catalog.has(id)) {
		return '';
	}
	if (!cache.has(id)) {
		cache.set(id, createSkinCSS(catalog.get(id).assets, originals));
	}
	return cache.get(id);
}
