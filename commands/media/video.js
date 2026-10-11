// .video / .play -- download video dari YouTube lewat wrapper Rust (bin/yt-dlp-rs).
//
// Kenapa lewat binary, bukan API: wrapper yang capping resolusi (WhatsApp gak bisa
// kirim 4K 679MiB), nyoba client YouTube lain kalo kena bot-check, dan bikin
// file .part bisa di-resume. Lihat yt-dlp/src/main.rs.
//
// Pakai: .video <url> | .video --audio <url> | .video --1080 <url>
//        (max tinggi default 720, batas aman WhatsApp)

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ytAudioScrapr } from '../../lib/scrapr.js';
import { siapkanWrapper } from '../../lib/scraper.js';

const exec = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Jalankan tool eksternal -> (true + stdout) kalau sukses, (false,'') kalau
// gagal/tidak ada. Gagal = nilai balik, BUKAN exception: ffmpeg/ffprobe mungkin
// aja gak kepasang, dan itu bukan alasan buat menggagalkan seluruh command.
async function run(cmd, args) {
	try {
		const { stdout } = await exec(cmd, args, { timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024 });
		return [true, stdout];
	} catch {
		return [false, ''];
	}
}
const WRAPPER = path.join(ROOT, 'bin/yt-dlp-rs');
const YTDLP = path.join(ROOT, 'bin/yt-dlp');

// Path cookies.txt untuk video age-restricted. Binary yt-dlp dipanggil dengan
// cwd = folder kerja per job, jadi path relatif "cookies.txt" hampir selalu
// salah tempat. Sama seperti lib/scraper.js, diteruskan sebagai path ABSOLUT.
function envCookies() {
	const p = process.env.YTDLP_COOKIES || path.join(ROOT, 'cookies.txt');
	return p && fs.existsSync(p) ? { YTDLP_COOKIES: path.resolve(p) } : {};
}

// WA menolak file di atas ~64MiB (dan bot ini jalan di Termux/HP yang RAM-nya
// mepet). Di bawah itu aman, jadi ambangnya 48MiB -- bukan 16MiB, karena
// re-encode ffmpeg itu mahal CPU: video 10 menit butuh ~4 menit, dan itu
// kelamaan buat chat.
const MAX_UPLOAD = 48 * 1024 * 1024;

function pickUrl(text, quoted) {
	if (text && /https?:\/\//i.test(text)) return text.match(/https?:\/\/\S+/i)[0];
	const qText = quoted ? (quoted.text || quoted.caption || quoted.msg?.text || '') : '';
	const m = qText && qText.match(/https?:\/\/\S+/i);
	return m ? m[0] : null;
}

// WhatsApp cuma mau .mp4 H.264/AAC. Banyak hasil yt-dlp av1/vp9 -> remux ke
// h264 (re-encode) kalu codec-nya gak kompatibel. Kalau ffmpeg gak ada, kirim
// apa adanya -- lebih baik kekirim daripada gagal diam-diam.
const COMPAT = /^avc1|^h264|^mp4v/i;
async function toMp4(file) {
	if (file.endsWith('.mp4')) {
		const probe = await run('ffprobe', [
			'-v', 'error', '-select_streams', 'v:0',
			'-show_entries', 'stream=codec_name', '-of', 'csv=p=0', file,
		]);
		// Probe gagal (ffmpeg/ffprobe gak ada) -> kirim apa adanya, jangan gagal.
		if (!probe || COMPAT.test(probe)) return file;
	}
	const out = file.replace(/\.[^.]+$/, '') + '.compat.mp4';
	const ok = await run('ffmpeg', [
		'-y', '-i', file,
		'-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
		'-c:a', 'aac', '-b:a', '128k',
		'-movflags', '+faststart',
		out,
	]);
	// ffmpeg gagal / gak ada -> kirim file asli, jangan lempar error ke user.
	return ok ? out : file;
}

export default {
	// Alias SENGAJA nggak nyantum `play`/`ytmp4`/`ytvideo`: ketiganya sudah ada di
	// switch voxel.js (ytsearch & downloader BetaBotz), dan command di commands/
	// dipanggil DULUAN -- jadi kalau ikut nxamad, dia bakal nge-shadow 3 command
	// lama tanpa jejak. Pakai nama yang bebas aja.
	name: 'video',
	aliases: ['yt', 'ytdl', 'playvideo', 'viddl'],

	async execute(ctx) {
		const { m, voxel, text, prefix, command, db, isLimit } = ctx;
		if (!isLimit) return m.reply(global.mess.limit);

		const url = pickUrl(text, m.quoted);
		if (!url) return m.reply(`Example: ${prefix + command} https://youtu.be/xxxx\n_(atau reply pesan yang ada linknya)_`);
		if (!/youtu\.?be| youtube\.com|vimeo|dailymotion/i.test(url)) return m.reply('URL bukan YouTube/Vimeo!');

		// Cek binary-nya sekalian, biar errornya jelas bukan "spawn ENOENT".
		// siapkanWrapper() juga memulihkan bit +x yang hilang saat upload (SFTP
		// nggak nyimpen permission bit) -- tanpa itu spawn() EACCES di server.
		await siapkanWrapper();
		for (const bin of [YTDLP]) {
			await fs.access(bin).catch(() => {
				throw new Error(`binary nggak ada: ${path.relative(ROOT, bin)}`);
			});
		}

		const audioOnly = /--audio|-x\b/.test(text);
		const max = text.match(/--(\d{3,4})\b/)?.[1] || '720';
		m.react('⏳');

		// Download di folder sendiri per-chat, biar file 500MB gak numpuk di
		// root project & gampang dibersihin.
		const work = path.join(ROOT, 'database', 'temp', `vid-${m.sender.replace(/\W/g, '')}-${Date.now()}`);
		await fs.mkdir(work, { recursive: true });

		let outFile = null;
		try {
			// Download bisa lama (file 100MB di koneksi HP) -> timeout longgar.
			const { stdout } = await exec(WRAPPER, [
				url,
				...(audioOnly ? ['--audio'] : []),
				'--max', max,
				'--out', 'downloads/%(title).80s.%(ext)s',
			// YTDLP_COOKIES: cwd di sini folder kerja, jadi path relatif
			// "cookies.txt" pasti salah tempat. Kirim path ABSOLUT kalau ada.
			], { cwd: work, timeout: 15 * 60 * 1000, maxBuffer: 1024 * 1024, env: { ...process.env, ...envCookies() } });

			// Wrapper nge-print path file hasil di baris terakhir stdout. Path itu relatif
			// ke cwd, jadi HARUS di-join ke `work` -- kalau cuma path.resolve() doang,
			// dia nge-resolve ke process cwd (root project) dan file nggak ketemu.
			outFile = path.resolve(work, stdout.trim().split('\n').pop()?.trim());
			const st = await fs.stat(outFile).catch(() => null);
			if (!st?.size) throw new Error('file hasil nggak ada');

			// toMp4 bikin file .compat.mp4 di folder yg sama -- dihapus bareng
			// sama isi folder `work` di blok finally, jadi gak perlu dilacak.
			const file = audioOnly ? outFile : await toMp4(outFile);

			// Caption: nama file-nya aja, dibersihin biar enak dibaca. Suffix internal
			// (.compat / -sm) harus dibuang -- itu nama kerjaan, bukan judul.
			const judul = path.basename(file)
				.replace(/\.compat\.mp4$|-sm\.mp4$/i, '')
				.replace(/\.[^.]+$/, '')
				.replace(/_/g, ' ')
				.trim();
			const caption = audioOnly ? `🎵 *${judul}*` : `🎬 *${judul}*`;
			const size = (await fs.stat(file)).size;

			// Kegedean buat WA? Compress lagi lebih keras (tinggi turun).
			// Kalau ffmpeg gagal, tetap kirim file aslinya -- lebih baik user
			// dapat file kegedean daripada gak dapat apa-apa.
			let kirim = file;
			if (size > MAX_UPLOAD && !audioOnly) {
				const kecil = file.replace(/\.mp4$/, '') + '-sm.mp4';
				const [ok] = await run('ffmpeg', [
					// ultrafast, bukan veryfast: yang dipanggil user di grup itu
					// nungguin, jadi kecepatan lebih penting dari ukuran file.
					'-y', '-i', file, '-vf', 'scale=-2:480',
					'-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
					'-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', kecil,
				]);
				if (ok) kirim = kecil;
			}

			const buf = await fs.readFile(kirim);
			const type = audioOnly ? 'audio' : 'video';
			const mimetype = audioOnly ? 'audio/mpeg' : 'video/mp4';
			const filename = path.basename(kirim);
			await voxel.sendMessage(m.chat, { [type]: buf, mimetype, caption, fileName: filename }, { quoted: m });

			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[VIDEO]', e);

			// --- CADANGAN: audio YouTube lewat scrapr -------------------------
			// yt-dlp lokal paling akurat (bisa video, subtitle, format bebas),
			// tapi YouTube sering rate-limit bot. Kalau dia gagal DAN yang
			// diminta cuma audio, scrapr punya backend lain = peluang kedua.
			// User tetep dapet audio daripada cuma pesan error.
			if (audioOnly) {
				const cadangan = await ytAudioScrapr(url).catch((err) => {
					console.warn('[VIDEO] cadangan scrapr gagal:', err.message);
					return null;
				});
				if (cadangan?.download) {
					await voxel.sendMessage(m.chat, {
						audio: { url: cadangan.download },
						mimetype: 'audio/mpeg',
						caption: `🎵 *${String(cadangan.title || 'Audio').slice(0, 90)}*`,
					}, { quoted: m });
					if (typeof global.setLimit === 'function') global.setLimit(m, db);
					return;
				}
			}

			const msg = String(e?.stderr || e?.message || e);
			// Klasifikasi error HATI-HATI: regex longgar kayak /age/ akan kepicu kata
			// "message"/"package"/"usage" di stderr dan bikin semua kegagalan
			// dilaporkan sebagai "butuh login". Cocokkan kalimat spesifik aja.
			const ket = /confirm your age|age verification|age-restricted/i.test(msg)
				? 'Video ini *age-restricted* -- butuh login.\nExport cookies.txt dari browser yang sudah login YouTube, taruh di `cookies.txt` (root project).'
				: /confirm you'?re not a bot|not a bot|403/i.test(msg)
					? 'YouTube kena_rate-limit/bot-check. Coba lagi nanti.'
					: /private video|members-only|join this channel/i.test(msg)
						? 'Video private -- cuma anggota channel yang bisa akses.'
						: /is unavailable|removed|terminated/i.test(msg)
							? 'Video ini sudah dihapus / gak tersedia.'
							: /Sign in to confirm/i.test(msg)
								? 'YouTube minta login (kemungkinan age-restricted). Taruh `cookies.txt` di root project.'
								: `Gagal: \`${msg.slice(-220)}\``;
			await m.reply(`❌ ${ket}`, { quoted: m }).catch(() => {});
		} finally {
			// m.react() di bot ini SINKRON (bukan promise) -- lihat src/message.js.
			// Kalau dipanggil dengan .catch() dia bakal "Cannot read properties of
			// undefined" dan menutupi error asli yg lagi kita laporkan.
			try {
				const r = m.react('✅');
				if (r && typeof r.catch === 'function') r.catch(() => {});
			} catch { /* reacting itu kosmetik, jangan gagalin command */ }
			// Bersihin SEMUA file kerja -- termasuk .part yg gagal dan file
			// .compat.mp4 hasil remux. Folder per-request jadi nggak numpuk.
			await fs.rm(work, { recursive: true, force: true }).catch(() => {});
		}
	},
};