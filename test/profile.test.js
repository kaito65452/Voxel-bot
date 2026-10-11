// Self-check .profile: format harus PERSIS kayak template, dan TIDAK BOLEH ada
// string "undefined"/"null"/"NaN" di output -- termasuk buat user yang datanya
// belum pernah keisi sama sekali.
// Jalankan: node test/profile.test.js   (tanpa npm install)
import assert from 'node:assert';
import profile from '../commands/info/info.js';

const run = async (users, args = []) => {
	let out = null;
	const m = { sender: '628xx@s.whatsapp.net', pushName: 'Push', reply: (t) => { out = t; } };
	const voxel = {
		profilePictureUrl: async () => 'https://i.pravatar.cc/500',
		// .profile sekarang kirim kartu gambar (image + caption), bukan teks polos.
		sendMessage: async (_chat, c) => { out = c.caption || c.text; }
	};
	await profile.execute({ command: 'profile', prefix: '.', args, isCreator: false, m, voxel, db: { users: { '628xx@s.whatsapp.net': users } } });
	return out;
};

// 1) User kosong total -> semua fallback aman, tidak ada undefined/null/NaN.
const kosong = await run({});
for (const bad of ['undefined', 'null', 'NaN']) assert.ok(!kosong.includes(bad), `bocor "${bad}":\n${kosong}`);
assert.ok(kosong.startsWith('[ 👤 INFO ]\nNama : -'), kosong);
assert.ok(kosong.includes('Peran : User'), kosong);
assert.ok(kosong.includes('Level : 1 (0 / 100 XP)'), kosong);
assert.ok(kosong.includes('Status : Offline'), kosong);
assert.ok(kosong.includes('Premium : Tidak'), kosong);
assert.ok(kosong.includes('Badge system: Incoming'), kosong);
assert.ok(kosong.endsWith('[ 🕊️ BIO ]\n-'), kosong);

// 2) Data terisi -> semua field terpakai, badge tetap teks murni.
const isi = await run({
	name: 'Saryu', gender: 'Laki-laki', age: 20, bio: 'Halo dunia',
	role: 'User', level: 3, xp: 40, xpRequired: 300, premium: true,
	chatCount: 12, commandCount: 7, lastCommand: 'tiktok',
	createdAt: '2026-01-02T03:04:05.000Z', lastSeen: new Date().toISOString(),
	badges: []
});
for (const baris of [
	'Nama : Saryu', 'Gender : Laki-laki', 'Umur : 20', 'Prefix : .',
	'Peran : User', 'Level : 3 (40 / 300 XP)', 'Status : Online', 'Premium : Aktif',
	'Chat : 12', 'Cmds : 7', 'LastCmd : tiktok'
]) assert.ok(isi.includes(baris), `hilang: ${baris}\n${isi}`);
assert.ok(isi.includes('Join : ') && !isi.includes('Join : -'), isi);
assert.ok(isi.includes('Badge system: Incoming'), isi);
assert.ok(isi.trimEnd().endsWith('Halo dunia'), isi);

// 3) Cuma 4 field yang boleh diubah user.
const u = {};
let out;
const m = { sender: 'x@s.whatsapp.net', reply: (t) => { out = t; } };
const db = { users: { 'x@s.whatsapp.net': u } };
for (const [sub, nilai] of [['setname', 'Saryu'], ['setgender', 'pria'], ['setage', '20'], ['setbio', 'Halo dunia']]) {
	out = null;
	await profile.execute({ command: 'profile', prefix: '.', args: [sub, nilai], isCreator: false, m, db });
	assert.match(out, /^✅ /, out);
}
assert.strictEqual(u.name, 'Saryu');
assert.strictEqual(u.gender, 'Laki-laki');
assert.strictEqual(u.age, 20);
assert.strictEqual(u.bio, 'Halo dunia');
assert.ok(!('level' in u) && !('xp' in u) && !('badges' in u), 'cuma 4 field yang boleh ditulis user');

// 4) Input ngah/NTGB harus ditolak, bukan tersimpan.
out = null;
await profile.execute({ command: 'profile', prefix: '.', args: ['setage', '999'], isCreator: false, m, db });
assert.match(out, /1-120/, out);
assert.strictEqual(u.age, 20);

console.log('OK: .profile (format + fallback + edit 4 field)');