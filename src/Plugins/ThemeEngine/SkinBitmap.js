import { clearSkinColorKey } from './SkinTransparency.js';

export function decodeSkinBitmap(buffer) {
	const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	if (buffer.length < 54) {
		throw new Error('Truncated skin BMP');
	}
	if (buffer[0] !== 66 || buffer[1] !== 77 || view.getUint32(14, true) < 40) {
		throw new Error('Unsupported skin BMP header');
	}
	const width = view.getInt32(18, true);
	const signedHeight = view.getInt32(22, true);
	const height = Math.abs(signedHeight);
	const bits = view.getUint16(28, true);
	const offset = view.getUint32(10, true);
	const palette = 14 + view.getUint32(14, true);
	const stride = Math.ceil((width * bits) / 32) * 4;
	if (
		width <= 0 ||
		height === 0 ||
		![4, 8, 24, 32].includes(bits) ||
		view.getUint32(30, true) !== 0 ||
		view.getUint16(26, true) !== 1 ||
		offset < palette ||
		offset + stride * height > buffer.length
	) {
		throw new Error('Unsupported or truncated skin BMP');
	}
	const pixels = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		const row = offset + (signedHeight < 0 ? y : height - y - 1) * stride;
		for (let x = 0; x < width; x++) {
			let source;
			if (bits === 4) {
				const packed = buffer[row + (x >> 1)];
				source = palette + (x % 2 === 0 ? packed >> 4 : packed & 15) * 4;
			} else if (bits === 8) {
				source = palette + buffer[row + x] * 4;
			} else {
				source = row + x * (bits / 8);
			}
			const target = (y * width + x) * 4;
			if (source + 2 >= (bits <= 8 ? offset : buffer.length)) {
				throw new Error('Truncated skin BMP pixels or palette');
			}
			pixels[target] = buffer[source + 2];
			pixels[target + 1] = buffer[source + 1];
			pixels[target + 2] = buffer[source];
			pixels[target + 3] = 255;
		}
	}
	clearSkinColorKey(pixels);
	return { width, height, pixels };
}
