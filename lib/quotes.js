import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const quotesDir = path.join(__dirname, '..', 'database', 'quotes');

function quotesFile(category) {
	return path.join(quotesDir, `${category}.json`);
}

// Sengaja baca file tiap dipanggil (bukan di-cache sekali di awal) -- karena
// isinya cuma JSON kecil, biayanya nggak berasa, tapi untungnya nambah
// kalimat baru (.addbucin dkk) langsung kepake TANPA perlu restart bot.
function loadQuotes(category) {
	try {
		const raw = fs.readFileSync(quotesFile(category), 'utf8');
		const list = JSON.parse(raw);
		return Array.isArray(list) ? list.filter((q) => typeof q === 'string' && q.trim()) : [];
	} catch (e) {
		return [];
	}
}

function addQuote(category, text) {
	text = String(text || '').trim();
	if (!text) throw new Error('Kalimat tidak boleh kosong.');
	if (text.length > 300) throw new Error('Kepanjangan, maksimal 300 karakter.');

	const list = loadQuotes(category);
	if (list.includes(text)) throw new Error('Kalimat itu sudah ada di database.');

	list.push(text);
	fs.mkdirSync(quotesDir, { recursive: true });
	fs.writeFileSync(quotesFile(category), JSON.stringify(list, null, 2));
	return list.length;
}

function deleteQuote(category, index) {
	const list = loadQuotes(category);
	if (index < 0 || index >= list.length) throw new Error('Nomor kalimat tidak valid.');
	const [removed] = list.splice(index, 1);
	fs.writeFileSync(quotesFile(category), JSON.stringify(list, null, 2));
	return removed;
}

// ============================================================
// WEIGHTED RANDOM -- cegah kalimat yang sama nongol berturut-turut
// ============================================================
// Tiap kalimat punya "weight" (bobot), disimpan permanen di global.db
// (ikut ke-backup/ke-restore sama sistem database yang udah ada, jadi
// bertahan lintas restart bot). Kalimat yang BARU DIPILIH bobotnya
// langsung dijatuhkan drastis (kecil kemungkinan kepilih lagi sebentar
// lagi), sementara semua kalimat LAIN bobotnya naik pelan-pelan tiap kali
// ada pemilihan -- jadi makin lama nggak kepilih, makin besar peluangnya
// kepilih di put berikutnya. Efeknya: random tapi "merata", bukan random
// murni yang bisa keluar kalimat sama 3x berturut-turut.
function pickWeightedQuote(category, quotes) {
	if (!quotes || !quotes.length) return null;
	if (quotes.length === 1) return quotes[0];

	global.db = global.db || {};
	global.db.quoteWeights = global.db.quoteWeights || {};
	const weights = (global.db.quoteWeights[category] = global.db.quoteWeights[category] || {});

	// Kalimat baru (belum pernah punya weight tercatat) mulai dari 1 (netral).
	for (const q of quotes) if (!(q in weights)) weights[q] = 1;

	const totalWeight = quotes.reduce((sum, q) => sum + (weights[q] ?? 1), 0);
	let r = Math.random() * totalWeight;
	let chosen = quotes[quotes.length - 1];
	for (const q of quotes) {
		r -= weights[q] ?? 1;
		if (r <= 0) {
			chosen = q;
			break;
		}
	}

	for (const q of quotes) {
		if (q === chosen) weights[q] = 0.15; // baru dipakai -> jarang muncul lagi sebentar
		else weights[q] = Math.min((weights[q] ?? 1) + 0.35, 12); // yang lain pelan-pelan naik, di-cap biar wajar
	}

	// Beres-beres: kalimat yang sudah dihapus dari file jangan nyampah selamanya di weight table.
	for (const key of Object.keys(weights)) {
		if (!quotes.includes(key)) delete weights[key];
	}

	return chosen;
}

export { loadQuotes, addQuote, deleteQuote, pickWeightedQuote };
