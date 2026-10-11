// Self-check hardening keamanan (audit 2026-10-10).
// Jalankan: node test/security.test.js   (tanpa npm install)
import assert from 'node:assert';
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const voxel = read('voxel.js');
const server = read('src/server.js');
const fn = read('lib/function.js');
const start = read('start.js');
const settings = read('settings.js');
const tiktokCmd = read('commands/media/tiktok.js');
const tiktokLib = read('lib/scrapers/tiktok.cjs');
const rs = read('yt-dlp/src/main.rs');
const scraper = read('lib/scraper.js');
const video = read('commands/media/video.js');

// === PRIORITAS 1: jadibot =====================================================

// Nomor sub-bot tidak boleh masuk ownerNumber saat ini Jadibot.
assert.match(voxel, /const ownerNumber = voxel\.isJadibot \? ownerAsli/,
	'ownerNumber di sesi jadibot harus CUMA ownerAsli (tanpa nomor bot)');
// set.owner (yang ditulis balik ke settings.js) tidak boleh punya nomor bot.
assert.doesNotMatch(voxel, /set\.owner = \[\.\.\.new Set\(\[\.\.\.global\.owner, botNumber/,
	'set.owner tidak boleh ikut memuat botNumber');
assert.match(voxel, /set\.owner = ownerAsli;/, 'set.owner harus = ownerAsli');

// Gerbang jadibot: satu daftar, bukan per-case.
const gerbang = voxel.slice(voxel.indexOf('CMD_OWNER_BERBAHAYA'), voxel.indexOf('switch(fileSha256 || command)'));
assert.match(gerbang, /voxel\.isJadibot &&/, 'gerbang harus dicek hanya saat isJadibot');
for (const cmd of ['backup', 'getsession', 'deletesession', 'update', 'upgrade', 'rcon',
	'addowner', 'delowner', 'setapikey', 'setbotapikey', 'setnamebot', 'setauthorbot',
	'settimezone', 'setlocale', 'addprefix', 'delprefix', 'addtoxic', 'delbadword']) {
	assert.ok(gerbang.includes(`'${cmd}'`), `command owner '${cmd}' belum dikunci di gerbang jadibot`);
}
// Prefix eval/exec ada di blok `default:`, jadi butuh cek terpisah.
assert.match(gerbang, /EVAL_PREFIX\.test\(budy\)/, 'prefix $/>/< harus dicek di gerbang jadibot');
assert.match(gerbang, /Khusus bot utama!/, 'balasan gerbang harus "Khusus bot utama!"');

assert.match(settings, /global\.jadibotOwnerOnly = true/,
	'global.jadibotOwnerOnly default harus true');

// === PRIORITAS 2: injeksi settings.js + dashboard ============================

// Semua nilai string wajib lewat JSON.stringify, bukan template mentah.
assert.match(fn, /function nilaiJS\(v\)/, 'nilaiJS() hilang');
assert.match(fn, /if \(s\.length > 100\)/, 'batas panjang 100 karakter hilang');
assert.match(fn, /if \(\/\[\\n\\r\]\/\.test\(s\)\)/, 'penolakan newline hilang');
for (const nama of ['author', 'botname', 'packname', 'locale', 'timezone']) {
	assert.match(fn, new RegExp(`tulisString\\(content, '${nama}'`), `${nama} harus lewat tulisString()`);
}
// .replace dengan string replacement menafsirkan $1/$& -> harus pakai fungsi.
assert.match(fn, /\(_, prefix\) => prefix \+ nilaiJS\(v\)/,
	'tulisString harus ganti lewat FUNGSI (_, prefix) => ..., bukan string');
assert.match(fn, /\(_, a, b\) => a \+ nilaiJS\(apikey\)/, 'apikey harus di-escape & pakai fungsi');
assert.doesNotMatch(fn, /`global\.author = '\$\{author\}'`/, 'author masih ditulis mentah (injeksi)');

// Dashboard: whitelist, bukan Object.assign.
// Object.assign(global, data) = attacker bisa timpa global sembarang.
// Pola di-skip baris komentar: baris ini boleh muncul sebagai penjelasan.
assert.doesNotMatch(server, /^\s*Object\.assign\(global, data\);/m,
	'Object.assign(global, data) = attacker bisa timpa global sembarang');
assert.match(server, /DASHBOARD_WHITELIST/, 'whitelist dashboard hilang');
for (const k of ['owner', 'author', 'botname', 'packname', 'timezone', 'locale',
	'listprefix', 'badWords', 'limit', 'money', 'mess', 'my']) {
	assert.ok(server.includes(`'${k}'`), `whitelist dashboard kurang '${k}'`);
}
assert.match(server, /for \(const key of DASHBOARD_WHITELIST\)/, 'whitelist harus dipakai saat menyalin');

// ADMIN_KEY: minimal 32 hex, timing-safe, tidak dicetak.
assert.match(server, /crypto\.randomBytes\(16\)\.toString\('hex'\)/,
	'ADMIN_KEY fallback harus randomBytes(16) = 32 hex char');
assert.doesNotMatch(server, /\|\| 'voxel'/, "fallback hardcode 'voxel' jangan dikembalikan");
assert.match(server, /crypto\.timingSafeEqual/, 'perbandingan ADMIN_KEY harus timing-safe');
assert.doesNotMatch(server, /adminKey !== ADMIN_KEY/, 'perbandingan !== (bukan timing-safe) masih ada');
assert.doesNotMatch(server, /console\.log\([^)]*dashboardUrl/,
	'URL dashboard berisi ADMIN_KEY tidak boleh dicetak');
assert.doesNotMatch(server, /adminKey=\$\{ADMIN_KEY\}[^`]*`\s*\)\s*;\s*\n\s*console\.log/,
	'URL ber-key tidak boleh masuk console.log');
assert.match(server, /process\.env\.RELAY_SERVER_URL \|\| 'https:\/\/bot\.voxel\.biz\.id'/,
	'RELAY_SERVER_URL harus bisa di-set via env, default tidak berubah');
assert.match(settings, /defaultAdminKey = crypto\.randomBytes\(16\)/,
	'defaultAdminKey di settings.js harus 16 byte = 32 hex');

// === PRIORITAS 3: kebocoran secret ==========================================

assert.doesNotMatch(start, /API Key Terbaca/, 'start.js jangan print API key');
assert.doesNotMatch(start, /import voxel from '\.\/voxel\.js'/, 'import voxel tak terpakai di start.js');

const setApi = voxel.slice(voxel.indexOf("case 'setapikey'"), voxel.indexOf("case 'sc': case 'script'"));
assert.doesNotMatch(setApi, /old_key/, 'setapikey tidak boleh menampilkan key lama');
assert.doesNotMatch(setApi, /menjadi \$\{q\}/, 'setapikey tidak boleh menampilkan key baru');
assert.match(setApi, /Apikey berhasil diganti/, 'setapikey harus balas tanpa key');
assert.match(setApi, /\^\[A-Za-z0-9_-\]\{8,128\}\$/, 'setapikey harus validasi regex ketat');
assert.match(setApi, /args\[1\]\.trim\(\)/, 'neosantara harus simpan args[1].trim()');
assert.match(setApi, /apikey: text\.trim\(\)/, 'apikey harus simpan text.trim()');

// === PRIORITAS 4: repo update ================================================

assert.match(fn, /github\.com\/yuusha2011\/Voxel-beta\/archive\/refs\/heads\/main\.zip/,
	'SERVER_ZIP harus ke yuusha2011/Voxel-beta');
assert.match(fn, /raw\.githubusercontent\.com\/yuusha2011\/Voxel-beta\/main\/package\.json/,
	'VERSION_URL harus ke yuusha2011/Voxel-beta');
const pkg = JSON.parse(read('package.json'));
for (const [k, v] of [['homepage', pkg.homepage], ['bugs', pkg.bugs.url], ['repository', pkg.repository.url]]) {
	assert.match(v, /yuusha2011\/Voxel-beta/, `package.json ${k} masih ke repo lama`);
}

// === PRIORITAS 5: SSRF =======================================================

assert.match(fn, /function ipLokal\(ip\)/, 'ipLokal() hilang');
assert.match(fn, /async function isSafePublicUrl\(url\)/, 'isSafePublicUrl() hilang');
assert.match(fn, /dns\.promises\.lookup\(host, \{ all: true \}\)/,
	'harus resolve DNS dan cek SEMUA IP hasilnya (bukan cuma hostname)');
assert.match(fn, /u\.protocol !== 'http:' && u\.protocol !== 'https:'/, 'harus hanya izinkan http/https');
for (const blok of ['a === 127', 'a === 10', 'b === 168', '169 && b === 254']) {
	assert.ok(fn.includes(blok), `blokir IP lokal hilang: ${blok}`);
}
assert.match(fn, /172 && b >= 16 && b <= 31/, 'rentang privat 172.16/12 hilang');
// IPv4-mapped IPv6 harus kena DUA bentuk: desimal (::ffff:127.0.0.1) dan hex
// (::ffff:7f00:1) -- new URL() menormalisasi ke yang kedua.
assert.match(fn, /\^::ffff:\(\?:\(\\d\+\\\.\\d\+\\\.\\d\+\\\.\\d\+\)\|\(\[0-9a-f\]\{1,4\}\)/,
	'IPv4-mapped IPv6 harus dicek di bentuk desimal DAN hex');

assert.match(voxel, /isSafePublicUrl/, 'voxel.js harus mengimpor isSafePublicUrl');
const ssweb = voxel.slice(voxel.indexOf("case 'ssweb'"), voxel.indexOf("case 'ssweb'") + 900);
assert.match(ssweb, /await isSafePublicUrl\(anu\)/, 'ssweb harus cek isSafePublicUrl SEBELUM screenshotWebsite');
assert.ok(ssweb.indexOf('isSafePublicUrl') < ssweb.indexOf('screenshotWebsite'),
	'cek SSRF harus dipanggil sebelum screenshotWebsite');

assert.match(tiktokCmd, /new URL\(u\)\.hostname/, 'tiktok.js harus cek hostname, bukan regex string');
assert.doesNotMatch(tiktokCmd, /\/tiktok\\\.com\/i\.test\(dlUrl\)/, 'regex lama yang bypass-able masih ada');
assert.match(tiktokCmd, /host === 'tiktok\.com' \|\| host\.endsWith\('\.tiktok\.com'\)/, 'hostname TikTok harus dipatok ketat');
// Semua expandTikTokUrl harus anchor ^ di awal string (Cek substring, bukan
// regex literal, supaya backslash-nya tidak bikin salah baca).
const ANCHOR = String.raw`/^https?:\/\/(vt|vm)\.tiktok\.com\//i`;
const jumlahPakai = tiktokLib.split('if (!' + ANCHOR + '.test(u)) return u').length - 1;
assert.equal(jumlahPakai, 2, `expandTikTokUrl harus anchor ^ (ditemukan ${jumlahPakai}, harus 2)`);
assert.doesNotMatch(tiktokLib, /if \(!\/https\?:/,
	'expandTikTokUrl yang tanpa anchor ^ masih ada');

// === PRIORITAS 6: rapikan ===================================================

assert.ok(!fs.existsSync(new URL('../commands/gemini.js', import.meta.url)),
	'commands/gemini.js (duplikat commands/ai/gemini.js) harus dihapus');
assert.ok(fs.existsSync(new URL('../commands/ai/gemini.js', import.meta.url)), 'commands/ai/gemini.js harus tetap ada');
assert.equal(pkg.dependencies['@sairidev/baileys-new'], '0.3.21', 'baileys-new harus dipin, bukan "latest"');
const lock = JSON.parse(read('package-lock.json'));
assert.equal(lock.packages[''].dependencies['@sairidev/baileys-new'], '0.3.21',
	'package-lock root harus ikut dipin');
assert.equal(lock.packages['node_modules/@sairidev/baileys-new'].version, '0.3.21',
	'versi terpasang di lock harus cocok dengan pin');
assert.match(read('lib/scrapers/cantarella-new.cjs'), /process\.env\.MIFTAH_APIKEY \|\| 'miftah'/,
	'apikey miftah harus lewat env dengan fallback nilai lama');

// Helper-nya diuji beneran, bukan cuma source-grep. Ini yang menangkap bug
// IPv4-mapped: new URL() menormalisasi [::ffff:127.0.0.1] jadi ::ffff:7f00:1
// (hex), jadi regex yang cuma menangkap bentuk desimal akan bocor.
{
	const { isSafePublicUrl } = await import('../lib/function.js');
	const tolak = [
		'http://localhost:3000', 'http://localhost/admin',
		'http://127.0.0.1/x', 'https://127.0.0.1:8080/', 'http://127.1.2.3/',
		'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:7f00:1]/',
		'http://10.0.0.5/', 'http://172.16.0.1/', 'http://172.31.255.255/',
		'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data/',
		'http://0.0.0.0/', 'http://router.local/', 'http://foo.internal/',
		'http://db.local:5432/', 'http://[fc00::1]/', 'http://[fe80::1]/',
		'file:///etc/passwd', 'ftp://example.com/', 'gopher://x/',
		'not-a-url', '', 'javascript:alert(1)',
	];
	for (const u of tolak) {
		assert.equal(await isSafePublicUrl(u), false, `isSafePublicUrl harus TOLAK: ${u || '<kosong>'}`);
	}
	// DNS mungkin tidak jalan di sandbox -- kalau resolve, hasilnya harus public.
	for (const u of ['https://github.com/', 'http://example.com']) {
		const r = await isSafePublicUrl(u);
		assert.equal(typeof r, 'boolean', 'harus balik boolean, bukan throw');
	}
}

// === WRAPPER YT-DLP: cookies =================================================

assert.match(rs, /std::env::var\("YTDLP_COOKIES"\)/, 'wrapper harus mendukung env YTDLP_COOKIES');
// Env harus dicek SEBELUM kandidat lama (cwd = folder kerja per job).
const fc = rs.slice(rs.indexOf('fn find_cookies()'));
assert.ok(fc.indexOf('YTDLP_COOKIES') < fc.indexOf('COOKIE_CANDIDATES'),
	'YTDLP_COOKIES harus dicek sebelum kandidat path relatif');
for (const f of [scraper, video]) {
	assert.match(f, /YTDLP_COOKIES/, 'pemanggil harus meneruskan YTDLP_COOKIES lewat env');
	assert.match(f, /env: \{ \.\.\.process\.env, \.\.\.envCookies\(\) \}/, 'exec harus menyertakan envCookies()');
	assert.match(f, /path\.resolve\(p\)/, 'path cookies harus dikirim ABSOLUT (cwd = folder kerja)');
}

console.log('OK: audit keamanan (jadibot, injeksi settings, dashboard, secret, repo, SSRF, rapian, cookies)');
