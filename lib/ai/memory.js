/*
 * Memori AI Voxel.
 *
 * Disimpan di db.ai[sender] sehingga mengikuti mekanisme persistence Voxel.
 * Skema lama tetap kompatibel: character/history/geminiSession masih dibaca.
 *
 * Memory baru:
 * - model       : model OpenCode aktif untuk user
 * - summary     : ringkasan konteks lama
 * - history     : percakapan terbaru
 * - threads     : thread terpisah untuk command lain
 */

const MAX_MESSAGES = 20
const SUMMARY_TRIGGER = 24

function ensure(db) {
	if (!db.ai || typeof db.ai !== 'object') db.ai = {}
	return db.ai
}

function normalizeState(state) {
	if (!state || typeof state !== 'object') state = {}
	if (!Array.isArray(state.history)) state.history = []
	if (state.character !== null && typeof state.character !== 'string') state.character = null
	if (typeof state.summary !== 'string') state.summary = ''
	if (typeof state.model !== 'string' || !state.model) state.model = 'oc/muse-spark-1.3-contributor-free'
	if (!state.threads || typeof state.threads !== 'object') state.threads = {}
	return state
}

export function getAiState(db, sender) {
	const store = ensure(db)
	store[sender] = normalizeState(store[sender])
	return store[sender]
}

function trimHistory(history, maxMessages = MAX_MESSAGES) {
	if (history.length > maxMessages) history.splice(0, history.length - maxMessages)
	return history
}

export function pushTurn(state, userText, aiText) {
	if (!state.history) state.history = []
	state.history.push({ role: 'user', content: String(userText) })
	state.history.push({ role: 'assistant', content: String(aiText) })
	trimHistory(state.history)
	return state
}

/*
 * Simpan ringkasan lokal tanpa memanggil model kedua.
 * Ringkasan dibuat dari pasangan percakapan lama secara deterministik.
 * Ini lebih murah dan tidak menambah latency request AI.
 */
export function compactMemory(state) {
	if (!Array.isArray(state.history) || state.history.length <= SUMMARY_TRIGGER) return false

	const old = state.history.slice(0, -MAX_MESSAGES)
	const lines = []
	for (let i = 0; i < old.length; i += 2) {
		const u = old[i]?.content
		const a = old[i + 1]?.content
		if (u) lines.push(`User: ${u.slice(0, 500)}`)
		if (a) lines.push(`AI: ${a.slice(0, 700)}`)
	}

	const previous = state.summary?.trim()
	const merged = [
		previous ? `Ringkasan sebelumnya:\n${previous}` : '',
		lines.length ? `Percakapan lama:\n${lines.join('\n')}` : ''
	].filter(Boolean).join('\n\n')

	// Batasi ukuran ringkasan agar prompt tidak terus membesar.
	state.summary = merged.slice(-6000)
	trimHistory(state.history)
	return true
}

export function setCharacter(state, character) {
	state.character = character
	state.history = []
	state.summary = ''
	state.geminiSession = null
}

export function setModel(state, model) {
	state.model = model
}

export function resetState(state) {
	state.history = []
	state.summary = ''
	state.geminiSession = null
}

function ensureThreads(db, sender) {
	const state = getAiState(db, sender)
	return state.threads
}

export function getThread(db, sender, key) {
	const threads = ensureThreads(db, sender)
	if (!Array.isArray(threads[key])) threads[key] = []
	return threads[key]
}

export function pushThreadTurn(thread, userText, aiText) {
	thread.push({ role: 'user', content: String(userText) })
	thread.push({ role: 'assistant', content: String(aiText) })
	trimHistory(thread)
	return thread
}

export function resetThread(db, sender, key) {
	const threads = ensureThreads(db, sender)
	threads[key] = []
}
