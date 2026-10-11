// Fitur Nikah + Level Pernikahan
// -------------------------------
// Sengaja ditaruh di sini (commands/), BUKAN di voxel.js, biar gampang di-maintain
// terpisah dari file utama yang udah gede. Beberapa "command" (nikah, terimanikah,
// tolaknikah, cerai, nikahinfo, kasihsayang) semuanya didaftarkan sebagai alias dari
// SATU file ini, terus di-dispatch berdasarkan `command` (nama yang beneran diketik
// user) - jadi logic yang berhubungan tetap ngumpul di satu tempat.
//
// Struktur data (disimpan permanen ke database, bukan cuma di memory):
// - db.users[jid].married = { partner, level, exp, since, lastAffection } | null
//   -> disimpan di KEDUA sisi pasangan (cermin satu sama lain).
// - db.game.marriage[targetJid] = { from: proposerJid, at: timestamp }
//   -> lamaran yang masih nunggu jawaban, auto-expire 5 menit.

const PROPOSAL_TIMEOUT = 5 * 60 * 1000; // 5 menit
const AFFECTION_COOLDOWN = 60 * 60 * 1000; // 1 jam
const EXP_PER_AFFECTION_MIN = 10;
const EXP_PER_AFFECTION_MAX = 30;

const expNeeded = (level) => level * 100;

const resolveTarget = (m) => {
	if (m.mentionedJid?.length) return m.mentionedJid[0];
	if (m.quoted?.sender) return m.quoted.sender;
	return null;
};

const ensureUser = (db, jid) => {
	if (!db.users[jid]) db.users[jid] = { limit: 0, money: 0 };
	if (!('married' in db.users[jid])) db.users[jid].married = null;
	return db.users[jid];
};

const formatDuration = (ms) => {
	const days = Math.floor(ms / 86400000);
	const hours = Math.floor(ms / 3600000) % 24;
	const minutes = Math.floor(ms / 60000) % 60;
	if (days > 0) return `${days} hari ${hours} jam`;
	if (hours > 0) return `${hours} jam ${minutes} menit`;
	return `${minutes} menit`;
};

async function propose({ m, voxel, db, prefix, command }) {
	const sender = ensureUser(db, m.sender);
	if (sender.married) {
		return m.reply(`❌ Kamu udah menikah sama @${sender.married.partner.split('@')[0]}!\nCek: ${prefix}nikahinfo`, { mentions: [sender.married.partner] });
	}

	const target = resolveTarget(m);
	if (!target) return m.reply(`Tag/reply orangnya buat ngelamar!\nContoh: ${prefix}${command} @pasangan`);
	if (target === m.sender) return m.reply('❌ Nggak bisa nikah sama diri sendiri wkwk');
	if (target === voxel.decodeJid(voxel.user.id)) return m.reply('❌ Aku bot, nggak bisa dinikahin 😅');

	const targetUser = ensureUser(db, target);
	if (targetUser.married) return m.reply(`❌ Orangnya udah menikah sama orang lain!`);

	db.game.marriage ||= {};
	const existing = db.game.marriage[target];
	if (existing && existing.from === m.sender && Date.now() - existing.at < PROPOSAL_TIMEOUT) {
		return m.reply('⏳ Kamu udah ngelamar orang ini, tungguin jawabannya dulu ya.');
	}

	db.game.marriage[target] = { from: m.sender, at: Date.now() };

	await m.reply(`💌 Lamaran terkirim ke @${target.split('@')[0]}!\nTungguin jawabannya (5 menit) ya.`, { mentions: [target] });
	await voxel.sendMessage(m.chat, {
		text: `💍 @${target.split('@')[0]}, kamu dilamar nikah sama @${m.sender.split('@')[0]}!\n\nKetik *${prefix}terimanikah* buat nerima, atau *${prefix}tolaknikah* buat nolak.\n_Lamaran expired dalam 5 menit._`,
		mentions: [target, m.sender]
	}, { quoted: m });

	setTimeout(() => {
		const still = db.game.marriage?.[target];
		if (still && still.from === m.sender && still.at === db.game.marriage[target]?.at) {
			delete db.game.marriage[target];
		}
	}, PROPOSAL_TIMEOUT);
}

async function accept({ m, voxel, db, prefix }) {
	db.game.marriage ||= {};
	const proposal = db.game.marriage[m.sender];
	if (!proposal) return m.reply('❌ Kamu nggak punya lamaran nikah yang nunggu jawaban.');
	if (Date.now() - proposal.at > PROPOSAL_TIMEOUT) {
		delete db.game.marriage[m.sender];
		return m.reply('❌ Lamarannya udah expired.');
	}

	const proposer = proposal.from;
	const proposerUser = ensureUser(db, proposer);
	const targetUser = ensureUser(db, m.sender);
	if (proposerUser.married) return m.reply('❌ Orang yang ngelamar kamu udah keburu nikah sama orang lain.');
	if (targetUser.married) return m.reply('❌ Kamu udah keburu nikah sama orang lain.');

	const now = Date.now();
	const marriedData = { partner: null, level: 1, exp: 0, since: now, lastAffection: 0 };
	proposerUser.married = { ...marriedData, partner: m.sender };
	targetUser.married = { ...marriedData, partner: proposer };
	delete db.game.marriage[m.sender];

	await voxel.sendMessage(m.chat, {
		text: `🎉💍 *SELAMAT MENIKAH!* 💍🎉\n\n@${proposer.split('@')[0]} ❤️ @${m.sender.split('@')[0]}\n\nSemoga langgeng ya! Naikin level pernikahan pakai *${prefix}kasihsayang*.`,
		mentions: [proposer, m.sender]
	}, { quoted: m });
}

async function reject({ m, voxel, db }) {
	db.game.marriage ||= {};
	const proposal = db.game.marriage[m.sender];
	if (!proposal) return m.reply('❌ Kamu nggak punya lamaran nikah yang nunggu jawaban.');
	delete db.game.marriage[m.sender];
	await voxel.sendMessage(m.chat, {
		text: `💔 @${m.sender.split('@')[0]} nolak lamaran dari @${proposal.from.split('@')[0]}.`,
		mentions: [m.sender, proposal.from]
	}, { quoted: m });
}

async function divorce({ m, voxel, db }) {
	const sender = ensureUser(db, m.sender);
	if (!sender.married) return m.reply('❌ Kamu belum menikah.');
	const partner = sender.married.partner;
	const partnerUser = ensureUser(db, partner);
	sender.married = null;
	if (partnerUser) partnerUser.married = null;
	await voxel.sendMessage(m.chat, {
		text: `💔 @${m.sender.split('@')[0]} resmi cerai sama @${partner.split('@')[0]}.`,
		mentions: [m.sender, partner]
	}, { quoted: m });
}

async function info({ m, db }) {
	const sender = ensureUser(db, m.sender);
	if (!sender.married) return m.reply('❌ Kamu belum menikah. Lamar seseorang pakai *.nikah @orang*');
	const { partner, level, exp, since } = sender.married;
	const need = expNeeded(level);
	await m.reply(
		`💍 *STATUS PERNIKAHAN*\n\n` +
		`👤 Pasangan: @${partner.split('@')[0]}\n` +
		`⭐ Level: ${level}\n` +
		`✨ EXP: ${exp}/${need}\n` +
		`⏳ Lama menikah: ${formatDuration(Date.now() - since)}`,
		{ mentions: [partner] }
	);
}

async function affection({ m, db }) {
	const sender = ensureUser(db, m.sender);
	if (!sender.married) return m.reply('❌ Kamu belum menikah. Lamar seseorang pakai *.nikah @orang*');
	const partner = sender.married.partner;
	const partnerUser = ensureUser(db, partner);
	if (!partnerUser.married || partnerUser.married.partner !== m.sender) {
		// Data nggak sinkron (mis. pasangan udah cerai/nikah lagi tapi punya kamu belum ke-update)
		sender.married = null;
		return m.reply('❌ Status pernikahan kamu udah nggak valid (pasangan udah cerai). Dibatalkan otomatis.');
	}

	const now = Date.now();
	const remaining = AFFECTION_COOLDOWN - (now - (sender.married.lastAffection || 0));
	if (remaining > 0) return m.reply(`⏳ Tunggu ${formatDuration(remaining)} lagi buat kasih sayang lagi ya.`);

	const gainedExp = Math.floor(Math.random() * (EXP_PER_AFFECTION_MAX - EXP_PER_AFFECTION_MIN + 1)) + EXP_PER_AFFECTION_MIN;
	sender.married.exp += gainedExp;
	partnerUser.married.exp = sender.married.exp;
	sender.married.lastAffection = now;
	partnerUser.married.lastAffection = now;

	let leveledUp = false;
	while (sender.married.exp >= expNeeded(sender.married.level)) {
		sender.married.exp -= expNeeded(sender.married.level);
		sender.married.level += 1;
		partnerUser.married.level = sender.married.level;
		partnerUser.married.exp = sender.married.exp;
		leveledUp = true;
	}

	sender.money = (sender.money || 0) + 2000;
	partnerUser.money = (partnerUser.money || 0) + 2000;

	let text = `💕 @${m.sender.split('@')[0]} kasih sayang ke @${partner.split('@')[0]}! +${gainedExp} EXP`;
	if (leveledUp) text += `\n\n🎉 *LEVEL UP!* Pernikahan kalian sekarang Level ${sender.married.level}!`;
	await m.reply(text, { mentions: [m.sender, partner] });
}

export default {
	name: 'nikah',
	aliases: ['marry', 'terimanikah', 'accnikah', 'tolaknikah', 'rejectnikah', 'cerai', 'divorce', 'nikahinfo', 'infonikah', 'kasihsayang', 'mesra'],

	async execute(ctx) {
		ctx.db.game ||= {};
		ctx.db.game.marriage ||= {};
		switch (ctx.command) {
			case 'nikah':
			case 'marry':
				return propose(ctx);
			case 'terimanikah':
			case 'accnikah':
				return accept(ctx);
			case 'tolaknikah':
			case 'rejectnikah':
				return reject(ctx);
			case 'cerai':
			case 'divorce':
				return divorce(ctx);
			case 'nikahinfo':
			case 'infonikah':
				return info(ctx);
			case 'kasihsayang':
			case 'mesra':
				return affection(ctx);
		}
	}
};
