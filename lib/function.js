import fs from 'fs';
import dns from 'dns';
import net from 'net';
import path from 'path';
import axios from 'axios';
import https from 'https';
import chalk from 'chalk';
import fse from 'fs-extra';
import { Jimp } from 'jimp';
import fetch from 'node-fetch';
import unzipper from 'unzipper';
import { sizeFormatter } from 'human-readable';
import { exec, execSync } from 'child_process';

const pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split('');

const SERVER_ZIP = 'https://github.com/yuusha2011/Voxel-beta/archive/refs/heads/main.zip';
const VERSION_URL = 'https://raw.githubusercontent.com/yuusha2011/Voxel-beta/main/package.json';

const ROOT_DIR = process.cwd();

const WHITELIST = [
	'node_modules',
	'database',
	'voxel_session',
	'.env',
	'settings.js'
];

const errorCache = {};

const unsafeAgent = new https.Agent({
	rejectUnauthorized: false
});

const customHttpsAgent = new https.Agent({
	lookup: (hostname, options, callback) => {
		let cb = callback;
		let opts = options;
		if (typeof options === 'function') {
			cb = options;
			opts = {};
		}
		dns.resolve4(hostname, (err, addresses) => {
			if (err) return cb(err);
			if (!addresses || addresses.length === 0) {
				const error = new Error(`ENOTFOUND: Tidak menemukan IPv4 untuk ${hostname}`);
				error.code = 'ENOTFOUND';
				return cb(error);
			}
			if (opts && opts.all) {
				const formatted = addresses.map(ip => ({ address: ip, family: 4 }));
				return cb(null, formatted);
			}
			cb(null, addresses[0], 4); 
		});
	}
});

const axiosss = axios.create({
	httpsAgent: new https.Agent({ rejectUnauthorized: false, keepAlive: false }),
});

const getRandom = (ext) => {
	return `${Math.floor(Math.random() * 10000)}${ext}`
}

const getBuffer = async (url, options = {}) => {
	let bufferData = null;
	let axiosResponse = null;
	let fetchResponse = null;
	try {
		axiosResponse = await axios.get(url, {
			headers: {
				'DNT': 1,
				'Upgrade-Insecure-Request': 1
			},
			responseType: 'arraybuffer',
			httpsAgent: unsafeAgent,
			...options
		})
		bufferData = axiosResponse.data;
		return bufferData;
	} catch (e) {
		try {
			fetchResponse = await fetch(url, { agent: unsafeAgent });
			bufferData = await fetchResponse.buffer()
			return bufferData
		} catch (e) {
			return e
		}
	} finally {
		bufferData = null;
		axiosResponse = null;
		fetchResponse = null;
	}
}

const fetchJson = async (url, options = {}) => {
	try {
		const { data } = await axios.get(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
			},
			httpsAgent: unsafeAgent,
			...options
		})
		return data
	} catch (e) {
		try {
			const res = await fetch(url, { agent: unsafeAgent });
			const anu = await res.json()
			return anu
		} catch (e) {
			return e
		}
	}
}

const runtime = function(seconds) {
	seconds = Number(seconds);
	var d = Math.floor(seconds / (3600 * 24));
	var h = Math.floor(seconds % (3600 * 24) / 3600);
	var m = Math.floor(seconds % 3600 / 60);
	var s = Math.floor(seconds % 60);
	var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
	var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
	var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
	var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
	return dDisplay + hDisplay + mDisplay + sDisplay;
}

const clockString = (ms) => {
	let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000)
	let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
	let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
	return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}

const sleep = async (ms) => {
	return new Promise(resolve => setTimeout(resolve, ms));
}

const isUrl = (url) => {
	return url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/, 'gi'))
}

const formatDate = (n, locale = 'id') => {
	let d = new Date(n)
	return d.toLocaleDateString(locale, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric'
	})
}

const formatp = sizeFormatter({
	std: 'JEDEC', //'SI' = default | 'IEC' | 'JEDEC'
	decimalPlaces: 2,
	keepTrailingZeroes: false,
	render: (literal, symbol) => `${literal} ${symbol}B`,
});

const generateProfilePicture = async (buffer, size) => {
	let cropped;
	const jimp = await Jimp.read(buffer)
	const w = jimp.width
	const h = jimp.height
	if (size) {
		const min = Math.min(w, h)
		const x = (w - min) / 2
		const y = (h - min) / 2
		cropped = jimp.crop({ x, y, w: min, h: min }).resize({ w: size, h: size });
	} else cropped = jimp.crop({ x: 0, y: 0, w, h });
	return {
		img: await cropped.scaleToFit({ w: 720, h: 720 }).getBuffer('image/jpeg'),
		preview: await cropped.scaleToFit({ w: 720, h: 720 }).getBuffer('image/jpeg')
	}
}

const bytesToSize = (bytes, decimals = 2) => {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const normalize = s => s.replace(/\s+/g, '').split('').sort().join('');

const encodeToLetters = (str) => {
	let result = ''
	for (let i = 0; i < str.length; i++) {
		let char = str[i]
		if (/[a-zA-Z]/.test(char)) {
			result += char
		} else if (char !== ' ') {
			result += String.fromCharCode(97 + (str.charCodeAt(i) % 26))
		}
	}
	return result || 'user'
}

const getSizeMedia = async (path) => {
	return new Promise((resolve, reject) => {
		if (typeof path === 'string' && /http/.test(path)) {
			axios.get(path).then((res) => {
				let length = parseInt(res.headers['content-length'])
				if(!isNaN(length)) resolve(bytesToSize(length, 3))
			})
		} else if (Buffer.isBuffer(path)) {
			let length = Buffer.byteLength(path)
			if(!isNaN(length)) resolve(bytesToSize(length, 3))
		} else {
			reject(0)
		}
	})
}

// Nilai yang ditulis ke settings.js harus berupa string yang SELALU aman untuk
// disisipkan ke source JS: JSON.stringify menutup dengan "..." dan escape
// semua newline/quote. Tanpa ini, nilai dari dashboard bisa menyisipkan kode:
// author = "x', global.owner = ['628xxx'  //" -> nulis baris JS bebas.
// Pola `$` di nilai juga PERLU di-escape kalau masih pakai .replace(re, string),
// karena `$&`/`$1` ditafsirkan sebagai backreference.
function nilaiJS(v) {
	if (typeof v !== 'string') throw new Error('Nilai harus string');
	const s = v.trim();
	if (s.length > 100) throw new Error('Nilai maksimal 100 karakter');
	if (/[\n\r]/.test(s)) throw new Error('Nilai tidak boleh mengandung baris baru');
	return JSON.stringify(s);
}

// Ganti nilai string di settings.js. Pemakai selalu fungsi, bukan string, jadi
// nilai yang mengandung `$` tidak ikut tertafsirkan sebagai backreference.
function tulisString(content, nama, v) {
	return content.replace(
		new RegExp(`(global\\.${nama}\\s*=\\s*)['"\`]([^'"\`]*)['"\`]`),
		(_, prefix) => prefix + nilaiJS(v)
	);
}

async function updateSettings({
	filePath, owner, author, apikey, botname, packname,
	neosantara, setPrefixArray, setBadwordArray, my, addNewApi,
	locale, timezone, addPrefix, removePrefix, newMess,
	addBadword, removeBadword, setLimitRole, setMoneyRole
}) {
	return new Promise((resolve, reject) => {
		try {
			let content = fs.readFileSync(filePath, 'utf8');
			if (owner) {
				content = content.replace(/global\.owner\s*=\s*\[[^\]]*\]/, () => `global.owner = ${JSON.stringify(owner)}`);
				global.owner = owner;
			}
			if (author) {
				content = tulisString(content, 'author', author);
				global.author = author;
			}
			if (apikey) {
				content = content.replace(/(global\.APIKeys\s*=\s*\{[\s\S]*?'https:\/\/api\.voxel\.biz\.id'\s*:\s*')[^']*(')/, (_, a, b) => a + nilaiJS(apikey).slice(1, -1) + b);
				if (global.APIKeys) global.APIKeys[global.APIs.voxel] = apikey;
			}
			if (botname) {
				content = tulisString(content, 'botname', botname);
				global.botname = botname;
			}
			if (packname) {
				content = tulisString(content, 'packname', packname);
				global.packname = packname;
			}
			if (locale) {
				content = tulisString(content, 'locale', locale);
				global.locale = locale;
			}
			if (timezone) {
				content = tulisString(content, 'timezone', timezone);
				global.timezone = timezone;
			}
			if (neosantara) {
				content = content.replace(/(global\.APIKeys\s*=\s*\{[\s\S]*?'https:\/\/api\.neosantara\.xyz\/v1'\s*:\s*')[^']*(')/, (_, a, b) => a + nilaiJS(neosantara).slice(1, -1) + b);
				if (global.APIKeys) global.APIKeys[global.APIs.neosantara] = neosantara;
			}
			if (my) {
        content = content.replace(/global\.my\s*=\s*\{[\s\S]*?\}/, () => `global.my = ${JSON.stringify(my, null, '\t').replace(/"([^"]+)":/g, '$1:')}`);
        global.my = my;
      }
			if (addNewApi && addNewApi.name && addNewApi.url) {
        const name = nilaiJS(addNewApi.name).slice(1, -1);
        const url = nilaiJS(addNewApi.url).slice(1, -1);
        const key = addNewApi.key ? nilaiJS(addNewApi.key).slice(1, -1) : '';
        if (!content.includes(url)) {
          content = content.replace(/(global\.APIs\s*=\s*\{)([\s\S]*?)(\})/, (match, start, inner, end) => {
            let body = inner.trimEnd();
            if (body && !body.endsWith(',')) body += ',';
            return `${start}${body}\n  '${name}': '${url}',\n${end}`;
          });
          if (global.APIs) global.APIs[name] = url;
        }
        if (key) {
          content = content.replace(/(global\.APIKeys\s*=\s*\{)([\s\S]*?)(\})/, (match, start, inner, end) => {
            let body = inner.trimEnd();
            if (body && !body.endsWith(',')) body += ',';
            return `${start}${body}\n  '${url}': '${key}',\n${end}`;
          });
          if (global.APIKeys) global.APIKeys[url] = key;
        }
      }

			if (setPrefixArray) {
        content = content.replace(/global\.listprefix\s*=\s*\[(.*?)\]/s, `global.listprefix = ${JSON.stringify(setPrefixArray)}`);
        if (global.listprefix) global.listprefix = setPrefixArray;
      }

      if (setBadwordArray) {
        content = content.replace(/global\.badWords\s*=\s*\[(.*?)\]/s, `global.badWords = ${JSON.stringify(setBadwordArray)}`);
        if (global.badWords) global.badWords = setBadwordArray;
      }

			if (setLimitRole) {
				const { role, value } = setLimitRole;
				content = content.replace(/global\.limit\s*=\s*\{([\s\S]*?)\}/, (match, body) => {
					const updated = body.replace(new RegExp(`(${role}\\s*:\\s*)\\d+`), `$1${value}`);
					return `global.limit = {${updated}}`;
				});
				if (global.limit) global.limit[role] = parseInt(value) || value;
			}
			if (setMoneyRole) {
				const { role, value } = setMoneyRole;
				content = content.replace(/global\.money\s*=\s*\{([\s\S]*?)\}/, (match, body) => {
					const updated = body.replace(new RegExp(`(${role}\\s*:\\s*)\\d+`), `$1${value}`);
					return `global.money = {${updated}}`;
				});
				if (global.money) global.money[role] = parseInt(value) || value;
			}
			if (addPrefix || removePrefix) {
				const match = content.match(/global\.listprefix\s*=\s*\[(.*?)\]/s);
				if (match) {
					let list = match[1].trim() ? match[1].split(',').map(v => v.trim()) : [];
					if (addPrefix && !list.includes(`'${addPrefix}'`)) list.push(`'${addPrefix}'`);
					if (removePrefix) list = list.filter(v => v !== `'${removePrefix}'`);
					content = content.replace(/global\.listprefix\s*=\s*\[(.*?)\]/s, `global.listprefix = [${list.join(', ')}]`);
					if (global.listprefix) {
						global.listprefix = list.map(v => v.replace(/^['"]|['"]$/g, ''));
					}
				}
			}
			if (addBadword || removeBadword) {
				const match = content.match(/global\.badWords\s*=\s*\[(.*?)\]/s);
				if (match) {
					let list = match[1].trim() ? match[1].split(',').map(v => v.trim()) : [];
					if (addBadword && !list.includes(`'${addBadword}'`)) list.push(`'${addBadword}'`);
					if (removeBadword) list = list.filter(v => v !== `'${removeBadword}'`);
					content = content.replace(/global\.badWords\s*=\s*\[(.*?)\]/s, `global.badWords = [${list.join(', ')}]`);
					if (global.badWords) {
						global.badWords = list.map(v => v.replace(/^['"]|['"]$/g, ''));
					}
				}
			}
			if (newMess) {
				const messString = JSON.stringify(newMess, null, '\t').replace(/"([^"]+)":/g, '$1:');
				content = content.replace(/global\.mess\s*=\s*\{[\s\S]*?\}/, `global.mess = ${messString}`);
				global.mess = newMess;
			}
			fs.writeFileSync(filePath, content, 'utf8');
			resolve(true);
		} catch (e) {
			reject(e);
		}
	});
}

// --- SSRF ------------------------------------------------------------------
// Command yang mengambil URL dari user (ssweb, downloader, dll) bisa DIPAKAI
// buat request ke jaringan internal bot: http://localhost:3000, http://10.0.0.5,
// http://169.254.169.254/ (metadata cloud -- bug SSRF cloud yang terkenal).
//
// Perhatikan: cek string saja tidak cukup. Host attacker dikendalikan, jadi
// `http://evil.com` bisa resolve ke 127.0.0.1. Karena itu DNS ikut di-resolve
// dan SETIAP hasil IP-nya dicek.
function ipLokal(ip) {
	const v = String(ip).toLowerCase().replace(/^\[|\]$/g, '');
	if (net.isIPv4(v)) {
		const [a, b] = v.split('.').map(Number);
		if (a === 127) return true;                       // loopback 127/8
		if (a === 10) return true;                        // privat 10/8
		if (a === 172 && b >= 16 && b <= 31) return true; // privat 172.16/12
		if (a === 192 && b === 168) return true;          // privat 192.168/16
		if (a === 169 && b === 254) return true;          // link-local/metadata 169.254/16
		if (a === 0) return true;                         // 0.0.0.0/8
		return false;
	}
	if (net.isIPv6(v)) {
		if (v === '::1' || v === '::') return true;
		// IPv4-mapped/embedded. PENTING: `new URL('http://[::ffff:127.0.0.1]/')`
		// menormalisasi address jadi bentuk HEX (::ffff:7f00:1), bukan desimal.
		// Jadi dua-duanya harus ditangani -- kalau cuma desimal, bypass ini
		// lolos dan Request mendarat di loopback.
		if (/^::ffff:/.test(v)) {
			const mapped = v.match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
			if (mapped) {
				if (mapped[1]) return ipLokal(mapped[1]);
				const hi = parseInt(mapped[2], 16), lo = parseInt(mapped[3], 16);
				return ipLokal([hi >> 8, hi & 255, lo >> 8, lo & 255].join('.'));
			}
		}
		if (/^f[cd][0-9a-f]{2}:/.test(v)) return true;     // fc00::/7 unique-local
		if (/^fe[89ab][0-9a-f]:/.test(v)) return true;    // fe80::/10 link-local
		return false;
	}
	return true; // bukan IP yang valid (nama host): biarkan jalur DNS yang menilai
}

// true = URL aman diambil (public http/https). false = tolak.
async function isSafePublicUrl(url) {
	if (typeof url !== 'string' || !url.trim()) return false;
	let u;
	try {
		u = new URL(url.trim());
	} catch {
		return false; // bukan URL valid
	}
	if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
	const host = u.hostname.toLowerCase().replace(/\.$/, '');
	if (!host) return false;
	if (host === 'localhost' || host.endsWith('.localhost')) return false;
	if (host.endsWith('.local') || host.endsWith('.internal')) return false;
	// IP literal: tidak perlu resolve.
	if (net.isIP(host.replace(/^\[|\]$/g, ''))) return !ipLokal(host);
	// Nama host: resolve dan cek SEMUA hasil (bisa >1, mis. round-robin).
	try {
		const addrs = await dns.promises.lookup(host, { all: true });
		if (!addrs.length) return false;
		return addrs.every(a => !ipLokal(a.address));
	} catch {
		return false; // DNS gagal = tidak bisa diverifikasi = jangan diambil
	}
}

const parseMention = (text = '') => {
	return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
}

function fixBytes(obj) {
	if (obj instanceof Uint8Array || Buffer.isBuffer(obj)) return obj
	if (typeof obj !== 'object') return obj
	return Uint8Array.from(Object.values(obj))
}

function levenshtein(a, b) {
	const m = a.length, n = b.length
	if (m === 0) return n
	if (n === 0) return m
	let dp = Array.from({ length: m+1 }, () => Array(n+1).fill(0))
	for (let i = 0; i <= m; i++) dp[i][0] = i
	for (let j = 0; j <= n; j++) dp[0][j] = j
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			let cost = a[i - 1] === b[j - 1] ? 0 : 1
			dp[i][j] = Math.min(dp[i - 1][j]+1, dp[i][j - 1]+1, dp[i - 1][j - 1]+cost)
		}
	}
	return dp[m][n]
}

function similarity(a, b) {
	let m_length = Math.max(a.length, b.length)
	if (m_length === 0) return 1
	return (m_length - levenshtein(a, b)) / m_length
}

function assertInstalled(cmd, name, code) {
	try {
		execSync(cmd, { stdio: 'ignore' });
	} catch (e) {
		console.error(chalk.redBright(`❌  ${name} is not installed or not in PATH.`) +`\nPlease install it first and run the script again.\n`);
		process.exit(code);
	}
}

function pickRandom(list) {
	return list[Math.floor(list.length * Math.random())]
}

function tarBackup(source, output) {
	return new Promise((resolve, reject) => {
		exec(`tar -czf ${output} --exclude=${output} --exclude='./node_modules' ${source}`, (err, stdout, stderr) => {
			if (err) return reject(err);
			resolve(output);
		})
	})
}

async function runUpdate() {
	try {
		console.log(chalk.cyanBright('[INFO] Checking version in package.json...'));
		
		const isTermux = process.env.PREFIX && process.env.PREFIX.includes('com.termux');
		const INSTALL_CMD = isTermux ? 'yarn' : 'npm install';
		const localPkgPath = path.join(ROOT_DIR, 'package.json');
		let localVersion = 'unknown';
		let localPkg = { dependencies: {} };

		if (fs.existsSync(localPkgPath)) {
			localPkg = JSON.parse(fs.readFileSync(localPkgPath, 'utf-8'));
			localVersion = localPkg.version || 'unknown';
		}

		const versionRes = await axios.get(VERSION_URL, { timeout: 10000 });
		const remotePkg = versionRes.data;
		const remoteVersion = remotePkg.version; 

		if (!remoteVersion) {
			throw new Error('Failed to fetch version from remote package.json');
		}

		if (localVersion === remoteVersion) {
			console.log(chalk.greenBright(`[INFO] Version matches target repository (${localVersion}). No synchronization needed.`));
			return;
		}

		console.log(chalk.yellowBright(`[UPDATE] Version difference detected! Starting synchronization: ${localVersion} → ${remoteVersion}`));

		const localDeps = localPkg.dependencies || {};
		const remoteDeps = remotePkg.dependencies || {};

		const addedDeps = [];
		const removedDeps = [];
		const changedDeps = [];

		for (const [dep, version] of Object.entries(remoteDeps)) {
			if (!localDeps[dep]) {
				addedDeps.push(dep);
			} else if (localDeps[dep] !== version) {
				changedDeps.push(`${dep} (${localDeps[dep]} -> ${version})`);
			}
		}

		for (const dep of Object.keys(localDeps)) {
			if (!remoteDeps[dep]) {
				removedDeps.push(dep);
			}
		}

		let needsNpmInstall = false;
		if (addedDeps.length || removedDeps.length || changedDeps.length) {
			console.log(chalk.magentaBright('\n[DEPENDENCY CHANGES DETECTED]'));
			if (addedDeps.length) console.log(chalk.greenBright(`  [+] Added: ${addedDeps.join(', ')}`));
			if (removedDeps.length) console.log(chalk.redBright(`  [-] Removed: ${removedDeps.join(', ')}`));
			if (changedDeps.length) console.log(chalk.yellowBright(`  [~] Changed: ${changedDeps.join(', ')}`));
			console.log();
			
			if (addedDeps.length || changedDeps.length) needsNpmInstall = true;
		} else {
			console.log(chalk.gray('[INFO] No dependency changes detected.'));
		}

		const zipPath = path.join(ROOT_DIR, 'update.zip');
		const extractPath = path.join(ROOT_DIR, 'update_temp');
		const backupPath = path.join(ROOT_DIR, 'backup_before_update');

		console.log(chalk.cyan('[INFO] Creating backup...'));
		await fse.remove(backupPath);
		await fse.ensureDir(backupPath);

		const rootItems = fs.readdirSync(ROOT_DIR);
		for (let item of rootItems) {
			if (['backup_before_update', 'update.zip', 'update_temp'].includes(item)) {
				continue;
			}
			const itemPath = path.join(ROOT_DIR, item);
			const targetBackupPath = path.join(backupPath, item);
			await fse.copy(itemPath, targetBackupPath);
		}

		console.log(chalk.cyan('[INFO] Downloading repository source code...'));
		const response = await axios({
			method: 'GET',
			url: SERVER_ZIP,
			responseType: 'stream',
			timeout: 60000
		});

		const writer = fs.createWriteStream(zipPath);
		response.data.pipe(writer);

		await new Promise((resolve, reject) => {
			writer.on('finish', resolve);
			writer.on('error', reject);
		});

		console.log(chalk.cyan('[INFO] Extracting files...'));
		await fs
			.createReadStream(zipPath)
			.pipe(unzipper.Extract({ path: extractPath }))
			.promise();

		const folders = fs.readdirSync(extractPath);
		if (!folders.length) {
			throw new Error('Extracted folder is empty');
		}

		const sourceBase = path.join(extractPath, folders[0]);
		const items = fs.readdirSync(sourceBase);

		console.log(chalk.cyan('[INFO] Replacing files...'));

		for (let item of items) {
			if (WHITELIST.includes(item)) {
				console.log(chalk.gray(`[SKIP] ${item}`));
				continue;
			}

			const sourcePath = path.join(sourceBase, item);
			const targetPath = path.join(ROOT_DIR, item);

			await fse.copy(sourcePath, targetPath, {
				overwrite: true,
				recursive: true
			});
			console.log(chalk.green(`[REPLACED] ${item}`));
		}

		console.log(chalk.cyan('[INFO] Cleaning up temporary files...'));
		await fse.remove(zipPath);
		await fse.remove(extractPath);

		if (needsNpmInstall) {
			console.log(chalk.cyanBright(`\n[INFO] Auto-installing new dependencies using "${INSTALL_CMD}"... (Please wait)`));
			try {
				execSync(INSTALL_CMD, { stdio: 'inherit' });
				console.log(chalk.greenBright('[SUCCESS] Dependencies installed successfully.'));
			} catch (npmErr) {
				console.log(chalk.redBright(`[ERROR] Failed during ${INSTALL_CMD}: ${npmErr.message}`));
			}
		}

		console.log(chalk.greenBright('\n[SUCCESS] Version synchronization completed successfully!'));
		console.log(chalk.greenBright(`[INFO] Current version: ${remoteVersion}\n`));

	} catch (err) {
		console.log(chalk.redBright(`\n[ERROR] Process failed: ${err.message}`));

		const backupPath = path.join(ROOT_DIR, 'backup_before_update');
		if (fs.existsSync(backupPath)) {
			console.log(chalk.yellowBright('[ROLLBACK] Reverting to previous version...'));
			try {
				const backupItems = fs.readdirSync(backupPath);
				for (let item of backupItems) {
					const bItemPath = path.join(backupPath, item);
					const rItemPath = path.join(ROOT_DIR, item);
					await fse.copy(bItemPath, rItemPath, { overwrite: true, recursive: true });
				}
				
				console.log(chalk.cyan(`[ROLLBACK] Restoring previous node_modules (running ${INSTALL_CMD})...`));
				execSync(INSTALL_CMD, { stdio: 'ignore' });

				console.log(chalk.greenBright('[ROLLBACK] Revert complete. System restored.'));
			} catch (rollbackErr) {
				console.log(chalk.redBright(`[ERROR] Rollback failed: ${rollbackErr.message}`));
			}
		}
	}
}

export {
	getSizeMedia,
	axiosss,
	assertInstalled,
	getRandom,
	getBuffer,
	fetchJson,
	runtime,
	clockString,
	sleep,
	isUrl,
	formatDate,
	customHttpsAgent,
	formatp,
	runUpdate,
	generateProfilePicture,
	errorCache,
	normalize,
	encodeToLetters,
	updateSettings,
	isSafePublicUrl,
	parseMention,
	fixBytes,
	similarity,
	levenshtein,
	pickRandom,
	unsafeAgent,
	tarBackup
};