const axios = require('axios')

class StickerPack {
  constructor() {
    this.base = 'https://getstickerpack.com/api/v1/stickerdb'
  }

  async search(query) {
    try {
      const res = await axios.post(
        `${this.base}/search`,
        { query, page: 1 },
        { timeout: 15000 }
      )

      const data = res?.data?.data || []

      return data.map(v => ({
        name: v?.title || 'No Title',
        slug: v?.slug || '',
        download: v?.download_counter || 0
      }))
    } catch (e) {
      console.log('Search Error:', e.message)
      return []
    }
  }

  async detail(slug) {
    try {
      const res = await axios.get(
        `${this.base}/stickers/${slug}`,
        { timeout: 15000 }
      )

      const data = res?.data?.data
      if (!data) return null

      return {
        title: data?.title || 'No Title',
        stickers: (data?.images || []).map(v => ({
          image: `https://s3.getstickerpack.com/${v.url}`,
          animated: v.is_animated !== 0
        }))
      }
    } catch (e) {
      console.log('Detail Error:', e.message)
      return null
    }
  }
}

module.exports = new StickerPack()
