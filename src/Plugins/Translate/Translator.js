const MAX_CACHE_ENTRIES = 300;
const MAX_CONCURRENT_REQUESTS = 3;
const MAX_QUEUED_REQUESTS = 100;
const REQUEST_TIMEOUT_MS = 10000;
const cache = new Map();
const pending = new Map();
const queue = [];
let activeRequests = 0;

function drainQueue() {
	while (activeRequests < MAX_CONCURRENT_REQUESTS && queue.length) {
		const { run, resolve, reject } = queue.shift();
		activeRequests++;
		run()
			.then(resolve, reject)
			.finally(() => {
				activeRequests--;
				drainQueue();
			});
	}
}

async function requestTranslation(text, target) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) {
			throw new Error(`Translation request failed (${response.status})`);
		}
		const data = await response.json();
		const translated = Array.isArray(data?.[0])
			? data[0]
					.map(item => (typeof item?.[0] === 'string' ? item[0] : ''))
					.join('')
					.trim()
			: '';
		if (!translated) {
			throw new Error('Translation response was empty');
		}
		return translated;
	} finally {
		clearTimeout(timeout);
	}
}

/** Translate text, sharing pending requests and caching successful results. */
export default function translate(text, target = 'en') {
	if (!text.trim()) {
		return Promise.resolve(text);
	}
	const key = JSON.stringify([text, target]);
	if (cache.has(key)) {
		const translated = cache.get(key);
		cache.delete(key);
		cache.set(key, translated);
		return Promise.resolve(translated);
	}
	if (pending.has(key)) {
		return pending.get(key);
	}
	if (queue.length >= MAX_QUEUED_REQUESTS) {
		return Promise.reject(new Error('Translation queue is full; try again shortly'));
	}
	const request = new Promise((resolve, reject) => {
		queue.push({ run: () => requestTranslation(text, target), resolve, reject });
	})
		.then(translated => {
			cache.set(key, translated);
			if (cache.size > MAX_CACHE_ENTRIES) {
				cache.delete(cache.keys().next().value);
			}
			return translated;
		})
		.finally(() => pending.delete(key));
	pending.set(key, request);
	drainQueue();
	return request;
}
