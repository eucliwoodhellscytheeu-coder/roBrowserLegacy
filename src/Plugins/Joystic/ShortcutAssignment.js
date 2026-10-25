import ItemInfo from 'UI/Components/ItemInfo/ItemInfo.js';
import SkillDescription from 'UI/Components/SkillDescription/SkillDescription.js';
import SkillList from 'UI/Components/SkillList/SkillList.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import ShortCut from 'UI/Components/ShortCut/ShortCut.js';
import ContextMenu from 'UI/Components/ContextMenu/ContextMenu.js';

export function clearShortcut(index, shortcuts = ShortCut) {
	if (!Number.isInteger(index) || index < 0 || index > 17) {
		return false;
	}
	shortcuts.prepare();
	shortcuts.addElement(index, false, 0, 0);
	shortcuts.onChange(index, false, 0, 0);
	return true;
}

export function assignShortcut(index, data, shortcuts = ShortCut) {
	const skill = data.type === 'skill';
	const id = skill ? data.data.SKID : data.data.ITID;
	const level = skill ? Number(data.data.selectedLevel || data.data.level) : 0;
	if (
		!Number.isInteger(index) ||
		index < 0 ||
		index > 17 ||
		!id ||
		(skill && (!Number.isInteger(level) || level < 1 || level > data.data.level || !data.data.type))
	) {
		return false;
	}
	shortcuts.prepare();
	shortcuts.removeElement(skill, id, Math.floor(index / 9), skill ? level : undefined);
	shortcuts.addElement(index, skill, id, level);
	shortcuts.onChange(index, skill, id, level);
	return true;
}

export default function installAssignments(root) {
	const clear = index => {
		root.dispatchEvent(new CustomEvent('joystic-clear-slot', { detail: index }));
		return clearShortcut(index);
	};
	root.querySelector('#shortcuts').addEventListener('contextmenu', event => {
		const button = event.target.closest('[data-slot]');
		if (!button) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		const index = Number(button.dataset.slot);
		ContextMenu.remove();
		ContextMenu.append();
		ContextMenu.addElement(`Clear shortcut ${index < 9 ? 'F' : 'A'}${(index % 9) + 1}`, () => clear(index));
		const menu = ContextMenu.getRoot().querySelector('.menu');
		menu.style.left = `${Math.max(0, Math.min(event.clientX, window.innerWidth - menu.offsetWidth))}px`;
		menu.style.top = `${Math.max(0, Math.min(event.clientY, window.innerHeight - menu.offsetHeight))}px`;
	});
	const selectedItems = new WeakMap();
	const installPanel = (component, data, parent) => {
		let panel = component.getRoot()?.querySelector('.joystic-assignment');
		if (!panel) {
			panel = document.createElement('div');
			panel.className = 'joystic-assignment';
			panel.style.cssText =
				'position:relative;display:flex;flex-wrap:wrap;gap:4px;padding:6px;background:white;color:black;align-items:center';
			panel.innerHTML = `<select aria-label="Shortcut slot">${Array.from({ length: 18 }, (_, i) => `<option value="${i}">${i < 9 ? 'F' : 'A'}${(i % 9) + 1}</option>`).join('')}</select><input aria-label="Skill level" type="number" min="1" style="width:40px"><button type="button">Set shortcut</button><button class="clear-shortcut" type="button">Clear</button><span role="status"></span>`;
			panel.querySelector('.clear-shortcut').addEventListener('click', event => {
				event.stopPropagation();
				const index = Number(panel.querySelector('select').value);
				if (clear(index)) {
					panel.querySelector('[role="status"]').textContent =
						`${index < 9 ? 'F' : 'A'}${(index % 9) + 1} cleared`;
				}
			});
			panel.addEventListener('mousedown', event => event.stopPropagation());
			panel.addEventListener('keydown', event => event.stopPropagation());
			panel.addEventListener('keyup', event => event.stopPropagation());
			panel.addEventListener('touchstart', event => event.stopPropagation(), { passive: true });
			panel.querySelector('button').addEventListener('click', event => {
				event.stopPropagation();
				const current = selectedItems.get(component);
				const level = panel.querySelector('input');
				if (current.type === 'skill') {
					const value = Number(level.value);
					if (!Number.isInteger(value) || value < 1 || value > current.data.level) {
						return;
					}
					current.data = { ...current.data, selectedLevel: value };
				}
				const slot = Number(panel.querySelector('select').value);
				panel.querySelector('[role="status"]').textContent = assignShortcut(slot, current)
					? `${slot < 9 ? 'F' : 'A'}${(slot % 9) + 1} set`
					: 'Unavailable';
			});
			component.getRoot().querySelector(parent).appendChild(panel);
		}
		selectedItems.set(component, data);
		const input = panel.querySelector('input');
		input.hidden = data.type !== 'skill';
		input.max = data.data.level || 1;
		input.value = data.data.selectedLevel || data.data.level || 1;
		panel.querySelector('[role="status"]').textContent = '';
	};
	const originalItem = ItemInfo.setItem;
	ItemInfo.setItem = function setItem(item) {
		const result = originalItem.call(this, item);
		if (item && Inventory.getItemById(item.ITID)) {
			installPanel(this, { type: 'item', data: item }, '.ItemInfo');
		} else {
			this.getRoot()?.querySelector('.joystic-assignment')?.remove();
		}
		return result;
	};
	const originalSkill = SkillDescription.setSkill;
	SkillDescription.setSkill = function setSkill(id) {
		const result = originalSkill.call(this, id);
		const skill = SkillList.getSkillById(id);
		if (skill?.level && skill.type) {
			installPanel(this, { type: 'skill', data: skill }, '#SkillDescription');
		} else {
			this.getRoot()?.querySelector('.joystic-assignment')?.remove();
		}
		return result;
	};
	root.querySelector('#shortcuts').addEventListener('dragover', event => event.preventDefault());
	root.querySelector('#shortcuts').addEventListener('drop', event => {
		event.preventDefault();
		event.stopPropagation();
		const button = event.target.closest('[data-slot]');
		try {
			const data = JSON.parse(event.dataTransfer.getData('Text'));
			if (button && ['item', 'skill'].includes(data.type)) {
				assignShortcut(Number(button.dataset.slot), data);
			}
		} catch {
			// Other applications can supply unrelated drag data.
		}
	});
	// Touch equivalent of the existing right-click item/skill information action.
	let timer;
	let origin;
	let suppressUntil = 0;
	const cancel = () => window.clearTimeout(timer);
	document.addEventListener(
		'pointerdown',
		event => {
			cancel();
			if (event.pointerType !== 'touch') {
				return;
			}
			const path = event.composedPath();
			const host = path.find(node => ['Inventory', 'Equipment', 'SkillList'].includes(node.id));
			const entry = path.find(node => node.matches?.('.item[data-index], .skill[data-index]'));
			if (!host || !entry) {
				return;
			}
			origin = [event.clientX, event.clientY];
			timer = window.setTimeout(() => {
				suppressUntil = performance.now() + 1000;
				entry.dispatchEvent(
					new MouseEvent('contextmenu', {
						bubbles: true,
						cancelable: true,
						clientX: event.clientX,
						clientY: event.clientY
					})
				);
			}, 500);
		},
		true
	);
	document.addEventListener(
		'pointermove',
		event => {
			if (origin && Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 10) {
				cancel();
			}
		},
		true
	);
	for (const type of ['pointerup', 'pointercancel', 'visibilitychange']) {
		document.addEventListener(type, cancel, true);
	}
	window.addEventListener('blur', cancel);
	document.addEventListener(
		'click',
		event => {
			if (
				performance.now() < suppressUntil &&
				event.composedPath().some(node => ['Inventory', 'Equipment', 'SkillList'].includes(node.id))
			) {
				event.preventDefault();
				event.stopImmediatePropagation();
			}
		},
		true
	);
}
