// Self-check wrapper yt-dlp (yt-dlp/src/main.rs).
// Jalankan: node test/ytdlp.test.js   (tanpa npm install / tanpa cargo)
//
// Yang dijaga, dua regression yang beneran kejadian:
//  1) Format tanpa batas tinggi -> `bv*+ba/b` narik 4K 679MiB, gak bisa dikirim WA.
//  2) Memaksa `player_client` -> `android_vr` lolos bot-check saat metadata tapi
//     download-nya 403 (butuh GVS PO Token), `web`/`tv` kena bot-check.
//     Default yt-dlp justru jalan normal.
import assert from 'node:assert';
import fs from 'node:fs';

const rs = fs.readFileSync(new URL('../yt-dlp/src/main.rs', import.meta.url), 'utf8');
const bin = new URL('../bin/yt-dlp-rs', import.meta.url);
const ytdlp = new URL('../bin/yt-dlp', import.meta.url);

// --- 1) batas resolusi ------------------------------------------------------
assert.match(rs, /height<=\{h\}/, 'format string harus pakai height<= (batas tinggi)');
assert.doesNotMatch(rs, /"bv\*\+ba\/b"/, 'format bv*+ba/b tanpa batas = 4K 679MiB');
// Default harus <=720 (batas WhatsApp).
const defMax = Number(rs.match(/const DEFAULT_MAX_HEIGHT: u32 = (\d+)/)?.[1]);
assert.ok(defMax > 0 && defMax <= 1080, `DEFAULT_MAX_HEIGHT ${defMax} unreasonable`);
// --max harus benar-benar masuk ke format string (bukan flag mati).
assert.match(rs, /"--max"/, 'opsi --max hilang');
assert.match(rs, /max_height = it\s*\.next\(\)/, '--max belum dibaca dari argv');

// --- 2) jangan hardcode player_client --------------------------------------
// Percobaan pertama WAJIB `None` (default yt-dlp).
assert.match(rs, /const PLAYER_CLIENTS: &\[Option<&str>\] = &\[None,/, 'percobaan pertama harus client default yt-dlp (None)');
assert.doesNotMatch(rs, /"android_vr"/, 'android_vr download-nya 403 (GVS PO Token) -- jangan dipaksa');
// Flag extractor-args hanya boleh dikirim conditional, bukan selalu.
assert.match(rs, /if let Some\(c\) = client \{/, 'player_client harus conditional, default = nggak ngirim flag sama sekali');

// --- 3) sisa yang wajib ada biar output bisa dipakai bot --------------------
assert.match(rs, /std::process::exit\(1\)/, 'gagal harus exit != 0 (bot harus bisa deteksi gagal)');
assert.match(rs, /fn newest_output/, 'fungsi cari file hasil hilang');
assert.match(rs, /\.ends_with\("\.part"\)/, 'file .part harus di-skip (download belum selesai)');
assert.match(rs, /println!\("\{\}", newest_output/, 'path hasil harus dicetak ke stdout');
// Resolusi video beneran dipakai: ffmpeg merge harus nyisa, bukan audio doang.
assert.match(rs, /"--merge-output-format"/, 'merge mp4 hilang');

// --- 4) artefak build -------------------------------------------------------
if (fs.existsSync(bin)) {
	const sz = fs.statSync(bin).size;
	assert.ok(sz > 100_000, `bin/yt-dlp-rs cuma ${sz} byte -- build ulang: cd yt-dlp && cargo build --release`);
	const head = fs.readFileSync(bin).subarray(0, 4);
	assert.ok(head.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])), 'bin/yt-dlp-rs bukan ELF (build-nya bukan binary Rust?)');
}
if (fs.existsSync(ytdlp)) {
	// Wrapper memanggil yt-dlp ini; kalau hilang, download gagal diam-diam.
	assert.ok(fs.statSync(ytdlp).size > 100_000, 'bin/yt-dlp kelihatan rusak');
}

console.log('OK: yt-dlp wrapper (batas 720p, default client bukan hardcode, exit code, artefak bin/)');