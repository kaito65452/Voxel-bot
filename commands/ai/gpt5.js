import { overchat, AIError } from '../../lib/ai/providers.js';

// Port dari plugins/ai/gpt5.js (Kyouko-MD) -> src/scraper/gpt5.js.
// Chat model via OverChat (overchat.ai), tanpa API key.

export default {
	name: 'gpt5',
	aliases: ['gpt5nano', 'gpt41'],

	async execute(ctx) {
		const { m, text, prefix, command, isLimit, db } = ctx;

		if (!text) {
			return m.reply(
				`🤖 *GPT-4.1 Nano*\n\n` +
				`Tanya apa aja ke AI, nanti dijawab pakai model GPT-4.1 Nano.\n\n` +
				`*PENGGUNAAN:*\n` +
				`> *${prefix}${command} <pertanyaan>*\n\n` +
				`*CONTOH:*\n` +
				`> *${prefix}${command} Apa itu quantum computing?*\n\n` +
				`_Jawaban bisa agak lama, sabar ya_`
			);
		}

		if (!isLimit) return m.reply(global.mess.limit);

		await m.react('🕕');

		try {
			const result = await overchat('gpt5', text);
			await m.react('✅');
			const reply = result.answer;
			await m.reply(reply.length > 4096 ? reply.slice(0, 4096) + '...' : reply);
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[GPT5 Error]', e);
			await m.react('☢');
			return m.reply(e instanceof AIError ? `❌ *GPT-5 Gagal*\n\n> ${e.message}` : global.mess.fail);
		}
	},
};
