import GUIComponent from 'UI/GUIComponent.js';
import UIManager from 'UI/UIManager.js';
import GraphicsOption from 'UI/Components/GraphicsOption/GraphicsOption.js';
import 'UI/Elements/Elements.js';
import htmlText from './ThemeEngine.html?raw';
import cssText from './ThemeEngine.css?raw';
import { themes, readTheme, saveTheme } from './Themes.js';
import { skinCSS, observeSkinAssets, registerSkin, unregisterSkin, skinThemes } from './SkinAssets.js';
import { folderEntries, droppedFolder, importSkinFolder } from './SkinImport.js';
import { trackSkinImages } from './SkinImages.js';

let initialized = false;
let current = 'classic';
const variable = '--robrowser-theme-engine-filter';
const styles = new Set();
const sharedSheet =
	typeof CSSStyleSheet !== 'undefined' && typeof CSSStyleSheet.prototype.replaceSync === 'function'
		? new CSSStyleSheet()
		: null;
let sharedCSS = '';
let importing = false;
let importController;
const importedURLs = new Map();
const themeStyle = () => `:host { filter: var(${variable}, none); }\n${skinCSS(current)}`;
function refreshStyles() {
	const css = themeStyle();
	if (sharedSheet) {
		if (css !== sharedCSS) {
			sharedSheet.replaceSync(css);
			sharedCSS = css;
		}
		return;
	}
	for (const reference of styles) {
		const style = reference.deref();
		if (style) {
			if (style.textContent !== css) {
				style.textContent = css;
			}
		} else {
			styles.delete(reference);
		}
	}
}
const panel = new GUIComponent('ThemeEngine', cssText);
panel.render = () => htmlText;
panel.mouseMode = GUIComponent.MouseMode.STOP;
panel.needFocus = true;
panel.captureKeyEvents = true;
panel.init = () => {
	const root = panel.getRoot();
	const select = root.querySelector('select');
	for (const [id, theme] of Object.entries(themes)) {
		select.add(new Option(theme.label, id));
	}
	select.addEventListener('change', () => setTheme(select.value));
	root.querySelector('.close').addEventListener('click', () => panel.remove());
	root.querySelector('.reset').addEventListener('click', () => setTheme('classic'));
	root.querySelector('.unload').addEventListener('click', () => {
		const id = current;
		const urls = importedURLs.get(id);
		if (!urls) {
			return;
		}
		unregisterSkin(id);
		if (Object.hasOwn(skinThemes, id)) {
			themes[id] = skinThemes[id];
		} else {
			delete themes[id];
			for (const option of select.options) {
				if (option.value === id) {
					option.remove();
					break;
				}
			}
		}
		importedURLs.delete(id);
		setTheme('classic');
		for (const url of urls) {
			URL.revokeObjectURL(url);
		}
		root.querySelector('.import-status').textContent = 'Imported theme removed.';
	});
	const picker = root.querySelector('.folder');
	root.querySelector('.import').addEventListener('click', () => picker.click());
	picker.addEventListener('change', () => {
		if (picker.files.length) {
			loadFolder(Promise.resolve(folderEntries(picker.files)));
		}
		picker.value = '';
	});
	const drop = root.querySelector('.drop-zone');
	drop.addEventListener('dragover', event => {
		event.preventDefault();
		event.stopPropagation();
	});
	drop.addEventListener('drop', event => {
		event.preventDefault();
		event.stopPropagation();
		if (!importing) {
			loadFolder(droppedFolder(event.dataTransfer.items));
		}
	});
	panel.draggable('.titlebar');
};

async function loadFolder(entries) {
	if (importing) {
		return;
	}
	importing = true;
	importController = new AbortController();
	const root = panel.getRoot();
	const button = root.querySelector('.import');
	const status = root.querySelector('.import-status');
	button.disabled = true;
	status.textContent = 'Loading theme…';
	try {
		const { name, assets } = await importSkinFolder(
			await entries,
			(done, total) => {
				status.textContent = `Loading theme… ${done}/${total}`;
			},
			{ signal: importController.signal }
		);
		const id = registerSkin(name, assets);
		themes[id] = skinThemes[id];
		const select = root.querySelector('select');
		if (![...select.options].some(option => option.value === id)) {
			select.add(new Option(name, id));
		}
		const oldURLs = importedURLs.get(id) || [];
		importedURLs.set(id, Object.values(assets));
		setTheme(id);
		for (const url of oldURLs) {
			URL.revokeObjectURL(url);
		}
		status.textContent = `Loaded ${name}. Local imports last until this page is reloaded.`;
	} catch (error) {
		status.textContent =
			error.name === 'AbortError' ? 'Theme import cancelled.' : `Theme could not be loaded: ${error.message}`;
	} finally {
		importing = false;
		importController = null;
		button.disabled = false;
	}
}
panel.onRemove = () => importController?.abort();
panel.onAppend = () => {
	panel.getRoot().querySelector('select').value = current;
};
panel.onKeyDown = event => {
	if (event.key === 'Escape' || event.which === 27) {
		event.stopImmediatePropagation();
		panel.remove();
		return false;
	}
	if (panel.isEditableFocused()) {
		event.stopImmediatePropagation();
	}
};

export function setTheme(id) {
	if (!Object.hasOwn(themes, id)) {
		return false;
	}
	current = id;
	document.documentElement.style.setProperty(variable, themes[id].filter);
	refreshStyles();
	saveTheme(id);
	const root = panel.getRoot();
	if (root) {
		root.querySelector('select').value = id;
		root.querySelector('.unload').disabled = !importedURLs.has(id);
	}
	return true;
}

function decorate(component) {
	const root = component.getRoot();
	if (!root || root.querySelector('style[data-theme-engine]')) {
		return;
	}
	const style = document.createElement('style');
	style.dataset.themeEngine = '';
	if (sharedSheet) {
		root.adoptedStyleSheets = [...(root.adoptedStyleSheets || []), sharedSheet];
	} else {
		style.textContent = themeStyle();
		styles.add(new WeakRef(style));
	}
	root.appendChild(style);
	component._themeImages = trackSkinImages(root);
	if (component._host?.isConnected) {
		component._themeImages.connect();
	}
	if (component === GraphicsOption) {
		const button = document.createElement('button');
		button.className = 'theme-engine';
		button.type = 'button';
		button.textContent = 'Theme Engine';
		button.setAttribute('aria-label', 'Theme Engine');
		button.addEventListener('click', () => {
			if (panel._host?.isConnected) {
				panel.remove();
			} else {
				panel.append();
			}
		});
		const row = document.createElement('tr');
		row.className = 'theme-engine-row';
		const label = document.createElement('td');
		label.textContent = 'Interface theme';
		const control = document.createElement('td');
		control.appendChild(button);
		row.append(label, control);
		root.querySelector('#basic .resolution').after(row);
	}
}

export default function initialize() {
	if (initialized) {
		return true;
	}
	initialized = true;
	observeSkinAssets(refreshStyles);
	UIManager.addComponent(panel);
	// Use the normal lifecycle so future windows and clones inherit the theme too.
	const prepare = GUIComponent.prototype.prepare;
	GUIComponent.prototype.prepare = function (...args) {
		const result = prepare.apply(this, args);
		decorate(this);
		return result;
	};
	const append = GUIComponent.prototype.append;
	GUIComponent.prototype.append = function (...args) {
		const result = append.apply(this, args);
		if (this._host?.isConnected) {
			this._themeImages?.connect();
		}
		return result;
	};
	const remove = GUIComponent.prototype.remove;
	GUIComponent.prototype.remove = function (...args) {
		const result = remove.apply(this, args);
		this._themeImages?.disconnect();
		return result;
	};
	for (const component of Object.values(UIManager.components)) {
		decorate(component);
	}
	setTheme(readTheme());
	return true;
}
