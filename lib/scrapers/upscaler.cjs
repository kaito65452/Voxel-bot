const axios = require('axios')
const FormData = require('form-data')

/**
 * Panggil server robertsLando/upscaler (https://github.com/robertsLando/upscaler)
 * -- FastAPI + Real-ESRGAN, self-hosted (Docker/Python), BUKAN API pihak ketiga.
 * Server-nya harus dijalankan duluan secara terpisah (lihat README.md di folder
 * ini), defaultnya di http://localhost:8000. Bisa dioverride lewat env
 * UPSCALER_URL kalau di-hosting di tempat lain (VPS terpisah, dsb).
 */
async function localUpscale(imageBuffer, { targetWidth, targetHeight, baseUrl } = {}) {
    if (!Buffer.isBuffer(imageBuffer)) throw new Error('Image harus berupa buffer')
    if (!targetWidth || !targetHeight) throw new Error('targetWidth dan targetHeight wajib diisi')

    const url = (baseUrl || process.env.UPSCALER_URL || 'http://localhost:8000').replace(/\/+$/, '')

    const form = new FormData()
    form.append('image', imageBuffer, { filename: 'input.jpg' })
    form.append('target_width', String(Math.round(targetWidth)))
    form.append('target_height', String(Math.round(targetHeight)))

    const { data } = await axios.post(`${url}/upscale`, form, {
        headers: form.getHeaders(),
        responseType: 'arraybuffer',
        // Real-ESRGAN jalan di CPU (apalagi kalau host-nya HP/Termux) bisa
        // lambat -- kasih timeout longgar daripada gagal di tengah proses.
        timeout: 180000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
    })

    return Buffer.from(data)
}

module.exports = { localUpscale }
