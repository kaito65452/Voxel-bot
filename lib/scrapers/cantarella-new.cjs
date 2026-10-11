const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');
const { Readable } = require('stream');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Stalk nickname Free Fire dari ID-nya, lewat endpoint resmi Codashop
 * (dipakai buat validasi sebelum top-up, jadi selalu akurat & live).
 */
async function ffstalk(userId) {
	const { data } = await axios({
		method: 'POST',
		url: 'https://order.codashop.com/id/initPayment.action',
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
		data: {
			'voucherPricePoint.id': 8050,
			'user.userId': userId,
			voucherTypeName: 'FREEFIRE',
			shopLang: 'in_ID'
		}
	});
	const role = data?.confirmationFields?.roles?.[0]?.role;
	if (!role) throw new Error('ID Free Fire tidak ditemukan');
	return { id: userId, nickname: role };
}

/**
 * Stalk nickname Mobile Legends dari ID+zoneId, lewat endpoint resmi
 * Dunia Games (juga dipakai buat validasi top-up).
 */
async function mlstalk(id, zoneId) {
	const { data } = await axios.post(
		'https://api.duniagames.co.id/api/transaction/v1/top-up/inquiry/store',
		new URLSearchParams({
			productId: '1', itemId: '2', catalogId: '57', paymentId: '352',
			gameId: id, zoneId, product_ref: 'REG', product_ref_denom: 'AE'
		}),
		{ headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://www.duniagames.co.id/' } }
	);
	const detail = data?.data?.gameDetail;
	if (!detail) throw new Error('ID Mobile Legends tidak ditemukan');
	return detail;
}

/**
 * Cek info paket npm langsung dari registry resmi npmjs.org.
 */
async function npmstalk(packageName) {
	const { data } = await axios.get('https://registry.npmjs.org/' + packageName);
	const versions = data.versions;
	const allver = Object.keys(versions);
	if (!allver.length) throw new Error('Paket tidak ditemukan');
	const verLatest = allver[allver.length - 1];
	const verPublish = allver[0];
	return {
		name: packageName,
		versionLatest: verLatest,
		versionPublish: verPublish,
		versionUpdate: allver.length,
		latestDependencies: Object.keys(versions[verLatest].dependencies || {}).length,
		publishTime: data.time.created,
		latestPublishTime: data.time[verLatest]
	};
}

/**
 * Cari lirik lagu -- coba LrcLib (API resmi, gratis) dulu, kalau gak
 * ketemu baru fallback scraping Genius.
 */
async function lyricsSearch(title) {
	try {
		const { data } = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(title)}`, {
			headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K)' }
		});
		const song = data?.[0];
		const lyricsRaw = song?.plainLyrics || song?.syncedLyrics;
		if (!lyricsRaw) throw new Error('Not found on LrcLib');
		return {
			trackName: song.trackName,
			artistName: song.artistName,
			albumName: song.albumName,
			lyrics: lyricsRaw.replace(/\[.*?\]/g, '').trim(),
			source: 'LrcLib'
		};
	} catch (e) {
		// Fallback: scraping Genius
		const headers = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
		const searchRes = await axios.get(`https://genius.com/api/search/multi?per_page=1&q=${encodeURIComponent(title)}`, { headers });
		const sections = searchRes.data?.response?.sections || [];
		const songHit = sections.find(s => s.type === 'song' && s.hits.length > 0)?.hits[0]?.result;
		if (!songHit) throw new Error('Lirik tidak ditemukan');
		const pageRes = await axios.get(songHit.url, { headers });
		const $ = cheerio.load(pageRes.data);
		const lyricsParts = [];
		$('[class^="Lyrics__Container"]').each((i, el) => {
			lyricsParts.push($(el).text().trim());
		});
		const lyrics = lyricsParts.join('\n').trim();
		if (!lyrics) throw new Error('Lirik tidak ditemukan');
		return {
			trackName: songHit.title || title,
			artistName: songHit.primary_artist?.name || 'Unknown',
			albumName: 'Unknown',
			lyrics,
			source: 'Genius'
		};
	}
}

/**
 * Download video Twitter/X lewat API pihak ketiga (miftahganzz).
 */
async function twitterdl(url) {
	// Apikey lewat env, bukan hardcode. Nilai lama ("miftah") tetap jadi
	// fallback biar tidak langsung mati kalau env belum di-set, tapi override
	// selalu menang: MIFTAH_APIKEY=<key> node index.js
	const miftahKey = process.env.MIFTAH_APIKEY || 'miftah';
	const { data } = await axios.get(`https://api.miftahganzz.my.id/api/download/twitter?url=${encodeURIComponent(url)}&apikey=${encodeURIComponent(miftahKey)}`);
	return data;
}

/**
 * Edit gambar pakai AI berdasarkan prompt teks (mis. "hapus background",
 * "ganti jadi gaya anime"). Ada 2 provider, otomatis coba yang kedua kalau
 * yang pertama gagal. Tiap provider punya batas polling max ~2 menit biar
 * gak hang selamanya kalau providernya lagi lambat/nyangkut.
 */
async function nanoEditV1(imageBuffer, prompt) {
	const form = new FormData();
	form.append('file_name', `edit_${Date.now()}.jpg`);
	const upRes = await axios.post('https://api.imgupscaler.ai/api/common/upload/upload-image', form, {
		headers: { ...form.getHeaders(), origin: 'https://imgupscaler.ai', referer: 'https://imgupscaler.ai/' }
	});
	const uploadData = upRes.data.result;
	await axios.put(uploadData.url, imageBuffer, {
		headers: { 'Content-Type': 'image/jpeg', 'Content-Length': imageBuffer.length },
		maxBodyLength: Infinity
	});
	const cdnUrl = 'https://cdn.imgupscaler.ai/' + uploadData.object_name;
	const jobForm = new FormData();
	jobForm.append('model_name', 'magiceraser_v4');
	jobForm.append('original_image_url', cdnUrl);
	jobForm.append('prompt', prompt);
	jobForm.append('ratio', 'match_input_image');
	jobForm.append('output_format', 'jpg');
	const serial = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
	const jobRes = await axios.post('https://api.magiceraser.org/api/magiceraser/v2/image-editor/create-job', jobForm, {
		headers: { ...jobForm.getHeaders(), 'product-code': 'magiceraser', 'product-serial': serial, origin: 'https://imgupscaler.ai', referer: 'https://imgupscaler.ai/' }
	});
	const jobId = jobRes.data.result.job_id;
	for (let attempt = 0; attempt < 40; attempt++) {
		await sleep(3000);
		const { data: result } = await axios.get(`https://api.magiceraser.org/api/magiceraser/v1/ai-remove/get-job/${jobId}`, {
			headers: { origin: 'https://imgupscaler.ai', referer: 'https://imgupscaler.ai/' }
		});
		if (result.code !== 300006) {
			if (!result?.result?.output_url?.[0]) throw new Error('nanoEditV1: hasil kosong');
			return result.result.output_url[0];
		}
	}
	throw new Error('nanoEditV1: timeout');
}

async function nanoEditV2(buffer, prompt) {
	const headers = { 'Product-Code': '067003', 'Product-Serial': 'vj6o8n' };
	const form = new FormData();
	form.append('model_name', 'seedream');
	form.append('edit_type', 'style_transfer');
	form.append('prompt', prompt);
	form.append('target_images', Readable.from(buffer), { filename: 'input.jpg', contentType: 'image/jpeg' });
	const { data } = await axios.post('https://api.photoeditorai.io/pe/photo-editor/create-job', form, { headers: { ...form.getHeaders(), ...headers } });
	const jobId = data.result.job_id;
	for (let attempt = 0; attempt < 40; attempt++) {
		const { data: statusData } = await axios.get(`https://api.photoeditorai.io/pe/photo-editor/get-job/${jobId}`, { headers });
		if (statusData.result.status === 2 && statusData.result.output?.length) return statusData.result.output[0];
		await sleep(2500);
	}
	throw new Error('nanoEditV2: timeout');
}

async function nanoEdit(imageBuffer, prompt) {
	try {
		return await nanoEditV1(imageBuffer, prompt);
	} catch (e) {
		return await nanoEditV2(imageBuffer, prompt);
	}
}

/**
 * Cari info/episode anime lewat API publik sankavollerei.
 */
async function animeSearch(keyword) {
	const { data } = await axios.get(`https://www.sankavollerei.com/anime/search/${encodeURIComponent(keyword)}`);
	return data;
}

module.exports = { ffstalk, mlstalk, npmstalk, lyricsSearch, twitterdl, nanoEdit, animeSearch };
