import { nexray, AIError } from '../../lib/ai/providers.js';

// Port dari plugins/ai/matematika.js (Kyouko-MD), via api.nexray.eu.cc, tanpa API key.

export default {
	name: 'matematika',
	aliases: ['mathgpt', 'mathsolver'],

	async execute(ctx) {
		const { m, text, prefix, command, isLimit, db } = ctx;

		if (!text) return m.reply(`📐 *MATH GPT*\n\n> Masukkan soal matematika\n\n\`Contoh: ${prefix}${command} 2+2 berapa?\``);
		if (!isLimit) return m.reply(global.mess.limit);

		await m.react('🕕');

		try {
			const result = await nexray('math', text);
			await m.react('✅');
			await m.reply(result);
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[Matematika Error]', e);
			await m.react('☢');
			return m.reply(e instanceof AIError ? '⚠️ Gagal memproses soal matematika.' : global.mess.fail);
		}
	},
};
