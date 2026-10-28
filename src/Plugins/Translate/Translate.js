import initNpcMenuTranslation from 'Plugins/Translate/NpcMenuTranslation.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import initNpcTranslation from 'Plugins/Translate/NpcTranslation.js';
import translate from 'Plugins/Translate/Translator.js';

let initialized = false;

export default function init() {
	if (initialized) {
		return true;
	}
	initialized = true;

	let targetLang = 'en';
	let autoTranslateEnabled = false;
	const container = document.createElement('div');
	Object.assign(container.style, { display: 'inline-block', verticalAlign: 'middle' });
	const langSelect = document.createElement('select');
	langSelect.id = 'translator-lang';
	langSelect.title = 'Translation language';
	Object.assign(langSelect.style, {
		margin: '1px',
		padding: '0 2px',
		fontSize: '10px',
		fontFamily: '"Tahoma", "MS Gothic", sans-serif',
		color: '#a6aff5',
		background: 'linear-gradient(#2a2a2a, #1a1a1a)',
		border: '1px solid #555',
		borderRadius: '2px',
		outline: 'none',
		zIndex: '100001'
	});
	const languages = {
		en: 'English',
		ja: 'Japanese',
		tl: 'Tagalog',
		fr: 'French',
		es: 'Spanish',
		ko: 'Korean',
		'zh-CN': 'Chinese',
		'zh-TW': 'Taiwan',
		ar: 'Arabic'
	};
	for (const [code, label] of Object.entries(languages)) {
		const option = document.createElement('option');
		option.value = code;
		option.textContent = label;
		langSelect.append(option);
	}
	langSelect.value = targetLang;
	langSelect.addEventListener('change', () => {
		targetLang = langSelect.value;
	});
	const checkbox = document.createElement('input');
	checkbox.type = 'checkbox';
	checkbox.id = 'auto-translate';
	checkbox.title = 'Automatically translate messages';
	Object.assign(checkbox.style, { margin: '1px 5px 1px 2px', transform: 'scale(0.8)', zIndex: '100001' });
	checkbox.addEventListener('change', () => {
		autoTranslateEnabled = checkbox.checked;
	});
	container.append(langSelect, checkbox);
	for (const type of ['keydown', 'keyup', 'keypress']) {
		container.addEventListener(type, event => event.stopPropagation());
	}

	const decorate = (line, preserveSender = true) => {
		if (line.querySelector('.translator-btn')) {
			return;
		}
		const original = line.textContent;
		const textSpan = document.createElement('span');
		textSpan.className = 'msg-text';
		// Move existing nodes so item links and sender links keep their handlers.
		textSpan.append(...line.childNodes);
		const originalNodes = [...textSpan.childNodes];
		let showingTranslation = false;
		let translatedText;
		let translatedLanguage;
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'translator-btn';
		button.textContent = '\u{1F310}';
		button.title = 'Translate message';
		Object.assign(button.style, {
			marginLeft: '2px',
			fontSize: '0.9em',
			cursor: 'pointer',
			background: 'transparent',
			border: 'none',
			padding: '0',
			outline: 'none',
			lineHeight: '1'
		});

		button.setAttribute('aria-pressed', 'false');
		button.addEventListener('click', async event => {
			event.stopPropagation();
			if (showingTranslation) {
				textSpan.replaceChildren(...originalNodes);
				showingTranslation = false;
				button.title = 'Show translation';
				button.setAttribute('aria-pressed', 'false');
				return;
			}
			const language = targetLang;
			const sepIndex = preserveSender ? original.indexOf(':') : -1;
			const prefix = sepIndex === -1 ? '' : original.substring(0, sepIndex + 1) + ' ';
			const message = sepIndex === -1 ? original : original.substring(sepIndex + 1).trim();
			button.disabled = true;
			button.title = 'Translating...';
			try {
				if (translatedText === undefined || translatedLanguage !== language) {
					translatedText = await translate(message, language);
					translatedLanguage = language;
				}
				textSpan.textContent = prefix + translatedText;
				showingTranslation = true;
				button.title = 'Show original message';
				button.setAttribute('aria-pressed', 'true');
			} catch {
				button.title = 'Translation failed. Click to retry';
			} finally {
				button.disabled = false;
			}
		});
		line.append(textSpan, button);
		if (autoTranslateEnabled) {
			button.click();
		}
	};

	const observer = new MutationObserver(records => {
		for (const record of records) {
			// ChatBox appends buffered messages to each tab in a document fragment.
			if (record.target instanceof Element && record.target.matches('.content')) {
				for (const node of record.addedNodes) {
					if (node instanceof Element && node.parentElement === record.target) {
						decorate(node);
					}
				}
			}
		}
	});
	const attach = () => {
		const root = ChatBox.getRoot();
		const header = root?.querySelector('.chat-function');
		if (header) {
			header.append(container);
			observer.disconnect();
			observer.observe(root, { childList: true, subtree: true });
		}
	};
	const originalOnAppend = ChatBox.onAppend;
	ChatBox.onAppend = function (...args) {
		const result = originalOnAppend?.apply(this, args);
		attach();
		return result;
	};
	const originalOnRemove = ChatBox.onRemove;
	ChatBox.onRemove = function (...args) {
		observer.disconnect();
		return originalOnRemove?.apply(this, args);
	};

	initNpcMenuTranslation(
		() => targetLang,
		() => autoTranslateEnabled
	);
	initNpcTranslation(
		() => targetLang,
		() => autoTranslateEnabled
	);
	attach();
	return true;
}
