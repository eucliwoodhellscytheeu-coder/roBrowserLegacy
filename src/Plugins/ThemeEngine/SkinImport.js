export function folderEntries(files) {
	return [...files].map(file => ({ file, path: file.webkitRelativePath || file.name }));
}

export async function droppedFolder(items) {
	const entries = [];
	const visit = async (entry, prefix = '') => {
		if (entry.isFile) {
			const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
			entries.push({ file, path: `${prefix}${entry.name}` });
		} else if (entry.isDirectory) {
			const reader = entry.createReader();
			let batch;
			do {
				batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
				for (const child of batch) {
					await visit(child, `${prefix}${entry.name}/`);
				}
			} while (batch.length);
		}
	};
	const roots = [...items].map(item => item.webkitGetAsEntry?.()).filter(Boolean);
	if (roots.length !== 1 || !roots[0].isDirectory) {
		throw new Error('Drop one extracted theme folder.');
	}
	await visit(roots[0]);
	return entries;
}

export function describeFolder(entries) {
	const images = entries.filter(({ path }) => /\.(bmp|png|jpe?g|gif)$/i.test(path));
	if (!images.length) {
		throw new Error('This folder contains no supported skin images.');
	}
	const name = images[0].path.split('/')[0];
	if (
		images.some(
			({ path }) => !path.startsWith(`${name}/`) || path.split('/').some(part => part === '..' || part === '.')
		)
	) {
		throw new Error('Choose one theme folder with its original asset paths.');
	}
	return { name, images };
}

export async function importSkinFolder(entries, progress = () => {}, { signal } = {}) {
	const { name, images } = describeFolder(entries);
	const assets = {};
	let worker;
	let rejectConversion;
	const abort = () => {
		worker?.terminate();
		rejectConversion?.(new DOMException('Import cancelled', 'AbortError'));
	};
	signal?.addEventListener('abort', abort, { once: true });
	const convert = async file => {
		worker ||= new Worker(new URL('./SkinWorker.js', import.meta.url), { type: 'module' });
		const buffer = await file.arrayBuffer();
		signal?.throwIfAborted();
		return new Promise((resolve, reject) => {
			rejectConversion = reject;
			worker.onmessage = ({ data }) => (data.error ? reject(new Error(data.error)) : resolve(data.blob));
			worker.onerror = () => reject(new Error('This browser could not start the skin conversion worker.'));
			worker.postMessage(buffer, [buffer]);
		});
	};
	try {
		for (let index = 0; index < images.length; index++) {
			signal?.throwIfAborted();
			const { file, path } = images[index];
			const relative = path
				.slice(name.length + 1)
				.replace(/\.bmp\.png$/i, '.bmp')
				.toLowerCase();
			if (Object.hasOwn(assets, relative)) {
				throw new Error(`Duplicate skin asset: ${relative}`);
			}
			const blob = /\.bmp$/i.test(path) ? await convert(file) : file;
			assets[relative] = URL.createObjectURL(blob);
			if (index % 16 === 0 || index === images.length - 1) {
				progress(index + 1, images.length);
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}
		signal?.throwIfAborted();
		return { name, assets };
	} catch (error) {
		for (const url of Object.values(assets)) {
			URL.revokeObjectURL(url);
		}
		throw error;
	} finally {
		signal?.removeEventListener('abort', abort);
		worker?.terminate();
	}
}
