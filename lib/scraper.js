import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ytdl from 'ytdl-core';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { ytAudioScrapr } from './scrapr.js';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRAPPER = path.join(ROOT, 'bin/yt-dlp-rs');

// Pastikan bin/yt-dlp-rs benar-benar bisa dieksekusi.
//
// SFTP dan ekstrak .zip TIDAK menyimpan permission bit, jadi file yang tadinya
// +x di laptop arrive di server sebagai 0644 -> spawn() gagal EACCES (bukan
// ENOENT), dan gejalanya aneh: command langsung bilang gagal padahal file-nya
// ada. Jadi bit +x dipulihkan sendiri di sini, bukan dikasih tahu user.
export async function siapkanWrapper() {
	const bin = path.join(ROOT, 'bin/yt-dlp-rs');
	const st = await fsp.stat(bin).catch(() => null);
	if (!st) throw new Error(`wrapper yt-dlp tidak ada: ${bin} (upload ulang folder bin/)`);
	try {
		await fsp.access(bin, fs.constants.X_OK);
	} catch {
		await fsp.chmod(bin, 0o755);
	}
}

// Path cookies.txt buat video age-restricted. Binary yt-dlp selalu dijalankan
// dengan cwd = folder kerja per job, jadi path RELATIF ("cookies.txt") nyaris
// selalu salah tempat. Makanya diteruskan sebagai path ABSOLUT lewat env.
function envCookies() {
	const p = process.env.YTDLP_COOKIES || path.join(ROOT, 'cookies.txt');
	return p && fs.existsSync(p) ? { YTDLP_COOKIES: path.resolve(p) } : {};
}

// Download lewat wrapper Rust (bin/yt-dlp-rs): capping resolusi, retry antar
// player_client, resume .part. Return path file LOKAL (file selalu dibersihin
// setelah dibaca -- pemanggil yang responsável kirim lalu hapus).
async function viaYtDlp(url, { audio = false, max = '720' } = {}) {
	await siapkanWrapper();
	const work = path.join(ROOT, 'database', 'temp', `ydl-${Date.now()}-${Math.floor(process.uptime() * 1000) % 100000}`);
	await fsp.mkdir(work, { recursive: true });
	try {
		const { stdout } = await execFileAsync(WRAPPER, [
			url,
			...(audio ? ['--audio'] : []),
			'--max', max,
		], { cwd: work, timeout: 15 * 60 * 1000, maxBuffer: 1024 * 1024, env: { ...process.env, ...envCookies() } });
		// Wrapper nge-print path RELATIF ke cwd -> wajib di-join ke `work`.
		const out = path.resolve(work, stdout.trim().split('\n').pop()?.trim());
		const st = await fsp.stat(out).catch(() => null);
		if (!st?.size) throw new Error('yt-dlp: file hasil nggak ada');
		const buf = await fsp.readFile(out);
		return { buffer: buf, title: path.basename(out).replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim() };
	} finally {
		await fsp.rm(work, { recursive: true, force: true }).catch(() => {});
	}
}

async function bytesToSize(bytes) {
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
	if (bytes === 0) return "n/a";
	const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
	if (i === 0) return `${bytes} ${sizes[i]}`;
	return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`;
}

async function ytMp4Lama(url, options) {
	try {
		const getUrl = await ytdl.getInfo(url, options);
		const audioPath = path.join('./database/temp', `audio_${Date.now()}.mp4`);
		const videoPath = path.join('./database/temp', `video_${Date.now()}.mp4`);
		const outputPath = path.join('./database/temp', `output_${Date.now()}.mp4`);
		await new Promise((resolve, reject) => {
			ytdl(url, { format: ytdl.chooseFormat(getUrl.formats, { quality: 'highestaudio', filter: 'audioonly' }) })
				.pipe(fs.createWriteStream(audioPath))
				.on('finish', resolve)
				.on('error', reject);
		});
		await new Promise((resolve, reject) => {
			ytdl(url, { format: ytdl.chooseFormat(getUrl.formats, { quality: 'highestvideo', filter: 'videoonly' }) })
				.pipe(fs.createWriteStream(videoPath))
				.on('finish', resolve)
				.on('error', reject);
		});
		await new Promise((resolve, reject) => {
			exec(`ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac "${outputPath}"`, (error, stdout, stderr) => {
				if (error) {
					return reject(new Error(`ffmpeg error: ${error.message}`));
				}
				resolve();
			});
		});

		await fs.promises.unlink(audioPath).catch(() => {});
		await fs.promises.unlink(videoPath).catch(() => {});
		return {
			title: getUrl.videoDetails.title,
			result: outputPath,
			thumb: getUrl.player_response.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url,
			views: getUrl.videoDetails.viewCount,
			likes: getUrl.videoDetails.likes,
			dislike: getUrl.videoDetails.dislikes,
			channel: getUrl.videoDetails.ownerChannelName,
			uploadDate: getUrl.videoDetails.uploadDate,
			desc: getUrl.videoDetails.description
		};
	} catch (error) {
		throw error;
	}
}

async function ytMp3Lama(url, options) {
	try {
		const getUrl = await ytdl.getInfo(url, options);
		let result = [];
		for (let i = 0; i < getUrl.formats.length; i++) {
			let item = getUrl.formats[i];
			if (item.mimeType === 'audio/webm; codecs="opus"') {
				let { contentLength } = item;
				let bytes = await bytesToSize(contentLength);
				result.push({
					audio: item.url,
					size: bytes
				});
			}
		}
		let resultFix = result.filter(x => x.audio !== undefined && x.size !== undefined);
		if (resultFix.length === 0) {
			throw new Error("Format audio tidak ditemukan.");
		}
		return {
			title: getUrl.videoDetails.title,
			result: resultFix[0].audio,
			size: resultFix[0].size,
			thumb: getUrl.player_response.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url,
			views: getUrl.videoDetails.viewCount,
			likes: getUrl.videoDetails.likes,
			dislike: getUrl.videoDetails.dislikes,
			channel: getUrl.videoDetails.ownerChannelName,
			uploadDate: getUrl.videoDetails.uploadDate,
			desc: getUrl.videoDetails.description
		};
	} catch (error) {
		throw error;
	}
}

// ============================================================
// RANTai: yt-dlp -> scrapr -> ytdl-core
// ============================================================
//
// Urutannya penting. Sebelumnya .ytmp3 cuma punya 2 tahap: API BetaBotz, lalu
// ytdl-core. ytdl-core itu library YouTube yang sudah ditinggalkan (YouTube
// ganti INNER_API-nya terus) -- jadi tahap kedua hampir selalu gagal, dan kode
// langsung jatuh ke `m.reply(global.mess.fail)`. scrapr baru jadi cadangan,
// tapi cuma buat AUDIO, dan itu hanya dipasang di command .video, bukan di
// .ytmp3 yang dipanggil user.
//
// Di sini rantainya dirapikan jadi satu tempat:
//   1. bin/yt-dlp-rs  -> yang beneran jalan (sudah dites, h264 720p, anti bot-check)
//   2. @coflyn/scrapr -> backend lain, cuma punya audio
//   3. ytdl-core      -> cara lama, disimpan sebagai upaya terakhir
// Kalau gagal semua, SEMUA errornya dilapor biar user tau penyebabnya.
//
// `result` bisa berupa BUFFER (dari yt-dlp) atau URL (dari scrapr/ytdl-core) --
// makanya ada flag `isBuffer` supaya pemanggil tahu cara mengirimnya.

async function ytMp4(url, options) {
	const errs = [];
	// 1) yt-dlp lokal -- paling akurat & satu-satunya yang bisa video.
	try {
		const { buffer, title } = await viaYtDlp(url, { audio: false });
		return { title, result: buffer, isBuffer: true };
	} catch (e) {
		errs.push(`yt-dlp: ${e.message}`);
	}
	// 2) ytdl-core (lama) -- disimpan di sini sebagai upaya terakhir.
	try {
		const r = await ytMp4Lama(url, options);
		return { ...r, isBuffer: false };
	} catch (e) {
		errs.push(`ytdl-core: ${e.message}`);
	}
	throw new Error(errs.join(' | '));
}

async function ytMp3(url, options) {
	const errs = [];
	// 1) yt-dlp lokal.
	try {
		const { buffer, title } = await viaYtDlp(url, { audio: true });
		return { title, result: buffer, isBuffer: true };
	} catch (e) {
		errs.push(`yt-dlp: ${e.message}`);
	}
	// 2) scrapr (backend lain) -- INI yang dulu tidak ada, dan penyebab
	//    .ytmp3 langsung bilang "gagal" padahal masih ada jalan lain.
	try {
		const r = await ytAudioScrapr(url);
		return { title: r.title, result: r.download, isBuffer: false, viaScrapr: true };
	} catch (e) {
		errs.push(`scapr: ${e.message}`);
	}
	// 3) ytdl-core (lama).
	try {
		const r = await ytMp3Lama(url, options);
		return { ...r, isBuffer: false };
	} catch (e) {
		errs.push(`ytdl-core: ${e.message}`);
	}
	throw new Error(errs.join(' | '));
}

export {
	ytMp4,
	ytMp3
};
