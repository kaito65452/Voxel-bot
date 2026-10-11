const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fallback buat .githubstalk kalau API utama (siputzx) lagi down.
 * Diambil dari Cantarella MD -- ternyata cuma manggil API resmi
 * GitHub langsung (public, gratis, gak butuh apikey), jadi ini
 * confidence-nya TINGGI, harusnya selalu jalan.
 */
async function githubstalkFallback(user) {
	const { data } = await axios.get('https://api.github.com/users/' + user);
	return {
		username: data.login,
		nickname: data.name,
		bio: data.bio,
		profile_pic: data.avatar_url,
		url: data.html_url,
		company: data.company,
		blog: data.blog,
		location: data.location,
		public_repo: data.public_repos,
		followers: data.followers,
		following: data.following,
		created_at: data.created_at
	};
}

/**
 * Fallback buat .facebook kalau API utama (siputzx) lagi down.
 * Diambil dari Cantarella MD (lib/scrape/dzscrape.js) -- PERINGATAN:
 * cookie yang dipakai kelihatan dari 2021 dan selector CSS-nya full-path
 * (gampang rusak kalau situsnya ganti tampilan), jadi confidence-nya
 * RENDAH. Tetap saya pasang karena fallback yang kadang gagal masih
 * lebih baik daripada nggak ada sama sekali -- tapi jangan kaget kalau
 * ini juga sering gagal, situsnya (getfvid.com) mungkin udah berubah.
 */
async function facebookFallback(link) {
	const { data } = await axios('https://www.getfvid.com/downloader', {
		method: 'POST',
		data: new URLSearchParams({ url: link }),
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
		}
	});
	const $ = cheerio.load(data);
	const sel = 'body > div.page-content > div > div > div.col-lg-10.col-md-10.col-centered > div > div:nth-child(3) > div > div.col-md-4.btns-download > p';
	const video = $(`${sel}:nth-child(1) > a`).attr('href');
	const audio = $(`${sel}:nth-child(2) > a`).attr('href');
	if (!video && !audio) throw new Error('getfvid.com: struktur halaman berubah / tidak ada hasil');
	return { video, audio };
}

module.exports = { githubstalkFallback, facebookFallback };
