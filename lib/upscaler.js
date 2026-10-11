import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { ResizeStrategy } from 'jimp';

const execFileAsync = promisify(execFile);

let _imBinCache = null;

/**
 * Deteksi binary ImageMagick yang tersedia di sistem. ImageMagick 7+ makai
 * nama command 'magick', versi 6 (masih umum di banyak distro/paket) makai
 * 'convert'. Hasil deteksi di-cache biar nggak nge-spawn proses tiap kali
 * dipanggil ulang.
 */
async function pickImageMagickBinary() {
	if (_imBinCache) return _imBinCache;
	for (const bin of ['magick', 'convert']) {
		try {
			await execFileAsync(bin, ['-version'], { timeout: 5000 });
			_imBinCache = bin;
			return bin;
		} catch {}
	}
	throw new Error("ImageMagick ('magick'/'convert') tidak ditemukan di sistem");
}

/**
 * Tier 0 (terbaik): upscale pakai `sharp` (dibangun di atas libvips).
 * Kualitas & kecepatan di atas ImageMagick maupun Jimp, dan nggak butuh
 * binary sistem terpisah -- binary libvips-nya ke-bundle otomatis pas
 * `npm install sharp` (termasuk di ARM/Termux/PRoot-Distro).
 *
 * `fit: 'inside'` + cuma nyediain SATU target box (bukan maksa w x h persis)
 * artinya rasio asli SELALU terjaga -- gambar di-fit ke dalam kotak
 * targetWidth x targetHeight tanpa distorsi. `.sharpen()` di akhir buat
 * ngimbangin efek lembek yang selalu muncul abis resize/upscale gede.
 */
async function sharpUpscale(buffer, { targetWidth, targetHeight } = {}) {
	return await sharp(buffer)
		.resize(targetWidth, targetHeight, {
			fit: 'inside',
			kernel: sharp.kernel.lanczos3
		})
		.sharpen({ sigma: 1, m1: 0.5, m2: 0.5 })
		.png()
		.toBuffer();
}

/**
 * Upscale pakai ImageMagick, filter Lanczos + unsharp mask di akhir biar
 * nggak lembek. Butuh ImageMagick ke-install di sistem (mis.
 * `pacman -S imagemagick` / `apt install imagemagick`) -- kalau nggak ada,
 * function ini throw.
 *
 * PENTING (bug lama): geometry sebelumnya pakai tanda "!" di belakang
 * (`WxH!`), itu artinya PAKSA ke ukuran itu PERSIS dan ABAIKAN rasio asli --
 * itu penyebab hasilnya gepeng/distorsi buat gambar non-persegi. Tanpa "!",
 * ImageMagick otomatis mempertahankan rasio dan cuma nge-"fit"-kan ke dalam
 * kotak WxH (sama seperti default `-resize`).
 */
async function imagemagickUpscale(buffer, { targetWidth, targetHeight } = {}) {
	const bin = await pickImageMagickBinary();

	const tmpBase = path.join(os.tmpdir(), `im-upscale-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	const inputPath = `${tmpBase}-in`;
	const outputPath = `${tmpBase}-out.png`;

	fs.writeFileSync(inputPath, buffer);
	try {
		await execFileAsync(bin, [
			inputPath,
			'-filter', 'Lanczos',
			'-resize', `${targetWidth}x${targetHeight}`,
			'-unsharp', '0x1',
			`PNG:${outputPath}`
		], { timeout: 60000 });
		return fs.readFileSync(outputPath);
	} finally {
		if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
		if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
	}
}

/**
 * Upscale pakai Jimp (pure JS, nol dependency native, hampir selalu bisa
 * jalan walau di VPS/HP spek rendah). Cuma resize interpolasi -- bukan AI,
 * nggak nambah detail baru.
 *
 * PENTING (bug lama): sebelumnya dikasih `targetWidth` DAN `targetHeight`
 * sekaligus (dua-duanya sudah dibatasi terpisah di pemanggilnya) -> Jimp
 * resize persis ke situ tanpa peduli rasio asli, itu penyebab gepeng.
 * Sekarang cuma `w` yang dikasih; Jimp v1 otomatis hitung `h` secara
 * proporsional kalau `h` nggak diisi. Pakai mode BICUBIC (kualitas terbaik
 * yang tersedia di Jimp v1) + kernel convolution sharpen di akhir.
 */
async function jimpUpscale(jimpImage, { targetWidth } = {}) {
	const img = jimpImage.clone().resize({ w: targetWidth, mode: ResizeStrategy.BICUBIC });
	img.convolution([
		[0, -1, 0],
		[-1, 5, -1],
		[0, -1, 0]
	]);
	return await img.getBuffer('image/png');
}

export { sharpUpscale, imagemagickUpscale, jimpUpscale };
