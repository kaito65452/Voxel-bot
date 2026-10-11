import { addQuote, deleteQuote, loadQuotes, pickWeightedQuote } from '../../lib/quotes.js';

async function sendMotivasi(ctx) {
	const { m, prefix } = ctx;
	const quotes = loadQuotes('motivasi');
	if (!quotes.length) return m.reply(`❌ Database quotes motivasi masih kosong.\n\nTambah dulu pakai: *${prefix}addmotivasi <kalimat>*`);
	const quote = pickWeightedQuote('motivasi', quotes);
	return m.reply(`🌱 *${quote}*`);
}

async function listMotivasi(ctx) {
	const { m, isCreator, prefix } = ctx;
	if (!isCreator) return m.reply(`❌ ${global.mess?.owner || 'Khusus Owner!'}\n\nMau hubungi owner beneran? Ketik *${prefix}owner*`);

	const quotes = loadQuotes('motivasi');
	if (!quotes.length) return m.reply('📭 Database quotes motivasi masih kosong.');

	const text = `🌱 *Daftar Quotes Motivasi (${quotes.length})*\n\n` +
		quotes.map((q, i) => `${i}. ${q}`).join('\n\n') +
		`\n\nHapus: *${prefix}delmotivasi <nomor>*`;
	return m.reply(text);
}

async function addMotivasi(ctx) {
	const { m, text, isCreator, prefix, command } = ctx;
	if (!isCreator) return m.reply(`❌ ${global.mess?.owner || 'Khusus Owner!'}\n\nMau hubungi owner beneran? Ketik *${prefix}owner*`);
	if (!text) return m.reply(`Contoh: *${prefix}${command} Jangan berhenti cuma karena lelah*`);

	try {
		const total = addQuote('motivasi', text);
		return m.reply(`✅ Kalimat motivasi baru ditambahkan!\nTotal sekarang: *${total}* kalimat.`);
	} catch (e) {
		return m.reply(`❌ ${e.message}`);
	}
}

async function delMotivasi(ctx) {
	const { m, args, isCreator, prefix, command } = ctx;
	if (!isCreator) return m.reply(`❌ ${global.mess?.owner || 'Khusus Owner!'}\n\nMau hubungi owner beneran? Ketik *${prefix}owner*`);

	const index = parseInt(args[0]);
	if (isNaN(index)) return m.reply(`Contoh: *${prefix}${command} 0*\n\nLihat nomornya lewat *${prefix}listmotivasi* dulu.`);

	try {
		const removed = deleteQuote('motivasi', index);
		return m.reply(`🗑️ Dihapus: "${removed}"`);
	} catch (e) {
		return m.reply(`❌ ${e.message}`);
	}
}

export default {
	name: 'motivasi',
	aliases: ['motivation', 'katamotivasi', 'listmotivasi', 'motivasilist', 'addmotivasi', 'tambahmotivasi', 'delmotivasi', 'hapusmotivasi'],

	async execute(ctx) {
		const { command } = ctx;

		switch (command) {
			case 'listmotivasi':
			case 'motivasilist':
				return listMotivasi(ctx);
			case 'addmotivasi':
			case 'tambahmotivasi':
				return addMotivasi(ctx);
			case 'delmotivasi':
			case 'hapusmotivasi':
				return delMotivasi(ctx);
			case 'motivasi':
			case 'motivation':
			case 'katamotivasi':
			default:
				return sendMotivasi(ctx);
		}
	},
};
