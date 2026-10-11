import { CommandIndex } from '../../lib/command-loader.js';

async function ownerCommand(ctx) {
	const { m, voxel } = ctx;
	const botNumber = voxel.decodeJid(voxel.user.id).split('@')[0];
	const ownerNumber = [...new Set([...(global.owner || []), botNumber])];
	return voxel.sendContact(m.chat, ownerNumber, m);
}

// Command .profile: nampilin profil user + nge-ubah 4 field yang memang
// boleh diubah user sendiri (name/gender/age/bio). Semua key lain read-only.
const FIELDS = { setname: 'name', setgender: 'gender', setage: 'age', setbio: 'bio' };
const LIMITS = { name: 25, gender: 15, age: 3, bio: 200 };

// Anti "undefined/null/NaN" bocor ke output teks WA.
const val = (v, fallback = '-') => {
	const s = v === undefined || v === null ? '' : String(v).trim();
	return !s || s === 'undefined' || s === 'null' || s === 'NaN' ? fallback : s;
};
const waktu = (v) => {
	const d = new Date(v);
	return isNaN(d.getTime()) ? '-' : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

// "L"/"P"/"pria"/"wanita"/ngasal -> Laki-laki/Perempuan, sisanya '-'.
function normGender(raw) {
	const g = String(raw).toLowerCase();
	if (/^(l|pria|laki|laki-laki|man|cowok)$/.test(g) || g.startsWith('laki')) return 'Laki-laki';
	if (/^(p|wanita|perempuan|cewek)$/.test(g) || g.startsWith('perem')) return 'Perempuan';
	return '-';
}

async function profileCommand(ctx) {
	const { m, db, prefix, isCreator, args, voxel } = ctx;
	const user = db.users[m.sender] || (db.users[m.sender] = {});

	const sub = String(args[0] || '').toLowerCase();
	const value = args.slice(1).join(' ').trim();
	if (FIELDS[sub]) {
		if (!value) return m.reply(`Usage: ${prefix}profile ${sub} <isi>\n\nsetname  : Nama (max ${LIMITS.name} karakter)\nsetgender: Laki-laki / Perempuan / -\nsetage   : Umur (angka 1-120)\nsetbio   : Bio (max ${LIMITS.bio} karakter)`);
		if (value.length > LIMITS[FIELDS[sub]]) return m.reply(`Maksimal ${LIMITS[FIELDS[sub]]} karakter!`);
		if (sub === 'setage' && (!/^\d{1,3}$/.test(value) || +value < 1 || +value > 120)) return m.reply('Umur harus angka 1-120!');
		if (sub === 'setgender') return m.reply(`✅ Gender diubah: ${user.gender = normGender(value)}`);
		user[FIELDS[sub]] = sub === 'setage' ? +value : value;
		return m.reply(`✅ ${FIELDS[sub]} diubah: ${user[FIELDS[sub]]}`);
	}

	const online = Date.now() - new Date(user.lastSeen).getTime() < 5 * 60 * 1000;
	let avatarUrl;
  try {
    avatarUrl = await voxel.profilePictureUrl(m.sender, 'image');
  } catch (e) {
    avatarUrl = 'https://i.pravatar.cc/500'; // fallback kalau foto profil private/kosong, ganti sesuai selera
  }

  return voxel.sendMessage(m.chat, {
    image: { url: avatarUrl },
    caption: `[ 👤 INFO ]
Nama : ${val(user.name)}
Gender : ${val(user.gender)}
Umur : ${val(user.age)}
Prefix : ${val(prefix)}

[ 🏷️ STATUS ]
Peran : ${val(user.role, 'User')}
Level : ${val(user.level || 1, '1')} (${val(user.xp || 0, '0')} / ${val(user.xpRequired || 100, '100')} XP)
Status : ${online ? 'Online' : 'Offline'}
Premium : ${user.premium || isCreator ? 'Aktif' : 'Tidak'}

[ 💬 AKTIVITAS ]
Chat : ${val(user.chatCount || 0, '0')}
Cmds : ${val(user.commandCount || 0, '0')}
LastCmd : ${val(user.lastCommand)}
Join : ${waktu(user.createdAt)}
LastSeen : ${waktu(user.lastSeen)}

[ 🎖️ BADGE ]
Badge system: Incoming

[ 🕊️ BIO ]
${val(user.bio)}`
  }, { quoted: m });
}

async function leaderboardCommand(ctx) {
	const { m, db } = ctx;
	const entries = Object.entries(db.users).sort((a, b) => b[1].money - a[1].money).slice(0, 10).map(entry => entry[0]);
	let teksnya = '╭──❍「 *LEADERBOARD* 」❍\n';
	for (let i = 0; i < entries.length; i++) {
		teksnya += `│• ${i + 1}. @${entries[i].split('@')[0]}\n│• Balance : ${db.users[entries[i]].money.toLocaleString('id-ID')}\n│\n`;
	}
	return m.reply(teksnya + '╰──────❍');
}

async function requestCommand(ctx) {
	const { m, text, voxel } = ctx;
	if (!text) return m.reply('Mau Request apa ke Owner?');
	await m.reply(`*Request Telah Terkirim Ke Owner*\n_Terima Kasih🙏_`);
	const ownerNumber = [...new Set([...(global.owner || []), voxel.decodeJid(voxel.user.id).split('@')[0]])];
	return voxel.sendFromOwner(ownerNumber[0], `Pesan Dari : @${m.sender.split('@')[0]}\nUntuk Owner\n\nRequest ${text}`, m, { contextInfo: { mentionedJid: [m.sender], isForwarded: true }});
}

async function totalFiturCommand(ctx) {
	const { m } = ctx;
	const legacyCases = Array.isArray(global.db?.cases) ? global.db.cases : [];
	const registryKeys = Array.from(CommandIndex.keys());
	const uniqueKeys = new Set(
		[...legacyCases, ...registryKeys]
			.map((key) => String(key).trim().toLowerCase())
			.filter(Boolean)
	);
	return m.reply(`Total Fitur : ${uniqueKeys.size}`);
}

export default {
	name: 'info',
	aliases: ['owner', 'listowner', 'profile', 'cek', 'leaderboard', 'req', 'request', 'totalfitur'],

	async execute(ctx) {
		const { command } = ctx;
		switch (command) {
			case 'owner':
			case 'listowner':
				return ownerCommand(ctx);
			case 'profile':
			case 'cek':
				return profileCommand(ctx);
			case 'leaderboard':
				return leaderboardCommand(ctx);
			case 'req':
			case 'request':
				return requestCommand(ctx);
			case 'totalfitur':
				return totalFiturCommand(ctx);
			default:
				return null;
		}
	},
};
