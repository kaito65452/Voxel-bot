import { addQuote, deleteQuote, loadQuotes, pickWeightedQuote } from '../../lib/quotes.js';

async function sendBucin(ctx) {
	const { m, prefix } = ctx;
	const quotes = loadQuotes('bucin');
	if (!quotes.length) return m.reply(`❌ Database quotes bucin masih kosong.\n\nTambah dulu pakai: *${prefix}addbucin <kalimat>*`);
	const quote = pickWeightedQuote('bucin', quotes);
	return m.reply(`💌 *${quote}*`);
}

async function listBucin(ctx) {
	const { m, isCreator, prefix } = ctx;
	if (!isCreator) return m.reply(`❌ ${global.mess?.owner || 'Khusus Owner!'}\n\nMau hubungi owner beneran? Ketik *${prefix}owner*`);

	const quotes = loadQuotes('bucin');
	if (!quotes.length) return m.reply('📭 Database quotes bucin masih kosong.');

	const text = `💌 *Daftar Quotes Bucin (${quotes.length})*\n\n` +
		quotes.map((q, i) => `${i}. ${q}`).join('\n\n') +
		`\n\nHapus: *${prefix}delbucin <nomor>*`;
	return m.reply(text);
}

async function addBucin(ctx) {
	const { m, text, isCreator, prefix, command } = ctx;
	if (!isCreator) return m.reply(`❌ ${global.mess?.owner || 'Khusus Owner!'}\n\nMau hubungi owner beneran? Ketik *${prefix}owner*`);
	if (!text) return m.reply(`Contoh: *${prefix}${command} Aku kangen kamu tiap detik, kamu tau?*`);

	try {
		const total = addQuote('bucin', text);
		return m.reply(`✅ Kalimat bucin baru ditambahkan!\nTotal sekarang: *${total}* kalimat.`);
	} catch (e) {
		return m.reply(`❌ ${e.message}`);
	}
}

async function delBucin(ctx) {
	const { m, args, isCreator, prefix, command } = ctx;
	if (!isCreator) return m.reply(`❌ ${global.mess?.owner || 'Khusus Owner!'}\n\nMau hubungi owner beneran? Ketik *${prefix}owner*`);

	const index = parseInt(args[0]);
	if (isNaN(index)) return m.reply(`Contoh: *${prefix}${command} 0*\n\nLihat nomornya lewat *${prefix}listbucin* dulu.`);

	try {
		const removed = deleteQuote('bucin', index);
		return m.reply(`🗑️ Dihapus: "${removed}"`);
	} catch (e) {
		return m.reply(`❌ ${e.message}`);
	}
}

export default {
	name: 'bucin',
	aliases: ['gombalan', 'gombal', 'listbucin', 'bucinlist', 'addbucin', 'tambahbucin', 'delbucin', 'hapusbucin'],

	async execute(ctx) {
		const { command } = ctx;

		switch (command) {
			case 'listbucin':
			case 'bucinlist':
				return listBucin(ctx);
			case 'addbucin':
			case 'tambahbucin':
				return addBucin(ctx);
			case 'delbucin':
			case 'hapusbucin':
				return delBucin(ctx);
			case 'bucin':
			case 'gombalan':
			case 'gombal':
			default:
				return sendBucin(ctx);
		}
	},
};
