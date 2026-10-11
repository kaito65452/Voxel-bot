import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
	name: 'megadl',
	aliases: ['meganzdl', 'meganz'],

	async execute({ m, voxel, text }) {
		const megaUrl = (text || '').trim();
		if (!/^https?:\/\/mega\.nz\//i.test(megaUrl)) {
			return m.reply('Masukkan link Mega.nz yang valid.\nContoh: .megadl https://mega.nz/file/xxxxx');
		}

		await m.react('⏳');

		const outputDir = path.join(__dirname, 'downloads');
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// execFile (bukan exec) -- megaUrl dikirim sebagai argumen array
		// terpisah, BUKAN digabung jadi satu string shell. Ini nyegah command
		// injection kalau ada yang masukin URL berisi karakter shell aneh-aneh
		// (;, |, &&, $(...), backtick, dll).
		execFile('megadl', ['--path', outputDir, megaUrl], async (error, stdout) => {
			if (error) {
				console.log(`megadl error: ${error.message}`);
				await m.react('✗');
				return m.reply('Gagal mendownload file dari Mega.nz.');
			}

			const match = stdout.match(/Downloaded (.*)/);
			if (!match || !match[1]) {
				await m.react('✗');
				return m.reply('Nama file yang diunduh tidak dapat ditentukan.');
			}

			const fileName = match[1].trim();
			const filePath = path.join(outputDir, fileName);

			try {
				await voxel.sendMessage(m.chat, {
					document: { url: filePath },
					mimetype: 'application/octet-stream',
					fileName
				}, { quoted: m });
				await m.react('✅');
			} catch (e) {
				console.log('Error meganz:', e);
				await m.react('✗');
				await m.reply('Gagal mengirim file ke WhatsApp.');
			} finally {
				if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
			}
		});
	}
};

