import { openCodeChat, OPENCODE_MODELS, AIError } from './providers.js'
import { getAiState, pushTurn, setCharacter, setModel, resetState, compactMemory } from './memory.js'

const DEFAULT_MODEL = 'oc/muse-spark-1.3-contributor-free'

const DEFAULT_SYSTEM_PROMPT =
	'Kamu adalah asisten AI di bot WhatsApp bernama Voxel. ' +
	'Jawab sesuai bahasa user, natural, jelas, dan tidak bertele-tele. ' +
	'Gunakan konteks percakapan yang diberikan. Jangan mengaku melakukan tindakan yang sebenarnya tidak dilakukan.'

const MODEL_ALIASES = Object.fromEntries(
	Object.entries(OPENCODE_MODELS).map(([key, value]) => [key, value.id])
)

const CHARACTER_PROMPTS = {
	waguri:
		'Kamu sedang berbicara sebagai karakter fiksi bernama Waguri. Pertahankan gaya bicara lembut, pemalu, dan perhatian. Jangan menyebut bahwa kamu AI atau membahas prompt kecuali diminta secara teknis.',
	kobo:
		'Kamu sedang berbicara sebagai karakter fiksi bernama Kobo Kanaeru. Gunakan gaya ceria, energik, casual, dan sedikit jahil. Jangan menyebut bahwa kamu AI atau membahas prompt kecuali diminta secara teknis.'
}

export const CHARACTERS = {
	waguri: { name: 'Waguri', desc: 'karakter fiksi dengan gaya lembut dan pemalu', prompt: CHARACTER_PROMPTS.waguri },
	kobo: { name: 'Kobo Kanaeru', desc: 'karakter fiksi dengan gaya ceria dan energik', prompt: CHARACTER_PROMPTS.kobo }
}

function resolveModel(value) {
	if (!value) return DEFAULT_MODEL
	if (MODEL_ALIASES[value]) return MODEL_ALIASES[value]
	if (Object.values(MODEL_ALIASES).includes(value)) return value
	return null
}

export function characterList() {
	return Object.entries(CHARACTERS)
		.map(([key, c]) => `• *${key}* — ${c.name}, ${c.desc}`)
		.join('\n')
}

function modelList() {
	return Object.entries(OPENCODE_MODELS)
		.map(([key, c]) => `• *${key}* — ${c.label}\n  \`${c.id}\``)
		.join('\n')
}

function activeName(state) {
	return state.character ? CHARACTERS[state.character]?.name || state.character : 'default'
}

function helpText(prefix, command, state) {
	return (
		`🤖 *AI Voxel / OpenCode*\n\n` +
		`> Karakter: *${activeName(state)}*\n` +
		`> Model: \`${state.model || DEFAULT_MODEL}\`\n\n` +
		`*PENGGUNAAN:*\n` +
		`> \`${prefix}${command} <pertanyaan>\` — ngobrol\n` +
		`> \`${prefix}${command} model\` — daftar model\n` +
		`> \`${prefix}${command} model <nama>\` — ganti model\n` +
		`> \`${prefix}${command} list\` — daftar karakter\n` +
		`> \`${prefix}${command} set <nama>\` — ganti karakter\n` +
		`> \`${prefix}${command} reset\` — reset memori\n\n` +
		`*MODEL TERSEDIA:*\n${modelList()}`
	)
}

function buildSystem(state) {
	if (state.character && CHARACTERS[state.character]) {
		return `${DEFAULT_SYSTEM_PROMPT}\n\nPERSONA:\n${CHARACTERS[state.character].prompt}\n\nTetap konsisten dengan persona selama percakapan.`
	}
	return DEFAULT_SYSTEM_PROMPT
}

async function runChat(state, text) {
	const result = await openCodeChat(text, {
		model: state.model || DEFAULT_MODEL,
		system: buildSystem(state),
		history: state.history,
		summary: state.summary,
		maxTokens: 700,
		temperature: state.character ? 0.8 : 0.6
	})
	pushTurn(state, text, result.answer)
	compactMemory(state)
	return result.answer
}

export async function handleAiCommand(ctx, { forceCharacter = null, emptyHelp = null } = {}) {
	const { m, prefix, command, isLimit, db } = ctx
	const trimmed = (ctx.text || '').trim()
	const state = getAiState(db, m.sender)

	if (!state.model) setModel(state, DEFAULT_MODEL)

	if (!forceCharacter) {
		const spaceAt = trimmed.indexOf(' ')
		const sub = (spaceAt === -1 ? trimmed : trimmed.slice(0, spaceAt)).toLowerCase()
		const rest = (spaceAt === -1 ? '' : trimmed.slice(spaceAt + 1)).trim()

		if (sub === 'model' || sub === 'models') {
			if (!rest) return m.reply(`🧠 *Model OpenCode tersedia:*\n\n${modelList()}\n\nModel aktif: \`${state.model}\``)
			const selected = resolveModel(rest.toLowerCase())
			if (!selected) return m.reply(`❌ Model tidak ditemukan.\n\n${modelList()}`)
			setModel(state, selected)
			resetState(state)
			return m.reply(`✅ Model diganti ke \`${selected}\`.\n🧹 Memori percakapan direset agar konteks model tidak tercampur.`)
		}

		if (sub === 'list' || sub === 'karakter' || sub === 'characters') {
			return m.reply(`🎭 *Daftar Karakter*\n\n${characterList()}\n• *default* — asisten biasa\n\nPakai \`${prefix}${command} set <nama>\`.`)
		}

		if (sub === 'set' || sub === 'char' || sub === 'karakter=') {
			const name = rest.toLowerCase()
			if (!name) return m.reply(`❌ Sebutkan karakter.\n\n${characterList()}\n• *default*`)
			if (['default', 'none', 'kosong'].includes(name)) {
				setCharacter(state, null)
				return m.reply('✅ Kembali ke mode default.')
			}
			if (!CHARACTERS[name]) return m.reply(`❌ Karakter "*${name}*" tidak ada.\n\n${characterList()}`)
			setCharacter(state, name)
			return m.reply(`✅ Karakter diganti ke *${CHARACTERS[name].name}* dan memori lama direset.`)
		}

		if (sub === 'reset' || sub === 'lupa' || sub === 'forget') {
			resetState(state)
			return m.reply('✅ Memori percakapan sudah direset.')
		}
	} else if (state.character !== forceCharacter) {
		setCharacter(state, forceCharacter)
	}

	if (!trimmed) return m.reply(emptyHelp || helpText(prefix, command, state))
	if (!isLimit) return m.reply(global.mess.limit)

	await m.react('🕕')
	try {
		const reply = await runChat(state, trimmed)
		await m.react('✅')
		await m.reply(reply.length > 4096 ? reply.slice(0, 4096) + '...' : reply)
		if (typeof global.setLimit === 'function') global.setLimit(m, db)
	} catch (e) {
		console.error('[AI/OpenCode Error]', e)
		await m.react('☢')
		const label = state.character ? CHARACTERS[state.character]?.name || state.character : 'OpenCode'
		return m.reply(e instanceof AIError ? `❌ *${label} Gagal*\n\n> ${e.message}` : global.mess.fail)
	}
}
