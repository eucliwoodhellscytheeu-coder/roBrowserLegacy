import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { decodeSkinBitmap } from './SkinBitmap.js';
export { decodeSkinBitmap } from './SkinBitmap.js';

const folder = path.dirname(fileURLToPath(import.meta.url));

export async function prepareSkins({
	source = path.resolve(folder, '../../../themes'),
	target = path.join(folder, 'skins')
} = {}) {
	await fs.mkdir(target, { recursive: true });
	try {
		await fs.access(source);
	} catch (error) {
		if (error.code !== 'ENOENT') {
			throw error;
		}
		console.log('[ThemeEngine] No original themes folder; keeping prepared skins.');
		return { converted: 0 };
	}
	const cacheFile = path.join(target, '.skin-cache.json');
	let cache = {};
	try {
		cache = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
	} catch {
		/* First run or invalid cache: regenerate. */
	}
	const pipeline = createHash('sha256');
	for (const name of ['registerSkins.mjs', 'SkinBitmap.js', 'SkinTransparency.js']) {
		pipeline.update(await fs.readFile(path.join(folder, name)));
	}
	const version = pipeline.digest('hex');
	const nextCache = { ...cache };
	let converted = 0;
	const visit = async (directory, relative = '') => {
		for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
			const child = path.join(relative, entry.name);
			const input = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				await visit(input, child);
			} else if (/\.(bmp|png|jpe?g|gif)$/i.test(entry.name)) {
				const bitmap = /\.bmp$/i.test(entry.name);
				const output = path.join(
					target,
					bitmap ? `${child}.png` : child.replace(/\.[^.]+$/, extension => extension.toLowerCase())
				);
				await fs.mkdir(path.dirname(output), { recursive: true });
				const buffer = await fs.readFile(input);
				const hash = createHash('sha256').update(version).update(buffer).digest('hex');
				nextCache[child] = hash;
				if (cache[child] === hash) {
					try {
						await fs.access(output);
						continue;
					} catch {
						/* Recreate a deleted generated file. */
					}
				}
				const temporary = `${output}.tmp`;
				if (bitmap) {
					const { width, height, pixels } = decodeSkinBitmap(buffer);
					await sharp(Buffer.from(pixels.buffer), { raw: { width, height, channels: 4 } })
						.png()
						.toFile(temporary);
					converted++;
				} else {
					await fs.writeFile(temporary, buffer);
				}
				await fs.rename(temporary, output);
			}
		}
	};
	await visit(source);
	await fs.writeFile(`${cacheFile}.tmp`, JSON.stringify(nextCache));
	await fs.rename(`${cacheFile}.tmp`, cacheFile);
	console.log(`[ThemeEngine] Prepared ${converted} transparent BMP skins at build time.`);
	return { converted };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await prepareSkins();
}
