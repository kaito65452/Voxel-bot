import { muslimAI, AIError } from '../../lib/ai/providers.js';

// Port dari plugins/ai/muslimai.js (Kyouko-MD), via muslimai.io, tanpa API key.

export default {
	name: 'muslimai',
	aliases: ['islamai', 'quranai'],

	async execute(ctx) {
		const { m, text, prefix, command, isLimit, db } = ctx;

		if (!text) return m.reply(`🕌 *MuslimAI*\n\n> Tanya seputar Islam & Al-Quran\n\n\`Contoh: ${prefix}${command} Apa itu sholat?\``);
		if (!isLimit) return m.reply(global.mess.limit);

		await m.react('🕕');

		try {
			const result = await muslimAI(text);
			await m.react('✅');
			await m.reply(result.length > 4096 ? result.slice(0, 4096) + '...' : result);
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[MuslimAI Error]', e);
			await m.react('☢');
			return m.reply(e instanceof AIError ? `❌ *MuslimAI Gagal*\n\n> ${e.message}` : global.mess.fail);
		}
	},
};
