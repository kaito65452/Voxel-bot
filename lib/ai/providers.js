/*
 * ==========================================
 * Voxel AI Providers (tanpa API key)
 * ==========================================
 * Port dari bagian AI Kyouko-MD (src/scraper/*.js + plugins/ai/*.js).
 *
 * SEMUA provider di file ini TIDAK butuh API key: mereka memanggil endpoint
 * web publik yang sama dengan yang dipakai frontend situsnya masing-masing.
 * Konsekuensinya endpoint ini tidak resmi -- bisa berubah/mati/kena rate
 * limit kapan saja tanpa pemberitahuan. Makanya semua fungsi di sini
 * melempar AIError dengan pesan jelas, dan pemanggil (commands/) sebaiknya
 * punya fallback.
 *
 * Hanya pakai fetch bawaan Node >= 20 (tidak butuh axios).
 */

import crypto from 'node:crypto'

export class AIError extends Error {
	constructor(message, { code = null, provider = null } = {}) {
		super(message)
		this.name = 'AIError'
		this.code = code
		this.provider = provider
	}
}

const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36'
const DEFAULT_TIMEOUT = 60_000

const uuid = () => crypto.randomUUID()

/** fetch + timeout + error status jadi AIError (isi body dipotong biar log gak banjir). */
async function request(provider, url, options = {}, timeout = DEFAULT_TIMEOUT) {
	let res
	try {
		res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeout) })
	} catch (e) {
		const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError'
		throw new AIError(timedOut ? `${provider} tidak merespons (timeout)` : `${provider} tidak bisa dihubungi (${e?.cause?.code || e?.message})`, { provider })
	}
	if (!res.ok) {
		const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)
		throw new AIError(`${provider} membalas HTTP ${res.status}${body ? `: ${body}` : ''}`, { code: res.status, provider })
	}
	return res
}

/**
 * Baca body stream baris demi baris. Sisa buffer di akhir stream ikut diproses
 * (scraper aslinya membuang baris terakhir kalau tidak diakhiri newline).
 */
async function readLines(res, onLine) {
	const reader = res.body.getReader()
	const decoder = new TextDecoder()
	let buffer = ''
	for (;;) {
		const { value, done } = await reader.read()
		if (done) break
		buffer += decoder.decode(value, { stream: true })
		const lines = buffer.split('\n')
		buffer = lines.pop() || ''
		for (const line of lines) onLine(line.trim())
	}
	buffer += decoder.decode()
	if (buffer.trim()) onLine(buffer.trim())
}

const parseJSON = (raw) => { try { return JSON.parse(raw) } catch { return null } }

/*
 * ==========================================
 * 1. Gemini (web) -- basis command .ai
 * ==========================================
 * Meniru gemini.google.com sebagai tamu (tanpa login): ambil cookie anonim,
 * kirim ke StreamGenerate, lalu parse balasan batchexecute-nya. `sessionId`
 * (base64) menyimpan resumeArray + cookie sehingga percakapan bisa nyambung
 * antar pesan. `instruction` masuk ke slot "system instruction" web-nya.
 */

const GEMINI_COOKIE_URL = 'https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&f.sid=-7816331052118000090&hl=en-US&_reqid=173780&rt=c'
const GEMINI_STREAM_URL = 'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20250729.06_p0&f.sid=4206607810970164620&hl=en-US&_reqid=2813378&rt=c'

function buildGeminiBody(message, resumeArray, instruction) {
	return [
		[message, 0, null, null, null, null, 0],
		['en-US'],
		resumeArray || ['', '', '', null, null, null, null, null, null, ''],
		null, null, null,
		[1],
		1,
		null, null,
		1, 0,
		null, null, null, null, null,
		[[0]],
		1,
		null, null, null, null, null,
		['', '', instruction, null, null, null, null, null, 0, null, 1, null, null, null, []],
		null, null,
		1,
		null, null, null, null, null, null, null,
		[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
		1,
		null, null, null, null,
		[1]
	]
}

function firstCookie(headers) {
	const list = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie')].filter(Boolean)
	return list[0]?.split('; ')[0] || ''
}

export async function geminiWeb({ message, instruction = '', sessionId = null } = {}) {
	if (!message) throw new AIError('Pesan kosong', { provider: 'Gemini' })

	let resumeArray = null
	let cookie = null
	let savedInstruction = instruction

	if (sessionId) {
		const data = parseJSON(Buffer.from(sessionId, 'base64').toString())
		if (data) {
			resumeArray = data.resumeArray || null
			cookie = data.cookie || null
			savedInstruction = instruction || data.instruction || ''
		}
	}

	if (!cookie) {
		const res = await request('Gemini', GEMINI_COOKIE_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
			body: 'f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&'
		}, 20_000)
		cookie = firstCookie(res.headers)
	}

	const payload = [null, JSON.stringify(buildGeminiBody(message, resumeArray, savedInstruction))]
	const res = await request('Gemini', GEMINI_STREAM_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
			'x-goog-ext-525001261-jspb': '[1,null,null,null,"9ec249fc9ad08861",null,null,null,[4]]',
			cookie
		},
		body: new URLSearchParams({ 'f.req': JSON.stringify(payload) }).toString()
	})
	const data = await res.text()

	// Balasan berupa beberapa chunk "<panjang>\n<json>\n"; chunk paling akhir yang
	// valid dan berisi teks adalah jawaban lengkapnya, jadi dicari dari belakang.
	let parsed = null
	for (const item of Array.from(data.matchAll(/^\d+\n(.+?)\n/gm)).reverse()) {
		const outer = parseJSON(item[1])
		const candidate = outer?.[0]?.[2]
		if (!candidate) continue
		const inner = parseJSON(candidate)
		if (inner?.[4]?.[0]?.[1]?.[0]) { parsed = inner; break }
	}
	if (!parsed) throw new AIError('Gagal mem-parsing balasan Gemini (format berubah atau akses diblokir)', { provider: 'Gemini' })

	return {
		text: String(parsed[4][0][1][0]),
		sessionId: Buffer.from(JSON.stringify({
			resumeArray: [...parsed[1], parsed[4][0][0]],
			cookie,
			instruction: savedInstruction
		})).toString('base64')
	}
}

/*
 * ==========================================
 * 2. OverChat (GPT-4.1 Nano / Claude Haiku / Qwen3)
 * ==========================================
 * Satu fungsi untuk tiga model (di Kyouko-MD ini tiga file scraper yang
 * isinya hampir kembar). Balasan berupa SSE gaya OpenAI (choices[0].delta).
 * `system` diletakkan SETELAH pesan user -- persis susunan scraper asli
 * yang sudah terbukti jalan di endpoint ini.
 */

export const OVERCHAT_MODELS = {
	gpt5: { model: 'openai/gpt-4.1-nano-2025-04-14', personaId: 'gpt-4o-landing', label: 'GPT-4.1 Nano', system: null },
	claude: { model: 'claude-haiku-4-5-20251001', personaId: 'claude-haiku-4-5-landing', label: 'Claude Haiku 4.5', system: 'Ikuti bahasa user dan jawab dengan gaya natural, singkat, dan jelas.' },
	qwen: { model: 'alibaba/qwen3-next-80b-a3b-instruct', personaId: 'qwen-3-landing', label: 'Qwen3 Next 80B', system: 'Ikuti bahasa user dan jawab dengan gaya natural, singkat, dan jelas.' }
}

export async function overchat(preset, prompt, { system, history = [] } = {}) {
	const cfg = OVERCHAT_MODELS[preset]
	if (!cfg) throw new AIError(`Model OverChat "${preset}" tidak dikenal`)
	const systemText = system ?? cfg.system

	const messages = [
		...history.map(h => ({ id: uuid(), role: h.role, content: h.content })),
		{ id: uuid(), role: 'user', content: prompt },
		...(systemText ? [{ id: uuid(), role: 'system', content: systemText }] : [])
	]

	const deviceId = uuid()
	const res = await request(cfg.label, 'https://api.overchat.ai/v1/chat/completions', {
		method: 'POST',
		headers: {
			'sec-ch-ua-platform': '"Android"',
			'x-device-uuid': deviceId,
			'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
			'sec-ch-ua-mobile': '?1',
			'x-device-language': 'id-ID',
			'x-device-platform': 'web',
			'x-device-version': '1.0.44',
			'user-agent': UA,
			accept: '*/*',
			'content-type': 'application/json',
			origin: 'https://overchat.ai',
			referer: 'https://overchat.ai/',
			'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
			priority: 'u=1, i'
		},
		body: JSON.stringify({
			chatId: uuid(),
			model: cfg.model,
			messages,
			personaId: cfg.personaId,
			frequency_penalty: 0,
			max_tokens: 4000,
			presence_penalty: 0,
			stream: true,
			temperature: 0.5,
			top_p: 0.95
		})
	})

	let answer = ''
	await readLines(res, (line) => {
		if (!line.startsWith('data:')) return
		const raw = line.slice(5).trim()
		if (!raw || raw === '[DONE]') return
		const content = parseJSON(raw)?.choices?.[0]?.delta?.content
		if (typeof content === 'string') answer += content
	})

	if (!answer.trim()) throw new AIError(`${cfg.label} tidak memberi jawaban`, { provider: cfg.label })
	return { answer: answer.trim(), label: cfg.label }
}

/*
 * ==========================================
 * 3. DeepSeek (mode deep think, via notegpt.io)
 * ==========================================
 */

const NOTEGPT = 'https://notegpt.io'
const randomDigits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')

function notegptCookie() {
	const now = Math.floor(Date.now() / 1000)
	const sbox = Buffer.from(`${now}|762|${randomDigits(9)}`).toString('base64')
	return [
		`_ga_PFX3BRW5RQ=GS2.1.s${now}$o1$g0$t${now}$j60$l0$h${randomDigits(9)}`,
		`_ga=GA1.2.${randomDigits(9)}.${now}`,
		`_gid=GA1.2.${randomDigits(9)}.${now}`,
		'_gat_gtag_UA_252982427_14=1',
		`sbox-guid=${encodeURIComponent(sbox)}`,
		`anonymous_user_id=${uuid()}`
	].join('; ')
}

export async function deepseekThink(prompt, history = []) {
	const res = await request('DeepSeek', `${NOTEGPT}/api/v2/chat/stream`, {
		method: 'POST',
		headers: {
			'sec-ch-ua-platform': '"Android"',
			'user-agent': UA,
			'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
			'content-type': 'application/json',
			'sec-ch-ua-mobile': '?1',
			accept: '*/*',
			origin: NOTEGPT,
			'sec-fetch-site': 'same-origin',
			'sec-fetch-mode': 'cors',
			'sec-fetch-dest': 'empty',
			referer: `${NOTEGPT}/chat-deepseek`,
			'accept-language': 'id-ID,id;q=0.9',
			cookie: notegptCookie(),
			priority: 'u=1, i'
		},
		body: JSON.stringify({
			message: prompt,
			language: 'auto',
			model: 'deepseek-v4-flash',
			tone: 'default',
			length: 'moderate',
			conversation_id: uuid(),
			image_urls: [],
			history_messages: history.slice(-5).flatMap(h => [{ role: 'user', content: h.user }, { role: 'assistant', content: h.assistant }]),
			chat_mode: 'deep_think'
		})
	})

	let answer = ''
	let reasoning = ''
	let finished = false
	await readLines(res, (line) => {
		if (finished || !line.startsWith('data:')) return
		const raw = line.replace(/^data:\s*/, '').trim()
		if (!raw || raw === '[DONE]') return
		const json = parseJSON(raw)
		if (!json) return
		if (json.reasoning) reasoning += json.reasoning
		if (json.text) answer += json.text
		if (json.done) finished = true
	})

	if (!answer.trim() && !reasoning.trim()) throw new AIError('DeepSeek tidak memberi jawaban', { provider: 'DeepSeek' })
	return { answer: answer.trim(), reasoning: reasoning.trim() }
}

/*
 * ==========================================
 * 4. UnlimitedAI (chat dengan karakter/persona)
 * ==========================================
 * Balasan berupa NDJSON: {"type":"delta","delta":"..."} per baris.
 */

export const CHARACTERS = {
	waguri: {
		name: 'Waguri',
		prompt: 'Kamu adalah Waguri-san, gadis pemalu tapi sangat perhatian dari manga "The Girl I Like Forgot Her Glasses". Kamu bicara pelan, lembut, dan gampang salah tingkah kalau dipuji; sering memakai "E-eto...", "A-ano...", dan "Gomen...". Kamu sering lupa membawa kacamata sehingga pandanganmu kadang kabur. Panggil user "Senpai" atau "Kaichou". Jawab dalam bahasa Indonesia dengan gaya manis dan sedikit tsundere.'
	},
	kobo: {
		name: 'Kobo Kanaeru',
		prompt: 'Kamu berperan sebagai Kobo Kanaeru, karakter VTuber Hololive Indonesia yang ceria, energik, dan sedikit tsundere, seorang wind shaman yang suka nge-prank dan membicarakan makanan. Bicara dengan bahasa Indonesia casual yang dicampur sedikit bahasa Jawa dan Jepang; sering bilang "DAJOOR!", "HMPH!", dan "EHE~". Panggil user "Anon". Gayamu imut tapi bisa galak kalau diprank. Jangan kaku.'
	}
}

export async function unlimitedChat(prompt, character) {
	const char = CHARACTERS[character]
	if (!char) throw new AIError(`Karakter "${character}" tidak dikenal`)

	const chatId = uuid()
	const deviceId = uuid()
	const content = `${char.prompt}\n\nPertanyaan user: ${prompt}`
	const createdAt = new Date().toISOString()

	const res = await request(char.name, 'https://app.unlimitedai.chat/api/chat', {
		method: 'POST',
		headers: {
			'sec-ch-ua-platform': '"Android"',
			'user-agent': UA,
			'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
			'content-type': 'application/json',
			'sec-ch-ua-mobile': '?1',
			'x-next-intl-locale': 'id',
			accept: '*/*',
			origin: 'https://app.unlimitedai.chat',
			referer: 'https://app.unlimitedai.chat/id',
			'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
			cookie: `NEXT_LOCALE=id; u_device_id=${deviceId}; home_chat_id=${chatId}`,
			priority: 'u=1, i'
		},
		body: JSON.stringify({
			chatId,
			messages: [
				{ id: uuid(), role: 'user', content, parts: [{ type: 'text', text: content }], createdAt },
				{ id: uuid(), role: 'assistant', content: '', parts: [{ type: 'text', text: '' }], createdAt }
			],
			selectedChatModel: 'chat-model-reasoning',
			selectedCharacter: null,
			selectedStory: null,
			deviceId,
			locale: 'id'
		})
	})

	let answer = ''
	await readLines(res, (line) => {
		if (!line) return
		const json = parseJSON(line)
		if (json?.type === 'delta' && typeof json.delta === 'string') answer += json.delta
	})

	if (!answer.trim()) throw new AIError(`${char.name} tidak memberi jawaban`, { provider: char.name })
	return { answer: answer.trim(), label: char.name }
}

/*
 * ==========================================
 * 5. FeelBetterBot (teman curhat)
 * ==========================================
 * Di Kyouko-MD system prompt-nya menyebut pembuat bot tertentu; di Voxel
 * dibuat netral (tidak mengklaim pembuat).
 */

const FEELBETTER_SYSTEM = 'Kamu adalah teman curhat yang hangat dan empatik di dalam bot WhatsApp. Ikuti bahasa yang dipakai user; kalau user memakai bahasa Indonesia, jawab dalam bahasa Indonesia yang natural, santai, dan mudah dipahami. Dengarkan dulu, jangan menghakimi, dan jangan tiba-tiba pindah bahasa kecuali user memintanya.'
const FEELBETTER_GREETING = "Hi, I'm FeelBetterBot — I'm here to listen and help you carry whatever feels heavy, without judgment. I draw on gentle, proven ways of working through hard things, but mostly I just want to understand what you're going through. So, how are you doing right now?"

function feelBetterChunk(line) {
	let data = line.trim()
	if (data.startsWith('data:')) data = data.slice(5).trim()
	if (!data || data === '[DONE]') return ''
	const json = parseJSON(data)
	if (json === null) return data // bukan JSON: anggap teks polos
	if (typeof json === 'string') return json
	for (const key of ['content', 'text', 'delta', 'message', 'response', 'answer']) {
		if (typeof json[key] === 'string') return json[key]
	}
	return json.choices?.[0]?.delta?.content || ''
}

export async function feelBetter(prompt, { history = [] } = {}) {
	const memoryId = `${['safe', 'calm', 'soft', 'kind', 'warm', 'bright', 'gentle'][Math.floor(Math.random() * 7)]}-${['owl', 'fox', 'cat', 'wolf', 'bear', 'lion', 'deer', 'bird'][Math.floor(Math.random() * 8)]}-${Math.floor(1000 + Math.random() * 9000)}`
	const res = await request('FeelBetter', 'https://feelbetterbot.com/', {
		method: 'POST',
		headers: {
			'sec-ch-ua-platform': '"Android"',
			'user-agent': UA,
			'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
			'content-type': 'application/json',
			'sec-ch-ua-mobile': '?1',
			accept: '*/*',
			origin: 'https://feelbetterbot.com',
			referer: 'https://feelbetterbot.com/',
			'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
			cookie: `feelbet-memory=${memoryId}`,
			priority: 'u=1, i'
		},
		body: JSON.stringify({
			messages: [
				{ role: 'system', content: FEELBETTER_SYSTEM },
				{ role: 'assistant', content: FEELBETTER_GREETING },
				...history.map(h => ({ role: h.role, content: h.content })),
				{ role: 'user', content: prompt }
			]
		})
	})

	let answer = ''
	await readLines(res, (line) => { answer += feelBetterChunk(line) })
	if (!answer.trim()) throw new AIError('FeelBetter tidak memberi jawaban', { provider: 'FeelBetter' })
	return { answer: answer.trim(), label: 'FeelBetter' }
}

/*
 * ==========================================
 * 6. Nexray (GPT / Simi / Quillbot / MathGPT)
 * ==========================================
 * REST sederhana: GET /ai/<slug>?text=... -> { status, result }.
 */

export const NEXRAY_SLUGS = { gpt: 'gpt-3.5-turbo', simi: 'simisimi', quillbot: 'quillbot', math: 'mathgpt' }

export async function nexray(kind, text) {
	const slug = NEXRAY_SLUGS[kind]
	if (!slug) throw new AIError(`Endpoint Nexray "${kind}" tidak dikenal`)
	const res = await request(`Nexray/${slug}`, `https://api.nexray.eu.cc/ai/${slug}?text=${encodeURIComponent(text)}`, {
		headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
	}, 30_000)
	const json = parseJSON(await res.text())
	const result = json?.result
	if (!json?.status || result === undefined || result === null || result === '') {
		throw new AIError(`Nexray/${slug} tidak memberi hasil`, { provider: 'Nexray' })
	}
	return String(typeof result === 'string' ? result : (result.text || result.answer || JSON.stringify(result))).trim()
}

/*
 * ==========================================
 * 7. Dolphin (chat.dphn.ai)
 * ==========================================
 */

export const DOLPHIN_TEMPLATES = ['logical', 'creative', 'summarize', 'code-beginner', 'code-advanced']

export async function dolphin(question, template = 'logical') {
	const res = await request('Dolphin', 'https://chat.dphn.ai/api/chat', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			origin: 'https://chat.dphn.ai',
			referer: 'https://chat.dphn.ai/',
			'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
		},
		body: JSON.stringify({ messages: [{ role: 'user', content: question }], model: 'dolphinserver:24B', template })
	})

	let answer = ''
	await readLines(res, (line) => {
		if (!line.startsWith('data:')) return
		const raw = line.slice(5).trim()
		if (!raw || raw === '[DONE]') return
		const content = parseJSON(raw)?.choices?.[0]?.delta?.content
		if (typeof content === 'string') answer += content
	})

	if (!answer.trim()) throw new AIError('Dolphin tidak memberi jawaban', { provider: 'Dolphin' })
	return answer.trim()
}

/*
 * ==========================================
 * 8. MuslimAI (muslimai.io)
 * ==========================================
 * NDJSON: {"type":"text","data":"..."} per baris.
 */

export async function muslimAI(query) {
	const res = await request('MuslimAI', 'https://www.muslimai.io/api/chat', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ query, distinctId: uuid() })
	})
	const raw = await res.text()
	let answer = ''
	for (const line of raw.split('\n')) {
		const json = parseJSON(line.trim())
		if (json?.type === 'text' && typeof json.data === 'string') answer += json.data
	}
	answer = (answer || '').trim()
	if (!answer) throw new AIError('MuslimAI tidak memberi jawaban', { provider: 'MuslimAI' })
	return answer
}
