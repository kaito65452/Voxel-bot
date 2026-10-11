import path from 'path';
import chalk from 'chalk';
import { createRequire } from 'module';
import { jidNormalizedUser } from '@sairidev/baileys-new';
import { updateSettings } from '../lib/function.js';
import { io } from 'socket.io-client';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const packageInfo = require('../package.json');

// ADMIN_KEY: kalau tidak di-set di env, jangan pakai fallback pendek yang
// ditebak orang (dulu hardcode 'voxel'). Generate key acak 32 char hex --
// key ini setara password dashboard, jadi harus kuat dan panjang.
// Set di env untuk dipakai konsisten lintas restart: ADMIN_KEY=<32 hex char>
const ADMIN_KEY = process.env.ADMIN_KEY || global.defaultAdminKey || crypto.randomBytes(16).toString('hex');
const RELAY_SERVER_URL = process.env.RELAY_SERVER_URL || 'https://bot.voxel.biz.id';

// Key global yang BOLEH ditimpa dari dashboard. Sengaja daftar tertutup: kalau
// nanti ada setting baru, tambah di sini -- bukan buka wildcard.
const DASHBOARD_WHITELIST = [
	'owner', 'author', 'botname', 'packname', 'timezone', 'locale',
	'listprefix', 'badWords', 'limit', 'money', 'mess', 'my',
];

// Perbandingan key harus constant-time: `!==` keluar lebih cepat saat byte
// awal beda, itu cukup buat menebak key lewat timing.
function kunciBenar(kandidat) {
	if (typeof kandidat !== 'string') return false;
	const a = Buffer.from(ADMIN_KEY);
	const b = Buffer.from(kandidat);
	// timingSafeEqual melempar kalau panjang beda, jadi samakan dulu dgn
	// padding nol (nama variabel kebalikannya, tapi konsekuensinya sama).
	if (a.length !== b.length) return false;
	return crypto.timingSafeEqual(a, b);
}

async function setupDashboard(database, storeDB, voxel) {
	const socket = io(RELAY_SERVER_URL, {
		transports: ['websocket'],
		reconnection: true,
		reconnectionDelay: 5000,
		reconnectionDelayMax: 10000,
	});

	socket.on('connect', () => {
		console.log(chalk.green('[SOCKET] ✅ Connected to Relay Server Dashboard'));
		
		const registerDevice = (clientObj, isMain) => {
			if (clientObj?.user?.id) {
				const rawId = clientObj.user.id;
				const botNumber = jidNormalizedUser(rawId).split('@')[0];
				const deviceId = rawId.includes(':') ? rawId.split(':')[1].split('@')[0] : '1';
				
				socket.emit('register_bot', { botNumber, id: deviceId, adminKey: ADMIN_KEY });
				
				// URL dashboard mengandung adminKey -> jangan dicetak. Log bot
				// ini bisa tersimpan permanen di file log server, dan log
				// perennial = credential perennial. Set ADMIN_KEY di env kalau
				// butuh URL lengkap, buka manual.
				const label = isMain ? "MAIN BOT" : "SUB-BOT";
				console.log(chalk.blue(`[DASHBOARD ${label}] `) + chalk.white(`terdaftar (botNumber: ${botNumber})`));
			}
		};

		registerDevice(voxel, true);

		if (global.client && typeof global.client === 'object') {
			for (const [key, clientBot] of Object.entries(global.client)) {
				registerDevice(clientBot, false);
			}
		}
	});

	socket.on('disconnect', () => {
		console.log(chalk.red('[SOCKET] ❌ Disconnected from Relay Server'));
	});

	const checkAuth = (adminKey, botNumber, deviceId, targetClient) => {
		if (!kunciBenar(adminKey)) {
			return { success: false, status: 401, message: 'Access Denied! Invalid Admin Key.' };
		}
		if (!botNumber || !deviceId) {
			return { success: false, status: 400, message: 'Bot Number or Device ID is required!' };
		}
		
		let validClient = null;
		if (voxel?.user?.id && voxel.user.id.includes(deviceId)) {
			validClient = voxel;
		} else if (global.client) {
			for (const clientBot of Object.values(global.client)) {
				if (clientBot?.user?.id && clientBot.user.id.includes(deviceId)) {
					validClient = clientBot;
					break;
				}
			}
		}
		
		if (!validClient) {
			return { success: false, status: 404, message: `Device ID ${deviceId} not found in this local bot!` };
		}

		const targetJid = `${botNumber}@s.whatsapp.net`;
		if (!global.db?.set || !global.db.set[targetJid]) {
			return { success: false, status: 404, message: `Database session for ${botNumber} not found.` };
		}
		
		return { success: true, targetJid, clientBot: validClient };
	};

	socket.on('get_info', (data, callback) => {
		if (process.send) {
			process.send('uptime');
			process.once('message', (uptime) => {
				callback({ status: 200, data: { bot_name: packageInfo.name, version: packageInfo.version, author: packageInfo.author, description: packageInfo.description, uptime: `${Math.floor(uptime)} seconds` }});
			});
		} else {
			callback({ status: 500, error: 'Process not running with IPC' });
		}
	});

	socket.on('api_process', ({ adminKey, botNumber, id, send }, callback) => {
		const auth = checkAuth(adminKey, botNumber, id);
		if (!auth.success) return callback(auth);
		if (!send) return callback({ status: 400, error: 'Missing send query' });
		if (process.send) {
			process.send(send);
			callback({ status: 200, status_msg: 'Send', data: send });
		} else callback({ status: 500, error: 'Process not running with IPC' });
	});

	socket.on('get_stats', (payload, callback) => {
		const auth = checkAuth(payload.adminKey, payload.botNumber, payload.id);
		if (!auth.success) return callback(auth);
		try {
			const memoryUsage = process.memoryUsage();
			callback({ success: true, status: 200, stats: { uptime: process.uptime(), memory: { rss: memoryUsage.rss, heapTotal: memoryUsage.heapTotal, heapUsed: memoryUsage.heapUsed, external: memoryUsage.external }, platform: process.platform, nodeVersion: process.version, cpuUsage: process.cpuUsage() } });
		} catch (error) {
			callback({ success: false, status: 500, message: error.message });
		}
	});

	socket.on('get_dashboard_data', (payload, callback) => {
		const auth = checkAuth(payload.adminKey, payload.botNumber, payload.id);
		if (!auth.success) return callback(auth);
		try {
			const { messages, ...filteredStore } = global.store || {};
			const { cmd, cases, ...filteredDb } = global.db || {};
			const targetJid = auth.targetJid;
			let dbSet = {};
			if (filteredDb.set && filteredDb.set[targetJid]) {
				dbSet[targetJid] = filteredDb.set[targetJid];
			}
			callback({
				success: true,
				status: 200,
				database: Object.keys(filteredDb).length > 0 ? {
					hit: filteredDb.hit || {}, set: dbSet, users: filteredDb.users || {},
					groups: filteredDb.groups || {}, premium: filteredDb.premium || [], sewa: filteredDb.sewa || []
				} : { hit: {}, set: {}, users: {}, groups: {}, premium: [], sewa: [] },
				store: Object.keys(filteredStore).length > 0 ? {
					contacts: filteredStore.contacts || {}, presences: filteredStore.presences || {}, groupMetadata: filteredStore.groupMetadata || {}
				} : { contacts: {}, presences: {}, groupMetadata: {} },
				Settings: {
					owner: global.owner || [], author: global.author || 'Voxel', botname: global.botname || 'Hitori Bot',
					packname: global.packname || 'Bot WhatsApp', timezone: global.timezone || 'Asia/Jakarta',
					locale: global.locale || 'id', listprefix: global.listprefix || ['+', '!', '.'],
					pairing_code: global.pairing_code ?? true, number_bot: global.number_bot || '',
					my: global.my || {}, limit: global.limit || { free: 20, premium: 999, vip: 900 },
					money: global.money || { free: 10000, premium: 1000000, vip: 10000000 },
					mess: global.mess || {}, APIs: global.APIs || {}, APIKeys: global.APIKeys || {},
					jadwalSholat: global.jadwalSholat || {}, badWords: global.badWords || [], chatLength: global.chatLength || 1000
				}
			});
		} catch (error) {
			callback({ success: false, status: 500, message: error.message });
		}
	});

	socket.on('save_dashboard_data', async (payload, callback) => {
		const auth = checkAuth(payload.adminKey, payload.botNumber, payload.id);
		if (!auth.success) return callback(auth);
		try {
			const { target, data, addNewApi, botNumber } = payload;
			const targetJid = auth.targetJid;
			if (target === 'database') {
				if (!global.db) global.db = {};
				if (!global.db.hit) global.db.hit = {};
				if (!global.db.set) global.db.set = {};
				if (!global.db.users) global.db.users = {};
				if (!global.db.groups) global.db.groups = {};
				if (!global.db.premium) global.db.premium = [];
				if (!global.db.sewa) global.db.sewa = [];
				if (data.hit) global.db.hit = data.hit;
				if (data.users) global.db.users = data.users;
				if (data.groups) global.db.groups = data.groups;
				if (data.premium) global.db.premium = data.premium;
				if (data.sewa) global.db.sewa = data.sewa;
				if (data.set && data.set[targetJid]) {
					global.db.set[targetJid] = { ...(global.db.set[targetJid] || {}), ...data.set[targetJid] };
				}
				await database.write(global.db);
			} else if (target === 'settings') {
				const settingsPath = path.join(process.cwd(), 'settings.js');
				let updatedOwners = [...data.owner];
				if (!updatedOwners.includes(botNumber)) updatedOwners.push(botNumber);
				await updateSettings({ filePath: settingsPath, botname: data.botname, packname: data.packname, author: data.author, owner: updatedOwners, timezone: data.timezone, locale: data.locale, newMess: data.mess, my: data.my, addNewApi: addNewApi, apikey: data.APIKeys?.['https://api.voxel.biz.id'], neosantara: data.APIKeys?.['https://api.neosantara.xyz/v1'], setPrefixArray: data.listprefix, setBadwordArray: data.badWords });
				if (data.limit) {
					for (const [role, value] of Object.entries(data.limit)) await updateSettings({ filePath: settingsPath, setLimitRole: { role, value } });
				}
				if (data.money) {
					for (const [role, value] of Object.entries(data.money)) await updateSettings({ filePath: settingsPath, setMoneyRole: { role, value } });
				}
				// Object.assign(global, data) dulu dipakai supaya semua nilai
				// settings.js langsung terpakai di RAM. Masalahnya: `data`
				// datang dari dashboard, jadi siapa pun yang lolos auth bisa
				// menimpa global yang BUKAN setting -- jadibotMode,
				// defaultAdminKey, dll. Jadi hanya key yang memang setting
				// yang boleh lewat, sisanya diabaikan.
				for (const key of DASHBOARD_WHITELIST) {
					if (data[key] !== undefined) global[key] = data[key];
				}
				global.owner = updatedOwners;
				if (global.db && global.db.set && global.db.set[targetJid]) {
					global.db.set[targetJid].owner = updatedOwners;
					await database.write(global.db);
				}
			}
			callback({ success: true, status: 200, message: `Data ${target} synchronized successfully!` });
		} catch (error) {
			console.error('[Dashboard API Error]', error);
			callback({ success: false, status: 500, message: 'Failed to save configuration: ' + error.message });
		}
	});

	socket.on('send_chat', async (payload, callback) => {
		const auth = checkAuth(payload.adminKey, payload.botNumber, payload.id);
		if (!auth.success) return callback(auth);
		try {
			const { content, jid } = payload;
			if (!content || !jid) return callback({ success: false, status: 400, message: 'Parameters "jid" and "content" are required!' });
			let targetJid = jid;
			if (!targetJid.includes('@')) targetJid = `${targetJid}@s.whatsapp.net`;
			const sendMsg = await auth.clientBot.sendMessage(targetJid, content);
			callback({ success: true, status: 200, message: 'Message sent successfully!', data: sendMsg });
		} catch (error) {
			console.error('[API Error]', error);
			callback({ success: false, status: 500, message: 'Server Error: Failed to send message.' });
		}
	});

	socket.on('send_command', async (payload, callback) => {
		const auth = checkAuth(payload.adminKey, payload.botNumber, payload.id);
		if (!auth.success) return callback(auth);
		try {
			const { content, jid } = payload;
			if (!content || !jid) return callback({ success: false, status: 400, message: 'Missing jid or content params' });
			const sendMsg = await auth.clientBot.appendResponseMessageV2(jid, content);
			callback({ success: true, status: 200, message: 'Message successfully injected into bot event!', data: sendMsg });
		} catch (e) {
			console.error(e);
			callback({ success: false, status: 500, message: 'Server Error!' });
		}
	});

	return socket;
}

export { setupDashboard };
