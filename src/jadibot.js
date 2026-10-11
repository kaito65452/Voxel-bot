import fs from 'fs';
import path from 'path';
import pino from 'pino';
import chalk from 'chalk';
import { Boom } from '@hapi/boom';
import NodeCache from 'node-cache';
import { fileURLToPath } from 'url';
import { makeWASocket as WAConnection, useMultiFileAuthState, Browsers, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestWaWebVersion } from '@sairidev/baileys-new';

import { sleep } from '../lib/function.js';
import { Solving, MessagesUpsert, GroupParticipantsUpdate } from './message.js';

/*
	* Fitur Jadibot untuk Voxel
	* Terinspirasi dari fitur "jadibot" pada Hitori MD - https://github.com/nazedev/hitori
	* Ide dasarnya: setiap koneksi WhatsApp (voxel.js handler, Solving(), MessagesUpsert())
	* di Voxel sudah generic terhadap socket & store yang dipakai (bukan hardcode ke satu
	* `voxel` global), jadi child bot di sini tinggal numpang lewat semua pipeline yang sama
	* persis dipakai bot utama -- tanpa duplikasi logic command sama sekali.
*/

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Semua sesi Jadibot disimpan terpisah dari sesi utama (voxel_session), 1 folder per nomor.
const jadibotBaseDir = path.join(rootDir, 'database', 'jadibot');
if (!fs.existsSync(jadibotBaseDir)) fs.mkdirSync(jadibotBaseDir, { recursive: true });

// Registry semua Jadibot yang lagi aktif di memori proses ini.
// key   : nomor WhatsApp (tanpa @s.whatsapp.net)
// value : { sock, store, connectedAt, requesterJid, presenceInterval }
if (!global.jadibots) global.jadibots = new Map();

const level = pino({ level: process.env.DEBUG_BAILEYS ? 'debug' : 'silent' });

function sessionFolder(number) {
	return path.join(jadibotBaseDir, number);
}

function sanitizeNumber(raw) {
	return String(raw || '').replace(/[^0-9]/g, '');
}

function freshStore() {
	return { contacts: {}, presences: {}, messages: {}, groupMetadata: {} };
}

async function destroySession(number, { wipe = true } = {}) {
	const entry = global.jadibots.get(number);
	if (entry) {
		try { entry.sock.ev.removeAllListeners(); } catch (e) {}
		try { entry.sock.end?.(undefined); } catch (e) {}
		if (entry.presenceInterval) clearInterval(entry.presenceInterval);
		global.jadibots.delete(number);
	}
	if (wipe) {
		try { fs.rmSync(sessionFolder(number), { recursive: true, force: true }); } catch (e) {}
	}
}

// Pasang semua helper & event listener yang sama dipakai bot utama (lihat index.js)
// supaya child bot punya fitur 100% identik: m.reply, m.react, antispam, dsb semua
// datang dari Solving()/MessagesUpsert() di src/message.js, bukan diduplikasi di sini.
async function bindHandlers(sock, number, store) {
	await Solving(sock, store);
	sock.isJadibot = true;
	sock.jadibotNumber = number;

	sock.ev.on('messages.upsert', (message) => MessagesUpsert(sock, message, store));
	sock.ev.on('group-participants.update', (update) => GroupParticipantsUpdate(sock, update, store));
	sock.ev.on('groups.update', (update) => {
		for (const n of update) {
			if (store.groupMetadata[n.id]) Object.assign(store.groupMetadata[n.id], n);
			else store.groupMetadata[n.id] = n;
		}
	});
	sock.ev.on('presence.update', (update) => {
		const { id, presences } = update;
		store.presences[id] = store.presences?.[id] || {};
		Object.assign(store.presences[id], presences);
	});
}

/**
 * Menyalakan satu sesi Jadibot.
 *
 * @param {Object} opts
 * @param {string} opts.number - Nomor WhatsApp tujuan (dipakai sebagai kunci sesi & nama folder).
 * @param {'pairing'|'qr'} [opts.mode='pairing'] - Metode login.
 * @param {string} [opts.requesterJid] - JID yang meminta pembuatan Jadibot ini (buat catatan saja).
 * @param {(type:'pairing'|'qr', code:string) => void} [opts.onCode] - Dipanggil sekali saat kode/QR siap dikirim ke user.
 * @param {(status:'open'|'close'|'logged-out'|'failed', info?:string) => void} [opts.onStatus] - Event penting koneksi.
 * @param {boolean} [opts.isRestore=false] - true kalau dipanggil dari restoreJadibotSessions() saat startup.
 */
async function startJadibotSession({ number, mode = 'pairing', requesterJid, onCode, onStatus, isRestore = false }) {
	number = sanitizeNumber(number);
	if (!number) throw new Error('Nomor tidak valid.');

	if (global.jadibots.has(number)) {
		throw new Error('Sudah ada sesi Jadibot aktif untuk nomor tersebut.');
	}

	const limit = global.jadibotLimit ?? 50;
	if (global.jadibots.size >= limit) {
		throw new Error(`Batas maksimal Jadibot aktif (${limit}) sudah tercapai.`);
	}

	const folder = sessionFolder(number);
	fs.mkdirSync(folder, { recursive: true });

	const { state, saveCreds } = await useMultiFileAuthState(folder);

	let version;
	try {
		({ version } = await fetchLatestWaWebVersion());
	} catch (e) {
		version = undefined;
	}

	// Sama seperti index.js: JANGAN paksa fingerprint browser custom selama proses
	// pairing-code belum selesai (creds belum registered) -- ini penyebab umum
	// gagal pairing / 401 "Connection Failure" di Baileys.
	const usePairing = mode === 'pairing' && !state.creds.registered;

	const sock = WAConnection({
		version,
		logger: level,
		syncFullHistory: false,
		maxMsgRetryCount: 15,
		msgRetryCounterCache: new NodeCache({ stdTTL: 60 * 60, useClones: false }),
		retryRequestDelayMs: 10,
		defaultQueryTimeoutMs: 0,
		connectTimeoutMs: 60000,
		keepAliveIntervalMs: 30000,
		...(usePairing ? {} : { browser: Browsers.ubuntu('Chrome') }),
		generateHighQualityLinkPreview: false,
		transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 10 },
		appStateMacVerification: { patch: true, snapshot: true },
		auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, level) },
	});

	const store = freshStore();
	global.jadibots.set(number, { sock, store, requesterJid, connectedAt: null, presenceInterval: null });

	await bindHandlers(sock, number, store);
	sock.ev.on('creds.update', saveCreds);

	let pairingRequested = false;
	let qrSent = false;
	let closedHandled = false;

	sock.ev.on('connection.update', async (update) => {
		const { qr, connection, lastDisconnect } = update;

		if (usePairing && qr && !pairingRequested && !sock.authState.creds.registered) {
			pairingRequested = true;
			await sleep(2000);
			try {
				const code = await sock.requestPairingCode(number);
				if (!code) throw new Error('Server tidak mengembalikan kode pairing.');
				onCode?.('pairing', code);
			} catch (err) {
				await destroySession(number);
				onStatus?.('failed', err?.message || 'Gagal meminta kode pairing.');
			}
		}

		if (!usePairing && qr && !qrSent) {
			qrSent = true;
			onCode?.('qr', qr);
		}

		if (connection === 'open') {
			const entry = global.jadibots.get(number);
			if (entry) entry.connectedAt = Date.now();
			if (entry && !entry.presenceInterval) {
				entry.presenceInterval = setInterval(async () => {
					if (sock?.user?.id) await sock.sendPresenceUpdate('available', sock.decodeJid(sock.user.id)).catch(() => {});
				}, 60 * 60 * 1000);
			}
			onStatus?.('open');
		}

		if (connection === 'close' && !closedHandled) {
			closedHandled = true;
			const boomError = new Boom(lastDisconnect?.error);
			const reason = boomError?.output?.statusCode;

			if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.forbidden || reason === DisconnectReason.multideviceMismatch) {
				await destroySession(number);
				onStatus?.('logged-out');
			} else if (!sock.authState.creds.registered) {
				// Putus sebelum sempat pairing kelar -> jangan nyangkut sesi setengah jadi di disk.
				await destroySession(number);
				onStatus?.('failed', 'Koneksi terputus sebelum proses pairing selesai. Coba lagi.');
			} else {
				// Sesi sudah pernah berhasil login -> reconnect otomatis (creds sudah registered
				// jadi kalau mode-nya 'pairing', percobaan reconnect ini TIDAK akan minta kode lagi).
				global.jadibots.delete(number);
				try {
					await startJadibotSession({ number, mode, requesterJid, onCode, onStatus, isRestore: true });
				} catch (e) {
					onStatus?.('failed', e?.message);
				}
			}
		}
	});

	return sock;
}

async function stopJadibotSession(number) {
	number = sanitizeNumber(number);
	const entry = global.jadibots.get(number);
	if (!entry) return false;
	try { await entry.sock.logout(); } catch (e) {}
	await destroySession(number);
	return true;
}

function listJadibotSessions() {
	return [...global.jadibots.entries()].map(([number, entry]) => ({
		number,
		requesterJid: entry.requesterJid || null,
		connectedAt: entry.connectedAt,
	}));
}

// Dipanggil sekali saat bot utama selesai konek (lihat index.js), buat nyambungin
// ulang semua Jadibot yang sesinya masih ada di disk (creds.json ada & registered).
async function restoreJadibotSessions() {
	if (!fs.existsSync(jadibotBaseDir)) return;
	const folders = fs.readdirSync(jadibotBaseDir).filter((f) => {
		try {
			return fs.existsSync(path.join(jadibotBaseDir, f, 'creds.json'));
		} catch (e) {
			return false;
		}
	});
	if (!folders.length) return;
	console.log(chalk.cyanBright(`[JADIBOT] Menemukan ${folders.length} sesi tersimpan, menyambungkan ulang...`));
	for (const number of folders) {
		try {
			await startJadibotSession({
				number,
				mode: 'pairing',
				isRestore: true,
				onStatus: (status) => {
					if (status === 'open') console.log(chalk.greenBright(`[JADIBOT] ${number} tersambung kembali.`));
					if (status === 'logged-out') console.log(chalk.redBright(`[JADIBOT] ${number} logout, sesi dihapus dari disk.`));
					if (status === 'failed') console.log(chalk.redBright(`[JADIBOT] ${number} gagal disambungkan ulang.`));
				},
			});
		} catch (e) {
			console.log(chalk.redBright(`[JADIBOT] Gagal restore ${number}:`), e.message);
		}
		await sleep(1500);
	}
}

export {
	startJadibotSession,
	stopJadibotSession,
	listJadibotSessions,
	restoreJadibotSessions,
	sanitizeNumber,
};
