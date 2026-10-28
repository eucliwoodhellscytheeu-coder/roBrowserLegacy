export function skinId(name) {
	// Preserve existing saved selections; new folder names need no registration.
	if (name === 'Alice in Wonderland') {
		return 'alice';
	}
	if (name === 'Phieti Renewal') {
		return 'phieti';
	}
	return `skin:${name.normalize('NFC')}`;
}

export function discoverSkins(files) {
	const catalog = new Map();
	for (const [filename, url] of Object.entries(files)) {
		const match = filename.match(/^\.\/skins\/([^/]+)\/(.+)$/);
		if (!match) {
			continue;
		}
		const [, name, relative] = match;
		const id = skinId(name);
		if (!catalog.has(id)) {
			catalog.set(id, { label: name, filter: 'none', assets: {} });
		}
		catalog.get(id).assets[relative.replace(/\.bmp\.png$/i, '.bmp').toLowerCase()] = url;
	}
	return catalog;
}
