import { unlimitedChat, AIError } from '../../lib/ai/providers.js';

// Port dari plugins/ai/kobo-ai.js (Kyouko-MD) -> src/scraper/unlimitedai.js.
// Chat karakter via app.unlimitedai.chat, tanpa API key.

export default {
	name: 'kobo-ai',
	aliases: ['koboai', 'kobo'],

	async execute(ctx) {
		const { m, text, prefix, command, isLimit, db } = ctx;

		if (!text) {
			return m.reply(
				`🌬️ *Kobo Kanaeru*\n\n` +
				`> VTuber Hololive Indonesia Gen 3 — Wind Shaman yang cheerfull dan suka prank!\n\n` +
				`*PENGGUNAAN:*\n` +
				`> *${prefix}${command} <pertanyaan>*`
			);
		}

		if (!isLimit) return m.reply(global.mess.limit);

		await m.react('🕕');

		try {
			const result = await unlimitedChat(text, 'kobo');
			await m.react('✅');
			const reply = result.answer;
			await m.reply(reply.length > 4096 ? reply.slice(0, 4096) + '...' : reply);
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[Kobo Error]', e);
			await m.react('☢');
			return m.reply(e instanceof AIError ? `❌ *Kobo AI Error*\n\n> ${e.message}` : global.mess.fail);
		}
	},
};
