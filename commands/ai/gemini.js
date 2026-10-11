import { GoogleGenAI } from '@google/genai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/*
 * ==========================================
 * Voxel AI - Gemini Command (With Auto-Fallback)
 * ESM + @google/genai
 * ==========================================
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATABASE_DIR = path.join(__dirname, '../database')
const MEMORY_FILE = path.join(DATABASE_DIR, 'ai_memory.json')

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const MAX_FACTS = 20
const MAX_MEMORY_CHARS = 4000

/*
 * ==========================================
 * Database Helper
 * ==========================================
 */

function ensureDatabase() {
    if (!fs.existsSync(DATABASE_DIR)) {
        fs.mkdirSync(DATABASE_DIR, { recursive: true })
    }
    if (!fs.existsSync(MEMORY_FILE)) {
        fs.writeFileSync(MEMORY_FILE, '{}', 'utf8')
    }
}

function loadMemory() {
    ensureDatabase()
    try {
        const data = fs.readFileSync(MEMORY_FILE, 'utf8')
        return JSON.parse(data || '{}')
    } catch (err) {
        console.error('[AI MEMORY] Failed to read database:', err)
        return {}
    }
}

function saveMemory(memory) {
    ensureDatabase()
    try {
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf8')
    } catch (err) {
        console.error('[AI MEMORY] Failed to save database:', err)
    }
}

/*
 * ==========================================
 * User Info Extractor
 * ==========================================
 */

function getMemberName(m) {
    return (m.pushName || m.name || m.senderName || 'Teman').trim()
}

function getUserId(m) {
    return (m.sender || m.participant || m.key?.participant || m.key?.remoteJid || '').trim()
}

function getUserMemory(m) {
    const memory = loadMemory()
    const userId = getUserId(m)

    if (!userId) {
        return { userId: null, data: {} }
    }

    if (!memory[userId]) {
        memory[userId] = {
            name: getMemberName(m),
            facts: [],
            updatedAt: Date.now()
        }
        saveMemory(memory)
    }

    const currentName = getMemberName(m)
    if (currentName && currentName !== 'Teman' && memory[userId].name !== currentName) {
        memory[userId].name = currentName
        memory[userId].updatedAt = Date.now()
        saveMemory(memory)
    }

    return {
        userId,
        data: memory[userId]
    }
}

function buildMemoryText(userMemory) {
    if (!userMemory) return 'Tidak ada memory tentang pengguna.'

    let text = ''
    if (userMemory.name) {
        text += `Nama pengguna: ${userMemory.name}\n`
    }

    if (Array.isArray(userMemory.facts) && userMemory.facts.length) {
        text += '\nFakta yang diketahui tentang pengguna:\n'
        for (const fact of userMemory.facts) {
            text += `- ${fact}\n`
        }
    }

    return text.slice(0, MAX_MEMORY_CHARS)
}

/*
 * ==========================================
 * Gemini Core Logic
 * ==========================================
 */

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null

async function askGemini({ prompt, memoryText, userName }) {
    if (!ai) {
        throw new Error('GEMINI_API_KEY belum diatur di file .env')
    }

    const systemInstruction = `
Kamu adalah AI assistant dari bot WhatsApp bernama Voxel.

Kepribadian:
- Ramah
- Natural
- Tidak terlalu kaku
- Bisa bercanda jika konteksnya cocok
- Bisa membantu coding dan pertanyaan teknis
- Bisa ngobrol santai
- Bisa membuat cerita dan berimajinasi
- Bisa melakukan roleplay ringan jika diminta

Identitas pengguna saat ini:
${userName || 'Teman'}

Memory pengguna:
${memoryText}

Aturan memory:
- Gunakan memory hanya jika relevan.
- Jangan mengarang fakta tentang pengguna.
- Jika tidak mengetahui sesuatu, katakan tidak tahu.
- Jangan mengatakan bahwa kamu memiliki akses ke seluruh database.
- Jangan menyebut JID atau ID internal kepada pengguna.

Jawablah pesan pengguna secara natural.
`

    // Daftar model yang akan dicoba secara berurutan jika terjadi error 503 (Overload)
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash']
    let lastError = null

    for (const modelName of modelsToTry) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    systemInstruction,
                    temperature: 0.8,
                    maxOutputTokens: 1000
                }
            })

            return response.text || 'Maaf, Gemini tidak memberikan jawaban.'
        } catch (err) {
            lastError = err
            const errStr = String(err?.message || err)

            // Jika error disebabkan oleh server sibuk (503 / High Demand / Unavailable), coba model berikutnya
            if (errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('high demand')) {
                console.warn(`[AI WARN] Model ${modelName} sibuk (503), beralih ke model cadangan...`)
                continue
            }

            // Jika error lain (seperti API key invalid/quota habis), langsung lempar error
            throw err
        }
    }

    throw new Error('Server Gemini sedang mengalami lonjakan trafik tinggi. Silakan coba beberapa saat lagi.')
}

async function extractMemory(userMessage, currentMemory) {
    if (!ai) return []

    try {
        const prompt = `
Tentukan apakah pesan pengguna mengandung informasi jangka panjang yang layak diingat.

Pesan pengguna:
"${userMessage}"

Memory saat ini:
${JSON.stringify(currentMemory)}

Hanya simpan informasi seperti:
- nama/panggilan
- hobi/game favorit
- bahasa pemograman/teknologi yang disukai
- preferensi pribadi
- project yang sedang dikerjakan
- informasi personal ringan yang secara eksplisit diberikan user

Jangan simpan:
- pertanyaan atau perintah biasa
- password, API key, token, data finansial
- isi percakapan sementara

Kembalikan HANYA berupa JSON Array berisi string fakta.
Contoh jika ada fakta: ["Nama pengguna adalah Elvandi", "Suka bermain Minecraft"]
Contoh jika tidak ada: []
`

        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash', // Gunakan model ringan untuk ekstraksi memori
            contents: prompt,
            config: {
                temperature: 0.1,
                maxOutputTokens: 300,
                responseMimeType: 'application/json'
            }
        })

        const text = response.text?.trim()
        if (!text) return []

        const result = JSON.parse(text)
        if (!Array.isArray(result)) return []

        return result
            .filter(item => typeof item === 'string' && item.trim())
            .slice(0, 5)

    } catch (err) {
        console.error('[AI MEMORY] Extraction failed:', err.message)
        return []
    }
}

function addFacts(userId, facts) {
    if (!userId || !facts?.length) return

    const memory = loadMemory()

    if (!memory[userId]) {
        memory[userId] = {
            name: 'Teman',
            facts: [],
            updatedAt: Date.now()
        }
    }

    if (!Array.isArray(memory[userId].facts)) {
        memory[userId].facts = []
    }

    for (const fact of facts) {
        const cleanFact = fact.trim().slice(0, 300)
        if (!cleanFact) continue

        const exists = memory[userId].facts.some(
            oldFact => oldFact.toLowerCase() === cleanFact.toLowerCase()
        )

        if (!exists) {
            memory[userId].facts.push(cleanFact)
        }
    }

    memory[userId].facts = memory[userId].facts.slice(-MAX_FACTS)
    memory[userId].updatedAt = Date.now()

    saveMemory(memory)
}

/*
 * ==========================================
 * Command Handler
 * ==========================================
 */

const execute = async ({ m, text, prefix, command }) => {
    const usedPrefix = prefix || '.'
    const inputText = text || m.text?.replace(new RegExp(`^\\${usedPrefix}${command}`, 'i'), '').trim()

    if (!inputText) {
        return m.reply(
            `🤖 *Voxel AI*\n\nGunakan:\n${usedPrefix}${command} <pertanyaan>\n\nContoh:\n${usedPrefix}${command} apa itu JavaScript?`
        )
    }

    try {
        if (typeof m.react === 'function') await m.react('⏳')

        const userMemory = getUserMemory(m)
        const userName = userMemory.data?.name || getMemberName(m)
        const memoryText = buildMemoryText(userMemory.data)

        const result = await askGemini({
            prompt: inputText,
            memoryText,
            userName
        })

        await m.reply(result)

        if (typeof m.react === 'function') await m.react('✅')

        extractMemory(inputText, userMemory.data)
            .then(facts => {
                if (facts.length && userMemory.userId) {
                    addFacts(userMemory.userId, facts)
                }
            })
            .catch(err => console.error('[AI MEMORY LOG]', err))

    } catch (err) {
        console.error('[AI ERROR]', err)

        if (typeof m.react === 'function') await m.react('❌')

        // Bersihkan format pesan error agar rapi bagi user
        let cleanErrorMessage = err.message || 'Terjadi kesalahan pada server AI.'
        if (cleanErrorMessage.includes('{"error"')) {
            try {
                const parsed = JSON.parse(cleanErrorMessage.substring(cleanErrorMessage.indexOf('{')))
                cleanErrorMessage = parsed.error?.message || cleanErrorMessage
            } catch (e) {
                // Abaikan jika gagal parse
            }
        }

        return m.reply(`⚠️ *AI Error*\n\n${cleanErrorMessage}`)
    }
}

export default {
    name: 'ai',
    command: ['ai', 'gemini'],
    tags: ['ai'],
    help: ['ai <pertanyaan>', 'gemini <pertanyaan>'],
    execute
}

