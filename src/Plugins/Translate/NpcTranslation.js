import NpcBox from 'UI/Components/NpcBox/NpcBox.js';
import translate from 'Plugins/Translate/Translator.js';

/** Translate the visible NPC page as one request, retaining its original DOM. */
export default function initNpcTranslation(getLanguage, isAutomatic) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'npc-translator-btn';
	button.textContent = '\u{1F310}';
	Object.assign(button.style, {
		position: 'absolute',
		left: '10px',
		bottom: '6px',
		cursor: 'pointer',
		background: 'transparent',
		border: 'none',
		padding: '0',
		lineHeight: '20px'
	});
	let originalNodes = null;
	let revision = 0;
	let timer;
	const content = () => NpcBox.getRoot()?.querySelector('.content');
	const resetButton = () => {
		button.disabled = false;
		button.title = 'Translate dialogue';
		button.setAttribute('aria-label', button.title);
		button.setAttribute('aria-pressed', 'false');
	};
	const restore = () => {
		if (originalNodes) {
			content()?.replaceChildren(...originalNodes);
			originalNodes = null;
		}
		resetButton();
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
		if (originalNodes) {
			restore();
			return;
		}
		const page = content();
		if (!page || !page.textContent.trim()) {
			return;
		}
		// Each setText call adds a div; keep those line boundaries in the request.
		const text = [...page.childNodes].map(node => node.textContent).join('\n');
		const requestRevision = revision;
		button.disabled = true;
		button.title = 'Translating dialogue...';
		try {
			const translated = await translate(text, getLanguage());
			if (requestRevision !== revision || content() !== page) {
				return;
			}
			originalNodes = [...page.childNodes];
			page.textContent = translated;
			button.title = 'Show original dialogue';
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
		const border = NpcBox.getRoot()?.querySelector('.border');
		if (border && button.parentNode !== border) {
			border.append(button);
		}
	};
	const schedule = () => {
		attach();
		clearTimeout(timer);
		if (isAutomatic()) {
			// Coalesce the consecutive line packets making up the visible page.
			timer = setTimeout(() => button.click(), 200);
		}
	};
	const originalSetText = NpcBox.setText;
	NpcBox.setText = function (...args) {
		invalidate();
		const result = originalSetText.apply(this, args);
		schedule();
		return result;
	};
	const originalOnAppend = NpcBox.onAppend;
	NpcBox.onAppend = function (...args) {
		const result = originalOnAppend?.apply(this, args);
		schedule();
		return result;
	};
	// Invalidate pending results as soon as the player advances or closes.
	for (const method of ['next', 'close', 'onRemove']) {
		const original = NpcBox[method];
		NpcBox[method] = function (...args) {
			invalidate();
			return original?.apply(this, args);
		};
	}
	resetButton();
	attach();
}
