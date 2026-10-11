import { overchat, AIError } from '../../lib/ai/providers.js';

// Port dari plugins/ai/qwen3.js (Kyouko-MD) -> src/scraper/qwen3.js.
// Chat model via OverChat (overchat.ai), tanpa API key.

export default {
	name: 'qwen3',
	aliases: ['qwen', 'qw3'],

	async execute(ctx) {
		const { m, text, prefix, command, isLimit, db } = ctx;

		if (!text) {
			return m.reply(
				`🤖 *Qwen3 Next 80B*\n\n` +
				`> Masukkan pertanyaan\n\n` +
				`\`Contoh: ${prefix}${command} apa itu machine learning?\``
			);
		}

		if (!isLimit) return m.reply(global.mess.limit);

		await m.react('🕕');

		try {
			const result = await overchat('qwen', text);
			await m.react('✅');
			const reply = result.answer;
			await m.reply(reply.length > 4096 ? reply.slice(0, 4096) + '...' : reply);
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[Qwen3 Error]', e);
			await m.react('☢');
			return m.reply(e instanceof AIError ? `❌ *Qwen3 Gagal*\n\n> ${e.message}` : global.mess.fail);
		}
	},
};
