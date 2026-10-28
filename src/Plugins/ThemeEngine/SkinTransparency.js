// Match Utils/Texture.removeMagenta's RO color-key tolerance.
export function clearSkinColorKey(pixels) {
	for (let index = 0; index < pixels.length; index += 4) {
		if (pixels[index] > 230 && pixels[index + 1] < 20 && pixels[index + 2] > 230) {
			pixels[index] = pixels[index + 1] = pixels[index + 2] = pixels[index + 3] = 0;
		}
	}
}
