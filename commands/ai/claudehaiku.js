import { overchat, AIError } from '../../lib/ai/providers.js';

// Port dari plugins/ai/claudehaiku.js (Kyouko-MD) -> src/scraper/claudehaiku.js.
// Chat model via OverChat (overchat.ai), tanpa API key.
//
// Nama command sengaja BUKAN "claude" -- voxel.js sudah punya `case 'claude'`
// bawaan (lewat fetchApi/siputzx) di switch-case utama, dan command dari
// folder commands/ dicek LEBIH DULU sebelum switch-case itu (lihat voxel.js).
// Kalau dipakai nama yang sama, fitur "claude" bawaan jadi ketiban otomatis
// tanpa sepengetahuan siapa pun -- jadi dipakai nama beda biar dua-duanya
// tetap bisa jalan berdampingan.

export default {
	name: 'claudehaiku',
	aliases: ['chaiku', 'haiku45'],

	async execute(ctx) {
		const { m, text, prefix, command, isLimit, db } = ctx;

		if (!text) {
			return m.reply(
				`🤍 *Claude Haiku 4.5*\n\n` +
				`Tanya apa aja ke AI Claude Haiku — cepat dan ringan, cocok buat pertanyaan sehari-hari.\n\n` +
				`*PENGGUNAAN:*\n` +
				`> *${prefix}${command} <pertanyaan>*\n\n` +
				`*CONTOH:*\n` +
				`> *${prefix}${command} Jelaskan teori relativitas*\n\n` +
				`_Respons cepat, tapi tetap cerdas_`
			);
		}

		if (!isLimit) return m.reply(global.mess.limit);

		await m.react('🕕');

		try {
			const result = await overchat('claude', text);
			await m.react('✅');
			const reply = result.answer;
			await m.reply(reply.length > 4096 ? reply.slice(0, 4096) + '...' : reply);
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[ClaudeHaiku Error]', e);
			await m.react('☢');
			return m.reply(e instanceof AIError ? `❌ *Claude Haiku Gagal*\n\n> ${e.message}` : global.mess.fail);
		}
	},
};
