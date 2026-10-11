import { tiktokDl } from '../../lib/scrapers/index.js';

function resolveDownloadUrl(text, quoted) {
	if (text && /https?:\/\//i.test(text)) return text;
	if (quoted) {
		const q = quoted.msg || quoted;
		const qText = quoted.text || q.caption || q.text || '';
		const match = qText && qText.match(/https?:\/\/\S+/i);
		if (match) return match[0];
	}
	return text;
}

// Hostname-nya harus persis tiktok.com atau subdomain-nya (vt./vm./www.).
// Fungsi sync & sederhana: tidak perlu DNS karena yang dicek adalah namanya.
function isHostTikTok(u) {
	try {
		const host = new URL(u).hostname.toLowerCase();
		return host === 'tiktok.com' || host.endsWith('.tiktok.com');
	} catch {
		return false;
	}
}

export default {
	name: 'tiktok',
	aliases: ['tiktokdown', 'ttdown', 'ttdl', 'tt', 'ttmp4', 'ttvideo', 'tiktokmp4', 'tiktokvideo'],

	async execute(ctx) {
		const { m, voxel, text, prefix, command, db, isLimit } = ctx;
		if (!isLimit) return m.reply(global.mess.limit);

		const dlUrl = resolveDownloadUrl(text, m.quoted);
		if (!dlUrl) return m.reply(`Example: ${prefix + command} https://www.tiktok.com/@user/video/...\n_(atau reply pesan yang ada link TikTok-nya)_`);
		// Cek HOSTNAME, bukan regex di seluruh string. `/tiktok\.com/i.test(url)`
		// ikut cocok untuk "https://evil.com/tiktok.com" atau
		// "https://evil.com/?ref=tiktok.com" -- jadi bypass-able.
		if (!isHostTikTok(dlUrl)) return m.reply('URL TikTok tidak valid!');
		m.react('⏳');

		try {
			const hasil = await tiktokDl(dlUrl);
			if (!hasil?.status || !Array.isArray(hasil.data) || !hasil.data.length) throw new Error(hasil?.msg || 'Media TikTok tidak ditemukan');
			const caption = `*📍Title:* ${hasil.title || '-'}\n*🎃Author:* ${hasil.author?.nickname || '-'}${hasil.author?.fullname ? ` (@${hasil.author.fullname})` : ''}\n*👁️Views:* ${hasil.stats?.views || '-'}\n*❤️Likes:* ${hasil.stats?.likes || '-'}`;
			const photos = hasil.data.filter(x => x?.type === 'photo' && x?.url).map(x => ({ image: { url: x.url } }));
			if (photos.length) {
				if (photos.length === 1) await m.reply({ image: photos[0].image, caption });
				else await voxel.sendAlbumMessage(m.chat, { album: photos, caption }, { quoted: m });
			} else {
				const video = hasil.data.find(x => x?.type === 'nowatermark_hd') || hasil.data.find(x => x?.type === 'nowatermark') || hasil.data.find(x => x?.type === 'watermark');
				if (!video?.url) throw new Error('URL video TikTok tidak ditemukan');
				await m.reply({ video: { url: video.url }, caption });
			}
			if (typeof global.setLimit === 'function') global.setLimit(m, db);
		} catch (e) {
			console.error('[TikTok Alya Port]', e);
			m.reply(`TikTok gagal diproses.\n_${e?.message || 'Semua scraper gagal.'}_`);
		}
	},
};
