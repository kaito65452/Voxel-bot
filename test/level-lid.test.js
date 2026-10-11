// Self-check: level/XP (src/database.js) + resolver lid->jid (src/message.js).
// Jalankan: node test/level-lid.test.js   (tanpa npm install)
//
// addXp & friends dipakai BENERAN dari file sumber (bukan implementasi ulang di
// test ini, yang bisa "cocok sendiri" sama kode yang lagi dites). Dipanggil lewat
// new Function karena src/database.js & src/message.js import mongoose/axios yang
// belum terpasang.
import assert from 'node:assert';
import fs from 'node:fs';

// Ambil deklarasi `nama` apa adanya dari file sumber, lalu eval jadi fungsi nyata.
// `deps` = fungsi lain dari file yang sama yang jadi rujukan di dalamnya.
// Batas body dicari dengan hitung kurung kurawal (bukan regexending baris),
// jadi aman untuk kode yang closing brace-nya nggak di kolom 0.
function muat(file, nama, deps = {}) {
	const lines = fs.readFileSync(new URL(file, import.meta.url), 'utf8').split('\n');
	const i = lines.findIndex(l => new RegExp(`(const|function|async function)\\s+${nama}\\b`).test(l));
	assert.ok(i >= 0, `${nama} nggak ketemu di ${file}`);
	let depth = 0, end = i;
	for (let j = i; j < lines.length; j++) {
		depth += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length;
		if (depth <= 0) { end = j; break }
	}
	// `const NAME = ...` -> `var NAME = ...` (biar bisa di-return), kalau function
	// declaration udah langsung sah nggak perlu disentuh.
	const guts = lines.slice(i, end + 1).join('\n')
		.replace(new RegExp(`^(\\s*)export\\s+`), '$1')
		.replace(new RegExp(`^(\\s*)(async\\s+)?const\\s+${nama}\\b`), '$1var ' + nama);
	const keys = Object.keys(deps);
	return new Function(...keys, `${guts}; return ${nama}`)(...keys.map(k => deps[k]));
}

// --- XP & level --------------------------------------------------------------
const xpRequired = muat('../src/database.js', 'xpRequired');
const addXp = muat('../src/database.js', 'addXp', { xpRequired });
const U = '628@s.whatsapp.net';
const newDb = (u = {}) => ({ users: { [U]: { name: 'U', level: 1, xp: 0, xpRequired: 100, ...u } } });

// 1) XP ngumpulin, level naik, sisa XP pindah ke level baru (100 buat L2, sisa 150).
let db = newDb();
addXp(U, db, 250);
assert.deepEqual(
	{ level: db.users[U].level, xp: db.users[U].xp, xpRequired: db.users[U].xpRequired },
	{ level: 2, xp: 150, xpRequired: 200 }
);
// Kalau XP-nya cukup buat beberapa level naik sekaligus, while-nya harus lanjut (bukan if):
// 700 XP = 100 (L2) + 200 (L3) + 300 (L4), sisa 100.
db = newDb();
addXp(U, db, 700);
assert.strictEqual(db.users[U].level, 4);
assert.strictEqual(db.users[U].xp, 100);
assert.ok(db.users[U].xp < db.users[U].xpRequired, 'sisa XP harus di bawah xpRequired');

// 2) XP kecil ngumpulin sendiri, level nggak lompat.
db = newDb();
for (let i = 0; i < 9; i++) addXp(U, db, 10);
assert.strictEqual(db.users[U].level, 1);
assert.strictEqual(db.users[U].xp, 90);

// 3) Kebutuhan XP harus naik seiring level (grinding chat XP tethered).
db = newDb();
for (let lv = 1; lv < 12; lv++) {
	assert.strictEqual(db.users[U].xpRequired, xpRequired(lv), `xpRequired level ${lv}`);
	addXp(U, db, db.users[U].xpRequired);
}
assert.strictEqual(db.users[U].level, 12);

// 4) Data user lama tanpa field profil, dan user yang nggak ada -> nggak crash.
db = newDb(); db.users[U] = { name: 'Lama' };
addXp(U, db, 10);
assert.strictEqual(db.users[U].xp, 10);
assert.strictEqual(addXp('tidak-ada@s.whatsapp.net', db, 10), null);

// 5) Hook XP di titik temu game (setLimit) + blok tracking chat/command voxel.js.
const gameSrc = fs.readFileSync(new URL('../lib/game.js', import.meta.url), 'utf8');
assert.match(gameSrc, /const setLimit = [\s\S]*?addXp\(m\.sender, db, 25\)/, 'setLimit (titik temu game) nggak kasih XP');
const voxelSrc = fs.readFileSync(new URL('../voxel.js', import.meta.url), 'utf8');
assert.match(voxelSrc, /addXp\(m\.sender, global\.db, m\.isGroup \? 2 : 10\)/, 'blok tracking profil nggak kasih XP chat/command');
assert.match(voxelSrc, /import \{ cmdAdd, cmdAddHit, addExpired, addXp,/, 'addXp belum di-import di voxel.js');

// --- Resolver lid -> jid -----------------------------------------------------
const linkLidToPhone = muat('../src/message.js', 'linkLidToPhone');
const isLid = muat('../src/message.js', 'isLid');
const isPn = muat('../src/message.js', 'isPn');
const rememberFromPeta = muat('../src/message.js', 'rememberFromPeta', { isLid, isPn });
const rememberLidPair = muat('../src/message.js', 'rememberLidPair', { linkLidToPhone, isLid, isPn });
const jedaAntarGrup = muat('../src/message.js', 'jedaAntarGrup');
const normalizeLidParticipants = muat('../src/message.js', 'normalizeLidParticipants', {
	linkLidToPhone, isLid, isPn, rememberFromPeta, rememberLidPair,
});

const LID = '111111@lid', PN = '62811@s.whatsapp.net';

// Bentuk 1 (paling sering): id = @lid, phoneNumber = nomorHp.
global.db = { users: {}, lidMap: {} };
let store = { groupMetadata: { 'g@g.us': { participants: [{ id: LID, phoneNumber: PN, admin: null }] } } };
let st = normalizeLidParticipants(store);
assert.strictEqual(st.mapped, 1);
assert.strictEqual(global.db.lidMap[LID], PN);
assert.strictEqual(store.groupMetadata['g@g.us'].participants[0].phoneNumber, PN, 'phoneNumber participant nggak keisi');

// Bentuk 2: id = nomorHp, lid ada di field terpisah.
global.db = { users: {}, lidMap: {} };
normalizeLidParticipants({ groupMetadata: { 'g@g.us': { participants: [{ id: PN, lid: LID }] } } });
assert.strictEqual(global.db.lidMap[LID], PN);

// Bentuk 3: participant@yatim (cuma @lid, belum terpetakan) -- minimal nggak boleh
// damaging: .tagall/.hidetag/.totag semuanya mem.read participant.phoneNumber.
global.db = { users: {}, lidMap: {} };
store = { groupMetadata: { 'g@g.us': { participants: [{ id: '999@lid' }] } } };
normalizeLidParticipants(store);
const orphan = store.groupMetadata['g@g.us'].participants[0];
assert.ok(orphan.id && orphan.phoneNumber, 'participant yatim harus tetap punya id + phoneNumber');

// store.contacts juga sumber mapping (diisi Serialize tiap pesan masuk).
global.db = { users: {}, lidMap: {} };
normalizeLidParticipants({ contacts: { [LID]: { id: LID, phoneNumber: PN, name: 'Budi' } }, groupMetadata: {} });
assert.strictEqual(global.db.lidMap[LID], PN);

// Baris user yang nyangkut di key @lid harus digabung ke nomorHp (leaderboard dobel).
global.db = { users: { [LID]: { limit: 5, money: 1000, name: 'Budi' }, [PN]: { limit: 2, money: 0, name: 'Budi' } }, lidMap: {} };
store = { groupMetadata: { 'g@g.us': { participants: [{ id: LID, phoneNumber: PN }] } } };
normalizeLidParticipants(store);
assert.ok(!global.db.users[LID], 'key user @lid belum kebuang');
assert.strictEqual(global.db.users[PN].limit, 5);
assert.strictEqual(global.db.users[PN].money, 1000);

// Idempotent: dipanggil 2x nggak nambah mapping baru & nggak damage apa pun.
global.db = { users: {}, lidMap: {} };
store = { groupMetadata: { 'g@g.us': { participants: [{ id: LID, phoneNumber: PN }] } } };
normalizeLidParticipants(store);
const kedua = normalizeLidParticipants(store);
assert.strictEqual(kedua.mapped, 0, 'mapping dobel');
assert.strictEqual(global.db.lidMap[LID], PN);
assert.ok(linkLidToPhone('bukan-lid@s.whatsapp.net', PN) === PN, 'linkLidToPhone harus lolos-through non-lid');

// --- Anti rate-overlimit -----------------------------------------------------
// Gejalanya: WA balas 429 "rate-overlimit" (statusCode 500) => .pinm & command
// lain gagal. Dua penyebab yang kita kendalikan: (1) tiap kirim pesan di grup
// query metadata over-network, (2) query metadata 60+ grup ditembak beruntun.
const idxSrc = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
assert.match(idxSrc, /cachedGroupMetadata: async \(jid\) => global\.store\?\.groupMetadata\?\.\[jid\]/,
	'socket belum dikasih cachedGroupMetadata => tiap kirim pesan di grup query metadata (default lib = undefined)');

const jeda = [];
const sleepPalsu = (ms) => { jeda.push(ms); return Promise.resolve() };
const reloadAllParticipants = muat('../src/message.js', 'reloadAllParticipants', {
	sleep: sleepPalsu, normalizeLidParticipants, jedaAntarGrup,
});
const pesan = (id) => ({ participants: [{ id: LID, phoneNumber: PN }], subject: id });
global.db = { users: {}, lidMap: {} };
const st2 = { groupMetadata: {} };
const hasil = await reloadAllParticipants(
	{
		groupFetchAllParticipating: async () => ({ 'g1@g.us': pesan('g1'), 'g2@g.us': pesan('g2'), 'g3@g.us': pesan('g3') }),
		// Grup kedua kena rate-limit: reload harus tetap lanjut, bukan abort total.
		groupMetadata: async (id) => { if (id === 'g2@g.us') throw new Error('rate-overlimit'); return pesan(id) },
	},
	st2
);
assert.strictEqual(hasil.groups, 3, 'grup yang kena rate-limit harus fallback ke data dari groupFetchAllParticipating');
assert.deepStrictEqual(jeda, [jedaAntarGrup, jedaAntarGrup], 'harus ada jeda tepat di antara query tiap grup');
assert.ok(jedaAntarGrup > 0, 'jeda antar grup harus > 0');
// Loop di syncGroupMetadataCache (dipakai saat boot) juga harus dijeda.
assert.match(fs.readFileSync(new URL('../src/message.js', import.meta.url), 'utf8'),
	/await sleep\(jedaAntarGrup\); \/\/ anti rate-overlimit/,
	'syncGroupMetadataCache belum dijeda => boot 60+ grup kena rate-overlimit');

console.log('OK: XP/level + resolver lid->jid (3 bentuk participant, merge user, idempotent) + anti rate-overlimit');