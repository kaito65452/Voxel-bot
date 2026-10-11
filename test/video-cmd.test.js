// Self-check command .video (commands/media/video.js) -- integrasi wrapper Rust.
// Jalankan: node test/video-cmd.test.js   (tanpa npm install / tanpa cargo)
import assert from 'node:assert';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const cmd = fs.readFileSync(new URL('../commands/media/video.js', import.meta.url), 'utf8');
const rs = fs.readFileSync(new URL('../yt-dlp/src/main.rs', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../lib/command-loader.js', import.meta.url), 'utf8');

// --- 1) alias cuma nama yang BEBAS -------------------------------------------
// Command di commands/ dipanggil sebelum switch voxel.js (lihat dispatch di
// voxel.js), jadi alias yang bentrok = command lama di-shadow diam-diam.
const declared = [...cmd.matchAll(/name: '(\w+)'|aliases: \[([^\]]+)\]/g)]
	.flatMap(m => (m[1] ? [m[1]] : [...m[2].matchAll(/'(\w+)'/g)].map(x => x[1])));
const voxelSrc = fs.readFileSync(new URL('../voxel.js', import.meta.url), 'utf8');
for (const alias of declared) {
	const bentrok = new RegExp(`case '${alias}':`).test(voxelSrc);
	assert.ok(!bentrok, `alias "${alias}" udah dipakai case di voxel.js -> bakal nge-shadow command lama`);
}

// --- 2) Dispatch commands/ memang duluan (asumsi di atas) -------------------
assert.match(voxelSrc, /const externalCommand = externalCommands\.get\(command\)/,
	'pencarian externalCommand berubah -- urutan dispatch perlu dicek ulang');

// --- 3) path output WAJIB di-join ke folder kerja ---------------------------
// Wrapper nge-print path RELATIF ke cwd. Kalau cuma path.resolve() tanpa work,
// dia resolve ke process.cwd() dan file nggak ketemu -> "file hasil nggak ada".
assert.match(cmd, /path\.resolve\(work, stdout/, 'path hasil harus di-resolve relatif ke folder kerja');
assert.match(cmd, /cwd: work/, 'exec wrapper harus cwd = folder kerja, bukan root project');
assert.match(cmd, /--out/, 'harus terusin --out ke wrapper');

// --- 4) Kebersihan: folder kerja dibersihin SELALU -------------------------
assert.match(cmd, /finally \{[\s\S]*?fs\.rm\(work, \{ recursive: true, force: true \}\)/,
	'folder kerja harus dihapus di finally, kalau tidak file 500MB numpuk');
assert.match(cmd, /database.*temp.*vid-/, 'folder kerja harus per-request (bukan satu folder global)');

// --- 5) Limit & error handling (botHarus bisa deteksi gagal) ----------------
assert.match(cmd, /if \(!isLimit\) return m\.reply\(global\.mess\.limit\)/, 'limit gate hilang');
assert.match(cmd, /global\.setLimit/, 'limit harus dipotong setelah sukses');
assert.match(cmd, /confirm your age\|age verification/i, 'pesan error age-restricted harus ada (butuh cookies)');
// Regex klasifikasi error jangan longgar: /age/ biasa kepicu kata "message"/
// "package" di stderr, jadi semua kegagalan ketuker jadi "butuh login".
assert.doesNotMatch(cmd, /\/age\|confirm you\/i/, 'regex klasifikasi error kepicu kata "message"/"package"');

// --- 6) Kompat WhatsApp -----------------------------------------------------
// WA cuma mau mp4 H.264/AAC; hasil yt-dlp sering av1/vp9.
assert.match(cmd, /libx264/, 'harus remux ke h264 (WA gak bisa main av1)');
assert.match(cmd, /MAX_UPLOAD/, 'limit ukuran upload WA harus dicek');
assert.match(cmd, /ffprobe/, 'cek codec sebelum remux (hemat waktu)');

// Error dari wrapper sendiri juga jangan mengandung frasa yg dipake buat
// klasifikasi -- kalau iya, setiap kegagalan jadi kelamaan "butuh login".
assert.doesNotMatch(rs, /gagal.*age-restricted/i, 'pesan error wrapper nyebut "age-restricted" -> falsely classified');

// --- 7) Beneran jalan: binary-nya ada & bisa dipanggil ---------------------
const bin = new URL('../bin/yt-dlp-rs', import.meta.url);
const ytdlp = new URL('../bin/yt-dlp', import.meta.url);
assert.ok(fs.existsSync(bin), 'bin/yt-dlp-rs hilang -> cd yt-dlp && cargo build --release && cp target/release/yt-dlp ../bin/');
assert.ok(fs.existsSync(ytdlp), 'bin/yt-dlp hilang (wrapper memanggil ini)');
assert.ok(fs.statSync(bin).size > 100_000, 'bin/yt-dlp-rs kelihatan bukan binary');

// Smoke: --help harus jalan (bukan crash), dan argumen jelek harus non-zero.
const binPath = bin.pathname;
const { stdout } = await promisify(execFile)(binPath, ['--help'], { timeout: 20000 });
assert.match(stdout, /yt-dlp-rs <url>/, 'smoke test: --help gagal');

// Argumen jelek harus keluar non-zero, bukan diam-diam sukses.
await assert.rejects(
	promisify(execFile)(binPath, [], { timeout: 20000 }),
	'argumen kosong harus exit != 0',
);

console.log(`OK: .video command (alias bebas: ${declared.join(', ')}, path resolution, cleanup, limit, kompat WA)`);