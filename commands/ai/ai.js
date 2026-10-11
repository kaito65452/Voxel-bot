import { geminiWeb, AIError } from '../../lib/ai/providers.js';

/*
 * .ai / .ai4chat / .gemini
 * Port dari plugins/ai/ai.js (Kyouko-MD), yang aslinya pakai src/scraper/gemini.js.
 * Sama-sama TIDAK butuh API key: meniru gemini.google.com sebagai tamu.
 *
 * Beda dari Kyouko-MD:
 * - Kyouko-MD merender balasan pakai AIRich (kartu interaktif WhatsApp khusus
 *   yang butuh dependensi `anita-baileys`). Voxel tidak punya infra itu,
 *   jadi balasan dikirim sebagai teks biasa lewat m.reply seperti command lain.
 * - Sesi percakapan (biar AI "ingat" konteks) disimpan per-pengirim di memori
 *   proses (Map), sama seperti punya Kyouko-MD -- hilang kalau bot restart.
 */

const sessions = new Map();

const SYSTEM_PROMPT = 'Kamu adalah asisten AI yang cerdas dan membantu untuk sebuah bot WhatsApp bernama Voxel. Jawab dalam bahasa yang dipakai user, dengan gaya natural, singkat, dan jelas.';

export default {
	name: 'ai',
	aliases: ['ai4chat', 'gemini'],

	async execute(ctx) {
		const { m, text, prefix, command, isLimit, db } = ctx;

		if (!text) {
			return m.reply(
				`🤖 *AI*\n\n` +
				`> Halo! Aku asisten cerdas Voxel\n\n` +
				`*Cara penggunaan:*\n` +
				`> \`${prefix}${command} <pertanyaan>\`\n\n` +
				`*Contoh:*\n` +
				`> \`${prefix}${command} jelaskan cara kerja promise di javascript\``
			);
		}

		if (!isLimit) return m.reply(global.mess.limit);

		await m.react('🕕');

		try {
			const sessionId = sessions.get(m.sender) || null;
			const result = await geminiWeb({ message: text, instruction: SYSTEM_PROMPT, sessionId });

			if (result.sessionId) sessions.set(m.sender, result.sessionId);

			await m.react('✅');
			const reply = result.text.trim();
			await m.reply(reply.length > 4096 ? reply.slice(0, 4096) + '...' : reply);
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[AI Error]', e);
			await m.react('☢');
			// Sesi yang error kemungkinan cookie-nya sudah basi -- buang biar
			// percobaan berikutnya mulai dari sesi baru, bukan terus gagal.
			sessions.delete(m.sender);
			return m.reply(e instanceof AIError ? `❌ *AI Gagal*\n\n> ${e.message}` : global.mess.fail);
		}
	},
};
