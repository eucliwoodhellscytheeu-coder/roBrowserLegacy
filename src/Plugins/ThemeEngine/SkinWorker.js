import { decodeSkinBitmap } from './SkinBitmap.js';

self.onmessage = async event => {
	try {
		if (typeof OffscreenCanvas === 'undefined') {
			throw new Error(
				'BMP imports need worker canvas support. Use transparent PNGs or bundle the theme during the build.'
			);
		}
		const { width, height, pixels } = decodeSkinBitmap(new Uint8Array(event.data));
		const canvas = new OffscreenCanvas(width, height);
		canvas.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0);
		const blob = await canvas.convertToBlob({ type: 'image/png' });
		canvas.width = canvas.height = 1;
		self.postMessage({ blob });
	} catch (error) {
		self.postMessage({ error: error.message });
	}
};
