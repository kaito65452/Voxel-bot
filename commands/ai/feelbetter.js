import { feelBetter, AIError } from '../../lib/ai/providers.js';

// Port dari plugins/ai/feelbetter.js (Kyouko-MD) -> src/scraper/feeb.js.
// Chat via feelbetterbot.com, tanpa API key.

export default {
	name: 'feelbetter',
	aliases: ['fb', 'healing'],

	async execute(ctx) {
		const { m, text, prefix, command, isLimit, db } = ctx;

		if (!text) {
			return m.reply(
				`💗 *FeelBetter*\n\n` +
				`> Teman curhat, tempat cerita apa aja tanpa dihakimi\n\n` +
				`*PENGGUNAAN:*\n` +
				`> *${prefix}${command} <ceritamu>*`
			);
		}

		if (!isLimit) return m.reply(global.mess.limit);

		await m.react('🕕');

		try {
			const result = await feelBetter(text);
			await m.react('✅');
			const reply = result.answer;
			await m.reply(reply.length > 4096 ? reply.slice(0, 4096) + '...' : reply);
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[FeelBetter Error]', e);
			await m.react('☢');
			return m.reply(e instanceof AIError ? `❌ *FeelBetter Gagal*\n\n> ${e.message}` : global.mess.fail);
		}
	},
};
