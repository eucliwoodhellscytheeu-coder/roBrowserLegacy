import GUIComponent from 'UI/GUIComponent.js';
import UIManager from 'UI/UIManager.js';
import Session from 'Engine/SessionStorage.js';
import Camera from 'Renderer/Camera.js';
import Renderer from 'Renderer/Renderer.js';
import Altitude from 'Renderer/Map/Altitude.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import PACKETVER from 'Network/PacketVerManager.js';
import ShortCut from 'UI/Components/ShortCut/ShortCut.js';
import attack from './ManualAttack.js';
import installAssignments from './ShortcutAssignment.js';
import { JoystickWalk, DEAD_ZONE } from './Movement.js';
import EntityManager from 'Renderer/EntityManager.js';
import Entity from 'Renderer/Entity/Entity.js';
import { sizeOverlay } from './Viewport.js';
import installChat, { chatHTML } from './Chat.js';
import installShortcutTargeting from './ShortcutTargeting.js';
import installTouchCamera from './TouchCamera.js';
import { WalkContinuity } from './WalkContinuity.js';
import { isMobileDevice } from './MobileDevice.js';
import cssText from './Joystic.css?raw';

let instance;

/** Plugin entry: ROConfig.plugins = { Joystic: 'Joystic/Joystic' }. */
export default function Joystic() {
	if (!isMobileDevice()) {
		return true;
	}
	if (instance) {
		return true;
	}
	const ui = new GUIComponent(
		'Joystic',
		cssText.replaceAll('__MENU_SPRITE__', new URL('./ui-menu.png', import.meta.url).href)
	);
	instance = ui;
	ui.needFocus = false;
	ui.onAppend = () => sizeOverlay(ui);
	ui.render = () => `<div id="controls" hidden>
		<div id="stick" role="group" aria-label="Movement joystick"><img draggable="false" src="${new URL('./joystaic.png', import.meta.url).href}" alt=""><span id="thumb"></span></div>
		<button id="attack" aria-label="Attack nearest target">ATK</button>
		<div id="shortcuts">${Array.from({ length: 9 }, (_, i) => `<button data-slot="${i}" data-position="${i + 1}" aria-label="Shortcut F${i + 1}"><span class="icon"></span><span class="shortcut-key">F${i + 1}</span></button>`).join('')}<button id="shortcut-switch" aria-label="Switch to shortcuts A1 to A9">F → A</button></div>
		<button id="orientation" aria-label="Change screen orientation">Rotate</button>
		${chatHTML}
	</div>`;
	let pointer = null;
	let centerTap = false;
	let vector = [0, 0];
	let movingPlayer = null;
	const walk = new JoystickWalk();
	const continuity = new WalkContinuity();
	let lastRefresh = 0;
	let shortcutRow = 0;
	let refreshChat;
	let shortcutInput;
	let touchCamera;
	let player = null;
	const movePacket = (x, y) => {
		const packet = PACKETVER.value >= 20180307 ? new PACKET.CZ.REQUEST_MOVE2() : new PACKET.CZ.REQUEST_MOVE();
		packet.dest[0] = x;
		packet.dest[1] = y;
		Network.sendPacket(packet);
	};
	const stop = (release = true) => {
		if (release) {
			shortcutInput?.cancel();
		}
		// Like MapEngine.onRequestStopWalk, stop renewing the path. A move to the
		// displayed tile can send the server back to a position it already passed.
		movingPlayer = null;
		vector = [0, 0];
		walk.reset();
		continuity.stop();
		const stick = ui.getRoot()?.querySelector('#stick');
		if (release) {
			centerTap = false;
			const captured = pointer;
			pointer = null;
			if (captured !== null && stick?.hasPointerCapture(captured)) {
				stick.releasePointerCapture(captured);
			}
		}
		const thumb = ui.getRoot()?.querySelector('#thumb');
		if (thumb) {
			thumb.style.transform = '';
		}
	};
	ui.init = () => {
		const root = ui.getRoot();
		installAssignments(root);
		refreshChat = installChat(root, stop);
		shortcutInput = installShortcutTargeting(root, stop);
		touchCamera = installTouchCamera();
		root.querySelector('#shortcut-switch').addEventListener('click', () => {
			shortcutInput.cancel();
			shortcutRow = 1 - shortcutRow;
			const prefix = shortcutRow ? 'A' : 'F';
			root.querySelectorAll('[data-slot]').forEach((button, index) => {
				button.dataset.slot = String(shortcutRow * 9 + index);
				button.setAttribute('aria-label', `Shortcut ${prefix}${index + 1}`);
				button.querySelector('.shortcut-key').textContent = `${prefix}${index + 1}`;
				button.querySelector('.icon').style.backgroundImage = '';
			});
			const toggle = root.querySelector('#shortcut-switch');
			toggle.textContent = shortcutRow ? 'A → F' : 'F → A';
			toggle.dataset.row = prefix;
			toggle.setAttribute(
				'aria-label',
				shortcutRow ? 'Switch to shortcuts F1 to F9' : 'Switch to shortcuts A1 to A9'
			);
			lastRefresh = 0;
		});
		const stick = root.querySelector('#stick');
		for (const type of ['mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'contextmenu']) {
			root.addEventListener(
				type,
				event => {
					event.stopPropagation();
					if (
						type === 'contextmenu' ||
						(type === 'mousedown' && !event.target.closest('input, select, textarea, [contenteditable]'))
					) {
						event.preventDefault();
					}
				},
				{ passive: false }
			);
		}
		const update = event => {
			const rect = stick.getBoundingClientRect();
			const x = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
			const y = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
			const length = Math.max(1, Math.hypot(x, y));
			if (Math.hypot(x, y) >= DEAD_ZONE) {
				centerTap = false;
			}
			vector = [x / length, y / length];
			root.querySelector('#thumb').style.transform = `translate(${vector[0] * 27}px, ${vector[1] * 27}px)`;
		};
		stick.addEventListener('pointerdown', event => {
			if (pointer !== null || event.button !== 0) {
				return;
			}
			event.preventDefault();
			pointer = event.pointerId;
			centerTap = true;
			stick.setPointerCapture(pointer);
			Session.moveAction = null;
			Session.autoFollow = false;
			update(event);
		});
		stick.addEventListener('pointermove', event => {
			if (event.pointerId === pointer) {
				update(event);
			}
		});
		for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
			stick.addEventListener(type, event => {
				if (event.pointerId === pointer) {
					const attackFromCenter =
						event.type === 'pointerup' && centerTap && window.matchMedia('(orientation: portrait)').matches;
					stop();
					if (attackFromCenter) {
						attack();
					}
				}
			});
		}
		const attackButton = root.querySelector('#attack');
		attackButton.addEventListener('pointerdown', event => {
			if (event.button !== 0) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			stop();
			attack();
		});
		attackButton.addEventListener('click', event => {
			// Keyboard activation does not produce a pointerdown.
			if (event.detail === 0) {
				stop();
				attack();
			}
		});
		root.querySelector('#orientation').addEventListener('click', async () => {
			stop();
			const button = root.querySelector('#orientation');
			try {
				if (!screen.orientation?.lock) {
					button.textContent = 'Rotate device';
					return;
				}
				const target = screen.orientation.type.startsWith('portrait') ? 'landscape' : 'portrait';
				if (!document.fullscreenElement) {
					await document.documentElement.requestFullscreen();
				}
				await screen.orientation.lock(target);
				button.textContent = 'Rotate';
			} catch {
				button.textContent = 'Rotate device';
			}
		});
	};
	UIManager.addComponent(ui);
	ui.append();
	window.addEventListener('blur', stop);
	window.addEventListener('resize', () => {
		stop();
		sizeOverlay(ui);
	});
	screen.orientation?.addEventListener('change', stop);
	document.addEventListener('visibilitychange', stop);
	ui.onRemove = stop;
	window.setInterval(() => {
		const active = !!Session.Entity && !!Renderer.rendering && !document.hidden;
		refreshChat?.(active);
		touchCamera?.update();
		if (active && !ui.__active) {
			ui.append();
		}
		ui.getRoot().querySelector('#controls').hidden = !active;
		if (!active || player !== Session.Entity) {
			stop();
			player = Session.Entity;
		}
		if (!active) {
			return;
		}
		shortcutInput.update();
		const now = performance.now();
		if (Math.hypot(...vector) < DEAD_ZONE) {
			if (movingPlayer) {
				stop(false);
			}
		} else if (!player.isDeath && player.action !== player.ACTION.DIE && player.action !== player.ACTION.SIT) {
			const occupied = new Set();
			EntityManager.forEach(entity => {
				if (![Entity.TYPE_EFFECT, Entity.TYPE_UNIT, Entity.TYPE_TRAP].includes(entity.objecttype)) {
					occupied.add(`${Math.round(entity.position[0])},${Math.round(entity.position[1])}`);
				}
				return true;
			});
			const dest = walk.next(
				player.position,
				vector,
				Camera,
				Altitude,
				now,
				{ width: Renderer.width, height: Renderer.height },
				(x, y) => occupied.has(`${x},${y}`)
			);
			if (dest) {
				continuity.track(player, dest);
				movePacket(...dest);
				movingPlayer = player;
			}
		}
		if (now - lastRefresh > 250) {
			lastRefresh = now;
			const slots = ShortCut.getList();
			for (const button of ui.getRoot().querySelectorAll('[data-slot]')) {
				const slot = slots[Number(button.dataset.slot)];
				button.setAttribute('aria-disabled', String(!slot?.ID));
				// Reuse the client's loaded shortcut art; do not issue extra asset requests.
				const source = ShortCut.getRoot()?.querySelector(`[data-index="${button.dataset.slot}"] .img`);
				const icon = button.querySelector('.icon');
				if (source) {
					icon.style.backgroundImage = getComputedStyle(source).backgroundImage;
				} else {
					icon.style.backgroundImage = '';
				}
			}
		}
	}, 33);
	return true;
}
