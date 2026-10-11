import { nexray, AIError } from '../../lib/ai/providers.js';

// Port dari plugins/ai/quillbot.js (Kyouko-MD), via api.nexray.eu.cc, tanpa API key.

export default {
	name: 'quilbot',
	aliases: ['quillbot', 'parafrase'],

	async execute(ctx) {
		const { m, text, isLimit, db } = ctx;

		if (!text) return m.reply('❌ Masukkan teks yang ingin disempurnakan.\n\nContoh: `.quilbot Saya sedang makan nasi di rumah`');
		if (!isLimit) return m.reply(global.mess.limit);

		await m.react('🕕');

		try {
			const result = await nexray('quillbot', text);
			await m.react('✅');
			await m.reply(result);
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[Quillbot Error]', e);
			await m.react('☢');
			return m.reply(e instanceof AIError ? '⚠️ Quillbot gagal memproses teks.' : global.mess.fail);
		}
	},
};
