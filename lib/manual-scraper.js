import axios from 'axios';
import * as cheerioNS from 'cheerio';
import cloudscraper from 'cloudscraper';

const cheerio = cheerioNS.default || cheerioNS;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';

async function requestSmart(config) {
  try {
    const res = await axios({ ...config, validateStatus: () => true });
    const text = typeof res.data === 'string' ? res.data : '';
    if (res.status < 400 && !/cf-browser-verification|Checking your browser/i.test(text)) return res;
  } catch {}

  const response = await cloudscraper({
    method: config.method || 'GET',
    uri: config.url,
    headers: config.headers || {},
    body: config.data,
    resolveWithFullResponse: true,
    simple: false,
    followAllRedirects: true,
    timeout: config.timeout || 30000
  });
  let data = response.body;
  try { data = JSON.parse(response.body); } catch {}
  return { data, status: response.statusCode, headers: response.headers, request: { res: { responseUrl: response.request?.uri?.href } } };
}

async function expandTikTokUrl(url) {
  if (!/^https?:\/\/(vt|vm)\.tiktok\.com\//i.test(url)) return url;
  const r = await requestSmart({ url, timeout: 20000, headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' } });
  return r?.request?.res?.responseUrl || url;
}

async function tikwm(url) {
  const expanded = await expandTikTokUrl(url);
  const body = new URLSearchParams({ url: expanded, count: '12', cursor: '0', web: '1', hd: '1' }).toString();
  const r = await requestSmart({
    method: 'POST', url: 'https://www.tikwm.com/api/', data: body, timeout: 45000,
    headers: { Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Origin: 'https://www.tikwm.com', Referer: 'https://www.tikwm.com/', 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest' }
  });
  const d = r.data?.data;
  if (!d) throw new Error(r.data?.msg || 'TikWM tidak mengembalikan media');
  const photos = Array.isArray(d.images) ? d.images.filter(Boolean) : [];
  if (d.duration === 0 || photos.length) return { type: 'images', images: photos, title: d.title || '', author: d.author || {}, music: d.music || d.music_info?.play };
  const video = d.hdplay || d.play || d.wmplay;
  if (!video) throw new Error('Video TikTok tidak ditemukan');
  return { type: 'video', video, title: d.title || '', author: d.author || {}, music: d.music || d.music_info?.play, cover: d.cover };
}

async function savetik(url) {
  const expanded = await expandTikTokUrl(url);
  const body = new URLSearchParams({ q: expanded, cursor: '0', page: '0', lang: 'id' }).toString();
  const r = await requestSmart({ method: 'POST', url: 'https://savetik.io/api/ajaxSearch', data: body, timeout: 45000, headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest', 'user-agent': UA, origin: 'https://savetik.io', referer: 'https://savetik.io/id/download-tiktok-photos' } });
  const html = typeof r.data?.data === 'string' ? r.data.data : (typeof r.data === 'string' ? r.data : '');
  if (!html) throw new Error('SaveTik tidak mengembalikan HTML');
  const $ = cheerio.load(html);
  const mp4 = $('a:contains("Unduh MP4 [1]")').attr('href') || $('a:contains("Unduh MP4 [2]")').attr('href') || $('a:contains("Unduh MP4 HD")').attr('href');
  const mp3 = $('a:contains("Unduh MP3")').attr('href');
  const images = [];
  $('.photo-list ul.download-box li').each((_, el) => { const u = $(el).find("a[title='Unduh Gambar']").attr('href'); if (u) images.push(u); });
  if (images.length) return { type: 'images', images, title: $('h3').first().text().trim(), music: mp3 };
  if (!mp4) throw new Error('SaveTik tidak menemukan media');
  return { type: 'video', video: mp4, title: $('h3').first().text().trim(), music: mp3 };
}

async function savett(url) {
  const expanded = await expandTikTokUrl(url);
  const page = await requestSmart({ url: 'https://savett.cc/en1/download', timeout: 30000, headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', Referer: 'https://savett.cc/en1/download' } });
  const html = typeof page.data === 'string' ? page.data : '';
  const csrf = html.match(/name=["']csrf_token["']\s+value=["']([^"']+)/i)?.[1];
  if (!csrf) throw new Error('CSRF SaveTT tidak ditemukan');
  const cookie = Array.isArray(page.headers?.['set-cookie']) ? page.headers['set-cookie'].map(v => v.split(';')[0]).join('; ') : '';
  const post = await requestSmart({ method: 'POST', url: 'https://savett.cc/en1/download', data: `csrf_token=${encodeURIComponent(csrf)}&url=${encodeURIComponent(expanded)}`, timeout: 45000, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie, 'User-Agent': UA, Referer: 'https://savett.cc/en1/download' } });
  const $ = cheerio.load(typeof post.data === 'string' ? post.data : '');
  const links = [];
  $('a[href]').each((_, el) => { const label = $(el).text().toLowerCase(); const href = $(el).attr('href'); if (href && /mp4|mp3|download/.test(label)) links.push({ label, href }); });
  const video = links.find(x => /mp4/.test(x.label) && !/watermark/.test(x.label))?.href || links.find(x => /mp4/.test(x.label))?.href;
  const music = links.find(x => /mp3/.test(x.label))?.href;
  if (!video) throw new Error('SaveTT tidak menemukan video');
  return { type: 'video', video, music, title: $('#video-info h3').first().text().trim() };
}

export async function tiktokDl(url) {
  const errors = [];
  for (const fn of [tikwm, savetik, savett]) {
    try { return await fn(url); } catch (e) { errors.push(e?.message || String(e)); }
  }
  throw new Error(`Semua scraper TikTok gagal: ${errors.join(' | ')}`);
}

async function getInstagramMeta(url) {
  try {
    const { data } = await axios.get(url, { headers: { 'User-Agent': UA }, timeout: 20000 });
    const $ = cheerio.load(data);
    return { username: $('meta[property="instapp:owner_user_name"]').attr('content') || $('meta[property="og:title"]').attr('content')?.split('•')[0]?.trim() || '-', caption: $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '-' };
  } catch { return { username: '-', caption: '-' }; }
}

async function indown(url) {
  const home = await axios.get('https://indown.io/en1', { headers: { 'User-Agent': UA }, timeout: 30000 });
  const $ = cheerio.load(home.data); const token = $('input[name="_token"]').val();
  if (!token) throw new Error('InDown token tidak ditemukan');
  const cookie = home.headers['set-cookie']?.map(v => v.split(';')[0]).join('; ') || '';
  const body = new URLSearchParams({ referer: 'https://indown.io/en1', locale: 'en', _token: token, link: url, p: 'i' });
  const { data } = await axios.post('https://indown.io/download', body, { headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie }, timeout: 45000 });
  const $$ = cheerio.load(data); const out = [];
  $$('video source[src], a[href]').each((_, el) => { let link = $$(el).attr('src') || $$(el).attr('href'); if (!link) return; if (link.includes('/fetch?')) { try { link = decodeURIComponent(new URL(link).searchParams.get('url')); } catch {} } if (/cdninstagram\.com|fbcdn\.net/.test(link)) out.push(link.replace(/&dl=1$/, '')); });
  return [...new Set(out)];
}

async function snapsave(url) {
  const form = new URLSearchParams({ url });
  const { data } = await axios.post('https://snapsave.app/id/action.php?lang=id', form, { headers: { 'User-Agent': UA, Origin: 'https://snapsave.app', Referer: 'https://snapsave.app/id/download-video-instagram' }, timeout: 45000 });
  const matches = String(data).match(/https:\/\/d\.rapidcdn\.app\/v2\?[^"']+/g) || [];
  return [...new Set(matches.map(u => u.replace(/&amp;/g, '&')))];
}

export async function instagramDl(url) {
  if (!/instagram\.com/i.test(url)) throw new Error('URL bukan Instagram');
  const author = await getInstagramMeta(url);
  let media = [];
  try { media = await indown(url); } catch {}
  if (!media.length) { try { media = await snapsave(url); } catch {} }
  if (!media.length) throw new Error('Media Instagram tidak ditemukan');
  return { author, media: media.map(download => ({ type: /\.mp4|rapidcdn/i.test(download) ? 'video' : 'image', download })) };
}

async function pinterestPinId(url) {
  let finalUrl = url;
  if (/pin\.it/i.test(url)) { const r = await axios.head(url, { maxRedirects: 5, timeout: 20000 }); finalUrl = r.request?.res?.responseUrl || r.config?.url || url; }
  return finalUrl.match(/\/pin\/(\d+)/)?.[1];
}

export async function pinterestDl(url) {
  const pinId = await pinterestPinId(url); if (!pinId) throw new Error('ID Pinterest tidak ditemukan');
  const headers = { 'User-Agent': UA, 'Content-Type': 'application/json' };
  const vars = { pinId, isAuth: true, isDesktop: false, isUnauth: false };
  const [a, b] = await Promise.all([
    axios.post('https://id.pinterest.com/_/graphql/', { queryHash: '5444a9d6e1f023c6785830bbadc6f60fe2bb7a8775b86f77905d400cfb06991b', variables: { ...vars, shouldPrefetchStoryPinFragment: false, shouldSkipImageViewerOnPageQuery: true } }, { headers, timeout: 30000 }),
    axios.post('https://id.pinterest.com/_/graphql/', { queryHash: 'a03317b3c9329575ec06fe3aeff2a3f194dae93a4eaaf4d16eab671fd2efd198', variables: { ...vars, shouldDefer: false, shouldFetchAIInsight: false, shouldShowSeoDrawerOption: false } }, { headers, timeout: 30000 })
  ]);
  const d1 = a.data?.data?.v3GetPinQueryv2?.data || {}; const d2 = b.data?.data?.v3GetPinQueryv2?.data || {};
  const images = Object.keys(d1).filter(k => k.startsWith('images_')).map(k => d1[k]).filter(Boolean);
  const video = d2?.storyPinData?.pages?.[0]?.blocks?.[0]?.videoDataV2?.videoList720P?.v720P || d2?.videos?.videoList?.v720P;
  return { title: d2.title?.trim() || d2.description?.trim() || '', author: d2.pinner?.fullName || d2.nativeCreator?.fullName || '-', images, video: video || null };
}

export async function spotifyDl(url) {
  const home = await axios.get('https://spotmate.online/en1', { headers: { 'User-Agent': UA }, timeout: 30000 });
  const $ = cheerio.load(home.data); const csrf = $('meta[name="csrf-token"]').attr('content') || $('meta[name="_token"]').attr('content') || home.data.match(/csrf-token["']?\s*content=["']([^"']+)/i)?.[1];
  if (!csrf) throw new Error('CSRF Spotify tidak ditemukan');
  const cookie = home.headers['set-cookie']?.map(v => v.split(';')[0]).join('; ') || '';
  const headers = { 'User-Agent': UA, Origin: 'https://spotmate.online', Referer: 'https://spotmate.online/en1', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf, Cookie: cookie };
  const meta = (await axios.post('https://spotmate.online/getTrackData', { spotify_url: url }, { headers, timeout: 30000 })).data;
  const converted = (await axios.post('https://spotmate.online/convert', { urls: url }, { headers, timeout: 45000 })).data;
  if (converted.error || !converted.url) throw new Error('Konversi Spotify gagal');
  return { title: meta.name || 'Audio', artist: meta.artists?.map(v => v.name).join(', ') || '-', thumbnail: meta.album?.images?.[0]?.url, download: converted.url };
}
