import NpcMenu from 'UI/Components/NpcMenu/NpcMenu.js';
import translate from 'Plugins/Translate/Translator.js';

/** Toggle all choice labels while keeping the selectable option elements intact. */
export default function initNpcMenuTranslation(getLanguage, isAutomatic) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'npc-menu-translator-btn';
	button.textContent = '\u{1F310}';
	Object.assign(button.style, {
		position: 'absolute',
		left: '10px',
		bottom: '5px',
		cursor: 'pointer',
		background: 'transparent',
		border: 'none',
		padding: '0',
		lineHeight: '20px'
	});
	let originals = null;
	let revision = 0;
	let timer;
	const options = () => [...(NpcMenu.getRoot()?.querySelectorAll('.content > div[data-index]') || [])];
	const reset = () => {
		button.disabled = false;
		button.title = 'Translate choices';
		button.setAttribute('aria-label', button.title);
		button.setAttribute('aria-pressed', 'false');
	};
	const restore = () => {
		if (originals) {
			for (const { option, nodes } of originals) {
				option.replaceChildren(...nodes);
			}
			originals = null;
		}
		reset();
	};
	const invalidate = () => {
		revision++;
		clearTimeout(timer);
		restore();
	};
	button.addEventListener('mousedown', event => event.stopPropagation());
	button.addEventListener('click', async event => {
		event.stopPropagation();
		clearTimeout(timer);
		if (originals) {
			restore();
			return;
		}
		const choices = options();
		if (!choices.length) {
			return;
		}
		const requestRevision = revision;
		const language = getLanguage();
		button.disabled = true;
		button.title = 'Translating choices...';
		try {
			// Separate results keep each label mapped to its original server index.
			const labels = await Promise.all(choices.map(option => translate(option.textContent, language)));
			if (requestRevision !== revision || choices.some((option, index) => options()[index] !== option)) {
				return;
			}
			originals = choices.map(option => ({ option, nodes: [...option.childNodes] }));
			choices.forEach((option, index) => {
				option.textContent = labels[index];
			});
			button.title = 'Show original choices';
			button.setAttribute('aria-label', button.title);
			button.setAttribute('aria-pressed', 'true');
		} catch {
			if (requestRevision === revision) {
				button.title = 'Translation failed. Click to retry';
				button.setAttribute('aria-label', button.title);
			}
		} finally {
			if (requestRevision === revision) {
				button.disabled = false;
			}
		}
	});
	const attach = () => {
		const container = NpcMenu.getRoot()?.querySelector('.container');
		if (container && button.parentNode !== container) {
			container.append(button);
		}
	};
	const schedule = () => {
		attach();
		clearTimeout(timer);
		if (isAutomatic() && !originals && !button.disabled) {
			timer = setTimeout(() => button.click(), 0);
		}
	};
	const originalSetMenu = NpcMenu.setMenu;
	NpcMenu.setMenu = function (...args) {
		invalidate();
		const result = originalSetMenu.apply(this, args);
		schedule();
		return result;
	};
	const originalOnAppend = NpcMenu.onAppend;
	NpcMenu.onAppend = function (...args) {
		const result = originalOnAppend?.apply(this, args);
		schedule();
		return result;
	};
	const originalOnRemove = NpcMenu.onRemove;
	NpcMenu.onRemove = function (...args) {
		invalidate();
		return originalOnRemove?.apply(this, args);
	};
	reset();
	attach();
}
