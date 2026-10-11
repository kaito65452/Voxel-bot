export default {
	name: 'susunkata',
	aliases: [],

	async execute(ctx) {
		const { m, db, text, prefix, command, isLimit, voxel } = ctx;
		const susunkata = db.game?.susunkata || {};

		if (global.iGame && global.iGame(susunkata, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!');
		if (!isLimit) return m.reply(global.mess.limit);
		if (!text) {
			const { data: hasil } = await global.fetchApi('/games/susunkata');
			let { key } = await m.reply(`🎮 Susun Kata Berikut :\n\n${hasil.soal}\nTipe : ${hasil.tipe}\n\nWaktu : 60s\nHadiah *+2989*`);
			susunkata[m.chat + key.id] = { jawaban: hasil.jawaban.toLowerCase(), id: key.id };
			await global.sleep(60000);
			if (global.rdGame && global.rdGame(susunkata, m.chat, key.id)) {
				m.reply('Waktu Habis\nJawaban: ' + susunkata[m.chat + key.id].jawaban);
				delete susunkata[m.chat + key.id];
			}
			return;
		}

		return m.reply(`Example: ${prefix + command}`);
	},
};
