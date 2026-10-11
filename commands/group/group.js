// Command .group -- settings grup (dulu nangkring di switch giant voxel.js).
// Semua nilai WA yang dipakai: announcement/not_announcement, request-participants,
// dan disappearingMessagesInChat (SATUAN DETIK: 90/7/1 hari = 7776000/604800/86400).

const TOGGLES = ['antilink', 'antivirtex', 'antidelete', 'welcome', 'antitoxic', 'waktusholat', 'nsfw', 'antihidetag', 'setinfo', 'antitagsw', 'leave', 'promote', 'demote'];
const TEKS = ['setwelcome', 'setleave', 'setpromote', 'setdemote'];
const HARI = { '90': 7776000, '7': 604800, '1': 86400 };

export default {
	name: 'group',
	aliases: ['grup', 'gc'],

	async execute(ctx) {
		const { m, db, args, prefix, command, voxel } = ctx;
		if (!m.isGroup) return m.reply(global.mess.group)
		if (!m.isAdmin) return m.reply(global.mess.admin)
		if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)

		const set = db.groups[m.chat];
		// Pakai `sub` (sudah lower-case), bukan args[0] mentah -- kalau user ngetik
		// ".group ANTILINK on", key set.ANTILINK bikinan case toggling bakal nyimpen
		// nilai di key yang salah.
		const sub = String(args[0] || '').toLowerCase();
		const nilai = String(args[1] || '').toLowerCase();

		if (sub === 'close' || sub === 'open') {
			// Bandingin args[0] mentah = bug: ".group CLOSE" masuk case 'close' tapi
			// args[0] == 'close' false -> malah MEMBUKA grup.
			const close = sub === 'close';
			await m.reply(global.mess.wait);
			await voxel.groupSettingUpdate(m.chat, close ? 'announcement' : 'not_announcement')
				.then(() => m.reply(`*Sukses ${close ? 'Menutup' : 'Membuka'} Group*`))
				.catch(() => m.reply(global.mess.fail));
			return;
		}

		if (sub === 'join') {
			const list = await voxel.groupRequestParticipantsList(m.chat).then(a => a.map(b => b.jid)).catch(() => []);
			// Regex lama /(a(p|pp|cc)|(ept|rove))|true|ok/i itu nyantol 'a' doang,
			// jadi ".group join hangar" kebaca approve. Wajib di-anchor.
			const approve = /^(acc|accept|approve|true|ok|ya|yes)$/.test(nilai);
			const reject = /^(rej|reject|tolak|false|no)$/.test(nilai);
			if ((!approve && !reject) || !list.length) {
				// join(...).split('@')[0] cuma nyisain nomor participant PERTAMA, sisanya
				// tampil jid lengkap -- bikin daftar request jadi acak-acakan.
				return m.reply(`List Request Join :\n${list.length ? list.map(j => '- @' + j.split('@')[0]).join('\n') : '*Nothing*'}\nExample : ${prefix + command} join acc/reject`);
			}
			await voxel.groupRequestParticipantsUpdate(m.chat, list, approve ? 'approve' : 'reject')
				.then(() => m.reply(`*Sukses ${approve ? 'approve' : 'reject'} ${list.length} request join*`))
				.catch(() => m.reply(global.mess.fail));
			return;
		}

		if (sub === 'pesansementara' || sub === 'disappearing') {
			// Sama kayak 'join': pola /\d|on/i nyantol di tengah kata --
			// "17 hari" ke-parse "7", "nonaktif" ke-parse "on".
			const secs = HARI[nilai];
			if (secs) {
				await m.reply(global.mess.wait);
				await voxel.sendMessage(m.chat, { disappearingMessagesInChat: secs })
					.then(() => m.reply(`*Sukses Set Pesan Sementara ${nilai} hari*`))
					.catch(() => m.reply(global.mess.fail));
				return;
			}
			if (/^(off|false|0)$/.test(nilai)) {
				await m.reply(global.mess.wait);
				await voxel.sendMessage(m.chat, { disappearingMessagesInChat: 0 })
					.then(() => m.reply('*Sukses Menonaktifkan Pesan Sementara*'))
					.catch(() => m.reply(global.mess.fail));
				return;
			}
			return m.reply('Silahkan Pilih :\n90 hari, 7 hari, 1 hari, off');
		}

		if (TOGGLES.includes(sub)) {
			// /on|true/i tanpa anchor nyantol di tengah kata ("nonaktif" contain"on").
			if (/^(on|true|aktif|enable)$/.test(nilai)) {
				if (set[sub]) return m.reply('*Sudah Aktif Sebelumnya*');
				set[sub] = true;
				return m.reply('*Sukses Change To On*');
			}
			if (/^(off|false|nonaktif|disable)$/.test(nilai)) {
				set[sub] = false;
				return m.reply('*Sukses Change To Off*');
			}
			return m.reply(`❗${sub.charAt(0).toUpperCase() + sub.slice(1)} on/off`);
		}

		if (TEKS.includes(sub)) {
			if (!args[1]) return m.reply(`Example:\n${prefix + command} ${sub} Isi Pesannya\n\nMisal Dengan tag:\n${prefix + command} ${sub} Kepada @\nMaka akan Menjadi:\nKepada @0\n\nMisal dengan Tag admin:\n${prefix + command} ${sub} Dari @admin untuk @\nMaka akan Menjadi:\nDari @${m.sender.split('@')[0]} untuk @0\n\nMisal dengan Nama grup:\n${prefix + command} ${sub} Dari @admin untuk @ di @subject\nMaka akan Menjadi:\nDari @${m.sender.split('@')[0]} untuk @0 di ${m.metadata.subject}`, { mentions: ['0@s.whatsapp.net'] });
			set.text ||= {};
			set.text[sub] = args.slice(1).join(' ');
			return m.reply(`Sukses Mengubah ${sub.split('set')[1]} Menjadi:\n${set.text[sub]}`);
		}

		return m.reply(`Settings Group ${m.metadata.subject}
- open / close
- join acc/reject
- disappearing 90/7/1/off
${TOGGLES.map(k => `- ${k} on/off ${set[k] ? '🟢' : '🔴'}`).join('\n')}

${TEKS.map(k => `- ${k} _textnya_`).join('\n')}

Example:
${prefix + command} antilink off

*Fitur terpisah (bukan on/off di sini):*
- ${prefix}bansenyap @orang -- ban tanpa pengumuman (${set.bansenyap?.length || 0} orang aktif)
- ${prefix}bansenyap del @orang
- ${prefix}bansenyap list`);
	},
};