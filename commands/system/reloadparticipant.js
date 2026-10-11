// .reloadparticipant -- paksa sinkronisasi ulang seluruh participants di semua
// grup + isi ulang peta permanen lid -> nomorHp (global.db.lidMap).
//
// Perlu ini karena setelah restart / grup yang jarang di-refresh, participants bisa
// masih cached dengan identitas @lid: .tagall nampilin @<lid>, leaderboard nampilin
// orang yang sama 2x, dan .profile kadang kelihatan "hilang".
//
// Peta hasil reload disimpan ke database baris `db.lidMap` (permanent, bukan cache
// store) -- jadi dia bertahan melewati restart.

import { reloadAllParticipants } from '../../src/message.js';

export default {
	name: 'reloadparticipant',
	aliases: ['reloadpart', 'resyncparticipant', 'syncparticipant'],

	async execute(ctx) {
		const { m, voxel, store, isCreator } = ctx;
		if (!isCreator) return m.reply(global.mess.owner)

		const t0 = Date.now();
		// 60+ grup x 1,2 detik jeda (anti rate-overlimit) = bisa sampai ~1 menit.
		// Kabari dulu, biar nggak kelihatan bot mati.
		const progres = await m.reply('⏳ Sinkronisasi participant... (1 detik per grup, tahan ya)')
			.catch(() => null);
		const stat = await reloadAllParticipants(voxel, store)
			.catch((e) => ({ error: e?.message || String(e) }));

		if (stat?.error) return m.reply(`❌ Gagal reload: ${stat.error}`)

		// Ingatkan juga bagian DB: user yang datanya nyangkut di key @lid digabung
		// ke nomorHp-nya di dalam reloadAllParticipants, jadi leaderboard/profil
		// langsung bersih tanpa perlu restart.
		return m.reply(`*Reload Participant Selesai*

Grup di-sync : ${stat.groups}
Total peserta : ${stat.participants}
LID ter-resolve : ${stat.mapped}
User digabung (lid → no.Hp) : ${stat.merged}
Durasi : ${((Date.now() - t0) / 1000).toFixed(1)} detik

Peta lid → nomorHp disimpan permanen di \`db.lidMap\`, jadi tetap kepake setelah restart.`, { quoted: m });
	},
};
