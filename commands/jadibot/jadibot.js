import QRCode from 'qrcode';
import { parsePhoneNumber } from 'awesome-phonenumber';
import { checkStatus } from '../../src/database.js';
import {
	startJadibotSession,
	listJadibotSessions,
	sanitizeNumber,
	stopJadibotSession,
} from '../../src/jadibot.js';

async function listJadibot(ctx) {
	const { m, isCreator } = ctx;

	if (!isCreator) return m.reply(global.mess?.owner || 'Khusus Owner!');
	await m.react('✅').catch(() => {});

	const list = listJadibotSessions();
	if (!list.length) return m.reply('📭 Belum ada sesi Jadibot yang aktif.');

	const text = `🤖 *Sesi Jadibot Aktif (${list.length})*\n\n` + list.map((entry, i) => {
		const since = entry.connectedAt ? `terhubung sejak ${new Date(entry.connectedAt).toLocaleString('id-ID')}` : 'sedang menghubungkan...';
		const by = entry.requesterJid ? ` — dibuat oleh @${entry.requesterJid.split('@')[0]}` : '';
		return `${i + 1}. wa.me/${entry.number} (${since})${by}`;
	}).join('\n');

	return m.reply(text, { mentions: list.map((e) => e.requesterJid).filter(Boolean) });
}

async function stopJadibot(ctx) {
	const { m, voxel, args, isCreator } = ctx;

	if (voxel.isJadibot) {
		if (!isCreator) return m.reply('❌ Cuma pemilik nomor Jadibot ini yang boleh mematikannya.');
		await m.react('✅').catch(() => {});
		await m.reply('📴 Oke, mematikan sesi Jadibot ini...');
		await stopJadibotSession(voxel.jadibotNumber);
		return;
	}

	if (!isCreator) return m.reply(global.mess?.owner || 'Khusus Owner!');

	const number = sanitizeNumber(args[0]);
	if (!number) return m.reply('❌ Masukkan nomor Jadibot yang mau dimatikan.\nContoh: *.delbot 628xxxxxxxxxx*');

	const ok = await stopJadibotSession(number);
	if (!ok) {
		await m.react('❌').catch(() => {});
		return m.reply(`❌ Tidak ditemukan sesi Jadibot aktif untuk nomor *${number}*.`);
	}
	await m.react('✅').catch(() => {});
	return m.reply(`✅ Sesi Jadibot *${number}* berhasil dimatikan.`);
}

async function startJadibot(ctx) {
	const { m, voxel, db, args, command, prefix, isCreator } = ctx;

	if (voxel.isJadibot) {
		await m.react('❌').catch(() => {});
		const mainBotNumber = voxel.decodeJid(voxel.user.id).split('@')[0];
		return m.reply(`❌ Perintah ini cuma bisa dipakai lewat bot utama, bukan dari sesi Jadibot ini.\n\nChat bot utama: https://wa.me/${mainBotNumber}`);
	}

	if (global.jadibotMode === false) {
		await m.react('❌').catch(() => {});
		return m.reply('❌ Fitur Jadibot sedang dinonaktifkan oleh owner.');
	}

	if (global.jadibotOwnerOnly && !isCreator) {
		await m.react('❌').catch(() => {});
		return m.reply('❌ Fitur Jadibot saat ini dibatasi khusus owner.');
	}

	const isPremiumUser = isCreator || checkStatus(m.sender, db.premium || []);
	if (global.jadibotPremiumOnly && !isPremiumUser) {
		await m.react('❌').catch(() => {});
		return m.reply('❌ Fitur Jadibot saat ini dibatasi khusus member *Premium* (dan owner).\n\nHubungi owner buat upgrade ke Premium ya.');
	}

	const limit = global.jadibotLimit ?? 50;
	if (!isCreator && listJadibotSessions().length >= limit) {
		await m.react('❌').catch(() => {});
		return m.reply(`❌ Slot Jadibot lagi penuh (maks ${limit} sesi aktif). Coba lagi nanti ya.`);
	}

	const rawNumber = (args[0] || '').replace(/[^0-9]/g, '');
	const useQr = !rawNumber;
	const number = useQr ? sanitizeNumber(m.sender.split('@')[0]) : sanitizeNumber(rawNumber);
	const mainBotNumber = sanitizeNumber(voxel.decodeJid(voxel.user.id).split('@')[0]);

	if (number === mainBotNumber) {
		await m.react('❌').catch(() => {});
		return m.reply(`❌ Nomor *${number}* itu nomor bot utama sendiri, jadi tidak perlu di-Jadibot-kan — semua fiturnya sudah otomatis aktif di sini.`);
	}

	if (!useQr) {
		const parsed = parsePhoneNumber('+' + number);
		if (!parsed.valid) {
			await m.react('❌').catch(() => {});
			return m.reply(`❌ Nomor tidak valid.\n\nContoh: *${prefix}${command} 628xxxxxxxxxx*\nAtau ketik *${prefix}${command}* saja (tanpa nomor) buat pakai QR Code.`);
		}
	}

	if (global.jadibots?.has(number)) {
		await m.react('❌').catch(() => {});
		return m.reply('❌ Nomor ini sudah punya sesi Jadibot aktif. Ketik *.delbot* dari chat Jadibot itu dulu kalau mau mengulang dari awal.');
	}

	await m.react('⏳').catch(() => {});
	await m.reply(useQr ? '🔄 Menyiapkan QR Code, tunggu sebentar...' : `🔄 Meminta kode pairing untuk *${number}*, tunggu sebentar...`);

	try {
		await startJadibotSession({
			number,
			mode: useQr ? 'qr' : 'pairing',
			requesterJid: m.sender,
			onCode: async (type, code) => {
				try {
					if (type === 'pairing') {
						await m.react('✅').catch(() => {});
						await voxel.sendMessage(m.chat, {
							text: `🔑 *Kode Pairing Jadibot*\n\n*${code}*\n\nBuka WhatsApp di HP nomor *${number}* → Perangkat Tertaut → Tautkan dengan nomor telepon, lalu masukkan kode di atas.\n\n_Kode berlaku sekitar 60 detik, kalau expired ketik ulang perintahnya._`,
						}, { quoted: m });
					} else {
						await m.react('✅').catch(() => {});
						const qrBuffer = await QRCode.toBuffer(code, { width: 512, margin: 1 });
						await voxel.sendMessage(m.chat, {
							image: qrBuffer,
							caption: '📷 Scan QR ini pakai WhatsApp di HP yang mau dijadikan Jadibot (Perangkat Tertaut → Tautkan Perangkat).\n\n_QR ini cuma berlaku sebentar, kalau keburu kedaluwarsa ketik ulang perintahnya._',
						}, { quoted: m });
					}
				} catch (e) {
					await m.react('❌').catch(() => {});
					console.log('[JADIBOT] Gagal kirim kode ke chat:', e?.message || e);
				}
			},
			onStatus: async (status, info) => {
				try {
					if (status === 'open') {
						await m.react('✅').catch(() => {});
						await voxel.sendMessage(m.chat, {
							text: `✅ Jadibot untuk *${number}* berhasil terhubung!\n\nNomor itu sekarang jadi bot pribadi buat kamu, dengan fitur yang sama persis seperti bot utama. Ketik *.menu* dari chat pribadinya buat lihat fiturnya, dan *.delbot* kapan aja kalau mau mematikannya.`,
						}, { quoted: m });
					} else if (status === 'logged-out') {
						await m.react('✅').catch(() => {});
						await voxel.sendMessage(m.chat, { text: `📴 Sesi Jadibot *${number}* logout / dihentikan.` }, { quoted: m }).catch(() => {});
					} else if (status === 'failed') {
						await m.react('❌').catch(() => {});
						await voxel.sendMessage(m.chat, { text: `❌ Gagal menghubungkan Jadibot *${number}*.${info ? `\nAlasan: ${info}` : ''}` }, { quoted: m }).catch(() => {});
					}
				} catch (e) {}
			},
		});
	} catch (e) {
		await m.react('❌').catch(() => {});
		await m.reply(`❌ Gagal membuat Jadibot: ${e.message}`);
	}
}

export default {
	name: 'jadibot',
	aliases: ['listjadibot', 'delbot', 'stopbot', 'serbot', 'jadibotlist', 'listserbot', 'unjadibot'],

	async execute(ctx) {
		const { command } = ctx;

		switch (command) {
			case 'listjadibot':
			case 'jadibotlist':
			case 'listserbot':
				return listJadibot(ctx);
			case 'delbot':
			case 'stopbot':
			case 'unjadibot':
				return stopJadibot(ctx);
			case 'jadibot':
			case 'serbot':
			default:
				return startJadibot(ctx);
		}
	},
};
