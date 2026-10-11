import fs from 'fs';
import chalk from 'chalk';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

/*
	* Create By Voxel Fork By Saryu
	* Base Bot: Hitori MD - https://github.com/nazedev/hitori
  * Fork : https://github.com/Sahur01-arch/Voxel-beta
	* Whatsapp : https://whatsapp.com/channel/0029VaWOkNm7DAWtkvkJBK43
*/

//~~~~~~~~~~~~< GLOBAL SETTINGS >~~~~~~~~~~~~\\

global.owner = ["62xxxxxx"] // ['628','628'] 2 owner atau lebih
global.author = 'Saryu'
global.botname = 'Voxel-Beta'
global.packname = 'Voxel-Beta'
global.timezone = 'Asia/Jakarta' // Ganti pakai command .settimezone
global.locale = 'id' // Ganti pakai command .setlocale
global.listprefix = ["+","!","."]
global.defaultAdminKey = crypto.randomBytes(16).toString("hex"); // 32 char hex; set ADMIN_KEY di .env untuk kunci tetap

global.listv = ['•','●','■','✿','▲','➩','➢','➣','➤','✦','✧','△','❀','○','□','♤','♡','◇','♧','々','〆']
global.tempatDB = 'database.json' // Taruh url mongodb di sini jika menggunakan mongodb. Format : 'mongodb+srv://...'
global.tempatStore = 'baileys_store.json' // Taruh url mongodb di sini jika menggunakan mongodb. Format : 'mongodb+srv://...'
global.pairing_code = true
global.number_bot = 'ISI NOMOR DISINI' // Kalo pake panel bisa masukin nomer di sini, jika belum ambil session. Format : '628xx'

global.fake = {
	anonim: 'https://telegra.ph/file/95670d63378f7f4210f03.png',
	thumbnailUrl: 'https://files.catbox.moe/zsq4jp.jpg',
	thumbnail: fs.readFileSync('./src/media/me.jpg'),
	docs: fs.readFileSync('./src/media/fake.pdf'),
	listfakedocs: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/pdf'],
}

global.my = {
	yt: "https://youtube.com/@sahur01-hyc",
	gh: "https://github.com/Sahur01-arch",
	gc: "",
	ch: ""
}

global.limit = {
	free: 20,
	premium: 999,
	vip: 900
}

global.money = {
	free: 10000,
	premium: 1000000,
	vip: 10000000
}

global.mess = {
	key: "Apikey limit! Silahkan hubungi owner untuk upgrade.",
	owner: "Khusus Owner!",
	admin: "Khusus Admin!",
	botAdmin: "Bot harus Admin!",
	onWa: "Nomor tersebut tidak terdaftar di WhatsApp!",
	group: "Khusus Grup!",
	private: "Khusus Private Chat!",
	quoted: "Reply pesannya!",
	limit: "Limit habis!",
	prem: "Khusus Premium!",
	text: "Masukkan teksnya!",
	media: "Kirim medianya!",
	wait: "Proses...",
	fail: "Gagal!",
	error: "Error!",
	done: "Selesai!"
}

global.APIs = {
  voxel: 'https://api.siputzx.my.id/api',
  lol: 'https://api.lolhuman.xyz/api',
  betabotz: 'https://api.betabotz.eu.org/api',
}
global.APIKeys = {
  'https://api.siputzx.my.id/api': '',
  'https://api.lolhuman.xyz/api': 'GANTI_DENGAN_APIKEY_LOLHUMAN_KAMU', // Daftar/login di https://api.lolhuman.xyz untuk dapat apikey (gratis: 10 req/hari)
  'https://api.betabotz.eu.org/api': 'GANTI_DENGAN_APIKEY_BETABOTZ_MU',
}

// Lainnya
global.jadwalSholat = {
	Subuh: '04:30',
	Dzuhur: '12:06',
	Ashar: '15:21',
	Maghrib: '18:08',
	Isya: '19:00'
}

global.badWords = ["dongo","konsol"] // input kata-kata toxic yg lain. ex: ['dongo','dongonya']
global.chatLength = 1000

//~~~~~~~~~~~~< JADIBOT >~~~~~~~~~~~~\\
global.jadibotMode = true       // true = fitur .jadibot bisa dipakai semua orang, false = fitur dimatikan total
global.jadibotOwnerOnly = true // true = cuma owner utama yang boleh bikin Jadibot baru (paling ketat, override premium)
global.jadibotPremiumOnly = false // true = cuma member Premium (dan owner) yang boleh bikin Jadibot baru
global.jadibotLimit = 50        // maksimal sesi Jadibot yang boleh aktif bersamaan di server ini

fs.watchFile(__filename, async () => {
	console.log(chalk.yellowBright(`[UPDATE] ${__filename}`))
});

global.rconAccess = [
  '62xxxxxx@s.whatsapp.net'
  // tambah nomor disini
]

global.rconConfig = {
    host: 'You Host',
    port: 2025,
    password: 'your password'
}
