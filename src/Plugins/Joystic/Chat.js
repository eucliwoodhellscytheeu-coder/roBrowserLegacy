import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import Session from 'Engine/SessionStorage.js';
import KEYS from 'Controls/KeyEventHandler.js';

export const chatHTML = `<button id="chat-toggle" aria-label="Open chat" aria-expanded="false"></button>
<section id="plugin-chat" aria-label="Chat" hidden>
	<div class="chat-log" role="log" aria-live="polite" aria-label="Chat messages"><div class="chat-lines"></div></div>
	<form class="chat-input">
		<select class="chat-channel" aria-label="Chat channel"><option value="PUBLIC">Public</option><option value="PARTY">Party</option><option value="GUILD">Guild</option><option value="CLAN">Clan</option><option value="PRIVATE">Private</option></select>
		<input class="chat-recipient" type="text" placeholder="Name" aria-label="Whisper recipient" hidden>
		<input class="chat-message" type="text" placeholder="Say something..." aria-label="Message" autocomplete="off">
		<button class="chat-send" type="submit">Send</button>
	</form>
	<div class="chat-status" role="status"></div>
</section>`;

/** Send through the existing history, slash-command and packet handling. */
export function sendChatMessage(chat, message, channel, recipient = '') {
	if (
		!message.trim() ||
		!(channel in chat.TYPE) ||
		(channel === 'PRIVATE' && !recipient.trim() && !message.trim().startsWith('/'))
	) {
		return false;
	}
	if (!chat.__loaded) {
		chat.prepare();
	}
	const root = chat.getRoot();
	const input = root.querySelector('.input-chatbox');
	const username = root.querySelector('.input .username');
	if (!input || !username) {
		return false;
	}
	const previousChannel = chat.sendTo;
	const previousRecipient = username.value;
	chat.sendTo = chat.TYPE[channel];
	username.value = channel === 'PRIVATE' ? recipient.trim() : '';
	input.textContent = message;
	try {
		chat.submit();
	} finally {
		chat.sendTo = previousChannel;
		username.value = previousRecipient;
	}
	return true;
}

/** Replace message content without removing GUIComponent's scrollbar or losing scroll. */
export function replaceChatLines(log, lines, fragment, forceBottom = false) {
	const previousTop = log.scrollTop;
	const followBottom = forceBottom || log.scrollHeight - previousTop - log.clientHeight < 24;
	lines.replaceChildren(fragment);
	log.scrollTop = followBottom ? Math.max(0, log.scrollHeight - log.clientHeight) : previousTop;
}

export default function installChat(root, stopMove) {
	const panel = root.querySelector('#plugin-chat');
	const toggleButton = root.querySelector('#chat-toggle');
	const log = panel.querySelector('.chat-log');
	const lines = log.querySelector('.chat-lines');
	const form = panel.querySelector('form');
	const input = panel.querySelector('.chat-message');
	const channel = panel.querySelector('.chat-channel');
	const recipient = panel.querySelector('.chat-recipient');
	const status = panel.querySelector('.chat-status');
	let observedRoot;
	let composing = false;
	let links = new WeakMap();
	const show = open => {
		panel.hidden = !open;
		toggleButton.setAttribute('aria-expanded', String(open));
		toggleButton.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
		if (open) {
			stopMove();
			input.focus();
			log.scrollTop = log.scrollHeight;
		} else if (panel.contains(root.activeElement)) {
			root.activeElement.blur();
		}
	};
	toggleButton.addEventListener('click', () => show(panel.hidden));
	channel.addEventListener('change', () => {
		recipient.hidden = channel.value !== 'PRIVATE';
		status.textContent = '';
	});
	form.addEventListener('submit', event => {
		event.preventDefault();
		if (!Session.Entity || composing) {
			return;
		}
		if (sendChatMessage(ChatBox, input.value, channel.value, recipient.value)) {
			input.value = '';
			status.textContent = '';
			input.focus();
		} else {
			status.textContent =
				channel.value === 'PRIVATE' && !recipient.value.trim() ? 'Enter a recipient.' : 'Enter a message.';
		}
	});
	input.addEventListener('compositionstart', () => {
		composing = true;
	});
	input.addEventListener('compositionend', () => {
		composing = false;
	});
	panel.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
	for (const type of ['keydown', 'keyup', 'keypress']) {
		panel.addEventListener(type, event => {
			event.stopPropagation();
			if (type === 'keydown' && event.key === 'Escape') {
				event.preventDefault();
				show(false);
			}
		});
	}
	// Hide only the presentation; keep native message storage and handlers alive.
	const style = document.createElement('style');
	style.dataset.joysticChat = '';
	style.textContent = '#ChatBox { display: none !important; }';
	document.head.appendChild(style);
	const originalKeyDown = ChatBox.onKeyDown;
	ChatBox.onKeyDown = function onKeyDown(event) {
		if (panel.contains(root.activeElement)) {
			if (event.key === 'Escape') {
				show(false);
				event.stopImmediatePropagation();
				return false;
			}
			// Keep native form submission and text editing; prevent game shortcuts.
			event.stopImmediatePropagation();
			return true;
		}
		const focused = KEYS.getDeepActiveElement();
		if (
			(event.key === 'Enter' || event.which === 13) &&
			Session.Entity &&
			!event.isComposing &&
			!focused?.matches?.('input, textarea, select, button, [contenteditable="true"]')
		) {
			show(true);
			event.stopImmediatePropagation();
			return false;
		}
		return originalKeyDown.call(this, event);
	};
	ChatBox.toggleChat = () => {
		show(panel.hidden);
		return false;
	};
	if (ChatBox.__active) {
		ChatBox._bindKeyDown();
	}
	const mirror = () => {
		const source = observedRoot?.querySelector(`.content[data-content="${ChatBox.activeTab}"]`);
		if (!source) {
			return;
		}
		links = new WeakMap();
		const fragment = document.createDocumentFragment();
		for (const line of Array.from(source.children).slice(-50)) {
			const copy = line.cloneNode(true);
			// Forward item/name link clicks to native handlers with their real DOM targets.
			const originals = line.querySelectorAll('.item-link, .playername, a');
			copy.querySelectorAll('.item-link, .playername, a').forEach((link, index) =>
				links.set(link, originals[index])
			);
			fragment.appendChild(copy);
		}
		replaceChatLines(log, lines, fragment, panel.hidden);
	};
	log.addEventListener('click', event => {
		const source = links.get(event.target.closest('.item-link, .playername, a'));
		if (source) {
			event.preventDefault();
			source.dispatchEvent(
				new MouseEvent('click', {
					bubbles: true,
					cancelable: true,
					clientX: event.clientX,
					clientY: event.clientY
				})
			);
		}
	});
	const observer = new MutationObserver(mirror);
	return active => {
		const nativeRoot = ChatBox.getRoot();
		if (nativeRoot && nativeRoot !== observedRoot) {
			observer.disconnect();
			observedRoot = nativeRoot;
			observer.observe(nativeRoot, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['class']
			});
			mirror();
		}
		if (!active) {
			show(false);
		}
	};
}
