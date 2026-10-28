// Mark the element ui-image paints, avoiding thousands of relational :has rules.
export function trackSkinImages(root) {
	const backgrounds = new WeakMap();
	const updateBackground = node => {
		if (!node.style || !node.dataset) {
			return;
		}
		const background = node.style.backgroundImage;
		if (backgrounds.get(node) === background) {
			return;
		}
		backgrounds.set(node, background);
		const match = background.match(/^url\((?:"(.*)"|'(.*)'|([^)]*))\)$/);
		if (match) {
			node.dataset.themeEngineUrl = match[1] ?? match[2] ?? match[3];
		} else {
			delete node.dataset.themeEngineUrl;
		}
	};
	const update = parent => {
		if (!parent?.dataset) {
			return;
		}
		const image = [...parent.children].find(child => child.localName === 'ui-image' && child.hasAttribute('src'));
		if (image) {
			parent.dataset.themeEngineImage = image.getAttribute('src');
		} else {
			delete parent.dataset.themeEngineImage;
		}
	};
	const scan = node => {
		updateBackground(node);
		for (const child of node.querySelectorAll?.('[style], [data-theme-engine-url]') || []) {
			updateBackground(child);
		}
		if (node.localName === 'ui-image') {
			update(node.parentElement);
		}
		for (const image of node.querySelectorAll?.('ui-image[src]') || []) {
			update(image.parentElement);
		}
	};
	let connected = false;
	const observer = new MutationObserver(records => {
		for (const record of records) {
			if (record.type === 'attributes') {
				if (record.attributeName === 'style') {
					updateBackground(record.target);
				} else {
					update(record.target.parentElement);
				}
			} else {
				for (const node of record.addedNodes) {
					scan(node);
				}
				if ([...record.removedNodes].some(node => node.localName === 'ui-image')) {
					update(record.target);
				}
			}
		}
	});
	scan(root);
	return {
		connect() {
			if (!connected) {
				for (const parent of root.querySelectorAll('[data-theme-engine-image]')) {
					update(parent);
				}
				scan(root);
				observer.observe(root, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ['src', 'style']
				});
				connected = true;
			}
		},
		disconnect() {
			observer.disconnect();
			connected = false;
		}
	};
}
