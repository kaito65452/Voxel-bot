import { deepseekThink, AIError } from '../../lib/ai/providers.js';

// Port dari plugins/ai/deepseek.js (Kyouko-MD) -> src/scraper/deepseek.js.
// Chat via notegpt.io (mode "deep think"), tanpa API key.
//
// Nama command sengaja BUKAN "deepseek" -- voxel.js sudah punya
// `case 'deepseek'` bawaan (lewat fetchApi/siputzx) di switch-case utama;
// lihat penjelasan yang sama di commands/ai/claudehaiku.js.

export default {
	name: 'deepthink',
	aliases: ['dsthink', 'dsv4', 'deepseekthink'],

	async execute(ctx) {
		const { m, text, prefix, command, isLimit, db } = ctx;

		if (!text) {
			return m.reply(
				`🧠 *DeepSeek V4 (Thinking)*\n\n` +
				`AI yang bisa mikir dulu sebelum jawab — cocok buat pertanyaan yang butuh penalaran.\n\n` +
				`*PENGGUNAAN:*\n` +
				`> *${prefix}${command} <pertanyaan>*\n\n` +
				`*CONTOH:*\n` +
				`> *${prefix}${command} Jelaskan lubang hitam*\n\n` +
				`_Bot akan mikir dulu, baru jawab — jadi agak lama sedikit_`
			);
		}

		if (!isLimit) return m.reply(global.mess.limit);

		await m.react('🕕');

		try {
			const result = await deepseekThink(text);
			await m.react('✅');

			let reply = '';
			if (result.reasoning) {
				const preview = result.reasoning.length > 800 ? result.reasoning.slice(0, 800) + '...' : result.reasoning;
				reply += `💭 *Proses Berpikir:*\n${preview.replace(/\n/g, '\n> ')}\n\n`;
			}
			if (result.answer) reply += result.answer;
			if (reply.length > 4096) reply = reply.slice(0, 4096) + '\n\n... (dipotong)';

			await m.reply(reply);
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[DeepThink Error]', e);
			await m.react('☢');
			return m.reply(e instanceof AIError ? `❌ *DeepSeek Gagal*\n\n> ${e.message}` : global.mess.fail);
		}
	},
};
