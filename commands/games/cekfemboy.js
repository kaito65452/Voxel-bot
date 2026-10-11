export default {
  name: 'cekfemboy',
  aliases: ['cekbencong'],

  async execute(ctx) {
    const { m, voxel } = ctx;

    // Kalau ada yang di-tag, cek orang tersebut.
    // Kalau tidak ada tag, cek pengirim.
    const target = m.mentionedJid?.[0] || m.sender;

    // Nama orang yang dicek
    const namaTarget = await voxel.getName(target);

    // Random 0-100%
    const hasil = Math.floor(Math.random() * 101);

    let jawaban = `Femboy : ${namaTarget} (${hasil}%)`;

    if (hasil >= 90) {
      jawaban += `\nkamu femboy sejati 😳`;
    } else if (hasil >= 70) {
      jawaban += `\nkamu femboy sepuh 😌`;
    } else if (hasil >= 40) {
      jawaban += `\nlumayan, dikit lagi nih 👀`;
    } else {
      jawaban += `\namen, bukan femboy 😎`;
    }

    await voxel.sendMessage(
      m.chat,
      {
        text: jawaban,
        mentions: [target]
      },
      { quoted: m }
    );
  }
};

