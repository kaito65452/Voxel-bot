import { loadFlappyBirdHtml } from '../lib/flappybird-html.js';

export default {
	name: 'flappybird',
	aliases: ['flappy', 'bird'],
	async execute({ m, voxel }) {
		// TES TIER 3: payload = URL MURNI (bukan teks HTML, bukan <script src>).
		// Kalau ini yang dibutuhkan, WhatsApp kemungkinan nge-load halamannya
		// kayak webview asli (browser engine beneran), jadi JS-nya pasti jalan
		// normal - beda mekanisme total dari nyuntik teks HTML ke payload.
		if (global.flappyBirdVercelUrl) {
			await voxel.sendHtmlApp(m.chat, global.flappyBirdVercelUrl, {
				title: '🐤 Voxel • Flappy Bird (Tes payload=URL)',
				text: 'Tap layar atau tekan Space untuk mulai bermain.',
				trustedSources: [global.flappyBirdVercelUrl],
				bypassDownload: true,
				quoted: m
			});
			return;
		}

		// TES TIER 2 (fallback kalau belum di-deploy ke Vercel): <script src>
		// eksternal lewat tunnel lokal + trustedSources. Lihat commands/birthday.js
		// dan web/server.js untuk detail infrastruktur tunnel-nya.
		if (!global.webBaseUrl) {
			return m.reply('⚠️ Server tunnel belum aktif, coba lagi sebentar. (Atau isi global.flappyBirdVercelUrl di settings.js setelah deploy ke Vercel buat tes jalur URL murni.)');
		}

		let html = await loadFlappyBirdHtml();
		html = html.replace('</body>', `<script src="${global.webBaseUrl}/flappybird/game.js"></script>\n</body>`);

		await voxel.sendHtmlApp(m.chat, html, {
			title: '🐤 Voxel • Flappy Bird (Tes external script)',
			text: 'Tap layar atau tekan Space untuk mulai bermain.',
			trustedSources: [global.webBaseUrl],
			bypassDownload: true,
			quoted: m
		});
	}
};
