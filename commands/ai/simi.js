import { nexray, AIError } from '../../lib/ai/providers.js';

// Port dari plugins/ai/simi.js (Kyouko-MD), via api.nexray.eu.cc, tanpa API key.

export default {
	name: 'simi',
	aliases: ['simisimi'],

	async execute(ctx) {
		const { m, text, isLimit, db } = ctx;

		if (!text) return m.reply('❌ Mau ngobrol apa sama Simi?\n\nContoh: `.simi Halo Simi!`');
		if (!isLimit) return m.reply(global.mess.limit);

		await m.react('🕕');

		try {
			const result = await nexray('simi', text);
			await m.react('✅');
			await m.reply(result);
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[Simi Error]', e);
			await m.react('☢');
			return m.reply(e instanceof AIError ? '⚠️ Simi lagi ngambek, nggak mau balas.' : global.mess.fail);
		}
	},
};
