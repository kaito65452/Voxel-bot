const axios = require('axios')
const cheerio = require('cheerio')

/**
 * Wallpaper scrapers ported/adapted from Alya-MD V12.
 * Order is intentionally resilient: BestHD -> Wikimedia -> DeviantArt -> WallpaperFlare.
 */
// Sumber utama: Wallhaven API v1 resmi (JSON, tanpa perlu API key buat konten SFW).
// Ditaruh paling pertama karena 3 scraper HTML di bawah semuanya scrape situs pihak
// ketiga yang gampang berubah struktur/anti-bot -- Wikimedia malah HTML-nya di-render
// pakai JS di browser (Special:MediaSearch), jadi hasil fetch axios/cheerio ke situ
// nggak akan pernah punya data buat di-parse cheerio, selalu 0 hasil.
async function wallhavenSearch(query, limit = 12) {
	const { data } = await axios.get('https://wallhaven.cc/api/v1/search', {
		params: { q: query, sorting: 'relevance' },
		headers: { 'User-Agent': 'Mozilla/5.0' },
		timeout: 15000
	})
	const items = data?.data || []
	return items.slice(0, limit).map(v => ({
		image: v.path,
		title: v.id,
		author: '-',
		resolution: v.resolution,
		page: v.url
	}))
}

async function bestHdWallpaper(query, page = 1, limit = 12) {
  const { data } = await axios.get('https://www.besthdwallpaper.com/search', {
    params: { CurrentPage: page, q: query },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000
  })
  const $ = cheerio.load(data)
  const results = []

  $('div.grid-item').each((_, el) => {
    if (results.length >= limit) return
    const img = $(el).find('picture img').attr('data-src') || $(el).find('picture img').attr('src')
    const source = $(el).find('div.info > a:nth-child(3)').attr('href')
    if (!img) return
    results.push({
      image: img,
      title: $(el).find('div.info > a > h3').text().trim() || 'BestHDWallpaper',
      author: '-',
      resolution: '-',
      page: source ? new URL(source, 'https://www.besthdwallpaper.com').href : undefined
    })
  })
  return results
}

async function wikimediaSearch(query, limit = 12) {
  const { data } = await axios.get('https://commons.wikimedia.org/w/index.php', {
    params: { search: query, title: 'Special:MediaSearch', go: 'Go', type: 'image' },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000
  })
  const $ = cheerio.load(data)
  const results = []

  $('.sdms-search-results__list-wrapper > div > a').each((_, el) => {
    if (results.length >= limit) return
    const image = $(el).find('img').attr('data-src') || $(el).find('img').attr('src')
    if (!image) return
    results.push({
      image,
      title: $(el).find('img').attr('alt')?.trim() || 'Wikimedia Commons',
      author: '-',
      resolution: '-',
      page: new URL($(el).attr('href') || '', 'https://commons.wikimedia.org').href
    })
  })
  return results
}

async function deviantartSearch(query, limit = 12) {
  const { data } = await axios.get('https://www.deviantart.com/search', {
    params: { q: query, content_type: 'visual' },
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'text/html,application/xhtml+xml'
    },
    timeout: 15000
  })

  const match = data.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/)
  if (!match) return []

  const json = JSON.parse(match[1])
  const deviations = json?.deviations
  if (!deviations) return []

  const results = []
  for (const key of Object.keys(deviations)) {
    const v = deviations[key]
    if (!v?.media?.baseUri) continue
    const type = v.media.types?.find(t => t?.c)
    const image = v.media.baseUri + (type?.c || '')
    if (!image) continue
    results.push({
      image,
      title: v.title || 'DeviantArt',
      author: v.author?.username || '-',
      resolution: '-'
    })
    if (results.length >= limit) break
  }
  return results
}

async function wallpaperFlareSearch(query, limit = 12) {
  const url = `https://www.wallpaperflare.com/search?wallpaper=${encodeURIComponent(query)}`
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': 'https://www.wallpaperflare.com/'
    },
    timeout: 15000
  })
  const $ = cheerio.load(data)
  const results = []
  $('li[itemprop="associatedMedia"]').each((_, el) => {
    if (results.length >= limit) return
    const image = $(el).find('img').attr('data-src') || $(el).find('img').attr('src')
    if (!image) return
    const page = $(el).find('a[itemprop="url"]').attr('href')
    results.push({
      image,
      title: $(el).find('figcaption[itemprop="caption description"]').text().trim() || 'WallpaperFlare',
      author: '-',
      resolution: $(el).find('.res').text().trim() || '-',
      page: page ? new URL(page, 'https://www.wallpaperflare.com').href : url
    })
  })
  return results
}

async function wallpaperScraper(query, limit = 12) {
  const sources = [
    ['Wallhaven', () => wallhavenSearch(query, limit)],
    ['BestHDWallpaper', () => bestHdWallpaper(query, 1, limit)],
    ['WallpaperFlare', () => wallpaperFlareSearch(query, limit)],
    ['DeviantArt', () => deviantartSearch(query, limit)]
    // Wikimedia dibuang dari daftar: Special:MediaSearch hasilnya di-render JS di
    // browser, HTML mentah yang di-fetch nggak pernah punya data buat di-scrape.
  ]

  for (const [name, fn] of sources) {
    try {
      const results = await fn()
      if (results?.length) return results
      console.warn(`[Wallpaper/${name}] Tidak ada hasil`)
    } catch (err) {
      console.error(`[Wallpaper/${name}]`, err.response?.status || err.message)
    }
  }
  return []
}

module.exports = {
  wallpaperScraper,
  bestHdWallpaper,
  wikimediaSearch,
  deviantartSearch,
  wallpaperFlareSearch
}
