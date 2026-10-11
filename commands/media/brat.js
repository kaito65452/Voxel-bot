import fs from 'node:fs';

export default {
	name: 'brat',
	aliases: [],

	async execute(ctx) {
		const { m, voxel, text, db, command, prefix, isLimit } = ctx;

		if (!isLimit) return m.reply(global.mess.limit);
		if (!text && (!m.quoted || !m.quoted.text)) return m.reply(`Kirim/reply pesan *${prefix + command}* Teksnya`);

		const queryText = text ? text : m.quoted.text;
		if (queryText.length >= 200) return m.reply('Max 200 Length!');

		m.react('⏳');

		try {
			let res = await global.fetchApi('/m/brat', { text: queryText }, { stream: true });
			const isFile = typeof res === 'string' && fs.existsSync(res);
			if (isFile) {
				await voxel.sendAsSticker(m.chat, res, m);
			} else {
				await voxel.sendAsSticker(m.chat, res, m);
			}
			m.react('✅');
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			try {
				let res = await global.fetchApi('/m/brat', { text: queryText }, { stream: true });
				await voxel.sendAsSticker(m.chat, res, m);
				if (typeof global.setLimit === 'function') global.setLimit(m, db);
			} catch (err) {
				console.log(err);
				m.react('❌');
				m.reply(global.mess.fail);
			}
		}
	},
};
