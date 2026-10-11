// Self-check rantai fallback YouTube (lib/scraper.js).
// Jalankan: node test/ytfallback.test.js   (tanpa npm install / tanpa cargo)
import assert from 'node:assert';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../lib/scraper.js', import.meta.url), 'utf8');
const voxel = fs.readFileSync(new URL('../voxel.js', import.meta.url), 'utf8');

// --- 1) ytMp3 harus berantai, bukan langsung throw -------------------------
// Urutannya: yt-dlp -> scrapr -> ytdl-core. Kalau scrapr dilompati, .ytmp3
// balik lagi ke "langsung gagal" seperti sebelum.
const badan = src.slice(src.indexOf('async function ytMp3(url, options)'));
const urutan = [...badan.matchAll(/await (viaYtDlp|ytAudioScrapr|ytMp3Lama)\(/g)].map(m => m[1]);
assert.deepEqual(urutan, ['viaYtDlp', 'ytAudioScrapr', 'ytMp3Lama'],
	`ytMp3 harus coba yt-dlp -> scrapr -> ytdl-core, urutannya: ${urutan.join(' -> ')}`);

// ytMp4 juga harus pakai yt-dlp dulu.
const badan4 = src.slice(src.indexOf('async function ytMp4(url, options)'));
assert.match(badan4, /await viaYtDlp\(url, \{ audio: false \}\)/, 'ytMp4 harus coba yt-dlp dulu');
assert.match(badan4, /await ytMp4Lama\(/, 'ytMp4 harus tetap punya cadangan ytdl-core');

// --- 2) Gagal semua harus MELAPORKAN semua tahap, bukan pesan generik ---------
assert.match(badan, /errs\.push\(/, 'ytMp3 harus kumpulkan error tiap tahap');
assert.match(badan, /throw new Error\(errs\.join\(' \| '\)\)/, 'ytMp3 harus gabung pesan error');

// --- 3) Impor scrapr beneran ada --------------------------------------------
assert.match(src, /import \{ ytAudioScrapr \} from '\.\/scrapr\.js'/, 'ytMp3 harus manggil scrapr');

// --- 4) Pemanggil harus tahu buffer vs URL ----------------------------------
// viaYtDlp mengembalikan Buffer; scrapr/ytdl-core mengembalikan URL. Kalau
// pemanggil nganggap selalu URL, dia bakal kirim {url: <Buffer>} = gagal.
assert.match(src, /isBuffer: true/, 'yt-dlp harus tandai isBuffer:true');
assert.match(src, /isBuffer: false/, 'scapr/ytdl-core harus tandai isBuffer:false');
assert.match(voxel, /if \(media\.isBuffer\) \{/, 'voxel.js .ytmp3 harus handle Buffer (yt-dlp)');
assert.match(voxel, /if \(hasil\.isBuffer\) \{/, 'voxel.js .ytmp4 harus handle Buffer (yt-dlp)');
// Yang bukan buffer tetap dikirim sebagai URL.
assert.match(voxel, /audio: \{ url: media\.url \}/, '.ytmp3 URL path harus tetap ada');

// --- 5) Tidak boleh ada fs.readFileSync(Buffer) ------------------------------
// Path hasil yt-dlp sudah dihapus sebelum dikembalikan, jadi caller nggak boleh
// membacanya dari disk lagi.
assert.doesNotMatch(voxel, /fs\.readFileSync\(dl\)/, 'yt-dlp return Buffer, jangan readFileSync');

// --- 6) Pesan error harus informatif, bukan global.mess.fail ----------------
const blok = voxel.slice(voxel.indexOf("case 'ytmp3'"), voxel.indexOf("case 'ytmp4'"));
assert.doesNotMatch(blok, /m\.reply\(global\.mess\.fail\)/, '.ytmp3 jangan lagi balas pesan generik "gagal"');
assert.match(blok, /e\.message/, '.ytmp3 harus menampilkan penyebab gagalnya');

// --- 7) Folder kerja yt-dlp harus dibersihkan --------------------------------
assert.match(src, /fsp\.rm\(work, \{ recursive: true, force: true \}\)/, 'folder kerja yt-dlp harus dihapus');
// Path relatif dari stdout WAHIB di-join ke folder kerja.
assert.match(src, /path\.resolve\(work, stdout/, 'path hasil yt-dlp harus di-resolve relatif ke folder kerja');

// --- 8) Bit +x harus dipulihkan sendiri (gejala EACCES di server) ------------
// SFTP & ekstrak zip nggak nyimpen permission bit -> bin/yt-dlp-rs tiba di
// server sebagai 0644 dan spawn() jadi EACCES, padahal file-nya ada.
assert.match(src, /export async function siapkanWrapper\(\)/, 'siapkanWrapper() hilang');
assert.match(src, /fsp\.chmod\(bin, 0o755\)/, 'harus chmod +x wrapper sebelum spawn');
assert.match(src, /fsp\.access\(bin, fs\.constants\.X_OK\)/, 'harus cek bit executable');
const badanYtdlp = src.slice(src.indexOf('async function viaYtDlp('));
assert.match(badanYtdlp, /await siapkanWrapper\(\)/, 'viaYtDlp harus memanggil siapkanWrapper()');
const videoSrc = fs.readFileSync(new URL('../commands/media/video.js', import.meta.url), 'utf8');
assert.match(videoSrc, /import \{ siapkanWrapper \}/, '.video harus pakai siapkanWrapper() juga');
assert.match(videoSrc, /await siapkanWrapper\(\)/, '.video harus memanggil siapkanWrapper()');

// --- 9) Error scrapr harus menyebut penyebab, bukan "tidak punya youtube" ----
// Kalau paketnya belum terpasang, pesan lamanya bikin orang nyalahin scrapr.
const scraprSrc = fs.readFileSync(new URL('../lib/scrapr.js', import.meta.url), 'utf8');
assert.match(scraprSrc, /if \(!_scrapr\) throw new Error\('paket @coflyn\/scrapr belum terpasang/,
	'paket scrapr hilang harus bilang "jalankan npm install", bukan "tidak punya youtube"');
assert.match(scraprSrc, /export const scraprAda = \(\) => \{\s*try/, 'scraprAda harus try/catch (scrapr() bisa throw)');

console.log('OK: rantai ytmp3/ytmp4 (yt-dlp -> scrapr -> ytdl-core, buffer-vs-URL, error informatif, chmod +x, pesan scrapr)');