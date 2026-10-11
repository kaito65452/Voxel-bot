// Self-check integrasi @coflyn/scrapr (lib/scrapr.js + lib/scrapers/index.js).
// Jalankan: node test/scrapr.test.js   (butuh npm install)
//
// Yang dijaga: scrapr dicoba DULU, dan kalau gagal HARUS jatuh ke scraper
// bawaan. Kalau ini balik, command .tiktok/.ig/.spotify mati total.
import assert from 'node:assert';
import fs from 'node:fs';

const adapterSrc = fs.readFileSync(new URL('../lib/scrapr.js', import.meta.url), 'utf8');
const indexSrc = fs.readFileSync(new URL('../lib/scrapers/index.js', import.meta.url), 'utf8');
const videoSrc = fs.readFileSync(new URL('../commands/media/video.js', import.meta.url), 'utf8');

// --- 1) Adapter: bentuk balasan harus sama dengan scraper bawaan -------------
// commands/media/tiktok.js ngecek `hasil.status` + `.data[].type`, jadi
// adapter yang ngambil alih TIDAK BOLEH lupa status:true.
assert.match(adapterSrc, /status: true/, 'tiktokScrapr harus return status:true (dicek command .tiktok)');
assert.match(adapterSrc, /nowatermark_hd/, 'tiktokScrapr harus petakan type mp4 -> nowatermark_hd');
assert.match(adapterSrc, /nickname:.*username/, 'author.nickname harus diisi (dipakai caption .tiktok)');
// Bentuk lain yang dipanggil voxel.js:
assert.match(adapterSrc, /download:/, 'harus ada mediafire/spotify yang mengembalikan .download');
assert.match(adapterSrc, /image_url/, 'pinterestScrapr harus return {data:[{image_url}]} (pickRandom di voxel.js)');
assert.match(adapterSrc, /result: \{ url/, 'twitterScrapr harus return {result:{url}} (voxel.js: res.result.url)');
// author.username + caption dipakai IG/Threads.
assert.match(adapterSrc, /username: r\?\.username/, 'igdl butuh author.username');

// --- 2) Multi-backend: satu backend mati jangan langsung menyerah ------------
assert.match(adapterSrc, /async function coba\(\.\.\.fns\)/, 'helper coba() multi-backend hilang');
const backendTiktok = adapterSrc.match(/const r = await coba\(([\s\S]*?)\);/)?.[1] || '';
assert.ok((backendTiktok.match(/=>\s*t\.\w+\(/g) || []).length >= 2, 'tiktokScrapr harus coba >1 backend scrapr');

// --- 3) Bungkus DI BATAS EXPORT, bukan di tiap call site --------------------
// Ini yang bikin voxel.js nggak perlu diubah satu baris pun.
for (const fn of ['tiktokDl', 'igdl', 'spotifydl', 'threadsdl', 'pinterest', 'mediafire', 'twitterdl']) {
	assert.match(indexSrc, new RegExp(`export const ${fn} = withScrapr\\(`), `${fn} belum dibungkus scrapr`);
}
assert.match(indexSrc, /const withScrapr = \(scraprFn, asli\)/, 'withScrapr hilang');
// Fallback: error scrapr harus diteruskan ke implementasi asli, BUKAN dilempar.
assert.match(indexSrc, /catch \(e\) \{\s*try \{\s*return await asli\(\.\.\.args\)/,
	'withScrapr harus fallback ke scraper bawaan');

// --- 4) Bentuk lama jangan dobel diekspor (redeclaration) -------------------
const block = indexSrc.slice(indexSrc.indexOf('export {'));
assert.doesNotMatch(block, /^\s*twitterdl,/m, 'twitterdl dobel ada di blok export (SyntaxError)');

// --- 5) scrapr harus lazy: paket hilang = bot tetap jalan --------------------
assert.match(adapterSrc, /createRequire/, 'harus pakai createRequire (paket CJS)');
assert.match(adapterSrc, /belum terpasang -> jalankan `npm install`/, 'paket hilang harus kasih pesan npm install');
assert.match(adapterSrc, /let _cobaLoad = false/, 'load scrapr harus di-cache (jangan require tiap panggilan)');

// --- 6) Cadangan .video --audio ---------------------------------------------
assert.match(videoSrc, /ytAudioScrapr/, 'cadangan audio scrapr belum dipakai di .video');
assert.match(videoSrc, /catch \(e\) \{[\s\S]{0,900}ytAudioScrapr\(/,
	'cadangan harus di blok catch (dipakai kalau yt-dlp lokal gagal)');

// --- 7) Semua nama yang diekspor memang ada di scrapr -----------------------
const { scraprAda } = await import('../lib/scrapr.js');
if (scraprAda()) {
	const s = (await import('node:module')).createRequire(import.meta.url)('@coflyn/scrapr');
	for (const p of ['tiktok', 'instagram', 'threads', 'spotify', 'twitter', 'pinterest', 'youtube']) {
		assert.ok(s[p], `scrapr v1.2.0 gak punya "${p}" -> adapter itu mati total`);
	}
	assert.ok(s.resolver?.mediafire, 'scrapr gak punya resolver.mediafire');
}

console.log('OK: integrasi scrapr (7 scraper dibungkus + fallback, bentuk balasan, lazy-load, cadangan .video)');