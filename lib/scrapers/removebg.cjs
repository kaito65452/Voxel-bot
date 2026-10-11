const FormData = require('form-data');
const fetch = require('node-fetch');

async function RemoveBG(imageBuffer) {
    if (!Buffer.isBuffer(imageBuffer)) throw new Error('Parameter harus Buffer gambar');
    const form = new FormData();
    form.append('image', imageBuffer, { filename: 'image.png' });
    form.append('format', 'png');
    form.append('model', 'v1');

    const res = await fetch('https://api2.pixelcut.app/image/matte/v1', {
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
            'x-locale': 'en',
            'x-client-version': 'web:pixa.com:4a5b0af2',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"',
            'origin': 'https://www.pixa.com',
            'sec-fetch-site': 'cross-site',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            'referer': 'https://www.pixa.com/',
            'accept-language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6'
        },
        body: form
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

module.exports = RemoveBG;