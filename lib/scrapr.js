// Adapter @coflyn/scrapr -> bentuk balasan yang dipanggil bot.
//
// Kenapa file ini ada: scrapr itu satu paket yang nge-cover 23 platform
// (TikTok, IG, YouTube, Spotify, X, Threads, Pinterest, MediaFire, unshorten,
// ...) pakai banyak backend sekaligus. Scraper bawaan bot cuma satu-satu
// backend, jadi gampang mati. Di sini scrapr DICOBAR LEBIH DAHULU, dan kalau
// gagal (API mati, konten privat, rate-limit) otomatis balik ke scraper bawaan.
//
// SEMUA fungsi di sini mengembalikan BENTUK YANG SAMA dengan scraper bawaan,
// jadi lib/scrapers/index.js cuma perlu membungkus -- semua call site di
// voxel.js tidak berubah sama sekali.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// scrapr cuma dimuat saat pertama dipakai: kalau paketnya belum terpasang,
// bot HARUS tetap jalan dengan scraper bawaan, bukan gagal start.
let _scrapr = null;
let _cobaLoad = false;
function scrapr() {
	if (!_cobaLoad) {
		_cobaLoad = true;
		try {
			_scrapr = require('@coflyn/scrapr');
		} catch (e) {
			// Jangan ditelan diam-diam. Sebelumnya error require (biasanya
			// "Cannot find module" karena server belum `npm install`) dibuang,
			// lalu semua adapter melapor "scapr tidak punya youtube" -- pesan
			// yang bikin orang nyalahin scrapr padahal paketnya memang belum ada.
			console.warn('[SCRAPR] @coflyn/scrapr tidak termuat -> jalankan `npm install`:', e.message);
		}
	}
	if (!_scrapr) throw new Error('paket @coflyn/scrapr belum terpasang -> jalankan `npm install` di folder project');
	return _scrapr;
}

export const scraprAda = () => {
	try {
		return !!scrapr();
	} catch {
		return false;
	}
};

// scrapr balannya `{ status: true, result: {...} }` atau `{ status: false,
// message: '...' }`. Semua backend-nya konsisten, jadi satu helper cukup.
function hasil(promise) {
	return promise.then((r) => {
		if (!r || r.status === false) throw new Error(r?.message || 'scrapr: gagal tanpa pesan');
		return r.result ?? r;
	});
}

// Backend gandi: scrapr nyediain beberapa backend per platform (mis. TikTok:
// snaptik/tiktokio/savetik/ssstik). Coba berurutan, ambil yang pertama hidup.
async function coba(...fns) {
	const errs = [];
	for (const fn of fns) {
		if (typeof fn !== 'function') continue;
		try {
			const r = await fn();
			if (r && r.status !== false) return r.result ?? r;
			errs.push(r?.message || 'kosong');
		} catch (e) {
			errs.push(e?.message || String(e));
		}
	}
	throw new Error(errs[0] || 'semua backend scrapr gagal');
}

// --- TikTok -> { status, title, author{nickname,fullname}, stats, data[] } ---
// Bentuk ini yang dipakai commands/media/tiktok.js.
export async function tiktokScrapr(url) {
	const s = scrapr();
	if (!s?.tiktok) throw new Error('scrapr tidak punya tiktok');
	const t = s.tiktok;
	const r = await coba(
		() => t.snaptik(url),
		() => t.tiktokio(url),
		() => t.savetik(url),
		() => t.ssstik(url),
		() => t.tikdownloader(url),
	);
	// scrapr: { title, author:{name,username}, downloads:[{type:'mp4',url}] }
	// Command .tiktok ngecek `hasil.status` dan `.data[].type` harus bernilai
	// 'nowatermark_hd' (video) atau 'photo' (gambar) -- scrapr pakai 'mp4'.
	const dl = r.downloads || r.data || [];
	const data = (Array.isArray(dl) ? dl : [dl])
		.filter((x) => x?.url)
		.map((x) => ({
			type: /^(mp4|video)$/i.test(x.type || '') ? 'nowatermark_hd' : 'photo',
			url: x.url,
		}));
	if (!data.length) throw new Error('scrapr: link TikTok tidak ditemukan');
	return {
		status: true,
		title: r.title || '-',
		thumbnail: r.thumbnail,
		// Dipakai caption: author.nickname (username) + author.fullname (nama).
		author: { nickname: r.author?.username || '-', fullname: r.author?.name || '-' },
		// scrapr nggak kirim views/likes; command pakai `|| '-'` jadi aman.
		stats: r.stats || {},
		data,
	};
}

// --- Instagram/Threads -> { author{username,caption}, media[{type,download}] } ---
function keBentukSosmed(r) {
	const dl = r?.downloads || r?.media || [];
	const list = (Array.isArray(dl) ? dl : [dl]).filter((x) => x?.url);
	if (!list.length) throw new Error('scrapr: media tidak ditemukan');
	return {
		author: {
			username: r?.username || r?.owner?.username || '-',
			caption: r?.caption || r?.title || '',
		},
		media: list.map((x) => ({
			type: x.type === 'video' ? 'video' : 'image',
			download: x.url,
		})),
	};
}
export async function instagramScrapr(url) {
	const s = scrapr();
	if (!s?.instagram) throw new Error('scrapr tidak punya instagram');
	const i = s.instagram;
	const r = await coba(() => i.indown(url), () => i.snapinsta(url), () => i.snapsave(url));
	return keBentukSosmed(r);
}
export async function threadsScrapr(url) {
	const s = scrapr();
	if (!s?.threads) throw new Error('scrapr tidak punya threads');
	const r = await coba(...Object.values(s.threads).map((fn) => () => fn(url)));
	return keBentukSosmed(r);
}

// --- Spotify -> { download, title, artist } ---
export async function spotifyScrapr(url) {
	const s = scrapr();
	if (!s?.spotify) throw new Error('scrapr tidak punya spotify');
	const r = await coba(...Object.values(s.spotify).map((fn) => () => fn(url)));
	const urlDl = r?.downloads?.[0]?.url || r?.download || r?.url;
	if (!urlDl) throw new Error('scrapr: link Spotify tidak ditemukan');
	return { download: urlDl, title: r.title, artist: r.artist || r.author };
}

// --- Twitter/X -> { result: { url } } (dipakai voxel.js: res.result.url) ---
export async function twitterScrapr(url) {
	const s = scrapr();
	if (!s?.twitter) throw new Error('scrapr tidak punya twitter');
	const r = await coba(...Object.values(s.twitter).map((fn) => () => fn(url)));
	const media = r?.downloads?.[0]?.url || r?.url;
	if (!media) throw new Error('scrapr: media X tidak ditemukan');
	return { result: { url: media } };
}

// --- Pinterest -> array of { image_url } (dipakai pickRandom(data.data)) ---
export async function pinterestScrapr(url) {
	const s = scrapr();
	if (!s?.pinterest) throw new Error('scrapr tidak punya pinterest');
	const r = await coba(...Object.values(s.pinterest).map((fn) => () => fn(url)));
	const list = r?.downloads || r?.data;
	const arr = (Array.isArray(list) ? list : list ? [list] : [])
		.filter((x) => x?.url)
		.map((x) => ({ image_url: x.url }));
	if (!arr.length) throw new Error('scrapr: gambar Pinterest tidak ditemukan');
	return { data: arr };
}

// --- MediaFire -> { download, filename, name, size } ---
export async function mediafireScrapr(url) {
	const s = scrapr();
	if (!s?.resolver?.mediafire) throw new Error('scrapr tidak punya resolver.mediafire');
	const r = await hasil(s.resolver.mediafire(url));
	const direct = r?.directLink || r?.link || r?.url || r?.download;
	if (!direct) throw new Error('scrapr: link MediaFire tidak ditemukan');
	return { download: direct, filename: r.filename || r.name, name: r.name || r.filename, size: r.size };
}

// --- YouTube MP3 -> dipakai sebagai cadangan .video --audio -----------------
//Yt-dlp lokal (bin/yt-dlp-rs) lebih akurat & bisa video, tapi kalau dia gagal
// (rate-limit WA bot), scrapr pakai backend lain = peluang kedua.
export async function ytAudioScrapr(url) {
	const s = scrapr();
	if (!s?.youtube) throw new Error('scrapr tidak punya youtube');
	const r = await coba(() => s.youtube.ytmp3(url), () => s.youtube.ytmp3gg(url));
	const audio = (r.downloads || []).find((x) => x?.type === 'audio' || x?.abr || x?.url?.includes('.mp3'));
	const direct = audio?.url || r.downloads?.[0]?.url;
	if (!direct) throw new Error('scrapr: link audio tidak ditemukan');
	return { download: direct, title: r.title, thumbnail: r.thumbnail };
}

// --- Unshorten: bit.ly/safelink/dll -------------------------------------------
export async function unshortenScrapr(url) {
	const s = scrapr();
	if (!s?.resolver?.unshorten) throw new Error('scrapr tidak punya unshorten');
	return hasil(s.resolver.unshorten(url));
}