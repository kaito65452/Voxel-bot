const axios = require('axios')
const { v4: uuidv4 } = require('uuid')

async function imgupscale(image, { scale = 4 } = {}) {
    const scales = [1, 4, 8, 16]
    if (!Buffer.isBuffer(image)) throw new Error('Image must be a buffer')
    if (!scales.includes(scale)) throw new Error(`Scale tersedia: ${scales.join(', ')}`)

    const identity = uuidv4()
    const inst = axios.create({
        baseURL: 'https://supawork.ai/supawork/headshot/api',
        headers: {
            authorization: 'null',
            origin: 'https://supawork.ai/',
            referer: 'https://supawork.ai/ai-photo-enhancer',
            'user-agent': 'Mozilla/5.0',
            'x-auth-challenge': '',
            'x-identity-id': identity
        }
    })

    // get upload url
    const { data: up } = await inst.get('/sys/oss/token', {
        params: { f_suffix: 'png', get_num: 1, unsafe: 1 }
    })

    const img = up?.data?.[0]
    if (!img) throw new Error('Upload URL tidak ditemukan')

    // upload buffer
    await axios.put(img.put, image)

    // bypass cloudflare
    const { data: cf } = await axios.post(
        'https://api.nekolabs.web.id/tools/bypass/cf-turnstile',
        {
            url: 'https://supawork.ai/ai-photo-enhancer',
            siteKey: '0x4AAAAAACBjrLhJyEE6mq1c'
        }
    )

    if (!cf?.result) throw new Error('CF token gagal')

    const { data: t } = await inst.get('/sys/challenge/token', {
        headers: { 'x-auth-challenge': cf.result }
    })

    const token = t?.data?.challenge_token
    if (!token) throw new Error('Challenge token gagal')

    // create task
    const { data: task } = await inst.post(
        '/media/image/generator',
        {
            aigc_app_code: 'image_enhancer',
            model_code: 'supawork-ai',
            image_urls: [img.get],
            extra_params: { scale: parseInt(scale) },
            currency_type: 'silver',
            identity_id: identity
        },
        { headers: { 'x-auth-challenge': token } }
    )

    if (!task?.data?.creation_id) throw new Error('Task gagal dibuat')

    // polling (max ~2 menit, jangan sampai nge-hang selamanya)
    const maxAttempts = 120
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { data } = await inst.get('/media/aigc/result/list/v1', {
            params: { page_no: 1, page_size: 10, identity_id: identity }
        })

        const result = data?.data?.list?.[0]?.list?.[0]
        if (result?.status === 1) return result.url

        await new Promise(r => setTimeout(r, 1000))
    }
    throw new Error('Timeout menunggu hasil upscale')
}

module.exports = { imgupscale }
