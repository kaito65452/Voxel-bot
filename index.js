import './settings.js';
import fs from 'fs';
import os from 'os';
import dns from 'dns';
import pino from 'pino';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';
import cron from 'node-cron';
import readline from 'readline';
import { Boom } from '@hapi/boom';
import NodeCache from 'node-cache';
import { fileURLToPath } from 'url';
import qrcode from 'qrcode-terminal';
import moment from 'moment-timezone';
import { createRequire } from 'module';
import { parsePhoneNumber } from 'awesome-phonenumber';
import { makeWASocket as WAConnection, useMultiFileAuthState, Browsers, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestWaWebVersion } from '@sairidev/baileys-new';

import { restoreJadibotSessions } from './src/jadibot.js';
import { startWebServer } from './web/server.js';
import { assertInstalled, customHttpsAgent } from './lib/function.js';
import { dataBase, cmdDel, checkStatus, checkExpired } from './src/database.js';
import { GroupParticipantsUpdate, MessagesUpsert, Solving, syncGroupMetadataCache } from './src/message.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const print = (label, value) => console.log(`${chalk.green.bold('║')} ${chalk.cyan.bold(label.padEnd(16))}${chalk.yellow.bold(':')} ${value}`);
const pairingCode = process.argv.includes('--qr') ? false : process.argv.includes('--pairing-code') || global.pairing_code;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))
const tempDir = path.join(__dirname, 'database/temp');
const time_now = new Date();
const time_end = 60000 - (time_now.getSeconds() * 1000 + time_now.getMilliseconds());
let pairingStarted = false;
let setupServer = null;
let webServerStarted = false;
let phoneNumber;
let pairingAttempts = 0;
let reconnectAttempts = 0;
let reconnectTimer = null;
const maxPairingAttempts = 5;
const maxReconnectAttempts = 10;

// Reconnect terkontrol (bukan langsung panggil ulang) supaya kalau koneksi
// gagal berkali-kali (mis. internet putus / WA lagi bermasalah) tidak jadi
// reconnect-storm yang diam-diam nge-spam server WhatsApp tanpa pernah kelihatan errornya.
function scheduleReconnect(reason) {
	if (reconnectTimer) return;
	reconnectAttempts++;
	if (reconnectAttempts > maxReconnectAttempts) {
		console.log(chalk.redBright(`[FATAL] Gagal reconnect (${reason}) setelah ${maxReconnectAttempts}x percobaan. Bot dihentikan, cek koneksi internet / status WhatsApp lalu jalankan ulang.`));
		process.exit(1);
	}
	const delay = Math.min(3000 * reconnectAttempts, 30000);
	console.log(chalk.yellow(`[RECONNECT] Alasan: ${reason}. Percobaan ke-${reconnectAttempts}/${maxReconnectAttempts}, mencoba lagi dalam ${(delay / 1000).toFixed(1)} detik...`));
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		startVoxelBot().catch((e) => {
			console.log(chalk.redBright('[FATAL] Reconnect gagal dijalankan:'), e)
			scheduleReconnect('reconnect-error')
		});
	}, delay);
}

// Retry KHUSUS buat sesi yang masih dalam proses pairing (belum `creds.registered`).
// SENGAJA dipisah dari scheduleReconnect() di atas: kalau dipatch (408 "QR refs
// attempts ended" dsb) langsung diperlakukan sama seperti reconnect jaringan biasa
// (3 detik, lalu 6, 9, ...), bot bakal minta kode pairing baru beruntun dalam
// hitungan detik. Selain kode-nya keburu ganti sebelum sempat diketik di HP,
// permintaan kode yang rapat begitu juga rawan dianggap otomasi/abuse sama
// WhatsApp -- itu yang bikin error awalnya cuma 408 lalu naik jadi 401
// "Connection Failure". Jadi di sini jedanya jauh lebih lama & percobaannya
// dibatasi lewat pairingAttempts/maxPairingAttempts, bukan reconnectAttempts.
const pairingRetryDelayMs = 25000;
function schedulePairingRetry(reason) {
	if (reconnectTimer) return;
	pairingAttempts++;
	if (pairingAttempts >= maxPairingAttempts) {
		console.log(chalk.redBright(`[FATAL] Pairing gagal terus (${reason}) setelah ${maxPairingAttempts}x percobaan.`));
		console.log(chalk.redBright('Kemungkinan penyebab: kode tidak sempat dimasukkan sebelum expired, NOMOR YANG DIKETIK SAAT START BOT BEDA DENGAN NOMOR WHATSAPP DI HP yang dipakai masukin kode, atau nomor sedang dibatasi sementara oleh WhatsApp karena permintaan kode berulang. Tunggu beberapa menit sebelum coba lagi, dan pastikan nomornya benar-benar sama.'));
		fs.rmSync('./voxel_session', { recursive: true, force: true });
		process.exit(1);
	}
	console.log(chalk.yellow(`[PAIRING RETRY] Alasan: ${reason}. Percobaan ke-${pairingAttempts}/${maxPairingAttempts}, minta kode baru dalam ${(pairingRetryDelayMs / 1000).toFixed(0)} detik (sengaja dipelankan biar tidak dianggap spam oleh WhatsApp)...`));
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		startVoxelBot().catch((e) => {
			console.log(chalk.redBright('[FATAL] Pairing retry gagal dijalankan:'), e)
			schedulePairingRetry('retry-error')
		});
	}, pairingRetryDelayMs);
}

const userInfoSyt = () => {
	try {
		return os.userInfo().username
	} catch (e) {
		return process.env.USER || process.env.USERNAME || 'unknown';
	}
}

try {
	dns.setServers(['8.8.8.8', '1.1.1.1']);
	console.log(chalk.yellowBright('[SYSTEM] Custom DNS Google & Cloudflare.'));
} catch (e) {
	console.log(chalk.yellowBright('[SYSTEM] failed to custom DNS:'), e.message);
}

// Fetch Api
global.fetchApi = async (endpoint = '/', data = {}, options = {}) => {
	return new Promise(async (resolve, reject) => {
		try {
			const apiList = Object.keys(global.APIs);
			if (options.api !== undefined) {
				if (typeof options.api !== 'number' || options.api < 1 || options.api > apiList.length) {
					return reject(new Error(`[Fetch Error] Parameter { api: ${options.api} } tidak terdaftar. Harap gunakan angka 1 hingga ${apiList.length}.`));
				}
			}
			const apiName = typeof options.api === 'number' ? apiList[options.api - 1] : options.name
			const base = apiName ? (global.APIs[apiName] || apiName) : global.APIs.voxel
			const apikey = global.APIKeys[base] || '';
			// Jangan kirim field/parameter apikey sama sekali kalau memang belum diisi.
			// Mengirim "apikey=" kosong ke server tujuan (mis. siputzx) bisa dianggap
			// sebagai apikey invalid, bukan request anonim, dan berujung 429 instan.
			const hasAuthHeader = !!options.headers?.['Authorization'];
			const apikeyField = (!hasAuthHeader && apikey) ? { apikey } : {};
			let method = (options.method || 'GET').toUpperCase()
			let url = base + endpoint 
			let payload = null
			let headers = options.headers || { 'user-agent': 'Mozilla/5.0 (Linux; Android 15)' }
			const isForm = options.form || data instanceof FormData || (data && typeof data.getHeaders === 'function');
			if (isForm) {
				payload = data
				method = 'POST'
				headers = { ...apikeyField, ...headers, ...data.getHeaders() }
			} else if (method !== 'GET') {
				payload = { ...data, ...apikeyField }
				headers['content-type'] = 'application/json'
			} else {
				url += (Object.keys({ ...data, ...apikeyField }).length ? '?' + new URLSearchParams({ ...data, ...apikeyField }).toString() : '')
			}
			const res = await axios({
				method, url, data: payload,
				headers, httpsAgent: customHttpsAgent,
				responseType: options.stream ? 'stream' : (options.buffer ? 'arraybuffer' : options.responseType || options.type || 'json'),
			});
			if (options.stream) {
				let ext = options.ext
				if (typeof options.stream !== 'string' && !ext) {
					const contentDisp = res.headers['content-disposition']
					const contentType = res.headers['content-type']
					if (contentDisp && contentDisp.includes('filename=')) {
						const match = contentDisp.match(/filename="?([^"]+)"?/)
						if (match && match[1]) {
							ext = match[1].split('.').pop()
						}
					}
					if (!ext && contentType) {
						ext = contentType.split('/')[1]?.split(';')[0]
						if (ext === 'jpeg') ext = 'jpg'
					}
					ext = ext || 'tmp'
				}
				let streamPath = typeof options.stream === 'string' ? options.stream : path.join(process.cwd(), 'database/temp', 'temp-' + Date.now() + '.' + ext)
				const writeStream = fs.createWriteStream(streamPath)
				res.data.pipe(writeStream)
				writeStream.on('finish', () => resolve(streamPath))
				writeStream.on('error', reject)
			} else {
				resolve(options.buffer ? Buffer.from(res.data) : res.data)
			}
		} catch (e) {
			reject(e)
		}
	})
}

const storeDB = dataBase(global.tempatStore);
const database = dataBase(global.tempatDB);
const msgRetryCounterCache = new NodeCache({ stdTTL: 60 * 60, useClones: false });

if (fs.existsSync(tempDir)) {
	fs.readdirSync(tempDir).forEach(file => {
		fs.unlinkSync(path.join(tempDir, file));
	});
	console.log(chalk.greenBright('[SYSTEM] Temp folder cleared successfully!'));
} else {
	fs.mkdirSync(tempDir, { recursive: true });
}

assertInstalled(process.platform === 'win32' ? 'where ffmpeg' : 'command -v ffmpeg', 'FFmpeg', 0);
console.log(chalk.greenBright('✅  All external dependencies are satisfied'));
console.log(chalk.green.bold(`╔═════[${`${chalk.cyan(userInfoSyt())}@${chalk.cyan(os.hostname())}`}]═════`));
print('OS', `${os.platform()} ${os.release()} ${os.arch()}`);
print('Uptime', `${Math.floor(os.uptime() / 3600)} h ${Math.floor((os.uptime() % 3600) / 60)} m`);
print('Shell', process.env.SHELL || process.env.COMSPEC || 'unknown');
print('CPU', os.cpus()[0]?.model.trim() || 'unknown');
print('Memory', `${(os.freemem()/1024/1024).toFixed(0)} MiB / ${(os.totalmem()/1024/1024).toFixed(0)} MiB`);
print('Script version', `v${require('./package.json').version}`);
print('Node.js', process.version);
let baileysVer;
try { baileysVer = require('@sairidev/baileys-new/package.json').version; } catch (e) { baileysVer = require('./package.json').dependencies['@sairidev/baileys-new']; }
print('Baileys', `v${baileysVer}`);
print('Date & Time', new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour12: false }));
console.log(chalk.green.bold('╚' + ('═'.repeat(30))));

async function startVoxelBot() {
	try {
		const loadData = await database.read()
		const storeLoadData = await storeDB.read()
		if (!loadData || Object.keys(loadData).length === 0) {
			global.db = {
				hit: {},
				set: {},
				cmd: {},
				store: {},
				users: {},
				game: {},
				groups: {},
				database: {},
				premium: [],
				sewa: [],
        lidMap: {},
				...(loadData || {}),
			}
			await database.write(global.db)
		} else {
			global.db = loadData
		}
		if (!storeLoadData || Object.keys(storeLoadData).length === 0) {
			global.store = {
				contacts: {},
				presences: {},
				messages: {},
				groupMetadata: {},
				...(storeLoadData || {}),
			}
			await storeDB.write(global.store)
		} else {
			global.store = storeLoadData
		}
		
		global.loadMessage = function (remoteJid, id) {
			const messages = store.messages?.[remoteJid]?.array;
			if (!messages) return null;
			return messages.find(msg => msg?.key?.id === id) || null;
		}
		
		if (!global._dbInterval) {
			global._dbInterval = setInterval(async () => {
				if (global.db) await database.write(global.db)
				if (global.store) await storeDB.write(global.store)
			}, 30 * 1000)
		}

		if (!global._metadataSyncInterval) {
			global._metadataSyncInterval = setInterval(async () => {
				try {
					if (global.store && global.voxelRef) {
						await syncGroupMetadataCache(global.voxelRef, global.store);
						await storeDB.write(global.store);
					}
				} catch (e) {
					console.warn('[METADATA] Auto refresh gagal:', e?.message || e);
				}
			}, 12 * 60 * 60 * 1000);
		}
	} catch (e) {
		console.log(e)
		process.exit(1)
	}
	
	// Level logger baileys bisa dinaikkan lewat env DEBUG_BAILEYS=1 supaya error/warning
	// koneksi (pairing gagal, dsb) kelihatan, bukan "silent" sepenuhnya.
	const level = pino({ level: process.env.DEBUG_BAILEYS ? 'debug' : 'silent' });
	let version;
	try {
		({ version } = await fetchLatestWaWebVersion());
	} catch (e) {
		console.log(chalk.redBright('[ERROR] Gagal mengambil versi WA Web terbaru, memakai fallback bawaan Baileys:'), e.message);
		version = undefined;
	}
	if (pairingCode && !phoneNumber && !fs.existsSync('./voxel_session/creds.json')) {
		fs.rmSync('./voxel_session', { recursive: true, force: true });
		async function getPhoneNumber() {
			phoneNumber = global.number_bot ? global.number_bot : process.env.BOT_NUMBER || await question('Please type your WhatsApp number : ');
			phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
			if (!parsePhoneNumber('+' + phoneNumber).valid && phoneNumber.length < 6) {
				console.log(chalk.bgBlack(chalk.redBright('Start with your Country WhatsApp code') + chalk.whiteBright(',') + chalk.greenBright(' Example : 62xxx')));
				await getPhoneNumber();
			}
		}
		await getPhoneNumber();
		console.log('Phone number captured. Waiting for Connection...\n' + chalk.blueBright('Estimated time: around 2 ~ 5 minutes'));
	}
	const { state, saveCreds } = await useMultiFileAuthState('voxel_session');
	const getMessage = async (key) => {
		if (global.store) {
			const msg = await global.loadMessage(key.remoteJid, key.id);
			return msg?.message || ''
		}
		return {
			conversation: 'Halo Saya Voxel Bot'
		}
	}
	
	// Connector
	const voxel = WAConnection({
		version,
		logger: level,
		getMessage,
		// WA balas 429 "rate-overlimit" (statusCode 500) kalau metadata grup di-query
		// tiap kirim pesan. Default lib = `async () => undefined` (selalu query).
		// Kita kasih cache store yang udah ke-sync, jadi query network cuma saat
		// grup belum pernah di-cache.
		cachedGroupMetadata: async (jid) => global.store?.groupMetadata?.[jid],
		syncFullHistory: false,
		maxMsgRetryCount: 15,
		msgRetryCounterCache,
		retryRequestDelayMs: 10,
		defaultQueryTimeoutMs: 0,
		connectTimeoutMs: 60000,
		keepAliveIntervalMs: 30000,
		// PENTING: contoh resmi @sairidev/baileys-new untuk pairing-code TIDAK
		// pernah set `browser` custom sama sekali. Memaksa fingerprint browser
		// (mis. Browsers.ubuntu('Chrome')) di flow pairing-code adalah salah satu
		// penyebab utama gagal pairing / 401 "Connection Failure" -- WhatsApp
		// menganggap kombinasi OS+browser itu tidak wajar untuk request pairing
		// code. Jadi browser override HANYA dipasang saat pakai QR, bukan pairing.
		...(pairingCode ? {} : { browser: Browsers.ubuntu('Chrome') }),
		generateHighQualityLinkPreview: false,
		transactionOpts: {
			maxCommitRetries: 10,
			delayBetweenTriesMs: 10,
		},
		appStateMacVerification: {
			patch: true,
			snapshot: true,
		},
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, level),
		},
	});
	
	// ============================================================
	// COOLDOWN ANTRIAN PENGIRIMAN PESAN
	// ============================================================
	// Kalau banyak member di grup ngetik command hampir bebarengan, bot bisa
	// nembak banyak balasan sekaligus dalam hitungan milidetik -- pola kirim
	// beruntun-super-cepat-tanpa-jeda kayak gini salah satu pola yang dipantau
	// WhatsApp buat deteksi akun otomasi/spam, dan beresiko kena limit/blokir.
	// voxel.sendMessage() asli dibungkus lewat antrian sederhana: kalau lagi
	// ada beberapa pesan yang mau keluar bebarengan, masing-masing dikasih
	// jeda singkat & acak sebelum beneran dikirim (acak biar polanya nggak
	// "mesin banget"). Kalau cuma 1 pesan lagi antre (nggak ada beban), tetep
	// langsung kirim tanpa jeda tambahan -- ini bukan rate-limit permanen,
	// cuma nyegah ledakan pengiriman pas lagi rame doang.
	//
	// Ini nempel di voxel.sendMessage() level paling bawah, jadi otomatis
	// berlaku buat SEMUA jalur pengiriman (m.reply, template_menu.js, plugin
	// di commands/, dll) tanpa perlu diubah satu-satu di tiap file.
	const SEND_QUEUE_MIN_DELAY_MS = 350;
	const SEND_QUEUE_MAX_DELAY_MS = 900;
	const _originalSendMessage = voxel.sendMessage.bind(voxel);
	const _sendQueue = [];
	let _sendQueueRunning = false;

	async function _processSendQueue() {
		if (_sendQueueRunning) return;
		_sendQueueRunning = true;
		while (_sendQueue.length > 0) {
			const { args, resolve, reject } = _sendQueue.shift();
			try {
				resolve(await _originalSendMessage(...args));
			} catch (e) {
				reject(e);
			}
			if (_sendQueue.length > 0) {
				const delay = SEND_QUEUE_MIN_DELAY_MS + Math.random() * (SEND_QUEUE_MAX_DELAY_MS - SEND_QUEUE_MIN_DELAY_MS);
				await new Promise((r) => setTimeout(r, delay));
			}
		}
		_sendQueueRunning = false;
	}

	voxel.sendMessage = (...args) => new Promise((resolve, reject) => {
		_sendQueue.push({ args, resolve, reject });
		_processSendQueue();
	});
	
	await Solving(voxel, global.store)
	
	voxel.ev.on('creds.update', saveCreds)
	
	voxel.ev.on('connection.update', async (update) => {
		const { qr, connection, lastDisconnect, isNewLogin, receivedPendingNotifications } = update;
		if ((connection === 'connecting' || !!qr) && pairingCode && phoneNumber && !voxel.authState.creds.registered && !pairingStarted) {
			pairingStarted = true;
			setTimeout(async () => {
				try {
					console.log('Requesting Pairing Code...')
					let code = await voxel.requestPairingCode(phoneNumber);
					if (!code) throw new Error('Server tidak mengembalikan pairing code (kemungkinan nomor invalid atau diblokir sementara oleh WhatsApp).');
					pairingAttempts = 0;
					console.log(chalk.blue('Your Pairing Code :'), chalk.green(code), '\n', chalk.yellow('Expires in 15 second'));
				} catch (err) {
					pairingAttempts++;
					console.log(chalk.redBright(`[ERROR] Gagal mendapatkan Pairing Code (percobaan ${pairingAttempts}/${maxPairingAttempts}):`), err.message);
					pairingStarted = false;
					if (pairingAttempts >= maxPairingAttempts) {
						console.log(chalk.redBright('[FATAL] Pairing gagal terus setelah beberapa kali percobaan.'));
						console.log(chalk.redBright('Kemungkinan penyebab: nomor WhatsApp salah/format tidak valid, nomor sedang dibatasi (rate-limited) oleh WhatsApp, atau koneksi internet server tidak stabil.'));
						fs.rmSync('./voxel_session', { recursive: true, force: true });
						process.exit(1);
					}
				}
			}, 3000)
		}
		if (connection === 'close') {
			pairingStarted = false;
			const boomError = new Boom(lastDisconnect?.error)
			const reason = boomError?.output?.statusCode
			// Log pesan asli errornya juga, jangan cuma nama reason -- ini yang sebelumnya
			// "silent" karena logger baileys di-set 'silent' dan tidak ada detail yang tampil.
			console.log(chalk.gray(`[DISCONNECT] statusCode=${reason} message=${boomError?.message || lastDisconnect?.error?.message || 'unknown'}`));
			// Kalau sesi ini belum pernah berhasil pairing (belum `creds.registered`) dan
			// disconnect-nya termasuk jenis "sementara/bisa dicoba lagi" (bukan yang memang
			// sengaja dihentikan seperti badSession/loggedOut/forbidden di bawah), pakai jalur
			// retry pairing yang lebih pelan -- lihat alasan di schedulePairingRetry().
			const stillPairing = pairingCode && phoneNumber && !voxel.authState.creds.registered;
			if (stillPairing && (reason === DisconnectReason.connectionLost || reason === DisconnectReason.connectionClosed || reason === undefined)) {
				console.log('Sesi pairing terputus sebelum selesai, mencoba lagi (lebih pelan)...');
				schedulePairingRetry(`pairing:${reason ?? 'unknown'}`)
			} else if (reason === DisconnectReason.connectionLost) {
				console.log('Connection to Server Lost, Attempting to Reconnect...');
				scheduleReconnect('connectionLost')
			} else if (reason === DisconnectReason.connectionClosed) {
				console.log('Connection closed, Attempting to Reconnect...');
				scheduleReconnect('connectionClosed')
			} else if (reason === DisconnectReason.restartRequired) {
				console.log('Restart Required...');
				reconnectAttempts = 0; // restartRequired itu normal (biasanya setelah pairing sukses), bukan tanda kegagalan
				startVoxelBot().catch((e) => {
					console.log(chalk.redBright('[FATAL] Restart gagal dijalankan:'), e)
					scheduleReconnect('restart-error')
				})
			} else if (reason === DisconnectReason.timedOut) {
				console.log('Connection Timed Out, Attempting to Reconnect...');
				scheduleReconnect('timedOut')
			} else if (reason === DisconnectReason.badSession) {
				console.log(chalk.redBright('Bad Session terdeteksi, menghapus sesi lama dan mencoba ulang...'));
				fs.rmSync('./voxel_session', { recursive: true, force: true });
				scheduleReconnect('badSession')
			} else if (reason === DisconnectReason.connectionReplaced) {
				console.log('Close current Session first...');
			} else if (reason === DisconnectReason.loggedOut) {
				console.log('Scan again and Run...');
				fs.rmSync('./voxel_session', { recursive: true, force: true });
				process.exit(0)
			} else if (reason === DisconnectReason.forbidden) {
				console.log('Connection Failure, Scan again and Run...');
				fs.rmSync('./voxel_session', { recursive: true, force: true });
				process.exit(1)
			} else if (reason === DisconnectReason.multideviceMismatch) {
				console.log('Scan again...');
				fs.rmSync('./voxel_session', { recursive: true, force: true });
				process.exit(0)
			} else {
				console.log(chalk.redBright(`[UNKNOWN DISCONNECT] reason=${reason}. Mencoba reconnect dengan backoff...`));
				scheduleReconnect(`unknown:${reason}`)
			}
		}
		if (connection == 'open') {
			reconnectAttempts = 0;
			pairingAttempts = 0;
			console.log('Connected to : ' + JSON.stringify(voxel.user, null, 2));
			let botNumber = await voxel.decodeJid(voxel.user.id);
			if (global.db?.set[botNumber] && !global.db?.set[botNumber]?.join) {
				if (my.ch.length > 0 && my.ch.includes('@newsletter')) {
					if (my.ch) await voxel.newsletterMsg(my.ch, { type: 'follow' }).catch(e => {})
					db.set[botNumber].join = true
				}
			}
			if (!global._jadibotRestored) {
				global._jadibotRestored = true;
				restoreJadibotSessions().catch((e) => console.log(chalk.redBright('[JADIBOT] Gagal restore sesi tersimpan:'), e.message));
			}
		}
		if (qr) {
			if (!pairingCode) qrcode.generate(qr, { small: true });
		}
		if (isNewLogin) console.log(chalk.green('[INFO] New device login detected...'))
		if (receivedPendingNotifications == 'true') {
			console.log(chalk.green('[INFO] Please wait About 1 Minute...'))
			voxel.ev.flush()
		}
	});
	
	voxel.ev.on('call', async (call) => {
		let botNumber = await voxel.decodeJid(voxel.user.id);
		if (global.db?.set[botNumber]?.anticall) {
			for (let id of call) {
				if (id.status === 'offer') {
					let msg = await voxel.sendMessage(id.from, { text: `Saat Ini, Kami Tidak Dapat Menerima Panggilan ${id.isVideo ? 'Video' : 'Suara'}.\nJika @${id.from.split('@')[0]} Memerlukan Bantuan, Silakan Hubungi Owner :)`, mentions: [id.from]});
					await voxel.sendContact(id.from, global.owner, msg);
					await voxel.rejectCall(id.id, id.from)
				}
			}
		}
	});
	
	voxel.ev.on('messages.upsert', async (message) => {
		await MessagesUpsert(voxel, message, global.store);
	});
	
	voxel.ev.on('group-participants.update', async (update) => {
		await GroupParticipantsUpdate(voxel, update, global.store);
	});
	
	voxel.ev.on('groups.update', (update) => {
		for (const n of update) {
			if (global.store.groupMetadata[n.id]) {
				Object.assign(global.store.groupMetadata[n.id], n);
			} else global.store.groupMetadata[n.id] = n;
		}
	});
	
	voxel.ev.on('presence.update', (update) => {
		const { id, presences } = update;
		global.store.presences[id] = global.store.presences?.[id] || {};
		Object.assign(global.store.presences[id], presences);
	});
	
	// Reset Limit & Backup
	cron.schedule('00 00 * * *', async () => {
		cmdDel(global.db.hit);
		console.log(chalk.cyan('[INFO] Reseted Limit Users'));
		let user = Object.keys(global.db.users)
		let botNumber = await voxel.decodeJid(voxel.user.id);
		for (let jid of user) {
			const limitUser = global.db.users[jid].vip ? global.limit.vip : checkStatus(jid, global.db.premium) ? global.limit.premium : global.limit.free
			if (global.db.users[jid].limit < limitUser) global.db.users[jid].limit = limitUser
		}
		if (global.db?.set[botNumber].autobackup) {
			let datanya = './database/' + global.tempatDB;
			if (global.tempatDB.startsWith('mongodb')) {
				datanya = './database/backup_database.json';
				fs.writeFileSync(datanya, JSON.stringify(global.db, null, 2), 'utf-8');
			}
			for (let o of ownerNumber) {
				try {
					await voxel.sendMessage(o, { document: fs.readFileSync(datanya), mimetype: 'application/json', fileName: new Date().toISOString().replace(/[:.]/g, '-') + '_database.json' })
					console.log(chalk.cyanBright(`[AUTO BACKUP] Backup success send to ${o}`));
				} catch (error) {
					console.error(chalk.cyanBright(`[AUTO BACKUP] Failed to Sending Backup ${o}:`, error));
				}
			}
		}
	}, {
		scheduled: true,
		timezone: global.timezone
	});
	
	// Waktu Sholat
	if (!global.intervalSholat) global.intervalSholat = null;
	if (!global.waktusholat) global.waktusholat = {};
	if (global.intervalSholat) clearInterval(global.intervalSholat); 
	setTimeout(() => {
		global.intervalSholat = setInterval(async() => {
			const sekarang = moment.tz(global.timezone);
			const jamSholat = sekarang.format('HH:mm');
			const hariIni = sekarang.format('YYYY-MM-DD');
			const detik = sekarang.format('ss');
			if (detik !== '00') return;
			for (const [sholat, waktu] of Object.entries(global.jadwalSholat)) {
				if (jamSholat === waktu && global.waktusholat[sholat] !== hariIni) {
					global.waktusholat[sholat] = hariIni
					for (const [idnya, settings] of Object.entries(global.db.groups)) {
						if (settings.waktusholat) {
							await voxel.sendMessage(idnya, { text: `Waktu *${sholat}* telah tiba, ambilah air wudhu dan segeralah shalat🙂.\n\n*${waktu.slice(0, 5)}*\n_untuk wilayah ${global.timezone} dan sekitarnya._` }, { ephemeralExpiration: store?.messages[idnya]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 }).catch(e => {})
						}
					}
				}
			}
		}, 60000)
	}, time_end);
	
	if (!global._dbPresence) {
		if (global?.db?.premium) checkExpired(global.db.premium);
		if (global?.db?.sewa && voxel?.user?.id) checkExpired(global.db.sewa, voxel);
		global._dbPresence = setInterval(async () => {
			if (voxel?.user?.id) await voxel.sendPresenceUpdate('available', voxel.decodeJid(voxel.user.id)).catch(e => {});
		}, 60 * 60 * 1000);
	}

	if (!webServerStarted) {
		webServerStarted = true;
		startWebServer();
	}

	global.voxelRef = voxel;
	await syncGroupMetadataCache(voxel, global.store, { force: true });
	if (global.store) await storeDB.write(global.store);

	return voxel
}

startVoxelBot().catch((e) => {
	console.log(chalk.redBright('[FATAL] startVoxelBot() gagal dijalankan:'), e)
	scheduleReconnect('startup-error')
})

const cleanup = async (signal) => {
	console.log(chalk.greenBright(`[SYSTEM] Received ${signal}. Menyimpan database...`));
	if (global.voxelRef && global.store) {
		try {
			await syncGroupMetadataCache(global.voxelRef, global.store, { force: true });
		} catch (e) {
			console.warn('[METADATA] Sync sebelum shutdown gagal:', e?.message || e);
		}
	}
	if (global.db) await database.write(global.db)
	if (global.store) await storeDB.write(global.store)
	console.log('Menutup sistem. Exiting...')
	process.exit(0)
}

process.on('uncaughtException', function (err) {
  console.error(chalk.redBright('[UNCAUGHT EXCEPTION]'), err);
});

process.on('unhandledRejection', function (err) {
  console.error(chalk.redBright('[UNHANDLED REJECTION]'), err);
});

process.on('SIGINT', () => cleanup('SIGINT'))
process.on('SIGTERM', () => cleanup('SIGTERM'))
process.on('exit', () => cleanup('exit'))
