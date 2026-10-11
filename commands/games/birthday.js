import { sendRichHtml } from '../../lib/airich-html/RichHtml.js';

function renderBirthdayCard(name = 'Teman') {
	return `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8" />
			<style>
				body {
					margin: 0;
					font-family: Arial, sans-serif;
					display: flex;
					align-items: center;
					justify-content: center;
					background: linear-gradient(135deg, #ff7eb3, #ffb347, #ffd166, #7bdff2);
					min-height: 100vh;
				}
				.card {
					width: min(90vw, 420px);
					background: rgba(255,255,255,0.15);
					backdrop-filter: blur(10px);
					border: 1px solid rgba(255,255,255,0.35);
					border-radius: 28px;
					padding: 28px 22px;
					text-align: center;
					box-shadow: 0 16px 40px rgba(104, 34, 68, 0.25);
					color: #fff;
				}
				.badge {
					display: inline-block;
					padding: 8px 14px;
					border-radius: 999px;
					background: rgba(255,255,255,0.18);
					font-weight: 700;
					letter-spacing: 1px;
					margin-bottom: 18px;
				}
				h1 {
					margin: 0;
					font-size: 2.1rem;
					line-height: 1.2;
				}
				.emoji {
					font-size: 3.2rem;
					margin: 18px 0 12px;
				}
				p {
					font-size: 1rem;
					line-height: 1.6;
					margin: 12px 0;
				}
				.tags {
					display: flex;
					justify-content: center;
					flex-wrap: wrap;
					gap: 8px;
					margin-top: 18px;
				}
				.tag {
					padding: 8px 12px;
					border-radius: 999px;
					background: rgba(255,255,255,0.2);
					font-size: 0.8rem;
					font-weight: 700;
				}
			</style>
		</head>
		<body>
			<div class="card">
				<div class="badge">🎂 Birthday</div>
				<div class="emoji">🎉🎁✨</div>
				<h1>Happy Birthday, ${name}!</h1>
				<p>Semoga hari ini penuh kebahagiaan, kesehatan, dan banyak momen indah yang bikin senyum terus.</p>
				<p>Semoga semua impianmu terus berkembang dan langkahmu selalu diberkahi.</p>
				<div class="tags">
					<span class="tag">🌸 Bahagia</span>
					<span class="tag">💫 Sukses</span>
					<span class="tag">❤️ Sehat</span>
				</div>
			</div>
		</body>
		</html>
	`;
}

export default {
	name: 'birthday',
	aliases: ['ultah', 'ulangtahun', 'birthdaycard'],

	async execute(ctx) {
		const { m, voxel, text } = ctx;
		const target = String(text || '').trim() || 'Teman';
		const html = renderBirthdayCard(target);

		await sendRichHtml(voxel, m.chat, html, {
			title: '🎂 Birthday Card',
			trustedSources: [],
			bypassDownload: false,
		});

		return null;
	},
};
