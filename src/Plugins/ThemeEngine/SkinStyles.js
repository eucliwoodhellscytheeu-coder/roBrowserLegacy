// Overrides preserve native loaders, event handlers, and original fallback art.
export function createSkinCSS(assets, originals = new Map()) {
	const rules = [];
	for (const [path, url] of Object.entries(assets)) {
		const value = JSON.stringify(path.toLowerCase());
		rules.push(
			`[data-background=${value} i], ui-button[bg=${value} i], [data-theme-engine-image=${value} i] { background-image: url(${JSON.stringify(url)}) !important; }`
		);
		for (const original of originals.get(path.toLowerCase()) || []) {
			rules.push(
				`[data-theme-engine-url=${JSON.stringify(original)}] { background-image: url(${JSON.stringify(url)}) !important; }`
			);
		}
	}
	// State rules follow base rules so hover/down images always win.
	for (const [attribute, state] of [
		['hover', ':hover'],
		['active', '.active'],
		['down', ':active']
	]) {
		for (const [path, url] of Object.entries(assets)) {
			const value = JSON.stringify(path.toLowerCase());
			rules.push(
				`[data-${attribute}=${value} i]${state}, ui-button[${attribute}=${value} i]${state} { background-image: url(${JSON.stringify(url)}) !important; }`
			);
		}
	}
	rules.push(createSliderCSS(assets));
	rules.push(createItemInfoCSS(assets));
	rules.push(createScrollbarCSS(assets));
	rules.push(createHorizontalScrollbarCSS(assets));
	return rules.join('\n');
}

export function createSliderCSS(assets) {
	const image = name => assets[name] || assets[`basic_interface/${name}`];
	const urls = ['scroll1mid.bmp', 'scroll1bar_left.bmp', 'scroll1bar_mid.bmp', 'scroll1bar_right.bmp'].map(image);
	if (urls.some(url => !url)) {
		return '';
	}
	const [track, left, middle, right] = urls.map(url => `url(${JSON.stringify(url)})`);
	const range = 'input[type="range"]:not([orient="vertical"])';
	const trackStyle = `height: 13px; border: 0; border-radius: 0; box-shadow: none; background: transparent ${track} repeat-x center / auto 13px;`;
	const thumbStyle = `box-sizing: border-box; width: 18px; height: 13px; border: 0; border-radius: 0; box-shadow: none;
		background-color: transparent; background-image: ${left}, ${right}, ${middle};
		background-position: left center, right center, center; background-repeat: no-repeat;
		background-size: 4px 13px, 4px 13px, calc(100% - 8px) 13px;`;
	return `
		${range} { -webkit-appearance: none; appearance: none; background: transparent; min-height: 20px; padding: 0; }
		${range}::-webkit-slider-runnable-track { ${trackStyle} }
		${range}::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; margin-top: 0; ${thumbStyle} }
		${range}::-moz-range-track { ${trackStyle} }
		${range}::-moz-range-thumb { ${thumbStyle} }
		${range}::-moz-range-progress { background: transparent; border: 0; }
		${range}:focus-visible { outline: 1px solid currentColor; outline-offset: 2px; }
		${range}:disabled { opacity: 0.5; }
	`;
}

// Collection artwork is 280 x 120. Keep its title and bottom edge at their
// original sizes; stretch only the middle as ItemInfo changes its height.
export function createItemInfoCSS(assets) {
	const url = assets['basic_interface/collection_bg.bmp'];
	if (!url) {
		return '';
	}
	return `
		.ItemInfo .container[data-background="basic_interface/collection_bg.bmp"] {
			background-image: none !important;
			isolation: isolate;
		}
		.ItemInfo .container[data-background="basic_interface/collection_bg.bmp"]::before {
			content: '';
			position: absolute;
			inset: 0;
			box-sizing: border-box;
			pointer-events: none;
			z-index: -1;
			border-style: solid;
			border-color: transparent;
			border-width: 35px 6px 8px;
			border-image-source: url(${JSON.stringify(url)});
			border-image-slice: 35 6 8 fill;
			border-image-width: 35px 6px 8px;
			border-image-repeat: stretch;
		}
	`;
}

export function createScrollbarCSS(assets) {
	const image = name => assets[name] || assets[`basic_interface/${name}`];
	const urls = [
		'scroll0up.bmp',
		'scroll0down.bmp',
		'scroll0mid.bmp',
		'scroll0bar_up.bmp',
		'scroll0bar_mid.bmp',
		'scroll0bar_down.bmp'
	].map(image);
	// Keep the original scrollbar intact when a skin is incomplete.
	if (urls.some(url => !url)) {
		return '';
	}
	const [up, down, track, top, middle, bottom] = urls.map(url => `url(${JSON.stringify(url)})`);
	const bar = '.ro-custom-scrollbar';
	const scrollable = '*';
	const thumb = `
		background-color: transparent !important;
		background-image: ${top}, ${bottom}, ${middle} !important;
		background-position: center top, center bottom, center !important;
		background-size: 100% 4px, 100% 4px, 100% calc(100% - 8px) !important;
		background-repeat: no-repeat !important;
		border: 0 !important;
		border-image: none !important;
		border-radius: 0;
		box-shadow: none;
	`;
	return `
		${bar} .btn-up { background: transparent ${up} no-repeat center / 100% 100% !important; }
		${bar} .btn-down { background: transparent ${down} no-repeat center !important; }
		${bar} .track { background: transparent ${track} repeat-y center / 100% auto !important; }
		${bar} .thumb { ${thumb} }
		/* Also cover native scrollbars before the GUI scrollbar is attached. */
		${scrollable}::-webkit-scrollbar { width: 13px; }
		${scrollable}::-webkit-scrollbar-track:vertical { background: transparent ${track} repeat-y center; }
		${scrollable}::-webkit-scrollbar-thumb:vertical { min-height: 12px; ${thumb} }
		${scrollable}::-webkit-scrollbar-button:vertical { display: none; }
		${scrollable}::-webkit-scrollbar-button:vertical:decrement:single-button {
			display: block; height: 13px; background: transparent ${up} no-repeat center;
		}
		${scrollable}::-webkit-scrollbar-button:vertical:increment:single-button {
			display: block; height: 13px; background: transparent ${down} no-repeat center;
		}
	`;
}

export function createHorizontalScrollbarCSS(assets) {
	const image = name => assets[name] || assets[`basic_interface/${name}`];
	const urls = [
		'scroll1left.bmp',
		'scroll1right.bmp',
		'scroll1mid.bmp',
		'scroll1bar_left.bmp',
		'scroll1bar_mid.bmp',
		'scroll1bar_right.bmp'
	].map(image);
	if (urls.some(url => !url)) {
		return '';
	}
	const [left, right, track, start, middle, end] = urls.map(url => `url(${JSON.stringify(url)})`);
	return `
		*::-webkit-scrollbar { height: 13px; }
		*::-webkit-scrollbar-track:horizontal { background: transparent ${track} repeat-x center; }
		*::-webkit-scrollbar-thumb:horizontal {
			min-width: 12px;
			background-color: transparent !important;
			background-image: ${start}, ${end}, ${middle} !important;
			background-position: left center, right center, center !important;
			background-size: 4px 100%, 4px 100%, calc(100% - 8px) 100% !important;
			background-repeat: no-repeat !important;
			border: 0 !important;
			border-image: none !important;
			border-radius: 0;
			box-shadow: none;
		}
		*::-webkit-scrollbar-button:horizontal { display: none; }
		*::-webkit-scrollbar-button:horizontal:decrement:single-button {
			display: block; width: 13px; background: transparent ${left} no-repeat center;
		}
		*::-webkit-scrollbar-button:horizontal:increment:single-button {
			display: block; width: 13px; background: transparent ${right} no-repeat center;
		}
	`;
}
