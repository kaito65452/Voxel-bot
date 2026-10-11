import { dolphin, DOLPHIN_TEMPLATES, AIError } from '../../lib/ai/providers.js';

// Port dari plugins/ai/dolphin.js (Kyouko-MD), via chat.dphn.ai, tanpa API key.

export default {
	name: 'dolphin',
	aliases: ['dolphinai', 'dphn'],

	async execute(ctx) {
		const { m, prefix, command, isLimit, db } = ctx;
		let text = ctx.text;

		if (!text) {
			return m.reply(
				`🐬 *Dolphin AI*\n\n` +
				`> Chat dengan Dolphin AI 24B Model\n\n` +
				`╭┈┈⬡「 📋 *TEMPLATE* 」\n` +
				`┃ • \`logical\` - Jawaban logis\n` +
				`┃ • \`creative\` - Jawaban kreatif\n` +
				`┃ • \`summarize\` - Ringkasan\n` +
				`┃ • \`code-beginner\` - Kode pemula\n` +
				`┃ • \`code-advanced\` - Kode lanjutan\n` +
				`╰┈┈┈┈┈┈┈┈⬡\n\n` +
				`> *Contoh:*\n` +
				`> ${prefix}${command} apa itu AI?\n` +
				`> ${prefix}${command} --creative buat puisi`
			);
		}

		let template = 'logical';
		const match = text.match(/^--(\S+)\s+/);
		if (match && DOLPHIN_TEMPLATES.includes(match[1].toLowerCase())) {
			template = match[1].toLowerCase();
			text = text.replace(match[0], '').trim();
		}
		if (!text) return m.reply('❌ Masukkan pertanyaan!');

		if (!isLimit) return m.reply(global.mess.limit);

		await m.react('🕕');

		try {
			const result = await dolphin(text, template);
			await m.react('✅');
			await m.reply(result);
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[Dolphin Error]', e);
			await m.react('☢');
			return m.reply(e instanceof AIError ? `❌ *Dolphin Gagal*\n\n> ${e.message}` : global.mess.fail);
		}
	},
};
