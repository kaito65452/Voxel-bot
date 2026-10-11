const axios = require('axios')
const cheerio = require('cheerio')

async function spotifydl(spotifyUrl) {
    try {
        const home = await axios.get(
            'https://spotmate.online/en1',
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            }
        )

        const cookies = home.headers['set-cookie'] || []

        const cookieString = cookies
            .map(v => v.split(';')[0])
            .join('; ')

        const $ = cheerio.load(home.data)

        let csrf =
            $('meta[name="csrf-token"]').attr('content') ||
            $('meta[name="_token"]').attr('content')

        if (!csrf) {
            const match = home.data.match(
                /csrf-token["']?\s*content=["']([^"']+)/
            )

            if (match) csrf = match[1]
        }

        if (!csrf) {
            throw new Error('CSRF token tidak ditemukan')
        }

        const headers = {
            'User-Agent': 'Mozilla/5.0',
            'Origin': 'https://spotmate.online',
            'Referer': 'https://spotmate.online/en1',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrf,
            'Cookie': cookieString
        }

        const trackData = await axios.post(
            'https://spotmate.online/getTrackData',
            {
                spotify_url: spotifyUrl
            },
            { headers }
        )

        const metadata = trackData.data

        const convert = await axios.post(
            'https://spotmate.online/convert',
            {
                urls: spotifyUrl
            },
            { headers }
        )

        if (convert.data.error) {
            throw new Error('Convert gagal')
        }

        return {
            title: metadata.name,
            artist: metadata.artists?.map(v => v.name).join(', ') || '-',
            thumbnail: metadata.album?.images?.[0]?.url,
            spotify: metadata.external_urls?.spotify,
            download: convert.data.url
        }

    } catch (err) {
        throw new Error(
            typeof err.response?.data === 'object'
                ? JSON.stringify(err.response.data)
                : err.response?.data || err.message
        )
    }
}

module.exports = spotifydl