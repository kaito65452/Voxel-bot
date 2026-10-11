import './settings.js';
import fs from 'fs';
import os from 'os';
import util from 'util';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';
import { screenshotWebsite } from './lib/ssweb.js';
import { Jimp } from 'jimp';
import yts from 'yt-search';
import fetch from 'node-fetch';
import { Chess } from 'chess.js';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import webp from 'node-webpmux';
import { createRequire } from 'module';
import speed from 'performance-now';
import moment from 'moment-timezone';
import { performance } from 'perf_hooks';
import { parsePhoneNumber } from 'awesome-phonenumber';
import { exec, spawn, execSync } from 'child_process';
import { generateWAMessageContent, jidNormalizedUser, getContentType } from '@sairidev/baileys-new';

import 'moment/min/locales.js';
import { UguuSe } from './lib/uploader.js';
import TicTacToe from './lib/tictactoe.js';
import { antiSpam } from './src/antispam.js';
import { ytMp4, ytMp3 } from './lib/scraper.js';
import { tiktokDl, igdl, spotifydl, pinterest as pinterestDl, threadsdl, mediafire, wallpaperScraper, generateIQC, RemoveBG, imgupscale, videoenhancer, stickerPack, githubstalkFallback, facebookFallback, ffstalk, mlstalk, npmstalk, lyricsSearch, twitterdl, nanoEdit, animeSearch } from './lib/scrapers/index.js';
import { sharpUpscale, imagemagickUpscale, jimpUpscale } from './lib/upscaler.js';
import templateMenu from './lib/template_menu.js';
import { toAudio, toPTT } from './lib/converter.js';
import { GroupUpdate, LoadDataBase } from './src/message.js';
import { cmdAdd, cmdAddHit, addExpired, addXp, getPosition, getExpired, getStatus, checkStatus } from './src/database.js';
import { rdGame, iGame, gameSlot, gameCasinoSolo, gameSamgongSolo, gameMerampok, gameBegal, daily, buy, setLimit, addLimit, addMoney, setMoney, transfer, Blackjack, SnakeLadder } from './lib/game.js';
import { getRandom, getBuffer, fetchJson, runtime, clockString, sleep, isUrl, formatDate, formatp, generateProfilePicture, errorCache, normalize, runUpdate, updateSettings, isSafePublicUrl, parseMention, fixBytes, similarity, pickRandom, encodeToLetters, tarBackup } from './lib/function.js';
import { loadCommands } from './lib/command-loader.js';

// Load commands saat bot melakukan inisialisasi
const externalCommands = await loadCommands('./commands');


const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const locales = moment.locales();
const timez = moment.tz.names();
const menfesTimeouts = new Map();
// Proteksi fitur confess/menfes -- bot DM langsung ke nomor yang belum pernah
// chat bot sama sekali (ini persis pola yang bikin akun WA kena restriksi
// "tidak bisa memulai chat baru"). Dua lapis proteksi ditambahin:
// 1. CONFESS_MAX_PER_HOUR -- batasin berapa kali fitur ini BOLEH mulai sesi
//    baru (= cold-DM ke orang asing) per jam, se-bot, bukan per-user.
// 2. menfesAwaitingReply -- setelah 1 pesan dikirim ke target yang belum
//    pernah bales, pesan BERIKUTNYA dari pengirim ditahan (nggak langsung
//    di-relay) sampai target bales duluan. Ini yang langsung nyasar kasus
//    "pengirim ngetik banyak pesan beruntun, target diem, tetep kekirim
//    semua" yang jadi biang keladi restriksi kemarin.
const CONFESS_MAX_PER_HOUR = 5;
const confessSessionLog = [];
const menfesAwaitingReply = new Set();
const settingsPath = path.join(__dirname, 'settings.js');
let canvasModule = null;

/*
	* Create By Voxel
	* Base Bot: Hitori MD - https://github.com/nazedev/hitori
	* Whatsapp : https://whatsapp.com/channel/0029VaWOkNm7DAWtkvkJBK43
*/

try {
	canvasModule = await import('@napi-rs/canvas');
	canvasModule.GlobalFonts.registerFromPath('./src/nulis/font/Indie-Flower.ttf', 'Indie Flower');
	console.log(chalk.yellowBright('[SYSTEM] Fast Mode (Canvas) Active 🚀'));
} catch (error) {
	console.log(chalk.yellowBright('[SYSTEM] Canvas not found. Fallback Imagemagick Active 🐢'));
}

const fileContent = fs.readFileSync(__filename, 'utf-8');
const casesArray = [...fileContent.matchAll(/case\s+['"]([^'"]+)['"]/g)].map(match => match[1]);

// Fallback: kalau user reply pesan yang isinya link (bukan ketik manual
// misalnya .tiktok <url>), otomatis ambil link dari pesan yang di-reply,
// biar gak perlu capek-capek ketik/copy-paste URL-nya lagi.
function resolveDownloadUrl(text, quoted) {
	if (text && /https?:\/\//i.test(text)) return text;
	if (quoted) {
		const q = quoted.msg || quoted;
		const qText = quoted.text || q.caption || q.text || '';
		const match = qText && qText.match(/https?:\/\/\S+/i);
		if (match) return match[0];
	}
	return text;
}

const voxel = async (voxel, m, msg, store) => {
    
	if (!global.db) global.db = {};
	global.db.cases = global.db.cases || casesArray;
	const cases = global.db.cases;

	await LoadDataBase(voxel, m);
	
	const botNumber = voxel.decodeJid(voxel.user.id);
	
	// Read Database
	const sewa = db.sewa
	const premium = db.premium
	const set = db.set[botNumber]
	
	// Database Game
	let suit = db.game.suit
	let chess = db.game.chess
	let menfes = db.game.menfes
	let tekateki = db.game.tekateki
	let tictactoe = db.game.tictactoe
	let tebaklirik = db.game.tebaklirik
	let kuismath = db.game.kuismath
	let blackjack = db.game.blackjack
	let tebaklagu = db.game.tebaklagu
	let tebakkata = db.game.tebakkata
	let family100 = db.game.family100
	let susunkata = db.game.susunkata
	let tebakbom = db.game.tebakbom
	let ulartangga = db.game.ulartangga
	let tebakkimia = db.game.tebakkimia
	let caklontong = db.game.caklontong
	let tebakangka = db.game.tebakangka
	let tebaknegara = db.game.tebaknegara
	let tebakgambar = db.game.tebakgambar
	let tebakbendera = db.game.tebakbendera
	
	// Daftar owner yang AsLIYAs tersimpan di settings.js (`global.owner`).
	// Bot utama menambah nomor bot-nya sendiri ke daftar PEMERIKSAAN
	// (ownerNumber) -- tapi TIDAK PERNAH ke `set.owner`, karena `set.owner`
	// dipakai .addowner/.delowner untuk menulis balik ke settings.js. Kalau
	// nomor bot ikut di sana, satu `.addowner` aja menimpa owner asli di
	// settings.js dengan nomor bot.
	//
	// Sesi Jadibot (sub-bot): nomor sub-bot TIDAK BOLEH jadi owner sama
	// sekali. Kalau iya, siapa pun yang memegang sesi sub-bot dapat akses
	// owner penuh atas bot utama (eval, .backup, .getsession, tulis
	// settings.js, dst).
	const ownerAsli = [...new Set([...global.owner, ...(set?.owner || [])])];
	set.owner = ownerAsli;
	const ownerNumber = voxel.isJadibot ? ownerAsli : [...new Set([...ownerAsli, botNumber.split('@')[0]])];

	try {
		await GroupUpdate(voxel, m, store);
		
		const body = ((m.type === 'conversation') ? m.message.conversation :
		(m.type == 'imageMessage') ? m.message.imageMessage.caption :
		(m.type == 'videoMessage') ? m.message.videoMessage.caption :
		(m.type == 'extendedTextMessage') ? m.message.extendedTextMessage.text :
		(m.type == 'reactionMessage') ? m.message.reactionMessage.text :
		(m.type == 'buttonsResponseMessage') ? m.message.buttonsResponseMessage.selectedButtonId :
		(m.type == 'listResponseMessage') ? m.message.listResponseMessage.singleSelectReply.selectedRowId :
		(m.type == 'templateButtonReplyMessage') ? m.message.templateButtonReplyMessage.selectedId :
		(m.type == 'interactiveResponseMessage'  && m.quoted) ? (m.message.interactiveResponseMessage?.nativeFlowResponseMessage ? JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id : '') :
		(m.type == 'messageContextInfo') ? (m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || '') :
		(m.type == 'editedMessage') ? (m.message.editedMessage?.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text || m.message.editedMessage?.message?.protocolMessage?.editedMessage?.conversation || '') :
		(m.type == 'protocolMessage') ? (m.message.protocolMessage?.editedMessage?.extendedTextMessage?.text || m.message.protocolMessage?.editedMessage?.conversation || m.message.protocolMessage?.editedMessage?.imageMessage?.caption || m.message.protocolMessage?.editedMessage?.videoMessage?.caption || '') : '') || '';
		
		const budy = (typeof m.text == 'string' ? m.text : '')
		const isCreator = global.isOwner = ownerNumber.some(owner => {
			const ownerJid = owner.includes('@') ? owner : owner + '@s.whatsapp.net';
			const findJid = voxel.findJidByLid(jidNormalizedUser(ownerJid), store, true);
			if (!findJid) return false
			return findJid === m.sender
		});

		// Blacklist Group -- kalau grup ini di-blacklist owner, bot beneran
		// mengacuhkan grup ini sepenuhnya: nggak baca pesan, nggak proses
		// command, nggak jalanin fitur apapun sama sekali (auto-read, log,
		// anti-link, dll semua ikut ke-skip karena return di paling awal ini).
		// Beda dari .bansenyap yang target-nya 1 orang DI DALAM grup -- ini
		// target-nya grup itu sendiri secara utuh. Owner tetap lolos, buat
		// jaga-jaga keperluan darurat/debug.
		if (m.isGroup && set.blacklistGroup?.includes(m.chat) && !isCreator) {
			return
		}
		const symbolMatch = set.multiprefix ? body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@()#,'"*+÷/\%^&.©^]/gi) : null;
		const emojiMatch = set.multiprefix ? body.match(/^[\uD800-\uDBFF][\uDC00-\uDFFF]/gi) : null;
		const listMatch = global.listprefix.find(a => body?.startsWith(a));
		const detectedPrefix = symbolMatch ? symbolMatch[0] : (emojiMatch ? emojiMatch[0] : listMatch);
		// authorPrefix null/undefined = belum pernah di-set owner -> ikuti aturan prefix normal (fix: dulu default '' bikin isCmd selalu true untuk owner walau tanpa prefix apapun)
		const hasAuthorOverride = set.authorPrefix !== null && set.authorPrefix !== undefined;
		const normalPrefix = set.multiprefix ? (detectedPrefix || '¿') : (listMatch || '¿');
		const prefix = isCreator ? (hasAuthorOverride ? (detectedPrefix || set.authorPrefix) : normalPrefix) : normalPrefix;
		const isCmd = body.startsWith(prefix)
		const args = body.trim().split(/ +/).slice(1)
		const quoted = m.quoted ? m.quoted : m
		const command = isCmd ? body.replace(prefix, '').trim().split(/ +/).shift().toLowerCase() : '';
		const text = global.q = args.join(' ');

		// Auto-tracking profil user (dikelola sistem, user cuma boleh ubah
		// name/gender/age/bio). Ditaruh SEBELUM dispatch command eksternal
		// di bawah, karena command dari folder commands/ langsung `return`
		// dan nggak pernah sampai ke blok hit global -- kalau autog tracking
		// ditaruh di sana, LastCmd/Cmds buat semua command external stuck "-"/0.
		const profil = global.db.users[m.sender];
		if (profil && !m.sender.endsWith('@g.us')) {
			profil.lastSeen = new Date().toISOString();
			profil.chatCount = (profil.chatCount || 0) + 1;
			// XP: ngobrol di grup +2, pake command +10. Command yang ngabisin limit
			// (game, AI, media) nambah +25 lagi dari setLimit() di lib/game.js.
			addXp(m.sender, global.db, m.isGroup ? 2 : 10);
			if (isCmd) {
				profil.commandCount = (profil.commandCount || 0) + 1;
				profil.lastCommand = command || '-';
			}
		}

		// Set Mode -- HARUS jalan sebelum dispatch command eksternal (folder
		// commands/) juga, bukan cuma buat command bawaan di switch di bawah.
		// Sebelumnya cek ini cuma ada di bawah (dekat switch), jadi command dari
		// commands/ (misalnya .nikahinfo) selalu lolos duluan tanpa pernah kena
		// cek self/public mode sama sekali -- itu penyebab double-response Jadibot
		// + bot utama khusus buat command yang letaknya di folder commands/.
		if ((set.grouponly === set.privateonly)) {
			if (!voxel.public && !m.key.fromMe) return
		}

    const externalCommand = externalCommands.get(command);

    if (externalCommand) {
      // ctx.isLimit dulu nggak pernah dikirim ke sini -- destructure `isLimit`
      // di command manapun di folder commands/ (tiktok, brat, susunkata, ai/*)
      // otomatis jadi `undefined`, dan `if (!isLimit)` selalu true. Efeknya:
      // semua command eksternal langsung balas "limit habis" walau limit
      // usernya masih banyak, tanpa error apapun yang kelihatan.
      const isLimitExternal = isCreator || (db.users[m.sender] ? (db.users[m.sender].limit > 0) : false);
      try {
        await externalCommand.execute({
            m,
            voxel,
            msg,
            store,
            db,
            args,
            text,
            command,
            prefix,
            isCreator,
            isLimit: isLimitExternal,
            isGroup: m.isGroup
        });
      } catch (error) {
        console.error(`[COMMAND ERROR: ${command}]`, error);

        await voxel.sendMessage(
            m.chat,
            {
                text: '❌ Terjadi kesalahan saat mengeksekusi command ini.'
            },
            {
                quoted: m
            }
        );
      }
      return;
    }

		const mime = (quoted.msg || quoted).mimetype || ''
		const qmsg = (quoted.msg || quoted)
		const author = set.author = global.author || 'Voxel';
		const packname = set.packname = global.packname || 'Bot WhatsApp';
		const botname = set.botname = global.botname || 'Hitori Bot';
		const badWordsLower = global.badWords.map(v => v.toLowerCase());
		const locale_day = moment.tz(global.timezone).locale(global.locale).format('dddd');
		const date = moment.tz(global.timezone).locale(global.locale).format('DD/MM/YYYY');
		const date_time = moment.tz(global.timezone).locale(global.locale).format('HH:mm:ss');
		const ucapanWaktu = date_time < '05:00:00' ? 'Selamat Pagi 🌉' : date_time < '11:00:00' ? 'Selamat Pagi 🌄' : date_time < '15:00:00' ? 'Selamat Siang 🏙' : date_time < '18:00:00' ? 'Selamat Sore 🌅' : date_time < '19:00:00' ? 'Selamat Sore 🌃' : date_time < '23:59:00' ? 'Selamat Malam 🌌' : 'Selamat Malam 🌌';
		const almost = 0.66
		const time = Date.now()
		const time_now = new Date()
		const time_end = 60000 - (time_now.getSeconds() * 1000 + time_now.getMilliseconds());
		const readmore = String.fromCharCode(8206).repeat(999)
		const setv = pickRandom(global.listv)
		
		const isVip = isCreator || (db.users[m.sender] ? db.users[m.sender].vip : false)
		const isBan = isCreator || (db.users[m.sender] ? db.users[m.sender].ban : false)
		const isLimit = isCreator || (db.users[m.sender] ? (db.users[m.sender].limit > 0) : false)
		const isPremium = isCreator || checkStatus(m.sender, premium) || false
		const isNsfw = m.isGroup ? db.groups[m.chat].nsfw : false
		
		// Fake
		const fkontak = {
			key: {
				remoteJid: '0@s.whatsapp.net',
				participant: '0@s.whatsapp.net',
				fromMe: false,
				id: 'Voxel'
			},
			message: {
				contactMessage: {
					displayName: (m.pushName || author),
					vcard: `BEGIN:VCARD\nVERSION:3.0\nN:XL;${m.pushName || author},;;;\nFN:${m.pushName || author}\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
					sendEphemeral: true
				}
			}
		}
		
    const reactSequence = async (m, emojis) => {
      for (let i = 0; i < emojis.length; i++) {
        await m.react([i])
        if (i < emojis.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150))
        }
      }
    }
    
		// Auto Set Bio
		if (set.autobio) {
			if (new Date() * 1 - set.status > 60000) {
				await voxel.updateProfileStatus(`${voxel.user.name} | 🎯 Runtime : ${runtime(process.uptime())}`).catch(e => {})
				set.status = new Date() * 1
			}
		}
		
		// Set Mode
		// (Cek self/public mode udah dipindah ke atas, sebelum dispatch command
		// eksternal -- lihat komentar di dekat awal fungsi. Di sini tinggal sisa
		// pengecekan group-only/private-only/whitelist yang emang khusus buat
		// command bawaan di switch, dan tetap boleh di-bypass creator.)
		if (!isCreator) {
			if (set.grouponly && !set.privateonly) {
				if (!m.isGroup) return
			} else if (set.privateonly && !set.grouponly) {
				if (m.isGroup) return
			}

			// Whitelist Chats
			if (set.whitelistonly && voxel.public && set.whitelist.length > 0 && !set.whitelist.includes(m.chat)) return
		}
		
		// Auto Read
		if (m.message && m.key.remoteJid !== 'status@broadcast') {
			// PENTING: readMessages (centang biru) HARUS murni ngikut toggle
			// set.autoread - JANGAN dikasih bypass isCreator di sini. Karena ini
			// self-bot, m.sender buat pesan fromMe selalu balik ke nomor bot itu
			// sendiri (yang otomatis kehitung isCreator di ownerNumber), jadi kalau
			// dikasih bypass, autoread OFF nggak akan pernah beneran kepake - semua
			// pesan yang KAMU kirim sendiri (ke chat manapun) tetep auto keread.
			if (set.autoread && voxel.public) {
				voxel.readMessages([m.key]);
			}
			// Logging ke console tetap boleh nyalain buat aktivitas creator walau
			// autoread lagi off - ini cuma soal keliatan di terminal, bukan blue-tick.
			if ((set.autoread && voxel.public) || isCreator) {
				if (set.log) console.log(chalk.black(chalk.whiteBright('[CHAT]:'), chalk.greenBright(`${locale_day} ${date} (${date_time})`), chalk.hex('#AF26EB')(m.key.id) + '\n' + chalk.hex('#00EAD3')(budy || m.type) + '\n' + chalk.cyanBright('[FROM]:'), chalk.yellowBright(m.pushName || (isCreator ? 'Bot' : 'Anonim')), chalk.hex('#FF449F')(m.sender.split('@')[0]), chalk.hex('#FF5700')(m.isGroup ? m.metadata.subject : m.chat.endsWith('@newsletter') ? 'Newsletter' : 'Private Chat'), chalk.blueBright('(' + m.chat + ')')));
				else console.log(chalk.black(chalk.bgWhite('[CHAT]:'), chalk.bgGreen(`${locale_day} ${date} (${date_time})`), chalk.bgHex('#AF26EB')(m.key.id) + '\n' + chalk.bgHex('#00EAD3')(budy || m.type) + '\n' + chalk.bgCyanBright('[FROM]:'), chalk.bgYellow(m.pushName || (isCreator ? 'Bot' : 'Anonim')), chalk.bgHex('#FF449F')(m.sender), chalk.bgHex('#FF5700')(m.isGroup ? m.metadata.subject : m.chat.endsWith('@newsletter') ? 'Newsletter' : 'Private Chat'), chalk.bgBlue('(' + m.chat + ')')));
			}
		}
		
		// Group Settings
		if (m.isGroup) {
			// Mute
			if (db.groups[m.chat].mute && !isCreator) {
				return
			}
			
			// Ban Senyap -- hapus pesan orang yang di-ban TANPA peringatan/
			// pengumuman apapun (beda dari antilink/antitoxic dll yang tetap
			// ngasih notif publik). Sengaja `return` di sini biar orang yang
			// kena ban senyap juga nggak bisa jalanin command apapun -- diem
			// total, nggak ada jejak/reaksi yang keliatan di grup.
			if (db.groups[m.chat].bansenyap?.includes(m.sender) && !isCreator && m.isBotAdmin && !m.isAdmin) {
				await voxel.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender }}).catch(() => {})
				return
			}
			
			// Anti Hidetag
			if (!m.key.fromMe && m.mentionedJid?.length === m.metadata.participants?.length && db.groups[m.chat].antihidetag && !isCreator && m.isBotAdmin && !m.isAdmin) {
				await voxel.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender }})
				await m.reply('*Anti Hidetag Sedang Aktif❗*')
			}
			
			// Anti Tag Sw
			if (!m.key.fromMe && db.groups[m.chat].antitagsw && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (m.type === 'groupStatusMentionMessage' || m.message?.groupStatusMentionMessage || m.message?.protocolMessage?.type === 25 || Object.keys(m.message).length === 1 && Object.keys(m.message)[0] === 'messageContextInfo') {
					if (!db.groups[m.chat].tagsw[m.sender]) {
						db.groups[m.chat].tagsw[m.sender] = 1
						await m.reply(`Grup ini terdeteksi ditandai dalam Status WhatsApp\n@${m.sender.split('@')[0]}, mohon untuk tidak menandai grup dalam status WhatsApp\nPeringatan ${db.groups[m.chat].tagsw[m.sender]}/5, akan dikick sewaktu waktu❗`)
					} else if (db.groups[m.chat].tagsw[m.sender] >= 5) {
						await voxel.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch((err) => m.reply(global.mess.fail))
						await m.reply(`@${m.sender.split("@")[0]} telah dikeluarkan dari grup\nKarena menandai grup dalam status WhatsApp sebanyak 5x`)
						delete db.groups[m.chat].tagsw[m.sender]
					} else {
						db.groups[m.chat].tagsw[m.sender] += 1
						await m.reply(`Grup ini terdeteksi ditandai dalam Status WhatsApp\n@${m.sender.split('@')[0]}, mohon untuk tidak menandai grup dalam status WhatsApp\nPeringatan ${db.groups[m.chat].tagsw[m.sender]}/5, akan dikick sewaktu waktu❗`)
					}
				}
			}
			
			// Anti Toxic
			if (!m.key.fromMe && db.groups[m.chat].antitoxic && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (budy.toLowerCase().split(/\s+/).some(word => badWordsLower.includes(word))) {
					await voxel.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender }})
					await voxel.relayMessage(m.chat, { extendedTextMessage: { text: `Terdeteksi @${m.sender.split('@')[0]} Berkata Toxic\nMohon gunakan bahasa yang sopan.`, contextInfo: { mentionedJid: [m.key.participantAlt || m.sender], isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: '*Anti Toxic❗*'}, ...m.key }}}, {})
				}
			}
			
			// Anti Delete
			if (m.type === 'protocolMessage' && m.msg?.type === 0 && db.groups[m.chat].antidelete && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (store?.messages?.[m.chat]?.array) {
					const chats = store.messages[m.chat].array.find(a => a.key.id === m.msg.key.id);
					if (!chats?.message) return
					const msgType = Object.keys(chats.message)[0];
					const msgContent = chats.message[msgType];
					if (msgContent.fileSha256 && msgContent.mediaKey) {
						msgContent.mediaKey = fixBytes(msgContent.mediaKey);
						msgContent.fileSha256 = fixBytes(msgContent.fileSha256);
						msgContent.fileEncSha256 = fixBytes(msgContent.fileEncSha256);
					}
					if (msgType !== 'conversation') msgContent.contextInfo = { mentionedJid: [chats.key.participantAlt], isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: '*Anti Delete❗*'}, ...chats.key }
					const pesan = msgType === 'conversation' ? { extendedTextMessage: { text: msgContent, contextInfo: { mentionedJid: [chats.key.participantAlt], isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: '*Anti Delete❗*'}, ...chats.key }}} : { [msgType]: msgContent }
					await voxel.relayMessage(m.chat, pesan, {})
				}
			}
			
			// Anti Link Group
			if (db.groups[m.chat].antilink && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (budy.match('chat.whatsapp.com/')) {
					await voxel.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender }})
					await voxel.relayMessage(m.chat, { extendedTextMessage: { text: `Terdeteksi @${m.sender.split('@')[0]} Mengirim Link Group\nMaaf Link Harus Di Hapus..`, contextInfo: { mentionedJid: [m.key.participantAlt || m.sender], isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: '*Anti Link❗*'}, ...m.key }}}, {})
				}
			}
			
			// Anti Virtex Group
			if (db.groups[m.chat].antivirtex && !isCreator && m.isBotAdmin && !m.isAdmin) {
				if (budy.length > 4500) {
					await voxel.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender }})
					await voxel.relayMessage(m.chat, { extendedTextMessage: { text: `Terdeteksi @${m.sender.split('@')[0]} Mengirim Virtex..`, contextInfo: { mentionedJid: [m.key.participantAlt || m.sender], isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: '*Anti Virtex❗*'}, ...m.key }}}, {})
					await voxel.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
				}
				if (m.msg?.nativeFlowMessage?.messageParamsJson?.length > 3500) {
					await voxel.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.id, participant: m.sender }})
					await voxel.relayMessage(m.chat, { extendedTextMessage: { text: `Terdeteksi @${m.sender.split('@')[0]} Mengirim Bug..`, contextInfo: { mentionedJid: [m.key.participantAlt || m.sender], isForwarded: true, forwardingScore: 1, quotedMessage: { conversation: '*Anti Bug❗*'}, ...m.key }}}, {})
					await voxel.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
				}
			}
			
		}
		
		// Filter Bot & Ban
		if (m.isBot) return
		if (isBan && !isCreator) return
		
		
		// Mengetik & Anti Spam & Hit
		if (voxel.public && isCmd) {
			if (set.autotyping) {
				await voxel.sendPresenceUpdate('composing', m.chat)
			}
			if (cases.includes(command)) {
				cmdAdd(db.hit);
				cmdAddHit(db.hit, command);
			}
			if (set.antispam && antiSpam.isFiltered(m.sender)) {
				console.log(chalk.bgRed('[ SPAM ] : '), chalk.black(chalk.bgHex('#1CFFF7')(`From -> ${m.sender}`), chalk.bgHex('#E015FF')(` In ${m.isGroup ? m.chat : 'Private Chat'}`)))
				return m.reply('「 ❗ 」Beri Jeda 5 Detik Per Command Kak')
			}
			
			if (command && set.didyoumean) {
				let isCommandValid = cases.some(c => c.toLowerCase() === command.toLowerCase());
				if (!isCommandValid) {
					let matches = [];
					for (const c of cases) {
						let cmdTarget = c.toLowerCase();
						let cmdInput = command.toLowerCase();
						let sim = similarity(cmdInput, cmdTarget);
						let lengthDiff = Math.abs(cmdInput.length - cmdTarget.length);
						let isStartsWith = cmdTarget.startsWith(cmdInput);
						if ( ((sim >= almost && lengthDiff <= 3) || isStartsWith) && cmdInput !== cmdTarget ) {
							matches.push({
								name: c, score: isStartsWith ? parseInt(sim * 100) + 10 : parseInt(sim * 100) 
							});
						}
					}
					if (matches.length > 0) {
						matches.sort((a, b) => b.score - a.score);
						let topMatches = matches.slice(0, 5);
						let replyText = `Command Tidak Ditemukan!\nMungkin yang kamu maksud:\n`;
						for (let i = 0; i < topMatches.length; i++) {
							let finalScore = topMatches[i].score > 99 ? 99 : topMatches[i].score;
							replyText += `- ${prefix + topMatches[i].name} (Similarity: ${finalScore}%)\n`;
						}
						return m.reply(replyText.trim());
					}
				}
			}
		}
		
		if (isCmd && !isCreator) antiSpam.addFilter(m.sender)
		
		// Cmd Media
		let fileSha256;
		if (m.isMedia && m.msg.fileSha256 && db.cmd && (m.msg.fileSha256.toString('base64') in db.cmd)) {
			let hash = db.cmd[m.msg.fileSha256.toString('base64')]
			fileSha256 = hash.text
		}
		
		// Salam
		if (/^a(s|ss)alamu('|)alaikum(| )(wr|)( |)(wb|)$/.test(budy?.toLowerCase())) {
			const jwb_salam = ['Wa\'alaikumusalam','Wa\'alaikumusalam wr wb','Wa\'alaikumusalam Warohmatulahi Wabarokatuh']
			m.reply(pickRandom(jwb_salam))
		}
		
		// TicTacToe
		let room = Object.values(tictactoe).find(room => room.id && room.game && room.state && room.id.startsWith('tictactoe') && [room.game.playerX, room.game.playerO].includes(m.sender) && room.state == 'PLAYING')
		if (room) {
			let now = Date.now();
			if (now - (room.lastMove || now) > 5 * 60 * 1000) {
				m.react('❌')
				m.reply('Game Tic-Tac-Toe dibatalkan karena tidak ada aktivitas selama 5 menit.');
				delete tictactoe[room.id];
				return;
			}
			room.lastMove = now;
			let ok, isWin = false, isTie = false, isSurrender = false;
			if (!/^([1-9]|(me)?nyerah|surr?ender|off|skip)$/i.test(m.text)) return
			isSurrender = !/^[1-9]$/.test(m.text)
			if (m.sender !== room.game.currentTurn) {
				if (!isSurrender) return true
			}
			if (!isSurrender && 1 > (ok = room.game.turn(m.sender === room.game.playerO, parseInt(m.text) - 1))) {
				m.react('❌')
				m.reply({'-3': 'Game telah berakhir','-2': 'Invalid','-1': 'Posisi Invalid',0: 'Posisi Invalid'}[ok])
				return true
			}
			m.react('✅')
			if (m.sender === room.game.winner) isWin = true
			else if (room.game.board === 511) isTie = true
			if (!(room.game instanceof TicTacToe)) {
				room.game = Object.assign(new TicTacToe(room.game.playerX, room.game.playerO), room.game)
			}
			let arr = room.game.render().map(v => ({X: '❌',O: '⭕',1: '1️⃣',2: '2️⃣',3: '3️⃣',4: '4️⃣',5: '5️⃣',6: '6️⃣',7: '7️⃣',8: '8️⃣',9: '9️⃣'}[v]))
			if (isSurrender) {
				room.game._currentTurn = m.sender === room.game.playerX
				isWin = true
			}
			let winner = isSurrender ? room.game.currentTurn : room.game.winner
			if (isWin) {
				db.users[m.sender].limit += 3
				db.users[m.sender].money += 3000
			}
			let str = `Room ID: ${room.id}\n\n${arr.slice(0, 3).join('')}\n${arr.slice(3, 6).join('')}\n${arr.slice(6).join('')}\n\n${isWin ? `@${winner.split('@')[0]} Menang!` : isTie ? `Game berakhir` : `Giliran ${['❌', '⭕'][1 * room.game._currentTurn]} (@${room.game.currentTurn.split('@')[0]})`}\n❌: @${room.game.playerX.split('@')[0]}\n⭕: @${room.game.playerO.split('@')[0]}\n\nKetik *nyerah* untuk menyerah dan mengakui kekalahan`
			if ((room.game._currentTurn ^ isSurrender ? room.x : room.o) !== m.chat)
			room[room.game._currentTurn ^ isSurrender ? 'x' : 'o'] = m.chat
			if (room.x !== room.o) await voxel.sendMessage(room.x, { text: str, mentions: parseMention(str) }, { quoted: m })
			await voxel.sendMessage(room.o, { text: str, mentions: parseMention(str) }, { quoted: m })
			if (isTie || isWin) delete tictactoe[room.id]
		}
		
		// Suit PvP
		let roof = Object.values(suit).find(roof => roof.id && roof.status && [roof.p, roof.p2].includes(m.sender))
		if (roof) {
			let now = Date.now();
			let win = '', tie = false;
			if (now - (roof.lastMove || now) > 3 * 60 * 1000) {
				m.reply('Game Suit dibatalkan karena tidak ada aktivitas selama 3 menit.');
				delete suit[roof.id];
				return;
			}
			roof.lastMove = now;
			if (m.sender == roof.p2 && /^(acc(ept)?|terima|gas|oke?|tolak|gamau|nanti|ga(k.)?bisa|y)/i.test(m.text) && m.isGroup && roof.status == 'wait') {
				if (/^(tolak|gamau|nanti|n|ga(k.)?bisa)/i.test(m.text)) {
					m.reply(`@${roof.p2.split('@')[0]} menolak suit,\nsuit dibatalkan`)
					delete suit[roof.id]
					return !0
				}
				roof.status = 'play';
				roof.asal = m.chat;
				m.reply(`Suit telah dikirimkan ke chat\n\n@${roof.p.split('@')[0]} dan @${roof.p2.split('@')[0]}\n\nSilahkan pilih suit di chat masing-masing klik https://wa.me/${botNumber.split('@')[0]}`)
				if (!roof.pilih) voxel.sendMessage(roof.p, { text: `Silahkan pilih \n\nBatu🗿\nKertas📄\nGunting✂️` }, { quoted: m })
				if (!roof.pilih2) voxel.sendMessage(roof.p2, { text: `Silahkan pilih \n\nBatu🗿\nKertas📄\nGunting✂️` }, { quoted: m })
			}
			let jwb = m.sender == roof.p, jwb2 = m.sender == roof.p2;
			let g = /gunting/i, b = /batu/i, k = /kertas/i, reg = /^(gunting|batu|kertas)/i;
			
			if (jwb && reg.test(m.text) && !roof.pilih && !m.isGroup) {
				roof.pilih = reg.exec(m.text.toLowerCase())[0];
				roof.text = m.text;
				m.reply(`Kamu telah memilih ${m.text} ${!roof.pilih2 ? `\n\nMenunggu lawan memilih` : ''}`);
				if (!roof.pilih2) voxel.sendMessage(roof.p2, { text: '_Lawan sudah memilih_\nSekarang giliran kamu' })
			}
			if (jwb2 && reg.test(m.text) && !roof.pilih2 && !m.isGroup) {
				roof.pilih2 = reg.exec(m.text.toLowerCase())[0]
				roof.text2 = m.text
				m.reply(`Kamu telah memilih ${m.text} ${!roof.pilih ? `\n\nMenunggu lawan memilih` : ''}`)
				if (!roof.pilih) voxel.sendMessage(roof.p, { text: '_Lawan sudah memilih_\nSekarang giliran kamu' })
			}
			let stage = roof.pilih
			let stage2 = roof.pilih2
			if (roof.pilih && roof.pilih2) {
				if (b.test(stage) && g.test(stage2)) win = roof.p
				else if (b.test(stage) && k.test(stage2)) win = roof.p2
				else if (g.test(stage) && k.test(stage2)) win = roof.p
				else if (g.test(stage) && b.test(stage2)) win = roof.p2
				else if (k.test(stage) && b.test(stage2)) win = roof.p
				else if (k.test(stage) && g.test(stage2)) win = roof.p2
				else if (stage == stage2) tie = true
				db.users[roof.p == win ? roof.p : roof.p2].limit += tie ? 0 : 3
				db.users[roof.p == win ? roof.p : roof.p2].money += tie ? 0 : 3000
				voxel.sendMessage(roof.asal, { text: `_*Hasil Suit*_${tie ? '\nSERI' : ''}\n\n@${roof.p.split('@')[0]} (${roof.text}) ${tie ? '' : roof.p == win ? ` Menang \n` : ` Kalah \n`}\n@${roof.p2.split('@')[0]} (${roof.text2}) ${tie ? '' : roof.p2 == win ? ` Menang \n` : ` Kalah \n`}\n\nPemenang Mendapatkan\n*Hadiah :* Uang(3000) & Limit(3)`.trim(), mentions: [roof.p, roof.p2] }, { quoted: m })
				delete suit[roof.id]
			}
		}
		
		// Tebak Bomb
		let pilih = '🌀', bomb = '💣';
		if (m.sender in tebakbom) {
			if (!/^[1-9]|10$/i.test(body) && !isCmd && !isCreator) return !0;
			let index = parseInt(body) - 1;
			if (tebakbom[m.sender].petak[index] === 1 || tebakbom[m.sender].petak[index] === 3) return !0;
			if (tebakbom[m.sender].petak[index] === 2) {
				tebakbom[m.sender].petak[index] = 3;
				tebakbom[m.sender].board[index] = bomb;
				tebakbom[m.sender].pick++;
				m.react('❌')
				tebakbom[m.sender].bomb--;
				tebakbom[m.sender].nyawa.pop();
				let brd = tebakbom[m.sender].board;
				if (tebakbom[m.sender].nyawa.length < 1) {
					await m.reply(`*GAME TELAH BERAKHIR*\nKamu terkena bomb\n\n ${brd.join('')}\n\n*Terpilih :* ${tebakbom[m.sender].pick}\n_Pengurangan Limit : 1_`);
					m.react('😂')
					delete tebakbom[m.sender];
				} else m.reply(`*PILIH ANGKA*\n\nKamu terkena bomb\n ${brd.join('')}\n\nTerpilih: ${tebakbom[m.sender].pick}\nSisa nyawa: ${tebakbom[m.sender].nyawa.join('')}`);
				return !0;
			}
			if (tebakbom[m.sender].petak[index] === 0) {
				tebakbom[m.sender].petak[index] = 1;
				tebakbom[m.sender].board[index] = pilih;
				tebakbom[m.sender].pick++;
				tebakbom[m.sender].lolos--;
				let brd = tebakbom[m.sender].board;
				if (tebakbom[m.sender].lolos < 1) {
					db.users[m.sender].money += 6000
					await m.reply(`*KAMU HEBAT ಠ⁠ᴥ⁠ಠ*\n\n${brd.join('')}\n\n*Terpilih :* ${tebakbom[m.sender].pick}\n*Sisa nyawa :* ${tebakbom[m.sender].nyawa.join('')}\n*Bomb :* ${tebakbom[m.sender].bomb}\nBonus Money 💰 *+6000*`);
					delete tebakbom[m.sender];
				} else m.reply(`*PILIH ANGKA*\n\n${brd.join('')}\n\nTerpilih : ${tebakbom[m.sender].pick}\nSisa nyawa : ${tebakbom[m.sender].nyawa.join('')}\nBomb : ${tebakbom[m.sender].bomb}`)
			}
		}
		
		// Game
		const games = { tebaklirik, tekateki, tebaklagu, tebakkata, kuismath, susunkata, tebakkimia, caklontong, tebakangka, tebaknegara, tebakgambar, tebakbendera }
		for (let gameName in games) {
			let game = games[gameName];
			let id = iGame(game, m.chat);
			if ((!isCmd || isCreator) && m.quoted && id == m.quoted.id) {
				if (game[m.chat + id]?.jawaban) {
					if (gameName == 'kuismath') {
						let jawaban = game[m.chat + id].jawaban
						const difficultyMap = { 'noob': 1, 'easy': 1.5, 'medium': 2.5, 'hard': 4, 'extreme': 5, 'impossible': 6, 'impossible2': 7 };
						let randMoney = difficultyMap[kuismath[m.chat + id].mode]
						if (!isNaN(budy)) {
							if (budy.toLowerCase() == jawaban) {
								db.users[m.sender].money += randMoney * 1000
								await m.reply(`Jawaban Benar 🎉\nBonus Money 💰 *+${randMoney * 1000}*`)
								delete kuismath[m.chat + id]
							} else m.reply('*Jawaban Salah!*')
						}
					} else {
						let jawaban = game[m.chat + id].jawaban
						let jawabBenar = /tekateki|tebaklirik|tebaklagu|tebakkata|tebaknegara|tebakbendera/.test(gameName) ? (similarity(budy.toLowerCase(), jawaban) >= almost) : (budy.toLowerCase() == jawaban)
						let bonus = gameName == 'caklontong' ? 9999 : gameName == 'tebaklirik' ? 4299 : gameName == 'susunkata' ? 2989 : 3499
						if (jawabBenar) {
							db.users[m.sender].money += bonus * 1
							await m.reply(`Jawaban Benar 🎉\nBonus Money 💰 *+${bonus}*`)
							delete game[m.chat + id]
						} else m.reply('*Jawaban Salah!*')
					}
				}
			}
		}
		
		// Family 100
		if (m.chat in family100) {
			if (m.quoted && m.quoted.id == family100[m.chat].id && !isCmd) {
				let room = family100[m.chat]
				let teks = budy.toLowerCase().replace(/[^\w\s\-]+/, '')
				let isSurender = /^((me)?nyerah|surr?ender)$/i.test(teks)
				if (!isSurender) {
					let index = room.jawaban.findIndex(v => v.toLowerCase().replace(/[^\w\s\-]+/, '') === teks)
					if (room.terjawab[index]) return !0
					room.terjawab[index] = m.sender
				}
				let isWin = room.terjawab.length === room.terjawab.filter(v => v).length
				let caption = `Jawablah Pertanyaan Berikut :\n${room.soal}\n\n\nTerdapat ${room.jawaban.length} Jawaban ${room.jawaban.find(v => v.includes(' ')) ? `(beberapa Jawaban Terdapat Spasi)` : ''}\n${isWin ? `Semua Jawaban Terjawab` : isSurender ? 'Menyerah!' : ''}\n${Array.from(room.jawaban, (jawaban, index) => { return isSurender || room.terjawab[index] ? `(${index + 1}) ${jawaban} ${room.terjawab[index] ? '@' + room.terjawab[index].split('@')[0] : ''}`.trim() : false }).filter(v => v).join('\n')}\n${isSurender ? '' : `Perfect Player`}`.trim()
				m.reply(caption)
				if (isWin || isSurender) delete family100[m.chat]
			}
		}
		
		
		// Confess / Menfes - relay pesan ke lawan bicara
		if (m.sender in menfes && !isCmd && !m.isGroup && m.chat === m.sender) {
			const sesiMenfes = menfes[m.sender]
			const tujuanMenfes = sesiMenfes.tujuan
			const namaMenfes = sesiMenfes.nama || 'Seseorang'
			// Proteksi: kalau lawan bicara (tujuanMenfes) belum bales pesan
			// terakhir, tahan dulu pesan berikutnya -- cegah 1 pihak ngirim
			// banyak pesan beruntun ke pihak yang diem aja. Pola "kirim cepat
			// walau nggak dibales" ini yang paling beresiko bikin akun bot
			// kena restriksi "tidak bisa memulai chat baru" dari WhatsApp.
			if (menfesAwaitingReply.has(m.sender)) {
				m.reply(`⏳ Tunggu ${namaMenfes} bales dulu ya, sebelum kirim pesan lagi.`)
				return !0
			}
			try {
				if (m.type === 'conversation' || m.type === 'extendedTextMessage') {
					const teksMenfes = m.text || body || ''
					if (teksMenfes) await voxel.sendMessage(tujuanMenfes, { text: `*${namaMenfes}:*\n${teksMenfes}` })
				} else if (m.msg && typeof m.msg === 'object' && m.type) {
					const isiMenfes = { ...m.msg }
					if ('caption' in isiMenfes) {
						isiMenfes.caption = `*${namaMenfes}:*${isiMenfes.caption ? '\n' + isiMenfes.caption : ''}`
						await voxel.relayMessage(tujuanMenfes, { [m.type]: isiMenfes }, {})
					} else {
						await voxel.sendMessage(tujuanMenfes, { text: `*${namaMenfes} mengirim pesan:*` })
						await voxel.relayMessage(tujuanMenfes, { [m.type]: isiMenfes }, {})
					}
				}
				// Giliran abis dipakai -- m.sender nunggu, tujuanMenfes gantian
				// boleh kirim (kalau sebelumnya dia yang nunggu, sekarang bebas).
				menfesAwaitingReply.add(m.sender)
				menfesAwaitingReply.delete(tujuanMenfes)
			} catch (e) {
				console.log('[Confess] Gagal relay pesan:', e)
				m.reply('Gagal mengirim pesan, coba lagi.')
			}
			return !0
		}
		
		
		// Ular Tangga
		if (m.isGroup && (!isCmd || isCreator) && (m.chat in ulartangga)) {
			if (m.quoted && ulartangga[m.chat].id == m.quoted.id) {
				if (!(ulartangga[m.chat] instanceof SnakeLadder)) {
					ulartangga[m.chat] = Object.assign(new SnakeLadder(ulartangga[m.chat]), ulartangga[m.chat]);
				}
				if (/^(roll|kocok)/i.test(budy.toLowerCase())) {
					const player = ulartangga[m.chat].players.findIndex(a => a.id == m.sender)
					if (ulartangga[m.chat].turn !== player) return m.reply('Bukan Giliranmu!')
					const roll = ulartangga[m.chat].rollDice();
					await m.reply(`https://raw.githubusercontent.com/nazedev/database/master/games/images/dice/roll-${roll}.webp`);
					ulartangga[m.chat].nextTurn();
					ulartangga[m.chat].players[player].move += roll
					if (ulartangga[m.chat].players[player].move > 100) ulartangga[m.chat].players[player].move = 100 - (ulartangga[m.chat].players[player].move - 100);
					let teks = `🐍🪜Warna: ${['Merah','Biru Muda','Kuning','Hijau','Ungu','Jingga','Biru Tua','Putih'][player]} -> ${ulartangga[m.chat].players[player].move}\n`;
					if(Object.keys(ulartangga[m.chat].map.move).includes(ulartangga[m.chat].players[player].move.toString())) {
						teks += ulartangga[m.chat].players[player].move > ulartangga[m.chat].map.move[ulartangga[m.chat].players[player].move] ? 'Kamu Termakan Ular!\n' : 'Kamu Naik Tangga\n'
						ulartangga[m.chat].players[player].move = ulartangga[m.chat].map.move[ulartangga[m.chat].players[player].move];
					}
					const newMap = await ulartangga[m.chat].drawBoard(ulartangga[m.chat].map.url, ulartangga[m.chat].players);
					if (ulartangga[m.chat].players[player].move === 100) {
						teks += `@${m.sender.split('@')[0]} Menang\nHadiah:\n- Limit + 50\n- Money + 100.000`;
						addLimit(50, m.sender, db);
						addMoney(100000, m.sender, db);
						delete ulartangga[m.chat];
						return m.reply({ image: newMap, caption: teks, mentions: [m.sender] });
					}
					let { key } = await m.reply({ image: newMap, caption: teks + `Giliran: @${ulartangga[m.chat].players[ulartangga[m.chat].turn].id.split('@')[0]}`, mentions: [m.sender, ulartangga[m.chat].players[ulartangga[m.chat].turn].id] });
					ulartangga[m.chat].id = key.id;
				} else m.reply('Example: roll/kocok')
			} else if (ulartangga[m.chat].time && (Date.now() - ulartangga[m.chat].time >= 7200000)) {
				delete ulartangga[m.chat]
				return m.reply(`🐍🪜Waktu Habis!\nPermainan dihentikan`)
			}
		}	
		
		// Afk
		let mentionUser = [...new Set([...(m.mentionedJid || []), ...(m.quoted ? [m.quoted.sender] : [])])]
		for (let jid of mentionUser) {
			let user = db.users[jid]
			if (!user) continue
			let afkTime = user.afkTime
			if (!afkTime || afkTime < 0) continue
			let reason = user.afkReason || ''
			m.reply(`Jangan tag dia!\nDia sedang AFK ${reason ? 'dengan alasan ' + reason : 'tanpa alasan'}\nSelama ${clockString(new Date - afkTime)}`.trim())
		}
		if (db.users[m.sender].afkTime > -1) {
			let user = db.users[m.sender]
			m.reply(`@${m.sender.split('@')[0]} berhenti AFK${user.afkReason ? ' setelah ' + user.afkReason : ''}\nSelama ${clockString(new Date - user.afkTime)}`)
			user.afkTime = -1
			user.afkReason = ''
		}
		
		// === GERBANG JADIBOT =============================================
		// Sesi Jadibot (sub-bot) boleh pakai command biasa, tapi TIDAK boleh
		// menyentuh apa pun yang bisa mencederai bot utama: eval/exec,
		// bocor creds (`backup`, `getsession`), atau menulis settings.js.
		// Satu daftar di sini, bukan `if (!isCreator)` di tiap case: case
		// baru dari contributor berikutnya otomatis ikut terkunci. Kalau
		// batasnya per-case, satu case yang lupa = kebocoran baru.
		const CMD_OWNER_BERBAHAYA = new Set([
			'eval', 'exec', // kalo nanti ada alias-nya, taruh di sini
			'backup', 'getsession', 'deletesession', 'delsession',
			'update', 'upgrade', 'rcon',
			'addowner', 'delowner',
			'setapikey', 'setbotapikey',
			// Semua yang menulis ke settings.js
			'addprefix', 'delprefix', 'removeprefix',
			'addtoxic', 'addbadword', 'deltoxic', 'delbadword',
			'setmessbot', 'setbotmessages', 'setlimitbot', 'setbotlimit',
			'setmoneybot', 'setbotmoney', 'setnamebot', 'setbotname',
			'setpacknamebot', 'setbotpackname', 'setauthorbot', 'setbotauthor',
			'setlocale', 'setlocalebot', 'setbotlocale',
			'settimezone', 'settimezonebot', 'setbottimezone',
			'restart', 'shutdown', 'off',
		]);
		// Prefix eval/exec ($, >, <) ada di blok `default:`, bukan `case`,
		// jadi harus dicek terpisah dari daftar di atas.
		const EVAL_PREFIX = /^[$><]/;
		if (voxel.isJadibot && (CMD_OWNER_BERBAHAYA.has(command) || EVAL_PREFIX.test(budy))) {
			return m.reply('Khusus bot utama!');
		}

		switch(fileSha256 || command) {
			// Tempat Add Case
			case '19rujxl1e': {
				console.log('.')
			}
			break
			
			// Owner Menu
			case 'shutdown': case 'off': {
				if (!isCreator) return m.reply(global.mess.owner)
				m.reply(`*[BOT] Process Shutdown...*`).then(() => {
					process.exit(0);
				})
			}
			break
			case 'update': case 'upgrade': {
				if (!isCreator) return m.reply(global.mess.owner)
				m.reply(`*[BOT] Process Update And Upgrade...*`).then(() => {
					try {
						runUpdate();
					} catch (e) {
						process.exit(0);
					}
				})
			}
			break
			case 'byq': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!m.quoted) return m.reply(global.mess.quoted)
				delete m.quoted.chat
				let anya = Object.values(m.quoted.fakeObj())[1]
				m.reply(`const byt = ${JSON.stringify(anya.message, null, 2)}\nvoxel.relayMessage(m.chat, byt, {})`)
			}
			break
			case 'setbio': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(global.mess.text)
				voxel.setStatus(q)
				m.reply(`*Bio telah di ganti menjadi ${q}*`)
			}
			break
			case 'setppbot': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!/image/.test(quoted.type)) return m.reply(`Reply Image With Caption ${prefix + command}`)
				let media = await quoted.download();
				let { img } = await generateProfilePicture(media, text.length > 0 ? null : 512)
				await voxel.query({
					tag: 'iq',
					attrs: {
						to: '@s.whatsapp.net',
						type: 'set',
						xmlns: 'w:profile:picture'
					},
					content: [{ tag: 'picture', attrs: { type: 'image' }, content: img }]
				});
				m.reply(global.mess.done)
			}
			break
			case 'delppbot': {
				if (!isCreator) return m.reply(global.mess.owner)
				await voxel.removeProfilePicture(voxel.user.id)
				m.reply(global.mess.done)
			}
			break
			case 'version': case 'versi': case 'v': {
				const pkg = require('./package.json');
				m.reply(`Version : ${pkg.version}`);
			}
			break
			case 'addprefix': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						addPrefix: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} textnya`)
			}
			break
			case 'delprefix': case 'removeprefix': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						removePrefix: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} textnya`)
			}
			break
			case 'listprefix': {
				if (!isCreator) return m.reply(global.mess.owner)
				m.reply('List Prefix :\n' + global.listprefix.map(a => '- ' + a).join('\n'));
			}
			break
			case 'addtoxic': case 'addbadword': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						addBadword: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} textnya`)
			}
			break
			case 'deltoxic': case 'delbadword': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						removeBadword: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} textnya`)
			}
			break
			case 'listtoxic': case 'listbadword': {
				if (!isCreator) return m.reply(global.mess.owner)
				m.reply('List Bad Words :\n' + global.badWords.map(a => '- ' + a).join('\n'));
			}
			break
			case 'join': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply('Masukkan Link Group!')
				if (!isUrl(args[0]) && !args[0].includes('whatsapp.com')) return m.reply('Link Invalid!')
				const result = args[0].match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/)
				if (!result) return m.reply('Link Invalid❗')
				m.reply(global.mess.wait)
				await voxel.groupAcceptInvite(result[1]).catch((res) => {
					if (res.data == 400) return m.reply('Grup Tidak Di Temukan❗');
					if (res.data == 401) return m.reply('Bot Di Kick Dari Grup Tersebut❗');
					if (res.data == 409) return m.reply('Bot Sudah Join Di Grup Tersebut❗');
					if (res.data == 410) return m.reply('Url Grup Telah Di Setel Ulang❗');
					if (res.data == 500) return m.reply('Grup Penuh❗');
				})
			}
			break
			case 'leave': {
				if (!isCreator) return m.reply(global.mess.owner)
				await voxel.groupLeave(m.chat).then(() => voxel.sendFromOwner(ownerNumber, 'Sukses Keluar Dari Grup', m, { contextInfo: { isForwarded: true }})).catch(e => {});
			}
			break
			case 'clearchat': {
				if (!isCreator) return m.reply(global.mess.owner)
				await voxel.chatModify({ delete: true, lastMessages: [{ key: m.key, messageTimestamp: m.timestamp }] }, m.chat).catch((e) => m.reply('Gagal Menghapus Chat!'))
				m.reply(global.mess.done)
			}
			break
			case 'getmsgstore': case 'storemsg': {
				if (!isCreator) return m.reply(global.mess.owner)
				let [teks1, teks2] = text.split`|`
				if (teks1 && teks2) {
					const msgnya = await global.loadMessage(teks1, teks2)
					if (msgnya?.message) await voxel.relayMessage(m.chat, msgnya.message, {})
					else m.reply('Pesan Tidak Ditemukan!')
				} else m.reply(`Example: ${prefix + command} 123xxx@g.us|3EB0xxx`)
			}
			break
			case 'blokir': case 'block': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const numbersOnly = m.isGroup ? (text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender) : m.chat
					await voxel.updateBlockStatus(numbersOnly, 'block').then((a) => m.reply(global.mess.done)).catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'listblock': {
				let anu = await voxel.fetchBlocklist()
				m.reply(`Total Block : ${anu.length}\n` + anu.map(v => '• ' + v.replace(/@.+/, '')).join`\n`)
			}
			break
			case 'openblokir': case 'unblokir': case 'openblock': case 'unblock': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const numbersOnly = m.isGroup ? (text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender) : m.chat
					await voxel.updateBlockStatus(numbersOnly, 'unblock').then((a) => m.reply(global.mess.done)).catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'ban': case 'banned': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx`)
				const findJid = voxel.findJidByLid(text.replace(/[^0-9]/g, '') + '@lid', store);
				const klss = text.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
				const nmrnya = voxel.findJidByLid(klss, store, true)
				if (db.users[nmrnya] && !db.users[nmrnya].ban) {
					db.users[nmrnya].ban = true
					m.reply(global.mess.done)
				} else m.reply('User tidak terdaftar di database!')
			}
			break
			case 'unban': case 'unbanned': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx`)
				const findJid = voxel.findJidByLid(text.replace(/[^0-9]/g, '') + '@lid', store);
				const klss = text.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
				const nmrnya = voxel.findJidByLid(klss, store, true)
				if (db.users[nmrnya] && db.users[nmrnya].ban) {
					db.users[nmrnya].ban = false
					m.reply(global.mess.done)
				} else m.reply('User tidak terdaftar di database!')
			}
			break
			case 'mute': case 'unmute': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!m.isGroup) return m.reply(global.mess.group)
				if (command == 'mute') {
					db.groups[m.chat].mute = true
					m.reply('Bot Telah Di Mute Di Grup Ini!')
				} else if (command == 'unmute') {
					db.groups[m.chat].mute = false
					m.reply(global.mess.done + ' Unmute')
				}
			}
			break
			case 'blacklistgroup': case 'bangroup': case 'bansenyapgroup': {
				if (!isCreator) return m.reply(global.mess.owner)
				set.blacklistGroup ||= []
				const sub = (args[0] || '').toLowerCase()
				if (sub === 'list') {
					if (!set.blacklistGroup.length) return m.reply('Belum ada grup yang di-blacklist.')
					const listText = set.blacklistGroup.map((jid, i) => `${i + 1}. ${store?.groupMetadata?.[jid]?.subject || '(nama tidak diketahui)'}\n   (${jid})`).join('\n')
					return m.reply(`*Daftar Grup Blacklist:*\n\n${listText}\n\nHapus: ${prefix + command} del <nomor>`)
				}
				if (sub === 'del' || sub === 'remove') {
					const idx = parseInt(args[1]) - 1
					if (isNaN(idx) || !set.blacklistGroup[idx]) return m.reply(`Nomor nggak valid. Cek dulu: ${prefix + command} list`)
					const removed = set.blacklistGroup[idx]
					set.blacklistGroup.splice(idx, 1)
					return m.reply(`✅ Grup *${store?.groupMetadata?.[removed]?.subject || removed}* dilepas dari blacklist.`)
				}
				// Ambil semua grup yang bot ikutin -- bisa dipilih dari mana
				// aja (DM/grup lain), nggak perlu masuk ke grup targetnya.
				const allGroups = await voxel.groupFetchAllParticipating().catch(() => ({}))
				const groupList = Object.values(allGroups)
				if (sub === 'add') {
					const idx = parseInt(args[1]) - 1
					if (isNaN(idx) || !groupList[idx]) return m.reply(`Nomor nggak valid. Cek daftarnya dulu: ${prefix + command}`)
					const target = groupList[idx]
					if (set.blacklistGroup.includes(target.id)) return m.reply('Grup itu udah ada di blacklist.')
					set.blacklistGroup.push(target.id)
					return m.reply(`✅ Grup *${target.subject}* di-blacklist. Bot bakal berhenti merespon apapun di sana.`)
				}
				// Tanpa argumen -- tampilin daftar semua grup buat dipilih nomornya.
				if (!groupList.length) return m.reply('Bot belum join grup manapun.')
				const pilihanText = groupList.map((g, i) => `${i + 1}. ${g.subject}${set.blacklistGroup.includes(g.id) ? ' 🔴 (sudah blacklist)' : ''}`).join('\n')
				await m.reply(`*Pilih grup yang mau di-blacklist:*\n\n${pilihanText}\n\nCara pakai:\n${prefix + command} add <nomor>\n${prefix + command} list\n${prefix + command} del <nomor>`)
			}
			break
			case 'whitelist': {
				if (!isCreator) return m.reply(global.mess.owner);
				if (!text) return m.reply(`*Format Salah!*\n\nContoh penggunaan:\n- ${prefix + command} user list\n- ${prefix + command} user add 1,3\n- ${prefix + command} user del 1\n- ${prefix + command} group add 1,2\n- ${prefix + command} clear`);
				const botNumber = await voxel.decodeJid(voxel.user.id);
				if (!global.db.set[botNumber].whitelist) global.db.set[botNumber].whitelist = [];
				let whitelistArray = global.db.set[botNumber].whitelist;
				let type = args[0] ? args[0].toLowerCase() : '';
				let action = args[1] ? args[1].toLowerCase() : '';
				let targetNumbers = args[2];
				if (type === 'user' || type === 'group' || ['gc', 'group','grup'].includes(type)) {
					let dbTarget = type === 'user' ? global.db.users : global.db.groups;
					let keys = Object.keys(dbTarget);
					if (keys.length === 0) return m.reply(`Belum ada data ${type} di database.`);
					if (action === 'list') {
						let listText = `*Daftar ${type === 'user' ? 'User' : 'Group'}:*\n\n`;
						keys.forEach((jid, index) => {
							let status = whitelistArray.includes(jid) ? '✅' : '❌';
							listText += `${index + 1}. ${type === 'user' ? global.store?.contacts?.[jid]?.name || '-' : global.store?.groupMetadata?.[jid]?.subject || '-'} [${status}]\n- (${jid})\n`;
						});
						listText += `\n*Cara Penggunaan:*\nTambah: ${prefix + command} ${type} add 1,2,3\nHapus: ${prefix + command} ${type} del 1,2`;
						return m.reply(listText);
					} else if (action === 'add' || action === 'del' || action === 'delete') {
						if (!targetNumbers) return m.reply(`Masukkan nomor urutnya!\nContoh: ${prefix + command} ${type} ${action} 1,2`);
						let processed = [];
						let inputNumbers = targetNumbers.split(',');
						for (let num of inputNumbers) {
							let index = parseInt(num.trim()) - 1;
							if (!isNaN(index) && keys[index]) {
								let targetJid = keys[index];
								if (action === 'add') {
									if (!whitelistArray.includes(targetJid)) {
										whitelistArray.push(targetJid);
										processed.push(targetJid);
									}
								} else {
									let wlIndex = whitelistArray.indexOf(targetJid);
									if (wlIndex !== -1) {
										whitelistArray.splice(wlIndex, 1);
										processed.push(targetJid);
									}
								}
							}
						}
						if (processed.length > 0) {
							let statusText = action === 'add' ? 'menambahkan ke' : 'menghapus dari';
							m.reply(`Sukses ${statusText} whitelist!\n\n*Total: ${processed.length} ${type}*\n- ${processed.join('\n- ')}`);
						} else {
							let failText = action === 'add' ? 'sudah ada di whitelist' : 'tidak ada di whitelist';
							m.reply(`Gagal diproses. Pastikan angka sesuai di *${prefix + command} ${type} list* dan data target ${failText}.`);
						}
					} else m.reply(`Kirim dengan format yang benar.\nContoh:\n- ${prefix + command} ${type} add 1,2,3\n- ${prefix + command} ${type} del 1,2\n- ${prefix + command} ${type} list`);
				} else if (type === 'clear') {
					global.db.set[botNumber].whitelist = [];
					m.reply('Semua data whitelist berhasil dihapus secara permanen!');
				} else m.reply(`Tipe tidak valid! Gunakan 'user', 'group', atau 'clear'.\nContoh: ${prefix + command} user list`);
			}
			break
			case 'addowner': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx`)
				const nmrnya = voxel.findJidByLid(text.replace(/[^0-9]/g, ''), store, true)
				const onWa = await voxel.onWhatsApp(nmrnya)
				if (!onWa.length > 0) return m.reply(global.mess.onWa)
				// Dulu di sini kalau set.owner entah kenapa nggak ada, command
				// diam-diam nggak nambahin siapa pun tapi TETEP bilang "Selesai"
				// ke user -- sekarang dikasih tau jelas kalau memang gagal.
				if (!set?.owner) return m.reply('Gagal: daftar owner di settings.js tidak ditemukan!')
				if (set.owner.find(a => nmrnya.includes(a))) return m.reply('Nomer Tersebut Sudah Ada Di Owner!')
				set.owner.push(nmrnya.split('@')[0]);
				await updateSettings({
					filePath: settingsPath,
					owner: set.owner
				});
				m.reply(global.mess.done)
			}
			break
			case 'delowner': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx`)
				const nmrnya = voxel.findJidByLid(text.replace(/[^0-9]/g, ''), store, true)
				const onWa = await voxel.onWhatsApp(nmrnya)
				if (!onWa.length > 0) return m.reply(global.mess.onWa)
				if (botNumber === nmrnya) return m.reply('Nomer Bot Tidak Boleh dihapus dari owner!')
				let list = set.owner
				const index = list.findIndex(o => o === nmrnya.split('@')[0]);
				if (index === -1) return m.reply('Owner tidak ditemukan di daftar!')
				list.splice(index, 1)
				await updateSettings({
					filePath: settingsPath,
					owner: set.owner
				});
				m.reply(global.mess.done)
			}
			break
			case 'adduang': case 'addmoney': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!args[0] || !args[1] || isNaN(args[1])) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx 1000`)
				if (args[1].length > 15) return m.reply('Jumlah Money Maksimal 15 digit angka!')
				const findJid = voxel.findJidByLid(args[0].replace(/[^0-9]/g, '') + '@lid', store);
				const klss = args[0].replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
				const nmrnya = voxel.findJidByLid(klss, store, true)
				const onWa = await voxel.onWhatsApp(nmrnya)
				if (!onWa.length > 0) return m.reply(global.mess.onWa)
				if (db.users[nmrnya] && db.users[nmrnya].money >= 0) {
					addMoney(args[1], nmrnya, db)
					m.reply(global.mess.done)
				} else m.reply('User tidak terdaftar di database!')
			}
			break
			case 'addlimit': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!args[0] || !args[1] || isNaN(args[1])) return m.reply(`Kirim/tag Nomernya!\nExample:\n${prefix + command} 62xxx 10`)
				if (args[1].length > 10) return m.reply('Jumlah Limit Maksimal 10 digit angka!')
				const findJid = voxel.findJidByLid(args[0].replace(/[^0-9]/g, '') + '@lid', store);
				const klss = args[0].replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
				const nmrnya = voxel.findJidByLid(klss, store, true)
				const onWa = await voxel.onWhatsApp(nmrnya)
				if (!onWa.length > 0) return m.reply(global.mess.onWa)
				if (db.users[nmrnya] && db.users[nmrnya].limit >= 0) {
					addLimit(args[1], nmrnya, db)
					m.reply(global.mess.done)
				} else m.reply('User tidak terdaftar di database!')
			}
			break
			case 'listpc': {
				if (!isCreator) return m.reply(global.mess.owner)
				let anu = Object.keys(store.messages).filter(a => a.endsWith('.net') || a.endsWith('lid'));
				let teks = `● *LIST PERSONAL CHAT*\n\nTotal Chat : ${anu.length} Chat\n\n`
				if (anu.length === 0) return m.reply(teks)
				for (let i of anu) {
					if (store.messages?.[i]?.array?.length) {
						let nama = await voxel.getName(i);
						teks += `${setv} *Nama :* ${nama}\n${setv} *User :* @${i.split('@')[0]}\n${setv} *Chat :* https://wa.me/${i.split('@')[0]}\n\n=====================\n\n`
					}
				}
				await m.reply(teks)
			}
			break
			case 'listgc': {
				if (!isCreator) return m.reply(global.mess.owner)
				let anu = Object.keys(store.messages).filter(a => a.endsWith('@g.us'));
				let teks = `● *LIST GROUP CHAT*\n\nTotal Group : ${anu.length} Group\n\n`
				if (anu.length === 0) return m.reply(teks)
				for (let i of anu) {
					let metadata;
					try {
						metadata = store.groupMetadata[i]
					} catch (e) {
						metadata = (store.groupMetadata[i] = await voxel.groupMetadata(i).catch(e => ({ ...store.groupMetadata[i] })));
					}
					teks += metadata?.subject ? `${setv} *Nama :* ${metadata.subject}\n${setv} *Admin :* ${metadata.ownerPn ? `@${metadata.ownerPn.split('@')[0]}` : '-' }\n${setv} *ID :* ${metadata.id}\n${setv} *Dibuat :* ${moment(metadata.creation * 1000).tz(global.timezone).format('DD/MM/YYYY HH:mm:ss')}\n${setv} *Member :* ${metadata.participants.length}\n\n=====================\n\n` : ''
				}
				await m.reply(teks)
			}
			break
			case 'creategc': case 'buatgc': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Example:\n${prefix + command} *Nama Gc*`)
				let group = await voxel.groupCreate(q, [m.sender])
				let res = await voxel.groupInviteCode(group.id)
				await m.reply(`*Link Group :* *https://chat.whatsapp.com/${res}*\n\n*Nama Group :* *${group.subject}*\nSegera Masuk dalam 30 detik\nAgar menjadi Admin`, { detectLink: true })
				await sleep(30000)
				await voxel.groupParticipantsUpdate(group.id, [m.sender], 'promote').catch(e => {});
				await voxel.sendMessage(group.id, { text: global.mess.done })
			}
			break
			case 'addsewa': case 'sewa': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Example:\n${prefix + command} https://chat.whatsapp.com/xxx | waktu\n${prefix + command} https://chat.whatsapp.com/xxx | 30 hari`)
				let [teks1, teks2] = text.split('|')?.map(x => x.trim()) || [];
				if (!isUrl(teks1) && !teks1.includes('chat.whatsapp.com/')) return m.reply('Link Invalid!')
				const urlny = teks1.match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/)
				if (!urlny) return m.reply('Link Invalid❗')
				try {
					await voxel.groupAcceptInvite(urlny[1])
				} catch (e) {
					if (e.data == 400) return m.reply('Grup Tidak Di Temukan❗');
					if (e.data == 401) return m.reply('Bot Di Kick Dari Grup Tersebut❗');
					if (e.data == 410) return m.reply('Url Grup Telah Di Setel Ulang❗');
					if (e.data == 500) return m.reply('Grup Penuh❗');
				}
				await voxel.groupGetInviteInfo(urlny[1]).then(a => {
					addExpired({ url: urlny[1], expired: (teks2?.replace(/[^0-9]/g, '') || 30) + 'd', id: a.id }, sewa)
					m.reply('Sukses Menambahkan Sewa Selama ' + (teks2?.replace(/[^0-9]/g, '') || 30) + ' hari\nOtomatis Keluar Saat Waktu Habis!')
				}).catch(e => m.reply('Gagal Menambahkan Sewa!'))
			}
			break
			case 'delsewa': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Example:\n${prefix + command} https://chat.whatsapp.com/xxxx\n Or \n${prefix + command} id_group@g.us`)
				let urlny;
				if (text.includes('chat.whatsapp.com/')) {
					urlny = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/)[1]
				} else if (/@g\.us$/.test(text)) {
					urlny = text.trim()
				} else {
					return m.reply('Format tidak valid❗')
				}
				if (checkStatus(urlny, sewa)) {
					await m.reply(global.mess.done)
					await voxel.groupLeave(getStatus(urlny, sewa).id).catch(e => {});
					sewa.splice(getPosition(urlny, sewa), 1);
				} else m.reply(`${text} Tidak Terdaftar Di Database\nExample:\n${prefix + command} https://chat.whatsapp.com/xxxx\n Or \n${prefix + command} id_group@g.us`)
			}
			break
			case 'listsewa': {
				if (!isCreator) return m.reply(global.mess.owner)
				let txt = `*------「 LIST SEWA 」------*\n\n`
				for (let s of sewa) {
					txt += `➸ *ID*: ${s.id}\n➸ *Url*: https://chat.whatsapp.com/${s.url}\n➸ *Expired*: ${formatDate(s.expired)}\n\n`
				}
				m.reply(txt)
			}
			break
			case 'addpr': case 'addprem': case 'addpremium': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Example:\n${prefix + command} @tag|waktu\n${prefix + command} @${m.sender.split('@')[0]}|30 hari`)
				let [teks1, teks2] = text.split('|').map(x => x.trim());
				const findJid = voxel.findJidByLid(teks1.replace(/[^0-9]/g, '') + '@lid', store);
				const klss = teks1.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
				const nmrnya = voxel.findJidByLid(klss, store, true)
				const onWa = await voxel.onWhatsApp(nmrnya)
				if (!onWa.length > 0) return m.reply(global.mess.onWa)
				if (teks2) {
					if (db.users[nmrnya] && db.users[nmrnya].limit >= 0) {
						addExpired({ id: nmrnya, expired: teks2.replace(/[^0-9]/g, '') + 'd' }, premium);
						m.reply(`Sukses ${command} @${nmrnya.split('@')[0]} Selama ${teks2}`)
						db.users[nmrnya].limit += db.users[nmrnya].vip ? global.limit.vip : global.limit.premium
						db.users[nmrnya].money += db.users[nmrnya].vip ? global.money.vip : global.money.premium
					} else m.reply('Nomer tidak terdaftar di BOT !\nPastikan Nomer Pernah Menggunakan BOT!')
				} else m.reply(`Masukkan waktunya!\Example:\n${prefix + command} @tag|waktu\n${prefix + command} @${m.sender.split('@')[0]}|30d\n_d = day_`)
			}
			break
			case 'delpr': case 'delprem': case 'delpremium': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply(`Example:\n${prefix + command} @tag`)
				const findJid = voxel.findJidByLid(text.replace(/[^0-9]/g, '') + '@lid', store);
				const klss = text.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
				const nmrnya = voxel.findJidByLid(klss, store, true)
				if (db.users[nmrnya] && db.users[nmrnya].limit >= 0) {
					if (checkStatus(nmrnya, premium)) {
						premium.splice(getPosition(nmrnya, premium), 1);
						m.reply(`Sukses ${command} @${nmrnya.split('@')[0]}`)
						db.users[nmrnya].limit += db.users[nmrnya].vip ? global.limit.vip : global.limit.free
						db.users[nmrnya].money += db.users[nmrnya].vip ? global.money.vip : global.money.free
					} else m.reply(`User @${nmrnya.split('@')[0]} Bukan Premium❗`)
				} else m.reply('Nomer tidak terdaftar di BOT !')
			}
			break
			case 'listpr': case 'listprem': case 'listpremium': {
				if (!isCreator) return m.reply(global.mess.owner)
				let txt = `*------「 LIST PREMIUM 」------*\n\n`
				for (let userprem of premium) {
					txt += `➸ *Nomer*: @${userprem.id.split('@')[0]}\n➸ *Limit*: ${db.users[userprem.id].limit}\n➸ *Money*: ${db.users[userprem.id].money.toLocaleString('id-ID')}\n➸ *Expired*: ${formatDate(userprem.expired)}\n\n`
				}
				m.reply(txt)
			}
			break
			case 'upsw': {
				if (!isCreator) return m.reply(global.mess.owner)
				const statusJidList = Object.keys(db.users)
				const backgroundColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
				try {
					if (quoted.isMedia) {
						let media = await voxel.downloadAndSaveMediaMessage(qmsg);
						try {
							if (/image|video/.test(quoted.mime)) {
								await voxel.sendMessage('status@broadcast', {
									[`${quoted.mime.split('/')[0]}`]: { url: media },
									caption: text || m.quoted?.body || ''
								}, { statusJidList, broadcast: true })
								m.react('✅')
							} else if (/audio/.test(quoted.mime)) {
								await voxel.sendMessage('status@broadcast', {
									audio: { url: media },
									mimetype: 'audio/mp4',
									ptt: true
								}, { backgroundColor, statusJidList, broadcast: true })
								m.react('✅')
							} else m.reply('Only Support video/audio/image/text')
						} finally {
							if (fs.existsSync(media)) fs.unlinkSync(media);
						}
					} else if (quoted.text) {
						await voxel.sendMessage('status@broadcast', { text: text || m.quoted?.body || '' }, {
							textArgb: 0xffffffff,
							font: Math.floor(Math.random() * 9),
							backgroundColor, statusJidList,
							broadcast: true
						})
						m.react('✅')
					} else m.reply('Only Support video/audio/image/text')
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			case 'addcase': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text && !text.startsWith('case')) return m.reply('Masukkan Casenya!')
				fs.readFile(__filename, 'utf8', (err, data) => {
					if (err) {
						console.error('Terjadi kesalahan saat membaca file:', err);
						return;
					}
					const posisi = data.indexOf("case '19rujxl1e':");
					if (posisi !== -1) {
						const codeBaru = data.slice(0, posisi) + '\n' + `${text}` + '\n' + data.slice(posisi);
						fs.writeFile(__filename, codeBaru, 'utf8', (err) => {
							if (err) {
								m.reply('Terjadi kesalahan saat menulis file: ', err);
							} else m.reply(global.mess.done);
						});
					} else m.reply(global.mess.fail);
				});
			}
			break
			case 'getcase': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply('Masukkan Nama Casenya!')
				try {
					const getCase = (cases) => {
						return "case"+`'${cases}'`+fs.readFileSync(__filename).toString().split('case \''+cases+'\'')[1].split("break")[0]+"break"
					}
					m.reply(`${getCase(text)}`)
				} catch (e) {
					m.reply(`case ${text} tidak ditemukan!`)
				}
			}
			break
			case 'delcase': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply('Masukkan Nama Casenya!')
				fs.readFile(__filename, 'utf8', (err, data) => {
					if (err) {
						console.error('Terjadi kesalahan saat membaca file:', err);
						return;
					}
					const regex = new RegExp(`case\\s+'${text.toLowerCase()}':[\\s\\S]*?break`, 'g');
					const modifiedData = data.replace(regex, '');
					fs.writeFile(__filename, modifiedData, 'utf8', (err) => {
						if (err) {
							console.log(err);
							m.reply(global.mess.fail);
						} else m.reply(global.mess.done);
					});
				});
			}
			break
			case 'backup': {
				if (!isCreator) return m.reply(global.mess.owner)
				switch (args[0]) {
					case 'all':
					let bekup = './database/backup_all.tar.gz';
					tarBackup('./', bekup).then(() => {
						return m.reply({
							document: fs.readFileSync(bekup),
							mimetype: 'application/gzip',
							fileName: 'backup_all.tar.gz'
						})
					}).catch(e => m.reply('Gagal backup: ', + e))
					break
					case 'auto':
					if (set.autobackup) return m.reply('Sudah Aktif Sebelumnya!')
					set.autobackup = true
					m.reply('Sukses Mengaktifkan Auto Backup')
					break
					case 'session':
					await m.reply({
						document: fs.readFileSync('./voxel_session/creds.json'),
						mimetype: 'application/json',
						fileName: 'creds.json'
					});
					break
					case 'database':
					let tglnya = new Date().toISOString().replace(/[:.]/g, '-');
					let datanya = './database/' + global.tempatDB;
					if (global.tempatDB.startsWith('mongodb')) {
						datanya = './database/backup_database.json';
						fs.writeFileSync(datanya, JSON.stringify(global.db, null, 2), 'utf-8');
					}
					await m.reply({
						document: fs.readFileSync(datanya),
						mimetype: 'application/json',
						fileName: tglnya + '_database.json'
					})
					break
					default:
					m.reply('Gunakan perintah:\n- backup all\n- backup auto\n- backup session\n- backup database');
				}
			}
			break
			case 'getsession': {
				if (!isCreator) return m.reply(global.mess.owner)
				await m.reply({
					document: fs.readFileSync('./voxel_session/creds.json'),
					mimetype: 'application/json',
					fileName: 'creds.json'
				});
			}
			break
			case 'deletesession': case 'delsession': {
				if (!isCreator) return m.reply(global.mess.owner)
				fs.readdir('./voxel_session', async function (err, files) {
					if (err) {
						console.error('Unable to scan directory: ' + err);
						return m.reply('Unable to scan directory: ' + err);
					}
					let filteredArray = await files.filter(item => ['session-', 'pre-key', 'sender-key', 'app-state'].some(ext => item.startsWith(ext)));					
					let teks = `Terdeteksi ${filteredArray.length} Session file\n\n`
					if(filteredArray.length == 0) return m.reply(teks);
					filteredArray.map(function(e, i) {
						teks += (i+1)+`. ${e}\n`
					})
					if (text && text == 'true') {
						let { key } = await m.reply('Menghapus Session File..')
						await filteredArray.forEach(function (file) {
							fs.unlinkSync('./voxel_session/' + file)
						});
						sleep(2000)
						m.reply('Berhasil Menghapus Semua Sampah Session', { edit: key })
					} else m.reply(teks + `\nKetik _${prefix + command} true_\nUntuk Menghapus`)
				});
			}
			break
			case 'deletesampah': case 'delsampah': case 'deletetemp': case 'deltemp': {
				if (!isCreator) return m.reply(global.mess.owner)
				fs.readdir('./database/temp', async function (err, files) {
					if (err) {
						console.error('Unable to scan directory: ' + err);
						return m.reply('Unable to scan directory: ' + err);
					}
					let filteredArray = await files.filter(item => ['gif', 'png', 'bin','mp3', 'mp4', 'jpg', 'webp', 'webm', 'opus', 'jpeg'].some(ext => item.endsWith(ext)));
					let teks = `Terdeteksi ${filteredArray.length} Sampah file\n\n`
					if(filteredArray.length == 0) return m.reply(teks);
					filteredArray.map(function(e, i) {
						teks += (i+1)+`. ${e}\n`
					})
					if (text && text == 'true') {
						let { key } = await m.reply('Menghapus Sampah File..')
						await filteredArray.forEach(function (file) {
							fs.unlinkSync('./database/temp/' + file)
						});
						sleep(2000)
						m.reply('Berhasil Menghapus Semua Sampah', { edit: key })
					} else m.reply(teks + `\nKetik _${prefix + command} true_\nUntuk Menghapus`)
				});
			}
			break
			case 'setmessbot': case 'setbotmessages': {
				if (!isCreator) return m.reply(global.mess.owner)
				const res = await fetchJson('https://raw.githubusercontent.com/nazedev/database/refs/heads/master/bot/lang.json');
				if (res.some(a => a.lang === text)) {
					const selectedLang = res.find(a => a.lang === text);
					await updateSettings({
						filePath: settingsPath,
						newMess: selectedLang.messages
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} en\n*List Lang :*\n${res.map(a => '- ' + a.lang).join('\n')}`)
			}
			break
			case 'setlimitbot': case 'setbotlimit': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (['free','premium','vip'].includes(args[0]) && !isNaN(args[1])) {
					await updateSettings({
						filePath: settingsPath,
						setLimitRole: { role: args[0], value: Number(args[1]) }
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} premium 10000\n*List Membership :*\n- free ${global.limit.free}\n- premium ${global.limit.premium}\n- vip ${global.limit.vip}`)
			}
			break
			case 'setmoneybot': case 'setbotmoney': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (['free','premium','vip'].includes(args[0]) && !isNaN(args[1])) {
					await updateSettings({
						filePath: settingsPath,
						setMoneyRole: { role: args[0], value: Number(args[1]) }
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} premium 10000\n*List Membership :*\n- free ${global.money.free}\n- premium ${global.money.premium}\n- vip ${global.money.vip}`)
			}
			break
			case 'setnamebot': case 'setbotname': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						botname: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} Hitori bot`)
			}
			break
			case 'setpacknamebot': case 'setbotpackname': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						packname: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} By Hitori bot`)
			}
			break
			case 'setauthorbot': case 'setbotauthor': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await updateSettings({
						filePath: settingsPath,
						author: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} Voxel`)
			}
			break
			case 'setlocale': case 'setlocalebot': case 'setbotlocale': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					if (!locales.includes(teksnya)) return m.reply('Locale List:\n' + locales.map(a => '- ' + a).join('\n'))
					await updateSettings({
						filePath: settingsPath,
						locale: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} en`)
			}
			break
			case 'settimezone': case 'settimezonebot': case 'setbottimezone': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					if (!timez.includes(teksnya)) return m.reply('Timezone List:\n' + timez.map(a => '- ' + a).join('\n'))
					await updateSettings({
						filePath: settingsPath,
						timezone: teksnya.trim()
					});
					m.reply(global.mess.done)
				} else m.reply(`Example: ${prefix + command} Asia/Jakarta`)
			}
			break
			case 'setapikey': case 'setbotapikey': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!text) return m.reply('Mana apikey nya?')
				// Pola key dikunci ketat. Nilai yang lolos hanya [A-Za-z0-9_-]
				// 8-128 char -- tanpa itu, karakter `'` bisa menutup string di
				// settings.js dan menyisipkan baris JS bebas. Sekalian menyaring
				// orang yang niatnya mau nulis key ngawur.
				const POLA_KEY = /^[A-Za-z0-9_-]{8,128}$/;
				const cek = v => typeof v === 'string' && POLA_KEY.test(v.trim());
				if (args[0]?.toLowerCase() == 'neo') {
					if (!cek(args[1])) return m.reply('Apikey Tidak Valid!\nAmbil Apikey di : https://app.neosantara.xyz/api-keys');
					await updateSettings({
						filePath: settingsPath,
						neosantara: args[1].trim()
					});
					// JANGAN tampilkan key lama maupun baru. Chat WA bisa
					// di-screenshot, diteruskan, dan tersimpan -- chat ini
					// tempat paling buruk buat secret.
					m.reply('Apikey berhasil diganti')
				} else {
					if (!cek(text)) return m.reply('Apikey Tidak Valid!\nAmbil Apikey di : https://voxel.biz.id/profile');
					await updateSettings({
						filePath: settingsPath,
						apikey: text.trim()
					});
					m.reply('Apikey berhasil diganti')
				}
			}
			break
			case 'sc': case 'script': {
				await m.reply(`https://github.com/Sahur01-arch/Voxel-beta\n⬆️ Itu Sc nya cuy`, {
					title: author,
					body: 'Subscribe My YouTube',
					thumbnail: global.fake.thumbnail,
					mediaType: 2,
					mediaUrl: global.my.yt,
					sourceUrl: global.my.yt,
					contextInfo: {
						forwardingScore: 10,
						isForwarded: true,
						forwardedNewsletterMessageInfo: {
							newsletterJid: global.my.ch,
							serverMessageId: null,
							newsletterName: 'Join For More Info'
						}
					}
				})
			}
			break
			case 'donasi': case 'donate': {
				m.reply('Donasi Dapat Melalui Url Dibawah Ini :\nhttps://saweria.co/voxel')
			}
			break
			
			// Group Menu
			case 'add': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender
					const findJid = voxel.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
					const nmrnya = voxel.findJidByLid(klss, store, true)
					try {
						await voxel.groupParticipantsUpdate(m.chat, [nmrnya], 'add').then(async (res) => {
							for (let i of res) {
								let invv = await voxel.groupInviteCode(m.chat)
								const statusMessages = {
									200: `Berhasil menambahkan @${nmrnya.split('@')[0]} ke grup!`,
									401: 'Dia Memblokir Bot!',
									409: 'Dia Sudah Join!',
									500: 'Grup Penuh!'
								};
								if (statusMessages[i.status]) {
									return m.reply(statusMessages[i.status]);
								} else if (i.status == 408) {
									await m.reply(`@${nmrnya.split('@')[0]} Baru-Baru Saja Keluar Dari Grub Ini!\n\nKarena Target Private\n\nUndangan Akan Dikirimkan Ke\n-> wa.me/${nmrnya.replace(/\D/g, '')}\nMelalui Jalur Pribadi`)
									await m.reply(`${'https://chat.whatsapp.com/' + invv}\n------------------------------------------------------\n\nAdmin: @${m.sender.split('@')[0]}\nMengundang anda ke group ini\nSilahkan masuk jika berkehendak🙇`, { detectLink: true, chat: nmrnya, quoted: fkontak }).catch((err) => m.reply('Gagal Mengirim Undangan!'))
								} else if (i.status == 403) {
									let a = i.content.content[0].attrs
									await voxel.sendGroupInviteV4(m.chat, nmrnya, a.code, a.expiration, m.metadata.subject, `Admin: @${m.sender.split('@')[0]}\nMengundang anda ke group ini\nSilahkan masuk jika berkehendak🙇`, null, { mentions: [m.sender] })
									await m.reply(`@${nmrnya.split('@')[0]} Tidak Dapat Ditambahkan\n\nKarena Target Private\n\nUndangan Akan Dikirimkan Ke\n-> wa.me/${nmrnya.replace(/\D/g, '')}\nMelalui Jalur Pribadi`)
								} else m.reply('Gagal Add User\nStatus : ' + i.status)
							}
						})
					} catch (e) {
						m.reply(global.mess.fail)
					}
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'bansenyap': case 'silentban': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				db.groups[m.chat].bansenyap ||= []
				const listBan = db.groups[m.chat].bansenyap
				const sub = (args[0] || '').toLowerCase()
				if (sub === 'list') {
					if (!listBan.length) return m.reply('Belum ada member yang kena ban senyap di grup ini.')
					return m.reply(`*Daftar Ban Senyap:*\n\n${listBan.map((jid, i) => `${i + 1}. @${jid.split('@')[0]}`).join('\n')}`, { mentions: listBan })
				}
				const isDel = sub === 'del' || sub === 'remove' || sub === 'unban'
				const rawTarget = isDel ? args.slice(1).join(' ') : (sub === 'add' ? args.slice(1).join(' ') : text)
				const target = (m.mentionedJid?.length ? m.mentionedJid[0] : null) || m.quoted?.sender || (rawTarget ? rawTarget.replace(/\D/g, '') + '@s.whatsapp.net' : null)
				if (!target) return m.reply(`Tag/reply/masukkan nomor orangnya!\nContoh:\n${prefix + command} @orang\n${prefix + command} del @orang\n${prefix + command} list`)
				const findJid = voxel.findJidByLid(target.replace(/[^0-9]/g, '') + '@lid', store);
				const klss = target.replace(/[^0-9]/g, '') + (findJid ? '@lid' : '@s.whatsapp.net')
				const nmrnya = voxel.findJidByLid(klss, store, true)
				if (isDel) {
					if (!listBan.includes(nmrnya)) return m.reply('Orang itu emang nggak lagi kena ban senyap.')
					db.groups[m.chat].bansenyap = listBan.filter((jid) => jid !== nmrnya)
					return m.reply(`✅ @${nmrnya.split('@')[0]} dilepas dari ban senyap.`, { mentions: [nmrnya] })
				}
				if (nmrnya === voxel.decodeJid(voxel.user.id)) return m.reply('❌ Nggak bisa ban senyap bot sendiri wkwk')
				if (listBan.includes(nmrnya)) return m.reply('Orang itu udah kena ban senyap.')
				listBan.push(nmrnya)
				// Sengaja BUKAN m.reply yang nge-tag orangnya di grup -- biar
				// nggak ketauan/nyadar dia baru aja di-ban senyap. Cukup react
				// centang ke pesan command-nya doang buat konfirmasi ke admin.
				await m.react('✅')
			}
			break
			case 'kick': case 'dor': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender
					const findJid = voxel.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
					const nmrnya = voxel.findJidByLid(klss, store, true)
					await voxel.groupParticipantsUpdate(m.chat, [nmrnya], 'remove').catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'promote': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender
					const findJid = voxel.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
					const nmrnya = voxel.findJidByLid(klss, store, true)
					await voxel.groupParticipantsUpdate(m.chat, [nmrnya], 'promote').catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'demote': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender
					const findJid = voxel.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
					const nmrnya = voxel.findJidByLid(klss, store, true)
					await voxel.groupParticipantsUpdate(m.chat, [nmrnya], 'demote').catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'warn': case 'warning': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender
					const findJid = voxel.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
					const nmrnya = voxel.findJidByLid(klss, store, true)
					if (!db.groups[m.chat].warn[nmrnya]) {
						db.groups[m.chat].warn[nmrnya] = 1
						m.reply('Warning 1/4, akan dikick sewaktu waktu❗')
					} else if (db.groups[m.chat].warn[nmrnya] >= 3) {
						await voxel.groupParticipantsUpdate(m.chat, [nmrnya], 'remove').catch((err) => m.reply(global.mess.fail))
						delete db.groups[m.chat].warn[nmrnya]
					} else {
						db.groups[m.chat].warn[nmrnya] += 1
						m.reply(`Warning ${db.groups[m.chat].warn[nmrnya]}/4, akan dikick sewaktu waktu❗`)
					}
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'unwarn': case 'delwarn': case 'unwarning': case 'delwarning': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const numbersOnly = text ? text.replace(/\D/g, '') + '@s.whatsapp.net' : m.quoted?.sender
					const findJid = voxel.findJidByLid(numbersOnly.replace(/[^0-9]/g, '') + '@lid', store);
					const klss = numbersOnly.replace(/[^0-9]/g, '') + (findJid ? '@lid' :  '@s.whatsapp.net')
					const nmrnya = voxel.findJidByLid(klss, store, true)
					if (db.groups[m.chat]?.warn?.[nmrnya]) {
						delete db.groups[m.chat].warn[nmrnya]
						m.reply('Berhasil Menghapus Warning!')
					}
				} else m.reply(`Example: ${prefix + command} 62xxx`)
			}
			break
			case 'setname': case 'setnamegc': case 'setsubject': case 'setsubjectgc': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await voxel.groupUpdateSubject(m.chat, teksnya).catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} textnya`)
			}
			break
			case 'setdesc': case 'setdescgc': case 'setdesk': case 'setdeskgc': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (text || m.quoted) {
					const teksnya = text ? text : m.quoted.text
					await voxel.groupUpdateDescription(m.chat, teksnya).catch((err) => m.reply(global.mess.fail))
				} else m.reply(`Example: ${prefix + command} textnya`)
			}
			break
			case 'setppgroups': case 'setppgrup': case 'setppgc': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (!m.quoted) return m.reply('Reply Gambar yang mau dipasang di Profile Bot')
				if (!/image/.test(quoted.type)) return m.reply(`Reply Image Dengan Caption ${prefix + command}`)
				let media = await quoted.download();
				let { img } = await generateProfilePicture(media, text.length > 0 ? null : 512)
				await voxel.query({
					tag: 'iq',
					attrs: {
						target: m.chat,
						to: '@s.whatsapp.net',
						type: 'set',
						xmlns: 'w:profile:picture'
					},
					content: [{ tag: 'picture', attrs: { type: 'image' }, content: img }]
				});
				m.reply(global.mess.done)
			}
			break
			case 'delete': case 'del': case 'd': {
				if (!m.quoted) return m.reply(global.mess.quoted)
				const isOwnMessage = m.quoted.sender === m.sender
				if (!isOwnMessage) {
					if (!m.isGroup) return m.reply('Kamu cuma bisa hapus pesan kamu sendiri di private chat!')
					if (!m.isAdmin && !isCreator) return m.reply(global.mess.admin)
					if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				}
				await voxel.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: isOwnMessage ? true : false, id: m.quoted.id, participant: m.quoted.sender }})
			}
			break
			// Alias `unpin` sengaja ikut: `.pin` udah jadi alias Pinterest (case di bawah),
// tapi `.unpin` nggak dipakai command lain -- jadi user nggak perlu hafal "unpinm".
case 'pinm': case 'unpinm': case 'unpin': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (!m.quoted) return m.reply(global.mess.quoted)
				const unpin = command.startsWith('unpin')
				// WAProto.Message.PinInChatMessage: 1 = PIN_FOR_ALL, 2 = UNPIN_FOR_ALL.
				// Bentuk pemanggilan WAIT: `pin` itu MessageKey-nya LANGSUNG, dan
				// `type`/`time` itu key SEBELUMNYA di luar `pin`. Versi lama
				// nge-send { pin: { type, time, key } } -- bikin pinInChatMessage.key
				// jadi objek ngawur (nggak punya remoteJid/id) dan type-nya UNKNOWN_TYPE(0),
				// makanya .pinm diam-diam nggak pernah ngepin apa-apa.
				const key = { remoteJid: m.chat, fromMe: !!m.quoted.fromMe, id: m.quoted.id, participant: m.quoted.sender }
				await voxel.sendMessage(m.chat, { pin: key, type: unpin ? 2 : 1, time: 2592000 })
				.then(() => m.reply(unpin ? '*Berhasil lepas pin*' : '*Berhasil pin pesan ini*'))
				.catch(() => m.reply(global.mess.fail))
			}
			break
			case 'linkgroup': case 'linkgrup': case 'linkgc': case 'urlgroup': case 'urlgrup': case 'urlgc': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				let response = await voxel.groupInviteCode(m.chat)
				await m.reply(`https://chat.whatsapp.com/${response}\n\nLink Group : ${(store.groupMetadata[m.chat] ? store.groupMetadata[m.chat] : (store.groupMetadata[m.chat] = await voxel.groupMetadata(m.chat).catch(e => ({ ...store.groupMetadata[m.chat] })))).subject}`, { detectLink: true })
			}
			break
			case 'revoke': case 'newlink': case 'newurl': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				await voxel.groupRevokeInvite(m.chat).then((a) => {
					m.reply(`Sukses Menyetel Ulang, Tautan Undangan Grup ${m.metadata.subject}`)
				}).catch((err) => m.reply(global.mess.fail))
			}
			break
			case 'tagall': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				let setv = pickRandom(global.listv)
				let teks = `*Tag All*\n\n*Pesan :* ${q ? q : ''}\n\n`
				let participants = m.metadata?.participants || [];
				if (participants.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.')
				for (let mem of participants) {
					// Fallback ke id: participant yang masih cached dengan identitas @lid
					// bisa punya phoneNumber kosong -- tanpa fallback ini @lid ikut ke-tag,
					// dan .split di atas bikin crash.
					teks += `${setv} @${(mem.phoneNumber || mem.id || '').split('@')[0]}\n`
				}
				await m.reply(teks, { mentions: participants.map(a => a.phoneNumber || a.id).filter(Boolean) })
			}
			break
			case 'hidetag': case 'h': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				let participants = m.metadata?.participants || [];
				if (participants.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.')
				await m.reply(q ? q : '', { mentions: participants.map(a => a.phoneNumber || a.id).filter(Boolean) })
			}
			break
			case 'totag': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				if (!m.quoted) return m.reply(global.mess.quoted)
				delete m.quoted.chat
				let participants = m.metadata?.participants || [];
				if (participants.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.')
				await voxel.sendMessage(m.chat, { forward: m.quoted.fakeObj(), mentions: participants.map(a => a.phoneNumber || a.id).filter(Boolean) })
			}
			break
			case 'listonline': case 'liston': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				let id = args && /\d+\-\d+@g.us/.test(args[0]) ? args[0] : m.chat
				if (!store.presences || !store.presences[id]) return m.reply('Sedang Tidak ada yang online!')
				const groupPresences = store.presences[id];
				const metadata = store.groupMetadata[id];
				let list_online = [];
				if (metadata && metadata.participants) {
					for (const p of metadata.participants) {
						if (groupPresences[p.id]) {
							list_online.push(p.phoneNumber);
						}
					}
				}
				if (!list_online.includes(botNumber)) {
					list_online.push(botNumber);
				}
				if (list_online.length === 0) return m.reply('Sedang tidak ada yang online!'); 
				let textReply = '*List Online:*\n\n' + list_online.map(v => setv + ' @' + v.split('@')[0]).join('\n');
				await m.reply(textReply, { mentions: list_online }).catch(() => m.reply('Gagal menampilkan list online..'));
			}
			break
			case 'totalpesan': case 'totalchat': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!m.isAdmin) return m.reply(global.mess.admin)
				if (!m.isBotAdmin) return m.reply(global.mess.botAdmin)
				let messageCount = {};
				let messages = store?.messages[m.chat]?.array || [];
				let participants = (m?.metadata?.participants?.map(p => p.phoneNumber) || store?.messages[m.chat]?.array?.map(p => p.key.participantAlt) || []).filter(p => p);
				messages.forEach(mes => {
					if (mes.key?.participantAlt && mes.message) {
						messageCount[mes.key.participantAlt] = (messageCount[mes.key.participantAlt] || 0) + 1;
					}
				});
				let totalMessages = Object.values(messageCount).reduce((a, b) => a + b, 0);
				let date = new Date().toLocaleDateString('id-ID');
				let zeroMessageUsers = participants.filter(user => !messageCount[user]).map(user => `- @${user.replace(/[^0-9]/g, '')}`);
				let messageList = Object.entries(messageCount).map(([sender, count], index) => `${index + 1}. @${sender.replace(/[^0-9]/g, '')}: ${count} Pesan`);
				let result = `Total Pesan ${totalMessages} dari ${participants.length} anggota\nPada tanggal ${date}:\n${messageList.join('\n')}\n\nNote: ${text.length > 0 ? `\n${zeroMessageUsers.length > 0 ? `Sisa Anggota yang tidak mengirim pesan (Sider):\n${zeroMessageUsers.join('\n')}` : 'Semua anggota sudah mengirim pesan!'}` : `\nCek Sider? ${prefix + command} --sider`}`;
				m.reply(result)
			}
			break
			
			// Bot Menu
			case 'runtime': case 'tes': case 'bot': {
				if (!args[0] && !args[1]) return m.reply(`*Bot Telah Online Selama*\n*${runtime(process.uptime())}*`);
				switch(args[0]) {
					case 'mode': case 'public': case 'self':
					if (!isCreator) return m.reply(global.mess.owner)
					if (args[1] == 'public' || args[1] == 'all') {
						if (voxel.public && set.grouponly && set.privateonly) return m.reply('*Sudah Aktif Sebelumnya*')
						voxel.public = set.public = true
						set.grouponly = true
						set.privateonly = true
						m.reply('*Sukses Change To Public Usage*')
					} else if (args[1] == 'self') {
						set.grouponly = false
						set.privateonly = false
						voxel.public = set.public = false
						m.reply('*Sukses Change To Self Usage*')
					} else if (args[1] == 'group') {
						set.grouponly = true
						set.privateonly = false
						m.reply('*Sukses Change To Group Only*')
					} else if (args[1] == 'private') {
						set.grouponly = false
						set.privateonly = true
						m.reply('*Sukses Change To Private Only*')
					} else m.reply('Mode self/public/group/private/all')
					break
					case 'log': case 'anticall': case 'autobio': case 'autoread': case 'autotyping': case 'readsw': case 'multiprefix': case 'antispam': case 'didyoumean':
					if (!isCreator) return m.reply(global.mess.owner)
					if (args[1] == 'on') {
						if (set[args[0]]) return m.reply('*Sudah Aktif Sebelumnya*')
						set[args[0]] = true
						m.reply('*Sukses Change To On*')
					} else if (args[1] == 'off') {
						set[args[0]] = false
						m.reply('*Sukses Change To Off*')
					} else m.reply(`${args[0].charAt(0).toUpperCase() + args[0].slice(1)} on/off`)
					break
					case 'set': case 'settings':
					let settingsBot = Object.entries(set).map(([key, value]) => {
						// Dulu di sini cek `typeof value === 'object'` lalu langsung
						// `.map()` -- masalahnya `typeof null` di JS itu JUGA 'object',
						// jadi begitu ada setting yang nilainya null (bukan array),
						// langsung crash "Cannot read properties of null (reading 'map')".
						// Sekarang dicek Array.isArray dulu, dan null/objek biasa
						// ditangani terpisah biar nggak pernah crash.
						let list = key == 'status' ? new Date(value).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
							: (typeof value === 'boolean') ? (value ? 'on🟢' : 'off🔴')
							: Array.isArray(value) ? (value.length ? `\n${value.map(a => '- ' + a).join('\n')}` : '(kosong)')
							: (value === null || value === undefined) ? '-'
							: (typeof value === 'object') ? JSON.stringify(value)
							: value;
						return `- ${key.charAt(0).toUpperCase() + key.slice(1)} : ${list}`;
					}).join('\n');
					m.reply(`Settings Bot @${botNumber.split('@')[0]}\n${settingsBot}\n\nExample: ${prefix + command} mode`);
					break
					case 'author': case 'authorprefix':
					if (!isCreator) return m.reply(global.mess.owner)
					if (args[1] == 'on') {
						set.authorPrefix = '.';
						m.reply(global.mess.done)
					} else if (args[1] == 'off') {
						set.authorPrefix = '';
						m.reply(global.mess.done)
					} else m.reply(`${args[0].charAt(0).toUpperCase() + args[0].slice(1)} on/off`)
					break
					case 'whitelist': case 'whitelistmode':
					if (!isCreator) return m.reply(global.mess.owner)
					if (args[1] == 'on') {
						set.whitelistonly = true
						m.reply('*Sukses Change To Whitelist Mode*')
					} else if (args[1] == 'off') {
						set.whitelistonly = false
						m.reply('*Sukses Change To Normal Mode*')
					} else m.reply('Whitelist on/off')
					break
					default: {
						let menuList = `*⚙️ SETTINGS BOT ⚙️*
					
Select Bot Settings:

*👥 Mode Penggunaan:*
- Mode Bot : *${prefix + command} mode [public/self/group/private]*
- Whitelist Mode : *${prefix + command} whitelist [on/off]*

*🎛️ Fitur Otomatis (on/off):*
- Anti Call : *${prefix + command} anticall [on/off]*
- Anti Spam : *${prefix + command} antispam [on/off]*
- Auto Bio : *${prefix + command} autobio [on/off]*
- Auto Read : *${prefix + command} autoread [on/off]*
- Auto Typing : *${prefix + command} autotyping [on/off]*
- Read Status/SW : *${prefix + command} readsw [on/off]*

*🛠️ System Settings:*
- Multi Prefix : *${prefix + command} multiprefix [on/off]*
- Did You Mean : *${prefix + command} didyoumean [on/off]*
- Log Console : *${prefix + command} log [on/off]*
- Author Prefix : *${prefix + command} author [on/off]*

*📊 Info & Status:*
- Cek Semua Setting : *${prefix + command} set*
- Cek Runtime Bot : *${prefix + command}*`;
						if (args[0] || args[1]) m.reply(menuList);
					}
				}
			}
			break
			case 'ping': case 'botstatus': case 'statusbot': {
				const used = process.memoryUsage()
				const cpus = os.cpus().map(cpu => {
					cpu.total = Object.keys(cpu.times).reduce((last, type) => last + cpu.times[type], 0)
					return cpu
				})
				const cpu = cpus.reduce((last, cpu, _, { length }) => {
					last.total += cpu.total
					last.speed += cpu.speed / length
					last.times.user += cpu.times.user
					last.times.nice += cpu.times.nice
					last.times.sys += cpu.times.sys
					last.times.idle += cpu.times.idle
					last.times.irq += cpu.times.irq
					return last
				}, {
					speed: 0,
					total: 0,
					times: {
						user: 0,
						nice: 0,
						sys: 0,
						idle: 0,
						irq: 0
					}
				})
				let timestamp = speed()
				let latensi = speed() - timestamp
				let neww = performance.now()
				let oldd = performance.now()
				let respon = `Kecepatan Respon ${latensi.toFixed(4)} _Second_ \n ${oldd - neww} _miliseconds_\n\nRuntime : ${runtime(process.uptime())}\n\n💻 Info Server\nRAM: ${formatp(os.totalmem() - os.freemem())} / ${formatp(os.totalmem())}\n\n_NodeJS Memory Usaage_\n${Object.keys(used).map((key, _, arr) => `${key.padEnd(Math.max(...arr.map(v=>v.length)),' ')}: ${formatp(used[key])}`).join('\n')}\n\n${cpus[0] ? `_Total CPU Usage_\n${cpus[0].model.trim()} (${cpu.speed} MHZ)\n${Object.keys(cpu.times).map(type => `- *${(type + '*').padEnd(6)}: ${(100 * cpu.times[type] / cpu.total).toFixed(2)}%`).join('\n')}\n_CPU Core(s) Usage (${cpus.length} Core CPU)_\n${cpus.map((cpu, i) => `${i + 1}. ${cpu.model.trim()} (${cpu.speed} MHZ)\n${Object.keys(cpu.times).map(type => `- *${(type + '*').padEnd(6)}: ${(100 * cpu.times[type] / cpu.total).toFixed(2)}%`).join('\n')}`).join('\n\n')}` : ''}`.trim()
				m.reply(respon)
			}
			break
			case 'speedtest': case 'speed': {
				m.reply('Testing Speed...')
				let cp = require('child_process')
				let { promisify } = require('util')
				let exec = promisify(cp.exec).bind(cp)
				let o
				try {
					o = await exec('python3 speed.py --share')
				} catch (e) {
					o = e
				} finally {
					let { stdout, stderr } = o
					if (stdout.trim()) m.reply(stdout)
					if (stderr.trim()) m.reply(stderr)
				}
			}
			break
			case 'afk': {
				let user = db.users[m.sender]
				user.afkTime = + new Date
				user.afkReason = text
				m.reply(`@${m.sender.split('@')[0]} Telah Afk${text ? ': ' + text : ''}`)
			}
			break
			case 'readviewonce': case 'readviewone': case 'rvo': {
				if (!m.quoted) return m.reply(global.mess.quoted)
				const qmsgRvo = (m.quoted.msg || m.quoted)
				const mimeRvo = qmsgRvo.mimetype || ''
				if (!mimeRvo) return m.reply(`Reply pesan sekali lihat (foto/video/audio)\nExample: ${prefix + command}`)
				try {
					const media = await voxel.downloadAndSaveMediaMessage(m.quoted)
					const buffer = fs.readFileSync(media)
					if (/image/.test(mimeRvo)) {
						await voxel.sendMessage(m.chat, { image: buffer, caption: qmsgRvo.caption || '' }, { quoted: m })
					} else if (/video/.test(mimeRvo)) {
						await voxel.sendMessage(m.chat, { video: buffer, caption: qmsgRvo.caption || '' }, { quoted: m })
					} else if (/audio/.test(mimeRvo)) {
						await voxel.sendMessage(m.chat, { audio: buffer, mimetype: 'audio/mpeg', ptt: qmsgRvo.ptt || false }, { quoted: m })
					} else {
						m.reply('Tipe media tidak didukung untuk reveal!')
					}
					if (fs.existsSync(media)) fs.unlinkSync(media)
				} catch (e) {
					console.log(e)
					m.reply('Media Tidak Valid atau bukan pesan sekali lihat!')
				}
			}
			break
			case 'inspect': {
				if (!text) return m.reply('Masukkan Link Grup atau Saluran!')
				let _grup = /chat.whatsapp.com\/([\w\d]*)/;
				let _saluran = /whatsapp\.com\/channel\/([\w\d]*)/;
				if (_grup.test(text)) {
					await voxel.groupGetInviteInfo(text.match(_grup)[1]).then((_g) => {
						let teks = `*[ INFORMATION GROUP ]*\n\nName Group: ${_g.subject}\nGroup ID: ${_g.id}\nCreate At: ${new Date(_g.creation * 1000).toLocaleString()}${_g.owner ? ('\nCreate By: ' + _g.owner) : '' }\nLinked Parent: ${_g.linkedParent}\nRestrict: ${_g.restrict}\nAnnounce: ${_g.announce}\nIs Community: ${_g.isCommunity}\nCommunity Announce:${_g.isCommunityAnnounce}\nJoin Approval: ${_g.joinApprovalMode}\nMember Add Mode: ${_g.memberAddMode}\nDescription ID: ${'`' + _g.descId + '`'}\nDescription: ${_g.desc}\nParticipants:\n`
						_g.participants.forEach((a) => {
							teks += a.admin ? `- Admin: @${a.id.split('@')[0]} [${a.admin}]\n` : ''
						})
						m.reply(teks)
					}).catch((e) => {
						if ([400, 406].includes(e.data)) return m.reply('Grup Tidak Di Temukan❗');
						if (e.data == 401) return m.reply('Bot Di Kick Dari Grup Tersebut❗');
						if (e.data == 410) return m.reply('Url Grup Telah Di Setel Ulang❗');
					});
				} else if (_saluran.test(text) || text.endsWith('@newsletter') || !isNaN(text)) {
					await voxel.newsletterMsg(text.match(_saluran)[1]).then((n) => {
						m.reply(`*[ INFORMATION CHANNEL ]*\n\nID: ${n.id}\nState: ${n.state.type}\nName: ${n.thread_metadata.name.text}\nCreate At: ${new Date(n.thread_metadata.creation_time * 1000).toLocaleString()}\nSubscriber: ${n.thread_metadata.subscribers_count}\nVerification: ${n.thread_metadata.verification}\nDescription: ${n.thread_metadata.description.text}\n`)
					}).catch((e) => m.reply('Saluran Tidak Di Temukan❗'))
				} else m.reply('Hanya Support Url Grup atau Saluran!')
			}
			break
			case 'addmsg': {
				if (!m.quoted) return m.reply('Reply Pesan Yang Ingin Disave Di Database')
				if (!text) return m.reply(`Example : ${prefix + command} file name`)
				let msgs = db.database
				if (text.toLowerCase() in msgs) return m.reply(`'${text}' telah terdaftar di list pesan`)
				msgs[text.toLowerCase()] = m.quoted
				delete msgs[text.toLowerCase()].chat
				m.reply(`Berhasil menambahkan pesan di list pesan sebagai '${text}'\nAkses dengan ${prefix}getmsg ${text}\nLihat list Pesan Dengan ${prefix}listmsg`)
			}
			break
			case 'delmsg': case 'deletemsg': {
				if (!text) return m.reply('Nama msg yg mau di delete?')
				let msgs = db.database
				if (text == 'allmsg') {
					db.database = {}
					m.reply('Berhasil menghapus seluruh msg dari list pesan')
				} else {
					if (!(text.toLowerCase() in msgs)) return m.reply(`'${text}' tidak terdaftar didalam list pesan`)
					delete msgs[text.toLowerCase()]
					m.reply(`Berhasil menghapus '${text}' dari list pesan`)
				}
			}
			break
			case 'getmsg': {
				if (!text) return m.reply(`Example : ${prefix + command} file name\n\nLihat list pesan dengan ${prefix}listmsg`)
				let msgs = db.database
				if (!(text.toLowerCase() in msgs)) return m.reply(`'${text}' tidak terdaftar di list pesan`)
				await voxel.relayMessage(m.chat, msgs[text.toLowerCase()], {})
			}
			break
			case 'listmsg': {
				let seplit = Object.entries(db.database).map(([nama, isi]) => { return { nama, message: getContentType(isi) }})
				let teks = '「 LIST DATABASE 」\n\n'
				for (let i of seplit) {
					teks += `${setv} *Name :* ${i.nama}\n${setv} *Type :* ${i.message?.replace(/Message/i, '')}\n───────────────\n`
				}
				m.reply(teks)
			}
			break
			case 'setcmd': case 'addcmd': {
				if (!m.quoted) return m.reply(global.mess.quoted)
				if (!m.quoted.fileSha256) return m.reply('SHA256 Hash Missing!')
				if (!text) return m.reply(`Example : ${prefix + command} CMD Name`)
				let hash = m.quoted.fileSha256.toString('base64')
				if (global.db.cmd[hash] && global.db.cmd[hash].locked) return m.reply('You have no permission to change this sticker command')
				global.db.cmd[hash] = {
					creator: m.sender,
					locked: false,
					at: + new Date,
					text
				}
				m.reply(global.mess.done)
			}
			break
			case 'delcmd': {
				if (!m.quoted) return m.reply(global.mess.quoted)
				if (!m.quoted.fileSha256) return m.reply('SHA256 Hash Missing!')
				let hash = m.quoted.fileSha256.toString('base64')
				if (global.db.cmd[hash] && global.db.cmd[hash].locked) return m.reply('You have no permission to change this sticker command')
				delete global.db.cmd[hash];
				m.reply(global.mess.done)
			}
			break
			case 'listcmd': {
				let teks = `*List Hash*\nInfo: *bold* hash is Locked\n${Object.entries(global.db.cmd).map(([key, value], index) => `${index + 1}. ${value.locked ? `*${key}*` : key} : ${value.text}`).join('\n')}`.trim()
				voxel.sendText(m.chat, teks, m);
			}
			break
			case 'lockcmd': case 'unlockcmd': {
				if (!isCreator) return m.reply(global.mess.owner)
				if (!m.quoted) return m.reply(global.mess.quoted)
				if (!m.quoted.fileSha256) return m.reply('SHA256 Hash Missing!')
				let hash = m.quoted.fileSha256.toString('base64')
				if (!(hash in global.db.cmd)) return m.reply('You have no permission to change this sticker command')
				global.db.cmd[hash].locked = !/^un/i.test(command)
			}
			break
			case 'q': case 'quoted': {
				if (!m.quoted) return m.reply(global.mess.quoted)
				if (text) {
					delete m.quoted.chat
					await m.reply({ forward: m.quoted })
				} else {
					try {
						const anu = await m.getQuotedObj()
						if (!anu) return m.reply('Format Tidak Tersedia!')
						if (!anu.quoted) return m.reply('Pesan Yang Anda Reply Tidak Mengandung Reply')
						await voxel.relayMessage(m.chat, { [anu.quoted.type]: anu.quoted.msg }, {})
					} catch (e) {
						return m.reply('Format Tidak Tersedia!')
					}
				}
			}
			break
			case 'confes': case 'confess': case 'menfes': case 'menfess': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (m.isGroup) return m.reply(global.mess.private)
				if (menfes[m.sender]) return m.reply(`Kamu Sedang Berada Di Sesi ${command}!`)
				if (!text) return m.reply(`Example : ${prefix + command} 62xxxx|Nama Samaran`)
				let [teks1, teks2] = text.split`|`
				if (teks1) {
					const tujuan = teks1.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
					const onWa = await voxel.onWhatsApp(tujuan)
					if (!onWa.length > 0) return m.reply(global.mess.onWa)
					// Cap sesi baru per jam (se-bot) -- tiap sesi baru artinya bot
					// mulai chat sama nomor yang belum pernah kontak bot, ini
					// yang paling beresiko bikin akun kena restriksi WhatsApp.
					const oneHourAgo = Date.now() - 60 * 60 * 1000;
					while (confessSessionLog.length && confessSessionLog[0] < oneHourAgo) confessSessionLog.shift();
					if (confessSessionLog.length >= CONFESS_MAX_PER_HOUR) {
						return m.reply(`⚠️ Fitur ${command} lagi dibatasi sementara (udah kepake ${CONFESS_MAX_PER_HOUR}x dalam 1 jam terakhir). Ini buat jaga keamanan akun bot dari WhatsApp -- coba lagi nanti ya.`)
					}
					confessSessionLog.push(Date.now());
					menfes[m.sender] = {
						tujuan: tujuan,
						nama: teks2 ? teks2 : 'Orang'
					};
					menfes[tujuan] = {
						tujuan: m.sender,
						nama: 'Penerima',
					};
					const timeout = setTimeout(() => {
						if (menfes[m.sender]) {
							m.reply(`_Waktu ${command} habis_`);
							delete menfes[m.sender];
						}
						if (menfes[tujuan]) {
							voxel.sendMessage(tujuan, { text: `_Waktu ${command} habis_` });
							delete menfes[tujuan];
						}
						menfesAwaitingReply.delete(m.sender);
						menfesAwaitingReply.delete(tujuan);
						menfesTimeouts.delete(m.sender);
						menfesTimeouts.delete(tujuan);
					}, 600000);
					menfesTimeouts.set(m.sender, timeout);
					menfesTimeouts.set(tujuan, timeout);
					voxel.sendMessage(tujuan, { text: `_${command} connected_\n*Note :* jika ingin mengakhiri ketik _*${prefix}del${command}*_` });
					m.reply(`_Memulai ${command}..._\n*Silahkan Mulai kirim pesan/media*\n*Durasi ${command} hanya selama 10 menit*\n*Note :* jika ingin mengakhiri ketik _*${prefix}del${command}*_`)
					setLimit(m, db)
				} else m.reply(`Masukkan Nomernya!\nExample : ${prefix + command} 62xxxx|Nama Samaran`)
			}
			break
			case 'delconfes': case 'delconfess': case 'delmenfes': case 'delmenfess': {
				if (!menfes[m.sender]) return m.reply(`Kamu Tidak Sedang Berada Di Sesi ${command.split('del')[1]}!`)
				let anu = menfes[m.sender]
				if (menfesTimeouts.has(m.sender)) {
					clearTimeout(menfesTimeouts.get(m.sender));
					menfesTimeouts.delete(m.sender);
				}
				if (menfesTimeouts.has(anu.tujuan)) {
					clearTimeout(menfesTimeouts.get(anu.tujuan));
					menfesTimeouts.delete(anu.tujuan);
				}
				voxel.sendMessage(anu.tujuan, { text: `Chat Di Akhiri Oleh ${anu.nama ? anu.nama : 'Seseorang'}` })
				m.reply(`Sukses Mengakhiri Sesi ${command.split('del')[1]}!`)
				menfesAwaitingReply.delete(m.sender);
				menfesAwaitingReply.delete(anu.tujuan);
				delete menfes[anu.tujuan];
				delete menfes[m.sender];
			}
			break
			case 'cai': case 'roomai': case 'chatai': case 'autoai': {
				if (m.isGroup) return m.reply(global.mess.private)
				if (chat_ai[m.sender]) return m.reply(`Kamu Sedang Berada Di Sesi ${command}!`)
				if (!text) return m.reply(`Example: ${prefix + command} halo ngab\nWith Prompt: ${prefix + command} halo ngab|Kamu adalah assisten yang siap membantu dalam hal apapun yang ku minta.\n\nUntuk Menghapus room: ${prefix + 'del' + command}`)
				let [teks1, teks2] = text.split`|`
				chat_ai[m.sender] = [{ role: 'system', content: teks2 || '' }, { role: 'user', content: text.split`|` ? teks1 : text || '' }]
				let hasil = await fetchApi('/ai/duckai', {
					messages: chat_ai[m.sender],
					prompt: budy
				}, { method: 'POST' });
				const response = hasil?.result?.message || 'Maaf, saya tidak mengerti.';
				chat_ai[m.sender].push({ role: 'assistant', content: response });
				await m.reply(response)
			}
			break
			case 'delcai': case 'delroomai': case 'delchatai': case 'delautoai': {
				if (!chat_ai[m.sender]) return m.reply(`Kamu Tidak Sedang Berada Di Sesi ${command.split('del')[1]}!`)
				m.reply(`Sukses Mengakhiri Sesi ${command.split('del')[1]}!`)
				delete chat_ai[m.sender];
			}
			break	
			
			// Tools Menu
			case 'fetch': case 'get': {
				if (!isPremium) return m.reply(global.mess.prem)
				if (!isLimit) return m.reply(global.mess.limit)
				if (!/^https?:\/\//.test(text)) return m.reply('Awali dengan http:// atau https://');
				try {
					const res = await axios.get(isUrl(text) ? isUrl(text)[0] : text)
					if (!/text|json|html|plain/.test(res.headers['content-type'])) {
						await m.reply(text)
					} else m.reply(util.format(res.data))
					setLimit(m, db)
				} catch (e) {
					m.reply(String(e))
				}
			}
			break
			case 'toaud': case 'toaudio': {
				if (!/video|audio/.test(mime)) return m.reply(`Kirim/Reply Video/Audio Yang Ingin Dijadikan Audio Dengan Caption ${prefix + command}`)
				m.react('⏳')
				let media = await voxel.downloadAndSaveMediaMessage(qmsg)
				try {
					let audio = await toAudio(media, 'mp4')
					await m.reply({ audio: { url: audio }, mimetype: 'audio/mpeg'})
					if (fs.existsSync(audio)) fs.unlinkSync(audio)
				} finally {
					if (fs.existsSync(media)) fs.unlinkSync(media)
				}
			}
			break
			case 'tomp3': {
				if (!/video|audio/.test(mime)) return m.reply(`Kirim/Reply Video/Audio Yang Ingin Dijadikan Audio Dengan Caption ${prefix + command}`)
				m.react('⏳')
				let media = await voxel.downloadAndSaveMediaMessage(qmsg)
				try {
					let audio = await toAudio(media, 'mp4')
					await m.reply({ document: { url: audio }, mimetype: 'audio/mpeg', fileName: `Convert By Voxel Bot.mp3`})
					if (fs.existsSync(audio)) fs.unlinkSync(audio)
				} finally {
					if (fs.existsSync(media)) fs.unlinkSync(media)
				}
			}
			break
			case 'tovn': case 'toptt': case 'tovoice': {
				if (!/video|audio/.test(mime)) return m.reply(`Kirim/Reply Video/Audio Yang Ingin Dijadikan Audio Dengan Caption ${prefix + command}`)
				m.react('⏳')
				let media = await voxel.downloadAndSaveMediaMessage(qmsg)
				try {
					let audioBuffer = await toPTT(media, 'mp4')
					await m.reply({ audio: audioBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });
				} finally {
					if (fs.existsSync(media)) fs.unlinkSync(media)
				}
			}
			break
			case 'togif': {
				if (!/webp|video/.test(mime)) return m.reply(`Reply Video/Stiker dengan caption *${prefix + command}*`)
				m.react('⏳')
				let media = await voxel.downloadAndSaveMediaMessage(qmsg)
				let ran = `./database/temp/${getRandom('.mp4')}`;
				exec(`ffmpeg -y -i "${media}" -an -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -pix_fmt yuv420p -c:v libx264 -preset veryfast "${ran}"`, async (err) => {
					try {
						if (err) return m.reply(global.mess.fail);
						await m.reply({ video: { url: ran }, gifPlayback: true, caption: global.mess.done, gifAttribution: pickRandom(['TENOR','GIPHY']) })
					} finally {
						if (fs.existsSync(media)) fs.unlinkSync(media)
						if (fs.existsSync(ran)) fs.unlinkSync(ran)
					}
				})
			}
			break
			case 'toimage': case 'toimg': {
				if (!/webp|video|image/.test(mime)) return m.reply(`Reply Video/Stiker dengan caption *${prefix + command}*`)
				m.react('⏳')
				let media = await voxel.downloadAndSaveMediaMessage(qmsg)
				let ran = `./database/temp/${getRandom('.png')}`;
				exec(`ffmpeg -y -i "${media}" -vframes 1 "${ran}"`, async (err) => {
					try {
						if (err) return m.reply(global.mess.fail);
						await m.reply({ image: { url: ran }, caption: global.mess.done })
					} finally {
						if (fs.existsSync(media)) fs.unlinkSync(media)
						if (fs.existsSync(ran)) fs.unlinkSync(ran)
					}
				})
			}
			break
			case 'toptv': {
				if (!/video/.test(mime)) return m.reply(`Kirim/Reply Video Yang Ingin Dijadikan PTV Message Dengan Caption ${prefix + command}`)
				if ((m.quoted ? m.quoted.type : m.type) === 'videoMessage') {
					m.react('⏳')
					let media = await voxel.downloadAndSaveMediaMessage(qmsg);
					try {
						const message = await generateWAMessageContent({ video: { url: media } }, { upload: voxel.waUploadToServer })
						await voxel.relayMessage(m.chat, { ptvMessage: message.videoMessage }, {})
					} finally {
						if (fs.existsSync(media)) fs.unlinkSync(media)
					}
				} else m.reply('Reply Video Yang Mau Di Ubah Ke PTV Message!')
			}
			break
			case 'tourl': {
				if (/webp|video|sticker|audio|jpg|jpeg|png/.test(mime)) {
					m.react('⏳')
					let media = await voxel.downloadAndSaveMediaMessage(qmsg);
					try {
						let anu = await UguuSe(media);
						m.reply('Url : ' + anu.url)
					} finally {
						if (fs.existsSync(media)) fs.unlinkSync(media)
					}
				} else m.reply(global.mess.media)
			}
			break
			case 'translate': case 'tr': {
				if (text && text == 'list') {
					let list_tr = `╭──❍「 *Kode Bahasa* 」❍\n│• af : Afrikaans\n│• ar : Arab\n│• zh : Chinese\n│• en : English\n│• en-us : English (United States)\n│• fr : French\n│• de : German\n│• hi : Hindi\n│• hu : Hungarian\n│• is : Icelandic\n│• id : Indonesian\n│• it : Italian\n│• ja : Japanese\n│• ko : Korean\n│• la : Latin\n│• no : Norwegian\n│• pt : Portuguese\n│• pt : Portuguese\n│• pt-br : Portuguese (Brazil)\n│• ro : Romanian\n│• ru : Russian\n│• sr : Serbian\n│• es : Spanish\n│• sv : Swedish\n│• ta : Tamil\n│• th : Thai\n│• tr : Turkish\n│• vi : Vietnamese\n╰──────❍`;
					m.reply(list_tr)
				} else {
					if (!m.quoted && (!text|| !args[1])) return m.reply(`Kirim/reply text dengan caption ${prefix + command}`)
					let lang = args[0] ? args[0] : global.locale
					let teks = args[1] ? args.slice(1).join(' ') : m.quoted.text
					try {
						let hasil = await fetchApi('/tools/translate', { text: teks, lang });
						m.reply(`To : ${lang}\n${hasil.result.translate}`)
					} catch (e) {
						m.reply(`Lang *${lang}* Tidak Di temukan!\nSilahkan lihat list, ${prefix + command} list`)
					}
				}
			}
			break
			case 'ssweb': {
				if (!isPremium) return m.reply(global.mess.prem)
				if (!text) return m.reply(`Example: ${prefix + command} https://github.com/nazedev/voxel-md`)
				let anu = 'https://' + text.replace(/^https?:\/\//, '')
				// Cegah SSRF: tanpa ini, .ssweb http://localhost:3000 atau
				// http://169.254.169.254/ bisa dipakai buat membaca jaringan
				// internal bot. Dicek SEBELUM dipanggil, karena URL-nya juga
				// dikirim ke provider luar saat fallback.
				if (!(await isSafePublicUrl(anu))) return m.reply('URL ditolak: target bukan alamat publik / tidak bisa diverifikasi.')
				let imageContent
				let fallbackTempPath
				try {
					try {
						// Sumber utama: Chromium lokal (device sendiri) -- lihat
						// lib/ssweb.js. Butuh Chromium ke-install di sistem.
						imageContent = await screenshotWebsite(anu)
					} catch (localErr) {
						console.log(chalk.yellow(`[SSWEB] Chromium lokal gagal/nggak ada (${localErr.message}). Fallback ke provider luar...`))
						fallbackTempPath = await fetchApi('/tools/ssweb', { url: anu }, { stream: true });
						imageContent = { url: fallbackTempPath }
					}
					await m.reply({ image: imageContent, caption: global.mess.done });
					setLimit(m, db)
				} finally {
					if (fallbackTempPath && fs.existsSync(fallbackTempPath)) fs.unlinkSync(fallbackTempPath);
				}
			}
			break
			case 'readmore': {
				let teks1 = text.split`|`[0] ? text.split`|`[0] : ''
				let teks2 = text.split`|`[1] ? text.split`|`[1] : ''
				m.reply(teks1 + readmore + teks2)
			}
			break
			case 'getexif': {
				if (!m.quoted) return m.reply(`Reply sticker\nDengan caption ${prefix + command}`)
				if (!/sticker|webp/.test(quoted.type)) return m.reply(`Reply sticker\nDengan caption ${prefix + command}`)
				const img = new webp.Image()
				await img.load(await m.quoted.download())
				if (!img.exif) return m.reply('Stiker ini tidak memiliki metadata/EXIF sama sekali.');
				try {
					const exifData = JSON.parse(img.exif.slice(22).toString());
					m.reply(util.format(exifData))
				} catch (e) {
					m.reply(`Stiker memiliki EXIF, tapi formatnya bukan JSON yang valid:\n\n${img.exif.toString()}`);
				}
			}
			break
		  case 'cuaca': case 'weather': {
        if (!text) return m.reply(`Example: ${prefix + command} jakarta`)

        try {
          const { data } = await fetchApi(
            '/info/cuaca',
            { q: text },
            { name: 'voxel' }
          )

          const lokasi = data?.wilayah?.nama
          const weather = data?.weather?.[0]?.cuaca?.[0]?.[0]

          if (!lokasi || !weather) {
            return m.reply('Data cuaca tidak ditemukan!')
          }

          m.reply(
              `*🏙️ Cuaca ${lokasi}*\n\n` +
              `*🌤️ Cuaca :* ${weather.weather_desc}\n` +
              `*🌡️ Suhu :* ${weather.t}°C\n` +
              `*💧 Kelembapan :* ${weather.hu}%\n` +
              `*💨 Kecepatan Angin :* ${weather.ws} km/jam\n` +
              `*🧭 Arah Angin :* ${weather.wd}\n` +
              `*👁️ Jarak Pandang :* ${weather.vs_text}\n` +
              `*🕐 Waktu :* ${weather.local_datetime}`
          )
        } catch (e) {
            console.error('[CUACA]', e)
              m.reply('Kota Tidak Ditemukan!')
        }
      }	
			break
			case 'sticker': case 'stiker': case 's': case 'stickergif': case 'stikergif': case 'sgif': case 'stickerwm': case 'swm': case 'curi': case 'colong': case 'take': case 'stickergifwm': case 'sgifwm': {
				if (!/image|video|sticker/.test(quoted.type)) return m.reply(`Kirim/reply gambar/video/gif dengan caption ${prefix + command}\nDurasi Image/Video/Gif 1-9 Detik`)
				let media = await voxel.downloadAndSaveMediaMessage(qmsg);
				let teks1 = text.split`|`[0] ? text.split`|`[0] : packname
				let teks2 = text.split`|`[1] ? text.split`|`[1] : author
				if (/image|webp/.test(mime)) {
					m.react('⏳')
					await voxel.sendAsSticker(m.chat, media, m, { packname: teks1, author: teks2 })
				} else if (/video/.test(mime)) {
					if ((qmsg).seconds > 11) return m.reply('Maksimal 10 detik!')
					m.react('⏳')
					await voxel.sendAsSticker(m.chat, media, m, { packname: teks1, author: teks2 })
				} else m.reply(`Kirim/reply gambar/video/gif dengan caption ${prefix + command}\nDurasi Video/Gif 1-9 Detik`)
			}
			break
			case 'brat': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text && (!m.quoted || !m.quoted.text)) return m.reply(`Kirim/reply pesan *${prefix + command}* Teksnya`)
				let queryText = text ? text : m.quoted.text;
				if (queryText.length >= 200) return m.reply('Max 200 Length!')
        m.react('⏳');       
				try {
					let res = await fetchApi('/m/brat', { text: queryText }, { stream: true });
					await voxel.sendAsSticker(m.chat, res, m)
          m.react('✅')
					setLimit(m, db)
				} catch (e) {
					try {
						let res = await fetchApi('/m/brat', { text: queryText }, { stream: true });
						await voxel.sendAsSticker(m.chat, res, m)
						setLimit(m, db)
					} catch (e) {
						console.log(e)
            m.react('❌')
						m.reply(global.mess.fail)
					}
				}
			}
			break
			case 'iqc': case 'quotefake': case 'fakechat': {
				if (!isLimit) return m.reply(global.mess.limit)
				const queryText = text ? text : (m.quoted?.text || '');
				if (!queryText) return m.reply(`Kirim/reply pesan *${prefix + command}* Teksnya\nExample: ${prefix + command} kayaa ginii`)
				if (queryText.length > 200) return m.reply('Max 200 Karakter!')
        m.react('⏳')
				try {
					const buffer = await generateIQC({ message: queryText })
					await m.reply({ image: buffer, caption: `Dibuat oleh: ${m.pushName || 'Seseorang'}` })
          m.react('✅')
					setLimit(m, db)
				} catch (e) {
					console.log(e)
          m.react('❌')
					m.reply(global.mess.fail)
				}
			}
			break
			case 'removebg': case 'rmbg': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!/image/.test(mime)) return m.reply(`Kirim/reply gambar dengan caption *${prefix + command}*`)
				m.react('⏳')
				const media = await voxel.downloadAndSaveMediaMessage(qmsg)
				try {
					const buffer = await RemoveBG(fs.readFileSync(media))
					await m.reply({ image: buffer, caption: global.mess.done })
					setLimit(m, db)
				} catch (e) {
					console.log(e)
          m.react('❌')
					m.reply(global.mess.fail)
				} finally {
					if (fs.existsSync(media)) fs.unlinkSync(media)
				}
			}
			break
			case 'hd': case 'upscale': case 'enhance': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!/image/.test(mime)) return m.reply(`Kirim/reply gambar dengan caption *${prefix + command}*`)
				m.react('⏳')
				const media = await voxel.downloadAndSaveMediaMessage(qmsg)
				try {
					const buffer = fs.readFileSync(media)
					let imageContent
					const img = await Jimp.read(buffer)
					const scale = 4
					const maxDim = 4000
					// PENTING: satu faktor skala yang sama dipakai buat width & height
					// sekaligus (bukan dua batas independen) -- ini yang menjaga rasio
					// asli gambar tetap proporsional, nggak gepeng/distorsi.
					const safeScale = Math.min(scale, maxDim / img.bitmap.width, maxDim / img.bitmap.height)
					const targetWidth = Math.round(img.bitmap.width * safeScale)
					const targetHeight = Math.round(img.bitmap.height * safeScale)
					try {
						// Tier 1: sharp (libvips) -- kualitas & ketajaman terbaik,
						// nggak butuh binary sistem terpisah. Butuh `npm install sharp`.
						imageContent = await sharpUpscale(buffer, { targetWidth, targetHeight })
					} catch (sharpErr) {
						console.log(chalk.yellow(`[HD] sharp gagal/nggak ada (${sharpErr.message}). Fallback ke ImageMagick...`))
						try {
							// Tier 2: ImageMagick (filter Lanczos + unsharp) -- hasil
							// tajam, tapi butuh ImageMagick ke-install di sistem
							// (`pacman -S imagemagick` / `apt install imagemagick`).
							// BUKAN AI upscale -- ini resize interpolasi, bukan nambah
							// detail kayak Real-ESRGAN.
							imageContent = await imagemagickUpscale(buffer, { targetWidth, targetHeight })
						} catch (imErr) {
							console.log(chalk.yellow(`[HD] ImageMagick gagal/nggak ada (${imErr.message}). Fallback ke Jimp...`))
							try {
								// Tier 3: Jimp -- pure JS, nol dependency native, hampir
								// selalu bisa jalan walau di VPS/HP spek rendah.
								imageContent = await jimpUpscale(img, { targetWidth })
							} catch (jimpErr) {
								console.log(chalk.yellow(`[HD] Jimp juga gagal (${jimpErr.message}). Fallback ke provider luar...`))
								// Tier 4 (paling akhir): provider pihak ketiga lama.
								imageContent = { url: await imgupscale(buffer, { scale: 4 }) }
							}
						}
					}
					await m.reply({ image: imageContent, caption: global.mess.done })
          m.react('✅')
					setLimit(m, db)
				} catch (e) {
					console.log(e)
          m.react('❌')
					m.reply(global.mess.fail)
				} finally {
					if (fs.existsSync(media)) fs.unlinkSync(media)
				}
			}
			break
			case 'hdvid': case 'upscalevid': case 'enhancevideo': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!/video/.test(mime)) return m.reply(`Kirim/reply video dengan caption *${prefix + command}*`)
				m.react('⏳')
				const media = await voxel.downloadAndSaveMediaMessage(qmsg)
				try {
					m.reply('_Memproses video, ini bisa memakan waktu beberapa menit..._')
					const hasil = await videoenhancer(media, '4k')
					await m.reply({ video: { url: hasil.output_url }, caption: global.mess.done })
          m.react('✅')
					setLimit(m, db)
				} catch (e) {
          m.react('❌')
					console.log(e)
					m.reply(global.mess.fail)
				} finally {
					if (fs.existsSync(media)) fs.unlinkSync(media)
				}
			}
			break
			case 'findsticker': case 'stickersearch': case 'stickerpack': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} anime`)
				m.react('⏳')
				try {
					const hasil = await stickerPack.search(text)
					if (!hasil?.length) return m.reply('Tidak ditemukan!')
					const item = pickRandom(hasil)
					const detail = await stickerPack.detail(item.slug)
					if (!detail?.stickers?.length) return m.reply('Tidak ditemukan!')
					const sticker = pickRandom(detail.stickers)
					await m.reply({ sticker: { url: sticker.image } })
          m.react('✅')
					setLimit(m, db)
				} catch (e) {
          m.react('❌')
					console.log(e)
					m.reply(global.mess.fail)
				}
			}
			break
			case 'nulis': {
				m.reply(`*Example*\n${prefix}nuliskiri\n${prefix}nuliskanan\n${prefix}foliokiri\n${prefix}foliokanan`)
			}
			break
			case 'nuliskanan': case 'nuliskiri': case 'foliokanan': case 'foliokiri': {
				if (!isLimit) return m.reply(mess.limit);
				if (!text) return m.reply(`Kirim perintah *${prefix + command}* Teksnya`);
				m.react('⏳');
				if (canvasModule) {
					const { createCanvas, loadImage } = canvasModule;
					const isFolio = command.includes('folio');
					const isKanan = command.includes('kanan');
					const folder = isFolio ? 'folio' : 'buku';
					const posisi = isKanan ? 'kanan' : 'kiri';
					const inputFile = `./src/nulis/images/${folder}/sebelum${posisi}.jpg`;
					const maxLines = isFolio ? 38 : 31;
					const maxWordsPerLine = isFolio ? 12 : 8;
					const regexWords = new RegExp(`(\\S+\\s*){1,${maxWordsPerLine}}`, 'g');
					const splitText = text.replace(regexWords, '$&\n');
					const lines = splitText.split('\n').slice(0, maxLines);
					let startX = 140, startY = 156, lineHeight = 8.7;
					if (command === 'nuliskanan') { startX = 128; startY = 136, lineHeight = 10.5; }
					if (command === 'foliokiri') { startX = 48; startY = 200, lineHeight = 12; }
					if (command === 'foliokanan') { startX = 89; startY = 168, lineHeight = 11; }
					let image = null, canvas = null, ctx = null, buffer = null;
					try {
						image = await loadImage(inputFile);
						canvas = createCanvas(image.width, image.height);
						ctx = canvas.getContext('2d');
						ctx.drawImage(image, 0, 0, image.width, image.height);
						ctx.font = '27px "Indie Flower"';
						ctx.fillStyle = '#1e1e1e';
						ctx.textBaseline = 'top';
						const baseLineHeight = 27 + lineHeight;
						let currentY = startY;
						for (const line of lines) {
							ctx.fillText(line, startX, currentY);
							currentY += baseLineHeight;
						}
						buffer = await canvas.encode('png');
						await m.reply({ image: buffer, caption: 'Jangan Malas Lord. Jadilah siswa yang rajin ರ_ರ' });
            m.react('✅')
						setLimit(m, db);
					} catch (err) {
						console.error('Error saat membuat gambar nulis:', err);
            m.react('❌')
						m.reply('Terjadi kesalahan pada sistem saat memproses gambar.');
					} finally {
						if (canvas) {
							canvas.width = 0;
							canvas.height = 0;
						}
						image = null, canvas = null, ctx = null, buffer = null;
					}
				} else {
					const config = {
						'nuliskiri':  { lines: 31, path: 'buku/sebelumkiri.jpg',   out: `buku_setelahkiri_${Date.now()}.jpg`,   size: '960x1280',  space: '2', coord: '+140+153' },
						'nuliskanan': { lines: 31, path: 'buku/sebelumkanan.jpg',  out: `buku_setelahkanan_${Date.now()}.jpg`,  size: '960x1280',  space: '2', coord: '+128+129' },
						'foliokiri':  { lines: 38, path: 'folio/sebelumkiri.jpg',  out: `folio_setelahkiri_${Date.now()}.jpg`,  size: '1720x1280', space: '4', coord: '+48+185' },
						'foliokanan': { lines: 38, path: 'folio/sebelumkanan.jpg', out: `folio_setelahkanan_${Date.now()}.jpg`, size: '1720x1280', space: '4', coord: '+89+190' }
					}[command]
					const splitText = text.replace(/(\S+\s*){1,9}/g, '$&\n')
					const fixHeight = splitText.split('\n').slice(0, config.lines).join('\n')
					const inputImg = `./src/nulis/images/${config.path}`
					const outputImg = `./database/temp/${config.out}`
					try {
						await new Promise((resolve, reject) => {
							spawn('convert', [
								inputImg,
								'-font', './src/nulis/font/Indie-Flower.ttf',
								'-size', config.size,
								'-pointsize', '23',
								'-interline-spacing', config.space,
								'-annotate', config.coord,
								fixHeight,
								outputImg
							])
							.on('error', reject)
							.on('exit', (code) => {
								if (code === 0) resolve()
								else reject(new Error(`Proses convert gagal dengan kode: ${code}`))
							})
						});
						const imageBuffer = fs.readFileSync(outputImg)
						await m.reply({ image: imageBuffer, caption: 'Jangan Malas Lord. Jadilah siswa yang rajin ಠ_ಠ' })
						setLimit(m, db)
					} catch (error) {
						console.error(error)
						m.reply(mess.error)
					} finally {
						if (fs.existsSync(outputImg)) fs.unlinkSync(outputImg);
					}
				}
			}
			break
			case 'bass': case 'blown': case 'deep': case 'earrape': case 'fast': case 'fat': case 'nightcore': case 'reverse': case 'robot': case 'slow': case 'smooth': case 'tupai': {
				try {
					let set;
					if (/bass/.test(command)) set = '-af equalizer=f=54:width_type=o:width=2:g=20'
					if (/blown/.test(command)) set = '-af acrusher=.1:1:64:0:log'
					if (/deep/.test(command)) set = '-af atempo=4/4,asetrate=44500*2/3'
					if (/earrape/.test(command)) set = '-af volume=12'
					if (/fast/.test(command)) set = '-filter:a "atempo=1.63,asetrate=44100"'
					if (/fat/.test(command)) set = '-filter:a "atempo=1.6,asetrate=22100"'
					if (/nightcore/.test(command)) set = '-filter:a atempo=1.06,asetrate=44100*1.25'
					if (/reverse/.test(command)) set = '-filter_complex "areverse"'
					if (/robot/.test(command)) set = '-filter_complex "afftfilt=real=\'hypot(re,im)*sin(0)\':imag=\'hypot(re,im)*cos(0)\':win_size=512:overlap=0.75"'
					if (/slow/.test(command)) set = '-filter:a "atempo=0.7,asetrate=44100"'
					if (/smooth/.test(command)) set = '-filter:v "minterpolate=\'mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=120\'"'
					if (/tupai/.test(command)) set = '-filter:a "atempo=0.5,asetrate=65100"'
					if (/audio/.test(mime)) {
						m.react('⏳')
						let media = await voxel.downloadAndSaveMediaMessage(qmsg)
						let ran = `./database/temp/${getRandom('.mp3')}`;
						exec(`ffmpeg -i "${media}" ${set} "${ran}"`, async (err, stderr, stdout) => {
			                try {
			                    if (err) return m.reply(global.mess.fail)
			                    await m.reply({ audio: { url: ran }, mimetype: 'audio/mpeg' });
			                } finally {
			                    if (fs.existsSync(media)) fs.unlinkSync(media);
			                    if (fs.existsSync(ran)) fs.unlinkSync(ran);
			                }
			            });
					} else m.reply(`Balas audio yang ingin diubah dengan caption *${prefix + command}*`)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			case 'git': case 'gitclone': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!args[0]) return m.reply(`Example: ${prefix + command} https://github.com/nazedev/hitori`)
				if (!isUrl(args[0]) && !args[0].includes('github.com')) return m.reply('Gunakan Url Github!')
				let [, user, repo] = args[0].match(/(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i) || []
				try {
					m.reply({ document: { url: `https://api.github.com/repos/${user}/${repo}/zipball` }, fileName: repo + '.zip', mimetype: 'application/zip' }).catch((e) => m.reply(global.mess.error))
					setLimit(m, db)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			
			// Search Menu
			case 'gimage': case 'bingimg': {
				if (!text) return m.reply(`Example: ${prefix + command} query`)
				try {
					let anu = await fetchApi('/s/bimg', { query: text });
					let una = pickRandom(anu.result)
					await m.reply({ image: { url: una.pagemap?.cse_thumbnail?.[0]?.src || una.pagemap?.cse_image?.[0].src || una.pagemap?.metatags?.[0]?.["og:image"] }, caption: 'Hasil Pencarian ' + text + '\nTitle: ' + una.title + '\nSnippet: ' + una.snippet + '\nSource: ' + una.link || una.formattedUrl })
					setLimit(m, db)
				} catch (e) {
					m.reply('Pencarian Tidak Ditemukan!')
				}
			}
			break
			case 'play': case 'ytplay': case 'yts': case 'ytsearch': case 'youtubesearch': {
				if (!text) return m.reply(`Example: ${prefix + command} dj komang`)
        await m.react('🔍')
        await sleep(750)
        await m.react('⏳')
				try {
					const res = await yts.search(text);
					const hasil = pickRandom(res.all)
					const teksnya = `*📍Title:* ${hasil.title || 'Tidak tersedia'}\n*✏Description:* ${hasil.description || 'Tidak tersedia'}\n*🌟Channel:* ${hasil.author?.name || 'Tidak tersedia'}\n*⏳Duration:* ${hasil.seconds || 'Tidak tersedia'} second (${hasil.timestamp || 'Tidak tersedia'})\n*🔎Source:* ${hasil.url || 'Tidak tersedia'}`;
					await m.reply({ image: { url: hasil.thumbnail }, caption: teksnya })
				} catch (e) {
					try {
						const res = await fetchApi('/s/youtube', { query: text });
						const hasil = pickRandom(res.result.items)
						const teksnya = `*📍Title:* ${hasil.snippet.title || 'Tidak tersedia'}\n*✏Description:* ${hasil.snippet.description || 'Tidak tersedia'}\n*🌟Channel:* ${hasil.snippet.channelTitle || 'Tidak tersedia'}\n*⏳Duration:* ${hasil.duration || 'Tidak tersedia'}\n*🔎Source:* https://youtu.be/${hasil.id.videoId || 'Tidak tersedia'}`;
						await m.reply({ image: { url: hasil.snippet.thumbnails.medium.url }, caption: teksnya })
            await m.react('✅')
					} catch (e) {
						m.reply('Post not available!')
					}
				}
			}
			break
			case 'ytmp3': case 'ytaudio': case 'ytplayaudio': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} https://youtu.be/xxxxx`)
				if (!isUrl(text) || !/youtu\.?be/.test(text)) return m.reply('Url Youtube Tidak Valid!')
				m.react('⏳')
				try {
					let media;
					try {
						const res = await fetchApi('/download/ytmp3', { url: text }, { name: 'betabotz' })
						const hasil = res.result || res
						const url = hasil.mp3 || hasil.url || hasil.dl || hasil.link || hasil.download
						if (!url) throw new Error('[BetaBotz] Format respons tidak dikenali: ' + JSON.stringify(res))
						media = { url, title: hasil.title }
					} catch (apiErr) {
						// Tahap 2: ytMp3 sendiri yg berantai (yt-dlp -> scrapr -> ytdl-core).
						// Hasilnya bisa Buffer (yt-dlp) atau URL (scapr/ytdl-core).
						const h = await ytMp3(text)
						media = { buf: h.result, url: null, title: h.title, isBuffer: h.isBuffer }
					}
					const judul = media.title || 'audio'
					const caption = `*Title:* ${judul}`
					if (media.isBuffer) {
						await m.reply({ audio: media.buf, mimetype: 'audio/mpeg', fileName: `${judul.slice(0, 60)}.mp3`, caption })
					} else {
						await m.reply({ audio: { url: media.url }, mimetype: 'audio/mpeg', fileName: `${judul.slice(0, 60)}.mp3`, caption })
					}
					setLimit(m, db)
				} catch (e) {
					console.log('[ytmp3]', e)
					// Jangan pesan generik: e.message bring semua tahap + penyebabnya,
					// jadi gampang tahu itu age-restricted, rate-limit, atau API mati.
					await m.reply(`❌ YouTube audio gagal.\n\n\`${String(e.message).slice(-260)}\``)
				}
			}
			break
			case 'ytmp4': case 'ytvideo': case 'ytplayvideo': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} https://youtu.be/xxxxx`)
				if (!isUrl(text) || !/youtu\.?be/.test(text)) return m.reply('Url Youtube Tidak Valid!')
				m.react('⏳')
				let localFile = null
				try {
					let dl, title
					try {
						const res = await fetchApi('/download/ytmp4', { url: text }, { name: 'betabotz' })
						const hasil = res.result || res
						dl = hasil.download || hasil.url || hasil.dl || hasil.link || hasil.mp4
						title = hasil.title
						if (!dl) throw new Error('[BetaBotz] Format respons tidak dikenali: ' + JSON.stringify(res))
						await m.reply({ video: { url: dl }, mimetype: 'video/mp4', fileName: `${title || 'video'}.mp4`, caption: `*Title:* ${title || 'Tidak tersedia'}` })
					} catch (apiErr) {
						// Tahap 2: ytMp4 berantai (yt-dlp -> ytdl-core). Hasil yt-dlp
						// udah berupa Buffer, jadi TIDAK perlu fs.readFileSync (path-nya
						// udah dihapus oleh yt-dlp sebelum dikembalikan).
						const hasil = await ytMp4(text)
						if (hasil.isBuffer) {
							await m.reply({ video: hasil.result, mimetype: 'video/mp4', fileName: `${(hasil.title || 'video').slice(0, 60)}.mp4`, caption: `*Title:* ${hasil.title || 'Tidak tersedia'}` })
						} else {
							localFile = hasil.result
							await m.reply({ video: fs.readFileSync(localFile), mimetype: 'video/mp4', fileName: `${(hasil.title || 'video').slice(0, 60)}.mp4`, caption: `*Title:* ${hasil.title || 'Tidak tersedia'}` })
						}
					}
					setLimit(m, db)
				} catch (e) {
					console.log('[ytmp4]', e)
					await m.reply(`❌ YouTube video gagal.\n\n\`${String(e.message).slice(-260)}\``)
				} finally {
					if (localFile && fs.existsSync(localFile)) fs.unlinkSync(localFile)
				}
			}
			break
		  case 'pinterest': case 'pin': {
        if (!isLimit) return m.reply(global.mess.limit)
        if (!text) return m.reply(`Example: ${prefix + command} hu tao`)

        try {
          const { data } = await axios.get('https://api.siputzx.my.id/api/s/pinterest', {
              params: { query: text, type: 'image' }
          })

          if (!data?.status || !data?.data?.length) {
            return m.reply('Pencarian tidak ditemukan!')
          }

          const hasil = pickRandom(data.data)
          const imageUrl = hasil?.image_url || hasil

          if (!imageUrl || typeof imageUrl !== 'string') {
              return m.reply('Gambar tidak ditemukan!')
          }

          const image = await getBuffer(imageUrl)

          await m.reply({
              image,
              caption: `Hasil dari: ${text}`
          })

          setLimit(m, db)
      } catch (e) {
          console.error('Pinterest Error:', e)
          m.reply(`Terjadi kesalahan saat mengambil gambar.\n\nDetail: ${e.message || e}`)
        }
      }
      break
	
			break
			case 'spotify': case 'spotifysearch': {
				if (!text) return m.reply(`Example: ${prefix + command} alan walker alone`)
        m.react('⏳')
				try {
					let hasil = await fetchApi('/search/spotify', { query: text }, { name: 'betabotz' });
					let txt = hasil.result.data.map(a => {
						return `*Title : ${a.title}*\n- Duration : ${a.duration}\n- Url : ${a.url}`
            m.react('✅')
					}).join`\n\n`
					m.reply(txt)
				} catch (e) {
					m.reply('Hasil Tidak Ditemukan!\n' + e)
				}
			}
			break
			case 'wastalk': case 'whatsappstalk': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} @tag / 628xxx`)
				try {
					let num = m.quoted?.sender || m.mentionedJid?.[0] || text
					if (!num) return m.reply(`Example : ${prefix + command} @tag / 628xxx`)
					num = num.replace(/\D/g, '') + '@s.whatsapp.net'
					if (!(await voxel.onWhatsApp(num))[0]?.exists) return m.reply('Nomer tidak terdaftar di WhatsApp!')
					let img = await voxel.profilePictureUrl(num, 'image').catch(_ => 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60')
					let bio = await voxel.fetchStatus(num).catch(_ => { })
					let name = await voxel.getName(num)
					let business = await voxel.getBusinessProfile(num)
					let parsed = parsePhoneNumber(`+${num.split('@')[0]}`)
					let format = parsed.number ? parsed.number.international : num.split('@')[0];
					let regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
					let country = parsed.regionCode ? regionNames.of(parsed.regionCode) : 'Unknown';
					let wea = `WhatsApp Stalk\n\n*° Country :* ${country.toUpperCase()}\n*° Name :* ${name ? name : '-'}\n*° Format Number :* ${format}\n*° Url Api :* wa.me/${num.split('@')[0]}\n*° Mentions :* @${num.split('@')[0]}\n*° Status :* ${bio?.status || '-'}\n*° Date Status :* ${bio?.setAt ? moment(bio.setAt.toDateString()).locale(global.locale).format('LL') : '-'}\n\n${business ? `*WhatsApp Business Stalk*\n\n*° BusinessId :* ${business.wid}\n*° Website :* ${business.website ? business.website : '-'}\n*° Email :* ${business.email ? business.email : '-'}\n*° Category :* ${business.category}\n*° Address :* ${business.address ? business.address : '-'}\n*° Timeone :* ${business.business_hours.timezone ? business.business_hours.timezone : '-'}\n*° Description* : ${business.description ? business.description : '-'}` : '*Standard WhatsApp Account*'}`
					img ? await voxel.sendMessage(m.chat, { image: { url: img }, caption: wea, mentions: [num] }, { quoted: m }) : m.reply(wea)
				} catch (e) {
					console.error(e)
					m.reply('Nomer Tidak ditemukan!')
				}
			}
			break
			case 'ghstalk': case 'githubstalk': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} usernamenya`)
				try {
					let res;
					try {
						const anu = await fetchApi('/stalk/github', { username: text });
						res = anu.result || anu.data || anu;
					} catch (apiErr) {
						// Fallback: API utama down, pakai API resmi GitHub langsung (Cantarella)
						res = await githubstalkFallback(text);
					}
					m.reply({ image: { url: res.avatar_url || res.avatar || res.profile_pic }, caption: `*Username :* ${res.login || res.username || text}\n*Nickname :* ${res.name || res.nickname || 'Tidak ada'}\n*Bio :* ${res.bio || 'Tidak ada'}\n*Company :* ${res.company || 'Tidak ada'}\n*Blog :* ${res.blog || res.website || 'Tidak ada'}\n*Location :* ${res.location || 'Tidak ada'}\n*Public Repo :* ${res.public_repos ?? '-'}\n*Followers :* ${res.followers ?? '-'}\n*Following :* ${res.following ?? '-'}` })
				} catch (e) {
					m.reply('Username Tidak ditemukan!')
				}
			}
			break
			case 'ffstalk': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} 123456789`)
				m.react('⏳')
				try {
					const res = await ffstalk(text)
					m.reply(`*🎮 Free Fire Stalk*\n\n*ID:* ${res.id}\n*Nickname:* ${res.nickname}`)
					setLimit(m, db)
				} catch (e) {
					m.reply('ID Free Fire tidak ditemukan!')
				}
			}
			break
			case 'mlstalk': {
				if (!isLimit) return m.reply(global.mess.limit)
				const [gameId, zoneId] = text.split(/\s+/)
				if (!gameId || !zoneId) return m.reply(`Example: ${prefix + command} 123456789 1234`)
				m.react('⏳')
				try {
					const res = await mlstalk(gameId, zoneId)
					m.reply(`*🎮 Mobile Legends Stalk*\n\n*ID:* ${gameId} (${zoneId})\n*Nickname:* ${res.username || res.nickname || JSON.stringify(res)}`)
					setLimit(m, db)
				} catch (e) {
					m.reply('ID Mobile Legends tidak ditemukan!')
				}
			}
			break
			case 'npmstalk': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} express`)
				m.react('⏳')
				try {
					const res = await npmstalk(text)
					m.reply(`*📦 NPM Stalk: ${res.name}*\n\n*Versi terbaru:* ${res.versionLatest}\n*Versi pertama:* ${res.versionPublish}\n*Total rilis:* ${res.versionUpdate}\n*Dependencies (terbaru):* ${res.latestDependencies}\n*Pertama publish:* ${res.publishTime}\n*Update terakhir:* ${res.latestPublishTime}`)
					setLimit(m, db)
				} catch (e) {
					m.reply('Paket npm tidak ditemukan!')
				}
			}
			break
			case 'lirik': case 'lyrics': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} Payung Teduh - Akad`)
				m.react('⏳')
				try {
					const res = await lyricsSearch(text)
					m.reply(`*🎵 ${res.trackName}*\n_by ${res.artistName}_\n\n${res.lyrics}\n\n> Sumber: ${res.source}`)
					setLimit(m, db)
				} catch (e) {
					m.reply('Lirik tidak ditemukan!')
				}
			}
			break
			case 'twitterdl': case 'twitter': case 'xdl': {
				if (!isLimit) return m.reply(global.mess.limit)
				const dlUrl = resolveDownloadUrl(text, m.quoted)
				if (!dlUrl) return m.reply(`Example: ${prefix + command} https://x.com/.../status/...\n_(atau reply pesan yang ada link X/Twitter-nya)_`)
				m.react('⏳')
				try {
					const res = await twitterdl(dlUrl)
					const video = res?.result?.url || res?.url || res?.result?.video
					if (!video) return m.reply('Video tidak ditemukan!')
					await voxel.sendFileUrl(m.chat, video, 'Twitter/X Download', m)
					setLimit(m, db)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			case 'animesearch': case 'anime': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} Naruto`)
				m.react('⏳')
				try {
					const res = await animeSearch(text)
					const list = res?.data || res?.results || res
					if (!Array.isArray(list) || !list.length) return m.reply('Anime tidak ditemukan!')
					const teks = list.slice(0, 10).map((a, i) => `${i + 1}. ${a.title || a.judul}${a.status ? ` (${a.status})` : ''}`).join('\n')
					m.reply(`*🎌 Hasil Pencarian Anime: ${text}*\n\n${teks}`)
					setLimit(m, db)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			case 'nanoedit': case 'aiedit': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!/image/.test(mime)) return m.reply(`Kirim/reply gambar dengan caption *${prefix + command} <perintah editnya>*\nExample: ${prefix + command} hapus background`)
				if (!text) return m.reply('Kasih tau mau diedit jadi apa gambarnya!\nExample: hapus background, ganti jadi gaya anime, dll')
				m.react('⏳')
				const media = await voxel.downloadAndSaveMediaMessage(qmsg)
				try {
					const buffer = fs.readFileSync(media)
					const url = await nanoEdit(buffer, text)
					await m.reply({ image: { url }, caption: global.mess.done })
					setLimit(m, db)
				} catch (e) {
					console.log(e)
					m.reply('Gagal edit gambar, coba lagi nanti!')
				} finally {
					if (fs.existsSync(media)) fs.unlinkSync(media)
				}
			}
			break
			
			// Downloader Menu
			case 'ig': case 'instagram': case 'instadl': case 'igdown': case 'igdl': {
				if (!isLimit) return m.reply(global.mess.limit)
				const dlUrl = resolveDownloadUrl(text, m.quoted)
				if (!dlUrl) return m.reply(`Example: ${prefix + command} https://www.instagram.com/reel/...\n_(atau reply pesan yang ada link Instagram-nya)_`)
				if (!/instagram\.com/i.test(dlUrl)) return m.reply('URL Instagram tidak valid!')
				m.react('⏳')
				try {
					const hasil = await igdl(dlUrl)
					if (!hasil?.media?.length) throw new Error('Media Instagram tidak ditemukan')
					const caption = `*📸 Instagram Downloader*\n*👤 User:* ${hasil.author?.username || '-'}\n\n${hasil.author?.caption || ''}`
					for (const item of hasil.media.slice(0, 10)) {
						if (!item?.download) continue
						if (item.type === 'video') await m.reply({ video: { url: item.download }, caption })
						else await m.reply({ image: { url: item.download }, caption })
					}
					setLimit(m, db)
				} catch (e) {
					console.error('[Instagram Alya Port]', e)
					m.reply(global.mess.fail)
				}
			}
			break
			case 'tiktok': case 'tiktokdown': case 'ttdown': case 'ttdl': case 'tt': case 'ttmp4': case 'ttvideo': case 'tiktokmp4': case 'tiktokvideo': {
				if (!isLimit) return m.reply(global.mess.limit)
				const dlUrl = resolveDownloadUrl(text, m.quoted)
				if (!dlUrl) return m.reply(`Example: ${prefix + command} https://www.tiktok.com/@user/video/...\n_(atau reply pesan yang ada link TikTok-nya)_`)
				if (!/tiktok\.com/i.test(dlUrl)) return m.reply('URL TikTok tidak valid!')
				m.react('⏳')
				try {
					const hasil = await tiktokDl(dlUrl)
					if (!hasil?.status || !Array.isArray(hasil.data) || !hasil.data.length) throw new Error(hasil?.msg || 'Media TikTok tidak ditemukan')
					const caption = `*📍Title:* ${hasil.title || '-'}\n*🎃Author:* ${hasil.author?.nickname || '-'}${hasil.author?.fullname ? ` (@${hasil.author.fullname})` : ''}\n*👁️Views:* ${hasil.stats?.views || '-'}\n*❤️Likes:* ${hasil.stats?.likes || '-'}`
					const photos = hasil.data.filter(x => x?.type === 'photo' && x?.url).map(x => ({ image: { url: x.url } }))
					if (photos.length) {
						if (photos.length === 1) await m.reply({ image: photos[0].image, caption })
						else await voxel.sendAlbumMessage(m.chat, { album: photos, caption }, { quoted: m })
					} else {
						const video = hasil.data.find(x => x?.type === 'nowatermark_hd') || hasil.data.find(x => x?.type === 'nowatermark') || hasil.data.find(x => x?.type === 'watermark')
						if (!video?.url) throw new Error('URL video TikTok tidak ditemukan')
						await m.reply({ video: { url: video.url }, caption })
					}
					setLimit(m, db)
				} catch (e) {
					console.error('[TikTok Alya Port]', e)
					m.reply(`TikTok gagal diproses.\n_${e?.message || 'Semua scraper gagal.'}_`)
				}
			}
			break
			case 'tiktoksearch': case 'ttsearch': case 'ttsearchvid': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} perfect world`)
				m.react('⏳')
				try {
					const res = await fetchApi('/search/tiktoks', { query: text }, { name: 'betabotz' })
					const list = res.result || res.data || res
					if (list?.status === false) throw { isUpstreamLimit: true, msg: list.msg }
					const items = Array.isArray(list) ? list : (Array.isArray(list?.result) ? list.result : [])
					if (!items.length) throw new Error('[Betabotz] Format respons tidak dikenali: ' + JSON.stringify(res))
					const hasil = pickRandom(items)
					const videoUrl = Array.isArray(hasil.video) ? hasil.video[0] : (hasil.video?.no_watermark || hasil.video?.noWatermark || hasil.video?.nowm || hasil.video?.url || (typeof hasil.video === 'string' ? hasil.video : null) || hasil.no_watermark || hasil.url || hasil.link || hasil.download)
					const caption = `*📍Title:* ${hasil.title || hasil.desc || hasil.caption || '-'}\n\n_Hasil acak dari ${items.length} video ditemukan untuk "${text}"_`
					if (!videoUrl) throw new Error('[Betabotz] Url video tidak ditemukan di hasil: ' + JSON.stringify(hasil))
					await m.reply({ video: { url: videoUrl }, caption });
					setLimit(m, db)
				} catch (e) {
					console.log('[TikTok Search] Error:', e)
					if (e?.isUpstreamLimit) return m.reply(`Sumber (TikTok) lagi dibatasi sebentar (429). Coba lagi beberapa saat lagi ya.\n${e.msg ? '_' + e.msg + '_' : ''}`)
					m.reply(global.mess.fail)
				}
			}
			break
			case 'tiktokrandom': case 'ttrandom': case 'asupantiktok': case 'ttasupan': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} cewek cantik`)
				m.react('⏳')
				try {
					const res = await fetchApi('/asupan/tiktok', { query: text }, { name: 'betabotz' })
					const hasil = res.result || res
					if (hasil.status === false) throw { isUpstreamLimit: true, msg: hasil.msg }
					const videoUrl = Array.isArray(hasil.video) ? hasil.video[0] : (hasil.video?.no_watermark || hasil.video?.noWatermark || hasil.video?.nowm || hasil.video?.url || (typeof hasil.video === 'string' ? hasil.video : null) || hasil.no_watermark || hasil.url || hasil.link || hasil.download)
					const caption = `*📍Title:* ${hasil.title || hasil.desc || hasil.caption || '-'}`
					if (!videoUrl) throw new Error('[Betabotz] Url video tidak ditemukan: ' + JSON.stringify(res))
					await m.reply({ video: { url: videoUrl }, caption });
					setLimit(m, db)
				} catch (e) {
					console.log('[TikTok Random] Error:', e)
					if (e?.isUpstreamLimit) return m.reply(`Sumber (TikTok) lagi dibatasi sebentar (429). Coba lagi beberapa saat lagi ya.\n${e.msg ? '_' + e.msg + '_' : ''}`)
					m.reply(global.mess.fail)
				}
			}
			break
			case 'ttmp3': case 'tiktokmp3': case 'ttaudio': case 'tiktokaudio': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} url_tiktok`)
				if (!text.includes('tiktok.com')) return m.reply('Url Tidak Mengandung Result Dari Tiktok!')
				m.react('⏳')
				try {
					const hasil = await fetchApi('/d/tiktok', { url: text });
					const audioUrl = hasil.result?.download?.music
					if (!audioUrl) throw new Error('[siputzx] Audio tidak ditemukan di respons')
					await m.reply({ audio: { url: audioUrl }, mimetype: 'audio/mpeg' })
					setLimit(m, db)
				} catch (e) {
					console.log('[TikTokMp3] siputzx gagal, mencoba betabotz...', e?.message || e)
					try {
						const res = await fetchApi('/download/tiktok', { url: text }, { name: 'betabotz' })
						const hasil = res.result || res
						if (hasil.status === false) throw { isUpstreamLimit: true, msg: hasil.msg }
						const audioUrl = Array.isArray(hasil.audio) ? hasil.audio[0] : (hasil.audio?.url || (typeof hasil.audio === 'string' ? hasil.audio : null) || hasil.music)
						if (!audioUrl) throw new Error('[Betabotz] Format respons tidak dikenali: ' + JSON.stringify(res))
						await m.reply({ audio: { url: audioUrl }, mimetype: 'audio/mpeg' })
						setLimit(m, db)
					} catch (e2) {
						console.log('[TikTokMp3] betabotz juga gagal:', e2)
						if (e2?.isUpstreamLimit) return m.reply(`Sumber (TikTok) lagi dibatasi sebentar (429). Coba lagi beberapa saat lagi ya.\n${e2.msg ? '_' + e2.msg + '_' : ''}`)
						m.reply(global.mess.fail)
					}
				}
			}
			break
			case 'fb': case 'fbdl': case 'fbdown': case 'facebook': case 'facebookdl': case 'facebookdown': case 'fbdownload': case 'fbmp4': case 'fbvideo': {
				if (!isLimit) return m.reply(global.mess.limit)
				const dlUrl = resolveDownloadUrl(text, m.quoted)
				if (!dlUrl) return m.reply(`Example: ${prefix + command} url_facebook\n_(atau reply pesan yang ada link Facebook-nya)_`)
				if (!dlUrl.includes('facebook.com')) return m.reply('Url Tidak Mengandung Result Dari Facebook!')
				m.react('⏳')
				try {
					let videoUrl, title;
					try {
						const hasil = await fetchApi('/d/facebook', { url: dlUrl });
						if (!hasil.result.hd && !hasil.result.sd) throw new Error('API utama: video tidak ditemukan')
						videoUrl = hasil.result.hd || hasil.result.sd;
						title = hasil.result.title;
					} catch (apiErr) {
						// Fallback: API utama down, pakai scraper getfvid.com (Cantarella)
						// -- confidence rendah, cookie/selector-nya udah lama.
						const hasil = await facebookFallback(dlUrl);
						videoUrl = hasil.video || hasil.audio;
						title = 'Facebook Video';
						if (!videoUrl) throw new Error('Fallback juga gagal: video tidak ditemukan')
					}
					await voxel.sendFileUrl(m.chat, videoUrl, `*🎐Title:* ${title}`, m);
					setLimit(m, db)
				} catch (e) {
					console.log(e)
					m.reply(global.mess.fail)
				}
			}
			break
			case 'spotifydl': case 'spotifydownload': {
				if (!isLimit) return m.reply(global.mess.limit)
				const dlUrl = resolveDownloadUrl(text, m.quoted)
				if (!dlUrl) return m.reply(`Example: ${prefix + command} https://open.spotify.com/track/...\n_(atau reply pesan yang ada link Spotify-nya)_`)
				if (!/open\.spotify\.com\/(track|intl-[^/]+\/track)\//i.test(dlUrl)) return m.reply('URL Spotify tidak valid!')
				m.react('⏳')
				try {
					const hasil = await spotifydl(dlUrl)
					if (!hasil?.download) throw new Error('Link download Spotify tidak ditemukan')
					await m.reply({ audio: { url: hasil.download }, mimetype: 'audio/mpeg', fileName: `${hasil.title || 'spotify'}.mp3`, caption: `*🎵 ${hasil.title || '-'}*\n👤 ${hasil.artist || '-'}` })
          m.react('✅')
					setLimit(m, db)
				} catch (e) {
					console.error('[Spotify Alya Port]', e)
          m.react('❌')
					m.reply(global.mess.fail)
				}
			}
			break
			
			case 'pindl': case 'pinterestdl': {
				if (!isLimit) return m.reply(global.mess.limit)
				const dlUrl = resolveDownloadUrl(text, m.quoted)
				if (!dlUrl) return m.reply(`Example: ${prefix + command} https://pin.it/...\n_(atau reply pesan yang ada link Pinterest-nya)_`)
				if (!/pinterest\.com|pin\.it/i.test(dlUrl)) return m.reply('URL Pinterest tidak valid!')
				try {
					const hasil = await pinterestDl(dlUrl)
					const images = hasil?.content?.images || []
					const videos = hasil?.content?.videos || []
					const media = [
						...images.map(x => x?.url || x?.urlOriginal || x?.urlPreview).filter(Boolean),
						...videos.map(x => x?.url || x?.urlOriginal).filter(Boolean)
					]
					if (!media.length) throw new Error('Media Pinterest tidak ditemukan')
					for (const url of media.slice(0, 10)) await m.reply({ image: { url }, caption: `*📌 ${hasil.post?.title || 'Pinterest'}*\n👤 ${hasil.user?.username || '-'}` })
					setLimit(m, db)
				} catch (e) { console.error('[Pinterest Alya Port]', e); m.reply(global.mess.fail) }
			}
			break
			case 'threads': case 'threadsdl': {
				if (!isLimit) return m.reply(global.mess.limit)
				const dlUrl = resolveDownloadUrl(text, m.quoted)
				if (!dlUrl) return m.reply(`Example: ${prefix + command} https://www.threads.net/...\n_(atau reply pesan yang ada link Threads-nya)_`)
				try {
					const hasil = await threadsdl(dlUrl)
					if (!hasil?.media?.length) throw new Error('Media Threads tidak ditemukan')
					for (const item of hasil.media.slice(0, 10)) {
						if (!item?.download) continue
						const caption = `*🧵 Threads*\n👤 ${hasil.author?.username || hasil.author?.name || '-'}`
						if (item.type === 'video') await m.reply({ video: { url: item.download }, caption })
						else await m.reply({ image: { url: item.download }, caption })
					}
					setLimit(m, db)
				} catch (e) { console.error('[Threads Alya Port]', e); m.reply(global.mess.fail) }
			}
			break
			case 'mediafire': case 'mfdl': {
				if (!isLimit) return m.reply(global.mess.limit)
				const dlUrl = resolveDownloadUrl(text, m.quoted)
				if (!dlUrl) return m.reply(`Example: ${prefix + command} https://www.mediafire.com/file/...\n_(atau reply pesan yang ada link MediaFire-nya)_`)
        await m.react('🔍')
        await sleep(300)
        await m.react('📥')
				try {
					const hasil = await mediafire(dlUrl)
					if (!hasil?.download) throw new Error('Link MediaFire tidak ditemukan' + m.react('❌'))
					await m.reply({ document: { url: hasil.download }, fileName: hasil.filename || hasil.name || 'mediafire-file', mimetype: 'application/octet-stream', caption: `*📁 ${hasil.name || hasil.filename || 'MediaFire'}*\n*Size:* ${hasil.size || '-'}` })
          m.react('✅')
					setLimit(m, db)
				} catch (e) { console.error('[MediaFire Alya Port]', e); m.reply(global.mess.fail); m.react('❌') }
			}
			break
			case 'wallpaper': case 'wallpaperflare': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} anime`)
				try {
					const hasil = await wallpaperScraper(text)
					if (!hasil?.length) throw new Error('Wallpaper tidak ditemukan')
					const item = pickRandom(hasil)
					await m.reply({ image: { url: item.image }, caption: `*🖼️ ${item.title}*\n*👤 Author:* ${item.author || '-'}\n*Resolution:* ${item.resolution || '-'}${item.page ? `\n*Source:* ${item.page}` : ''}` })
					setLimit(m, db)
				} catch (e) { console.error('[Wallpaper Alya Port]', e); m.reply(global.mess.fail) }
			}
			break

			// Quotes Menu
			case 'waifu': case 'neko': {
				try {
					const anu = await fetchApi('/r/' + command);
					const res = anu.result || anu.data || anu;
					const imgUrl = res.url || res.image || res;
					await voxel.sendFileUrl(m.chat, imgUrl, command === 'waifu' ? 'Random Waifu' : 'Random Neko', m)
					setLimit(m, db)
				} catch (e) {
					m.reply('Server sedang offline!')
				}
			}
			break
			
			// Fun Menu
			case 'dadu': {
				let ddsa = [{ url: 'https://telegra.ph/file/9f60e4cdbeb79fc6aff7a.png', no: 1 },{ url: 'https://telegra.ph/file/797f86e444755282374ef.png', no: 2 },{ url: 'https://telegra.ph/file/970d2a7656ada7c579b69.png', no: 3 },{ url: 'https://telegra.ph/file/0470d295e00ebe789fb4d.png', no: 4 },{ url: 'https://telegra.ph/file/a9d7332e7ba1d1d26a2be.png', no: 5 },{ url: 'https://telegra.ph/file/99dcd999991a79f9ba0c0.png', no: 6 }]
				let media = pickRandom(ddsa)
				try {
					await voxel.sendAsSticker(m.chat, media.url, m, { packname, author, isAvatar: 1 })
				} catch (e) {
					let anu = await fetch(media.url)
					let una = await anu.buffer()
					await voxel.sendAsSticker(m.chat, una, m, { packname, author, isAvatar: 1 })
				}
			}
			break
			case 'halah': case 'hilih': case 'huluh': case 'heleh': case 'holoh': {
				if (!m.quoted && !text) return m.reply(`Kirim/reply text dengan caption ${prefix + command}`)
				let ter = command[1].toLowerCase()
				let tex = m.quoted ? m.quoted.text ? m.quoted.text : q ? q : m.text : q ? q : m.text
				m.reply(tex.replace(/[aiueo]/g, ter).replace(/[AIUEO]/g, ter.toUpperCase()))
			}
			break
			case 'bisakah': {
				if (!text) return m.reply(`Example : ${prefix + command} saya menang?`)
				let bisa = ['Bisa','Coba Saja','Pasti Bisa','Mungkin Saja','Tidak Bisa','Tidak Mungkin','Coba Ulangi','Ngimpi kah?','yakin bisa?']
				let keh = bisa[Math.floor(Math.random() * bisa.length)]
				m.reply(`*Bisakah ${text}*\nJawab : ${keh}`)
			}
			break
			case 'apakah': {
				if (!text) return m.reply(`Example : ${prefix + command} saya bisa menang?`)
				let apa = ['Iya','Tidak','Bisa Jadi','Coba Ulangi','Mungkin Saja','Mungkin Tidak','Mungkin Iya','Ntahlah']
				let kah = apa[Math.floor(Math.random() * apa.length)]
				m.reply(`*${command} ${text}*\nJawab : ${kah}`)
			}
			break
			case 'kapan': case 'kapankah': {
				if (!text) return m.reply(`Example : ${prefix + command} saya menang?`)
				let kapan = ['Besok','Lusa','Nanti','4 Hari Lagi','5 Hari Lagi','6 Hari Lagi','1 Minggu Lagi','2 Minggu Lagi','3 Minggu Lagi','1 Bulan Lagi','2 Bulan Lagi','3 Bulan Lagi','4 Bulan Lagi','5 Bulan Lagi','6 Bulan Lagi','1 Tahun Lagi','2 Tahun Lagi','3 Tahun Lagi','4 Tahun Lagi','5 Tahun Lagi','6 Tahun Lagi','1 Abad lagi','3 Hari Lagi','Bulan Depan','Ntahlah','Tidak Akan Pernah']
				let koh = kapan[Math.floor(Math.random() * kapan.length)]
				m.reply(`*${command} ${text}*\nJawab : ${koh}`)
			}
			break
			case 'siapa': case 'siapakah': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (!text) return m.reply(`Example : ${prefix + command} jawa?`)
				let member = (store.groupMetadata?.[m.chat]?.participants || m.metadata?.participants || []).map(a => a.phoneNumber).filter(p => p)
				if (member.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.')
				let siapakh = pickRandom(member)
				m.reply(`@${siapakh.split('@')[0]}`);
			}
			break
			case 'tanyakerang': case 'kerangajaib': case 'kerang': {
				if (!text) return m.reply(`Example : ${prefix + command} boleh pinjam 100?`)
				let krng = ['Mungkin suatu hari', 'Tidak juga', 'Tidak keduanya', 'Kurasa tidak', 'Ya', 'Tidak', 'Coba tanya lagi', 'Tidak ada']
				let jwb = pickRandom(krng)
				m.reply(`*Pertanyaan : ${text}*\n*Jawab : ${jwb}*`)
			}
			break
			case 'ceksifat': {
				let sifat_a = ['Bijak','Sabar','Kreatif','Humoris','Mudah bergaul','Mandiri','Setia','Jujur','Dermawan','Idealis','Adil','Sopan','Tekun','Rajin','Pemaaf','Murah hati','Ceria','Percaya diri','Penyayang','Disiplin','Optimis','Berani','Bersyukur','Bertanggung jawab','Bisa diandalkan','Tenang','Kalem','Logis']
				let sifat_b = ['Sombong','Minder','Pendendam','Sensitif','Perfeksionis','Caper','Pelit','Egois','Pesimis','Penyendiri','Manipulatif','Labil','Penakut','Vulgar','Tidak setia','Pemalas','Kasar','Rumit','Boros','Keras kepala','Tidak bijak','Pembelot','Serakah','Tamak','Penggosip','Rasis','Ceroboh','Intoleran']
				let teks = `╭──❍「 *Cek Sifat* 」❍\n│• Sifat ${text && m.mentionedJid ? text : '@' + m.sender.split('@')[0]}${(text && m.mentionedJid ? '' : (`\n│• Nama : *${text ? text : m.pushName}*` || '\n│• Nama : *Tanpa Nama*'))}\n│• Orang yang : *${pickRandom(sifat_a)}*\n│• Kekurangan : *${pickRandom(sifat_b)}*\n│• Keberanian : *${Math.floor(Math.random() * 100)}%*\n│• Kepedulian : *${Math.floor(Math.random() * 100)}%*\n│• Kecemasan : *${Math.floor(Math.random() * 100)}%*\n│• Ketakutan : *${Math.floor(Math.random() * 100)}%*\n│• Akhlak Baik : *${Math.floor(Math.random() * 100)}%*\n│• Akhlak Buruk : *${Math.floor(Math.random() * 100)}%*\n╰──────❍`
				m.reply(teks)
			}
			break
			case 'rate': case 'nilai': {
				m.reply(`Rate Bot : *${Math.floor(Math.random() * 100)}%*`)
			}
			break
			case 'jodohku': {
				if (!m.isGroup) return m.reply(global.mess.group)
				let member = (store.groupMetadata?.[m.chat]?.participants || m.metadata?.participants || []).map(a => a.phoneNumber).filter(p => p)
				if (member.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.')
				let jodoh = pickRandom(member)
				m.reply(`👫Jodoh mu adalah\n@${m.sender.split('@')[0]} ❤ @${jodoh ? jodoh.split('@')[0] : '0'}`);
			}
			break
			case 'jadian': {
				if (!m.isGroup) return m.reply(global.mess.group)
				let member = (store.groupMetadata?.[m.chat]?.participants || m.metadata?.participants || []).map(a => a.phoneNumber).filter(p => p)
				if (member.length === 0) return m.reply('Data member grup tidak tersedia! Harap coba lagi nanti.')
				let jadian1 = pickRandom(member)
				let jadian2 = pickRandom(member)
				m.reply(`Ciee yang Jadian💖 Jangan lupa Donasi🗿\n@${jadian1.split('@')[0]} ❤ @${jadian2.split('@')[0]}`);
			}
			break
			case 'fitnah': {
				let [teks1, teks2, teks3] = text.split`|`
				if (!teks1 || !teks2 || !teks3) return m.reply(`Example : ${prefix + command} pesan target|pesan mu|nomer/tag target`)
				let ftelo = { key: { fromMe: false, participant: teks3.replace(/[^0-9]/g, '') + '@s.whatsapp.net', ...(m.isGroup ? { remoteJid: m.chat } : { remoteJid: teks3.replace(/[^0-9]/g, '') + '@s.whatsapp.net'})}, message: { conversation: teks1 }}
				voxel.sendMessage(m.chat, { text: teks2 }, { quoted: ftelo });
			}
			break
			case 'coba': {
				let anu = ['Aku Monyet','Aku Kera','Aku Tolol','Aku Kaya','Aku Dewa','Aku Anjing','Aku Dongo','Aku Raja','Aku Sultan','Aku Baik','Aku Hitam','Aku Suki']
				// Dipindah dari voxel.sendButtonMsg (format buttonsMessage lama, sudah deprecated di WA)
				// ke format buttons bawaan @sairidev/baileys-new (native flow) lewat m.reply.
				await m.reply({
					text: 'Semoga Hoki😹',
					buttons: [{
						text: pickRandom(anu),
						id: 'teshoki'
					}, {
						text: pickRandom(anu),
						id: 'cobacoba'
					}]
				})
			}
			break
			case 'richtest': case 'testrich': {
				// Rich message sederhana pakai fitur bawaan @sairidev/baileys-new
				// (native flow: tombol biasa + tombol "select" berisi list) - murni lokal, tanpa panggil API luar.
				await m.reply({
					text: `👋🏻 Halo @${m.sender.split('@')[0]}, ini contoh *rich message* bawaan ${botname}.`,
					footer: `${botname} • Rich Message Test`,
					mentions: [m.sender],
					buttons: [{
						text: '📊 Cek Ping',
						id: `${prefix}ping`
					}, {
						text: '📋 Pilih Menu',
						sections: [{
							title: '✨ Contoh Section 1',
							rows: [{
								title: '🚀 Speed Test',
								description: 'Jalankan speed test bot',
								id: `${prefix}speedtest`
							}]
						}, {
							title: '✨ Contoh Section 2',
							highlight_label: '🔥 Populer',
							rows: [{
								title: '📖 Menu',
								description: 'Tampilkan menu bot',
								id: `${prefix}menu`
							}]
						}]
					}]
				})
			}
			break
			
			// Game Menu
			case 'rampok': case 'merampok': {
				await gameMerampok(m, db)
			}
			break
			case 'begal': {
				await gameBegal(voxel, m, db)
			}
			break
			case 'suitpvp': case 'suit': {
				if (Object.values(suit).find(roof => roof.id.startsWith('suit') && [roof.p, roof.p2].includes(m.sender))) return m.reply(`Selesaikan suit mu yang sebelumnya`)
				if (m.mentionedJid[0] === m.sender) return m.reply(`Tidak bisa bermain dengan diri sendiri !`)
				if (!m.mentionedJid[0]) return m.reply(`_Siapa yang ingin kamu tantang?_\nTag orangnya..\n\nExample : ${prefix}suit @${ownerNumber[0]}`, m.chat, { mentions: [ownerNumber[0] + '@s.whatsapp.net'] })
				if (Object.values(suit).find(roof => roof.id.startsWith('suit') && [roof.p, roof.p2].includes(m.mentionedJid[0]))) return m.reply(`Orang yang kamu tantang sedang bermain suit bersama orang lain :(`)
				let caption = `_*SUIT PvP*_\n\n@${m.sender.split('@')[0]} menantang @${m.mentionedJid[0].split('@')[0]} untuk bermain suit\n\nSilahkan @${m.mentionedJid[0].split('@')[0]} untuk ketik terima/tolak`
				let id = 'suit_' + Date.now();
				suit[id] = {
					chat: caption,
					id: id,
					p: m.sender,
					p2: m.mentionedJid[0],
					status: 'wait',
					poin: 10,
					poin_lose: 10,
					timeout: 3 * 60 * 1000
				}
				m.reply(caption)
				await sleep(3 * 60 * 1000)
				if (suit[id]) {
					m.reply(`_Waktu suit habis_`)
					delete suit[id]
				}
			}
			break
			case 'delsuit': case 'deletesuit': {
				let roomnya = Object.values(suit).find(roof => roof.id.startsWith('suit') && [roof.p, roof.p2].includes(m.sender))
				if (!roomnya) return m.reply(`Kamu sedang tidak berada di room suit !`)
				delete suit[roomnya.id]
				m.reply(`Berhasil delete session room suit !`)
			}
			break
			case 'ttc': case 'ttt': case 'tictactoe': {
				if (Object.values(tictactoe).find(room => room.id.startsWith('tictactoe') && [room.game.playerX, room.game.playerO].includes(m.sender))) {
					m.react('❌')
					return m.reply(`Kamu masih didalam game!\nKetik *${prefix}deltictactoe* Jika Ingin Mengakhiri sesi`)
				}
				let room = Object.values(tictactoe).find(room => room.state === 'WAITING' && (text ? room.name === text : true))
				if (room) {
					m.react('✅')
					m.reply('Partner ditemukan!')
					room.o = m.chat
					room.game.playerO = m.sender
					room.state = 'PLAYING'
					if (!(room.game instanceof TicTacToe)) {
						room.game = Object.assign(new TicTacToe(room.game.playerX, room.game.playerO), room.game)
					}
					let arr = room.game.render().map(v => {
						return {X: '❌',O: '⭕',1: '1️⃣',2: '2️⃣',3: '3️⃣',4: '4️⃣',5: '5️⃣',6: '6️⃣',7: '7️⃣',8: '8️⃣',9: '9️⃣'}[v]
					})
					let str = `Room ID: ${room.id}\n\n${arr.slice(0, 3).join('')}\n${arr.slice(3, 6).join('')}\n${arr.slice(6).join('')}\n\nMenunggu @${room.game.currentTurn.split('@')[0]}\n\nKetik *nyerah* untuk menyerah dan mengakui kekalahan`
					if (room.x !== room.o) await voxel.sendMessage(room.x, { text: str, mentions: parseMention(str) }, { quoted: m })
					await voxel.sendMessage(room.o, { text: str, mentions: parseMention(str) }, { quoted: m })
				} else {
					room = {
						id: 'tictactoe-' + (+new Date),
						x: m.chat,
						o: '',
						game: new TicTacToe(m.sender, 'o'),
						state: 'WAITING',
					}
					if (text) room.name = text
					m.react('⏳')
					voxel.sendMessage(m.chat, { text: 'Menunggu partner' + (text ? ` mengetik command dibawah ini ${prefix}${command} ${text}` : ''), mentions: m.mentionedJid }, { quoted: m })
					tictactoe[room.id] = room
					await sleep(300000)
					if (tictactoe[room.id]) {
						m.reply(`_Waktu ${command} habis_`)
						delete tictactoe[room.id]
					}
				}
			}
			break
			case 'delttc': case 'delttt': case 'deltictactoe': {
				let roomnya = Object.values(tictactoe).find(room => room.id.startsWith('tictactoe') && [room.game.playerX, room.game.playerO].includes(m.sender))
				if (!roomnya) {
					m.react('❌')
					return m.reply(`Kamu sedang tidak berada di room tictactoe !`)
				}
				delete tictactoe[roomnya.id]
				m.react('✅')
				m.reply(`Berhasil delete session room tictactoe !`)
			}
			break
			case 'tebakbom': {
				if (tebakbom[m.sender]) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				tebakbom[m.sender] = {
					petak: [0, 0, 0, 2, 0, 2, 0, 2, 0, 0].sort(() => Math.random() - 0.5),
					board: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'],
					bomb: 3,
					lolos: 7,
					pick: 0,
					nyawa: ['❤️', '❤️', '❤️'],
				}
				await m.reply(`*TEBAK BOM*\n\n${tebakbom[m.sender].board.join("")}\n\nPilih lah nomor tersebut! dan jangan sampai terkena Bom!\nBomb : ${tebakbom[m.sender].bomb}\nNyawa : ${tebakbom[m.sender].nyawa.join("")}`);
				await sleep(120000)
				if (tebakbom[m.sender]) {
					m.reply(`_Waktu ${command} habis_`)
					delete tebakbom[m.sender];
				}
			}
			break
			case 'tekateki': {
				if (iGame(tekateki, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { data: hasil } = await fetchApi('/games/tekateki');
				let { key } = await m.reply(`🎮 Teka Teki Berikut :\n\n${hasil.soal}\n\nWaktu : 60s\nHadiah *+3499*`)
				tekateki[m.chat + key.id] = {
					jawaban: hasil.jawaban.toLowerCase(),
					id: key.id
				}
				await sleep(60000)
				if (rdGame(tekateki, m.chat, key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + tekateki[m.chat + key.id].jawaban)
					delete tekateki[m.chat + key.id]
				}
			}
			break
			case 'tebaklirik': {
				if (iGame(tebaklirik, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { data: hasil } = await fetchApi('/games/tebaklirik');
				let { key } = await m.reply(`🎮 Tebak Lirik Berikut :\n\n${hasil.soal}\n\nWaktu : 90s\nHadiah *+4299*`)
				tebaklirik[m.chat + key.id] = {
					jawaban: hasil.jawaban.toLowerCase(),
					id: key.id
				}
				await sleep(90000)
				if (rdGame(tebaklirik, m.chat, key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + tebaklirik[m.chat + key.id].jawaban)
					delete tebaklirik[m.chat + key.id]
				}
			}
			break
			case 'family100': {
				if (family100.hasOwnProperty(m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { data: hasil } = await fetchApi('/games/family100');
				let { key } = await m.reply(`🎮 Tebak Kata Berikut :\n\n${hasil.soal}\n\nWaktu : 5m\nHadiah *+3499*`)
				family100[m.chat] = {
					soal: hasil.soal,
					jawaban: hasil.jawaban,
					terjawab: Array.from(hasil.jawaban, () => false),
					id: key.id
				}
				await sleep(300000)
				if (family100.hasOwnProperty(m.chat)) {
					m.reply('Waktu Habis\nJawaban:\n- ' + family100[m.chat].jawaban.join('\n- '))
					delete family100[m.chat]
				}
			}
			break
			case 'susunkata': {
				if (iGame(susunkata, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { data: hasil } = await fetchApi('/games/susunkata');
				let { key } = await m.reply(`🎮 Susun Kata Berikut :\n\n${hasil.soal}\nTipe : ${hasil.tipe}\n\nWaktu : 60s\nHadiah *+2989*`)
				susunkata[m.chat + key.id] = {
					jawaban: hasil.jawaban.toLowerCase(),
					id: key.id
				}
				await sleep(60000)
				if (rdGame(susunkata, m.chat, key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + susunkata[m.chat + key.id].jawaban)
					delete susunkata[m.chat + key.id]
				}
			}
			break
			case 'tebakkimia': {
				if (iGame(tebakkimia, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { data: hasil } = await fetchApi('/games/tebakkimia');
				let { key } = await m.reply(`🎮 Tebak Kimia Berikut :\n\n${hasil.unsur}\n\nWaktu : 60s\nHadiah *+3499*`)
				tebakkimia[m.chat + key.id] = {
					jawaban: hasil.lambang.toLowerCase(),
					id: key.id
				}
				await sleep(60000)
				if (rdGame(tebakkimia, m.chat, key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + tebakkimia[m.chat + key.id].jawaban)
					delete tebakkimia[m.chat + key.id]
				}
			}
			break
			case 'caklontong': {
				if (iGame(caklontong, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				const { data: hasil } = await fetchApi('/games/caklontong');
				let { key } = await m.reply(`🎮 Jawab Pertanyaan Berikut :\n\n${hasil.soal}\n\nWaktu : 60s\nHadiah *+9999*`)
				caklontong[m.chat + key.id] = {
					...hasil,
					jawaban: hasil.jawaban.toLowerCase(),
					id: key.id
				}
				await sleep(60000)
				if (rdGame(caklontong, m.chat, key.id)) {
					m.reply(`Waktu Habis\nJawaban: ${caklontong[m.chat + key.id].jawaban}\n"${caklontong[m.chat + key.id].deskripsi}"`)
					delete caklontong[m.chat + key.id]
				}
			}
			break
      case 'tebakbendera': {
        if (iGame(tebakbendera, m.chat)) {
          return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
        }

        try {
          const { data: hasil } = await fetchApi('/games/tebakbendera')

          if (!hasil?.img || !hasil?.name) {
            return m.reply('Gagal mendapatkan soal tebak bendera!')
          }

          const { key } = await voxel.sendMessage(
            m.chat,
            {
                image: { url: hasil.img },
                caption: '🎮 *Tebak Bendera Berikut :*'
            },
            {
                quoted: m
            }
          )

          tebakbendera[m.chat + key.id] = {
            jawaban: hasil.name.toLowerCase(),
            id: key.id
          }

          await sleep(60000)

          if (rdGame(tebakbendera, m.chat, key.id)) {
            const game = tebakbendera[m.chat + key.id]

            m.reply(
                '⏰ Waktu Habis!\n\n' +
                'Jawaban: *' + game.jawaban + '*'
            )

            delete tebakbendera[m.chat + key.id]
          }
        } catch (e) {
            console.error('[TEBAK BENDERA]', e)
            m.reply('Gagal mengambil soal tebak bendera!')
        }
      } 
			break
			case 'kuismath': case 'math': {
				const { genMath, modes } = await import('./lib/math.js');
				const inputMode = ['noob', 'easy', 'medium', 'hard','extreme','impossible','impossible2'];
				if (iGame(kuismath, m.chat)) return m.reply('Masih Ada Sesi Yang Belum Diselesaikan!')
				if (!text) return m.reply(`Mode: ${Object.keys(modes).join(' | ')}\nExample penggunaan: ${prefix}math medium`)
				if (!inputMode.includes(text.toLowerCase())) return m.reply('Mode tidak ditemukan!')
				let result = await genMath(text.toLowerCase())
				let { key } = await m.reply(`*Berapa hasil dari: ${result.soal.toLowerCase()}*?\n\nWaktu : ${(result.waktu / 1000).toFixed(2)} detik`)
				kuismath[m.chat + key.id] = {
					jawaban: result.jawaban,
					mode: text.toLowerCase(),
					id: key.id
				}
				await sleep(kuismath, result.waktu)
				if (rdGame(m.chat + key.id)) {
					m.reply('Waktu Habis\nJawaban: ' + kuismath[m.chat + key.id].jawaban)
					delete kuismath[m.chat + key.id]
				}
			}
			break
			case 'ulartangga': case 'snakeladder': case 'ut': {
				if (!m.isGroup) return m.reply(global.mess.group)
				if (ulartangga[m.chat] && !(ulartangga[m.chat] instanceof SnakeLadder)) {
					ulartangga[m.chat] = Object.assign(new SnakeLadder(ulartangga[m.chat]), ulartangga[m.chat]);
				}
				switch(args[0]) {
					case 'create': case 'join':
					if (ulartangga[m.chat]) {
						if (Object.keys(ulartangga[m.chat].players).length > 8) return m.reply(`Jumlah Pemain Sudah Maksimal\nSilahkan Memulai Permainan\n${prefix + command} start`);
						if (ulartangga[m.chat].players.some(a => a.id == m.sender)) return m.reply('Kamu Sudah Bergabung!')
						ulartangga[m.chat].players.push({ id: m.sender, move: 0 });
						m.reply('Sukses Join Sesi Game')
					} else {
						ulartangga[m.chat] = new SnakeLadder({ id: m.chat, host: m.sender });
						ulartangga[m.chat].players.push({ id: m.sender, move: 0 });
						ulartangga[m.chat].time = Date.now();
						m.reply('Sukses Membuat Sesi Game')
					}
					break
					case 'start':
					if (!ulartangga[m.chat]) return m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!')
					if (ulartangga[m.chat].players.length < 2) return m.reply('Jumlah Pemain Kurang!\nMinimal 2 Pemain!')
					if (ulartangga[m.chat].start) return m.reply('Sesi Sudah dimulai Sejak Awal!')
					if (ulartangga[m.chat].host !== m.sender) return m.reply(`Hanya Pembuat Room @${ulartangga[m.chat].host.split('@')[0]} yang bisa Memulai Sessi!`)
					let { key } = await m.reply({ image: { url: ulartangga[m.chat].map.url }, caption: `🐍🪜GAME ULAR TANGGA\n\n${ulartangga[m.chat].players.map((p, i) => `- @${p.id.split('@')[0]} (Pion ${['Merah', 'Biru Muda', 'Kuning', 'Hijau', 'Ungu', 'Jingga', 'Biru Tua', 'Putih'][i]})`).join('\n')}\n\nGiliran: @${m.sender.split('@')[0]}\n\nReply Pesan Ini untuk lanjut bermain!\nExample: roll/kocok`, mentions: ulartangga[m.chat].players.map(p => p.id)});
					ulartangga[m.chat].id = key.id
					ulartangga[m.chat].start = true
					break
					case 'leave':
					if (!ulartangga[m.chat]) return m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!')
					if (!ulartangga[m.chat].players.some(a => a.id == m.sender)) return m.reply('Kamu Bukan Pemain!')
					const player = ulartangga[m.chat].players.findIndex(a => a.id == m.sender)
					if (ulartangga[m.chat].start) return m.reply('Game Sudah dimulai!\nTidak Bisa Keluar Sekarang')
					if (ulartangga[m.chat].players.length < 1 || ulartangga[m.chat].host === m.sender) {
						m.reply(ulartangga[m.chat].host === m.sender ? 'Host Meninggalkan Permainan\nPermainan dihentikan!' : 'Pemain Kurang Dari 1, Permainan dihentikan!');
						delete ulartangga[m.chat];
						break;
					}
					ulartangga[m.chat].players.splice(player, 1);
					m.reply('Sukses Meninggalkan Permainan');
					break
					case 'end':
					if (!ulartangga[m.chat]) return m.reply('Tidak Ada Sesi Yang Sedang Berlangsung!')
					if (ulartangga[m.chat]?.host !== m.sender) return m.reply(`Hanya Pembuat Room @${ulartangga[m.chat].host.split('@')[0]} yang bisa Menghapus Sessi!`)
					delete ulartangga[m.chat]
					m.reply('Berhasil Menghapus Sesi Game')
					break
					default:
					m.reply(`🐍🪜GAME ULARTANGGA\nCommand: ${prefix + command} <command>\n- create\n- join\n- start\n- leave\n- end`)
				}
			}
			break
			case 'blackjack': case 'bj': {
				const normalizeCard = (str) => String(str).replace(/\uFE0F|\s/g, '').trim().toLowerCase();
				if (blackjack[m.chat] && !(blackjack[m.chat] instanceof Blackjack)) {
					blackjack[m.chat] = Object.assign(new Blackjack(blackjack[m.chat]), blackjack[m.chat]);
				}
				let session = null;
				for (const id in blackjack) {
					if (blackjack[id].players?.find(p => p.id === m.sender)) {
						session = blackjack[id];
						break;
					}
				}
				if (session && !(session instanceof Blackjack)) {
					session = Object.assign(new Blackjack(session), session);
					blackjack[session.id] = session;
				}
				const sendCardPrompt = async (playerId, headerText, sess) => {
					const p = sess.players.find(x => x.id === playerId);
					if (!p || !p.cards.length) return;
					const hasStart = Object.keys(sess.startCard).length > 0;
					// Ditiru dari lib/template_menu.js bagian 2 (type 'listMessage'):
					// satu tombol pembuka -> sections/rows, bukan flat quick_reply
					// per item. Flat quick_reply kena batas ~3 tombol langsung dari
					// WhatsApp, jadi kalau kartu di tangan lebih dari itu bakal
					// kepotong/nggak semua muncul. Format list nggak kena batas itu.
					const rows = p.cards.map(c => ({
						title: `${c.rank}${c.suit}`,
						id: `.${command} play ${c.rank}${c.suit}`
					}));
					if (hasStart && !sess.hasMatching(playerId)) {
						rows.push({
							title: '🍺 Minum',
							description: 'Ambil kartu baru dari deck',
							id: `.${command} minum`
						});
					}
					await voxel.sendListMsg(playerId, {
						text: headerText,
						footer: `Kartumu (${p.cards.length}): ${p.cards.map(c => c.rank + c.suit).join(', ')}`,
						buttons: [{
							text: '🃏 Pilih Kartu',
							sections: [{
								title: 'Kartu Kamu',
								rows
							}]
						}]
					}, { quoted: m });
				};

				const endGame = async (sess) => {
					const loser = sess.players[0];
					const winnerList = sess.winner.length ? sess.winner.map((w, i) => `${i + 1}. @${w.id.split('@')[0]}`).join('\n') : '-';
					await voxel.sendText(sess.id, `🃏 *GAME BLACKJACK SELESAI!* 🃏\n\n` + `🏆 *Urutan Pemenang:*\n${winnerList}\n\n` + `💀 *Pecundang:* @${loser?.id.split('@')[0] ?? '?'}`, m);
					delete blackjack[sess.id];
				};

				const finalizeRound = async (sess) => {
					if (!sess.isRoundComplete()) return false;
					const resultMsg = sess.resolveRound();
					if (!resultMsg) return false;
					await voxel.sendText(sess.id, resultMsg, m);
					for (let i = sess.players.length - 1; i >= 0; i--) {
						const p = sess.players[i];
						if (p.cards.length === 0) {
							sess.winner.push({ id: p.id });
							sess.players.splice(i, 1);
							const rank = sess.winner.length;
							await voxel.sendText(sess.id, `🎉 @${p.id.split('@')[0]} mengeluarkan semua kartu! Posisi ke-${rank}! 🏆`, m);
						}
					}
					if (sess.players.length <= 1) {
						await endGame(sess);
						return true;
					}
					if (!sess.players.find(p => p.id === sess.leader)) {
						sess.leader = sess.players[0].id;
					}
					await sleep(500);
					await sendCardPrompt(sess.leader, `🃏 Giliranmu memulai ronde baru!\nMainkan kartu pertama:`, sess);
					return true;
				};

				switch (args[0]) {
					case 'create': case 'join': {
						if (!m.isGroup) return m.reply(mess.group);
						if (blackjack[m.chat]?.players?.some(a => a.id === m.sender)) return m.reply('❌ Kamu sudah bergabung di sesi ini!');
						if (session) return m.reply('❌ Kamu sudah ada di sesi grup lain! Keluar dulu sebelum join di sini.');
						if (blackjack[m.chat]) {
							if (blackjack[m.chat].started) return m.reply('❌ Game sudah berjalan! Tunggu sesi berikutnya.');
							if (blackjack[m.chat].players.length >= 10) return m.reply(`❌ Pemain sudah penuh (maks 10).\nMulai dengan: ${prefix + command} start`);
							blackjack[m.chat].players.push({ id: m.sender, cards: [] });
							m.reply(`✅ *Berhasil join Game Blackjack!*\n` + `👥 Total pemain: ${blackjack[m.chat].players.length}\n` + `Tunggu host memulai: ${prefix + command} start`);
						} else {
							blackjack[m.chat] = new Blackjack({ id: m.chat, host: m.sender });
							blackjack[m.chat].players.push({ id: m.sender, cards: [] });
							m.reply(`✅ *Room Blackjack berhasil dibuat!*\n` + `Ajak teman: ${prefix + command} join\n` + `Mulai game: ${prefix + command} start`);
						}
					}
					break

					case 'start': {
						if (!m.isGroup) return m.reply(mess.group);
						if (!blackjack[m.chat]) return m.reply(`❌ Belum ada sesi. Buat dulu: ${prefix + command} create`);
						if (blackjack[m.chat].host !== m.sender) return m.reply(`❌ Hanya host @${blackjack[m.chat].host.split('@')[0]} yang bisa memulai!`);
						if (blackjack[m.chat].players.length < 2) return m.reply('❌ Minimal 2 pemain!');
						if (blackjack[m.chat].started) return m.reply('❌ Game sudah dimulai!');
						blackjack[m.chat].distributeCards();
						const sess = blackjack[m.chat];
						await m.reply(
							`🃏 *GAME BLACKJACK DIMULAI!* ♦️\n\n` +
							`📌 Start Card: ${sess.startCard.rank}${sess.startCard.suit}\n` +
							`📦 Sisa Deck: ${sess.deck.length} kartu\n` +
							`🎯 Leader: @${sess.leader.split('@')[0]}\n\n` +
							`👥 *Pemain:*\n` +
							sess.players.map(p => `• @${p.id.split('@')[0]} (${p.cards.length} kartu)`).join('\n') +
							`\n\nCek private chat untuk kartumu! 👇\n` +
							`wa.me/${botNumber.split('@')[0]}`
						);

						for (const p of sess.players) {
							await sleep(400);
							const isLeader = p.id === sess.leader;
							await sendCardPrompt(p.id, isLeader ? `🃏 Game dimulai! Kamu adalah 🎯 Leader ronde pertama.\nStart Card: ${sess.startCard.rank}${sess.startCard.suit}\nMainkan kartu suit ${sess.startCard.suit} untuk memulai!` : `🃏 Game dimulai!\nStart Card: ${sess.startCard.rank}${sess.startCard.suit}\nMainkan kartu suit ${sess.startCard.suit} atau tekan Minum jika tidak ada.`, sess);
						}
					}
					break

					case 'minum': case 'hit': {
						if (!session) return m.reply('❌ Tidak ada sesi aktif!');
						if (!session.started) return m.reply('❌ Game belum dimulai!');
						if (!session.players.some(a => a.id === m.sender)) return m.reply('❌ Kamu belum bergabung!');
						if (!Object.keys(session.startCard).length) return m.reply('⏳ Belum ada Start Card! Tunggu leader memulai ronde.');
						if (session.submitCard.some(s => s.id === m.sender) || session.skip.includes(m.sender)) return m.reply('❌ Kamu sudah bermain di ronde ini!');
						if (session.hasMatching(m.sender)) {
							return m.reply(`❌ Kamu masih punya kartu suit *${session.startCard.suit}*!\n` + `Mainkan dulu sebelum minum.`);
						}
						const player = session.players.find(p => p.id === m.sender);
						if (session.deck.length > 0) {
							const newCard = session.deck.shift();
							player.cards.push(newCard);
							await voxel.sendText(session.id, `@${m.sender.split('@')[0]} minum 🍺 dan mengambil kartu dari deck! (sisa deck: ${session.deck.length})`, m);
						} else if (session.submitCard.length > 0) {
							const reuse = session.reuseSubmitCardsForDrinking();
							await voxel.sendText(session.id, `⚠️ Deck habis! ${reuse.msg}`, m);
						} else {
							await voxel.sendText(session.id, `⚠️ @${m.sender.split('@')[0]} minum tapi deck kosong — dilewati ronde ini.`, m);
						}
						if (!session.skip.includes(m.sender)) session.skip.push(m.sender);
						await sleep(400);
						await sendCardPrompt(m.sender, `🃏 Kartumu setelah minum:\nStart Card: ${session.startCard.rank}${session.startCard.suit}`, session);
						await finalizeRound(session);
					}
					break

					case 'play': {
						if (!session) return m.reply('❌ Tidak ada sesi aktif!');
						if (!session.started) return m.reply('❌ Game belum dimulai!');
						if (!session.players.some(a => a.id === m.sender)) return m.reply('❌ Kamu belum bergabung!');
						if (!args[1]) return m.reply(`❌ Format: ${prefix + command} play <kartu>\nContoh: ${prefix + command} play 3♥️`);
						if (session.submitCard.some(s => s.id === m.sender) || session.skip.includes(m.sender)) return m.reply('❌ Kamu sudah bermain di ronde ini!');
						const player = session.players.find(p => p.id === m.sender);
						const idx = player.cards.findIndex(c => normalizeCard(c.rank + c.suit) === normalizeCard(args[1]));
						if (idx === -1) return m.reply('❌ Kartu tidak valid atau tidak ada di tanganmu!');
						const card = player.cards[idx];
						const hasStartCard = Object.keys(session.startCard).length > 0;
						if (hasStartCard) {
							if (card.suit !== session.startCard.suit) {
								if (session.hasMatching(m.sender)) {
									return m.reply(`❌ Harus memainkan kartu suit *${session.startCard.suit}*!`);
								}
								return m.reply(`❌ Kartu tidak sesuai suit *${session.startCard.suit}*!\n` + `Karena tidak punya kartu cocok, gunakan: ${prefix + command} minum`);
							}
						} else {
							if (m.sender !== session.leader) {
								return m.reply(`⏳ Tunggu dulu! Hanya 🎯 @${session.leader.split('@')[0]} (leader) yang bisa memulai ronde baru.`);
							}
						}
						player.cards.splice(idx, 1);
						session.secondDeck.push(card);
						session.submitCard.push({ id: m.sender, card });
						await m.reply(`✅ Kamu memainkan *${card.rank}${card.suit}*`);
						if (!hasStartCard) {
							session.startCard = card;
							await voxel.sendText(session.id, `🎯 @${m.sender.split('@')[0]} memulai ronde dengan *${card.rank}${card.suit}*\n` + `Semua pemain harus memainkan kartu suit *${card.suit}*!`, m);
							for (const s of session.players) {
								if (s.id === session.leader) continue;
								await sleep(300);
								await sendCardPrompt(s.id, `🃏 Ronde baru dimulai!\nStart Card: *${card.rank}${card.suit}*\nMainkan kartu suit ${card.suit} atau tekan Minum.`, session);
							}
							await finalizeRound(session);
							return;
						}
						await voxel.sendText(session.id, `@${m.sender.split('@')[0]} memainkan *${card.rank}${card.suit}* (sisa: ${player.cards.length} kartu)`, m);
						await finalizeRound(session);
					}
					break

					case 'info': {
						const infoSess = session || blackjack[m.chat];
						if (!infoSess) return m.reply('❌ Tidak ada sesi aktif!');
						if (!infoSess.players.some(a => a.id === m.sender)) return m.reply('❌ Kamu belum bergabung!');
						const hasStart = Object.keys(infoSess.startCard).length > 0;
						const startStr = hasStart ? `${infoSess.startCard.rank}${infoSess.startCard.suit}` : '-';
						const playerList = infoSess.players.map((p, i) => {
							let tag = '';
							if (p.id === infoSess.host) tag += ' 👑HOST';
							if (p.id === infoSess.leader) tag += ' 🎯Leader';
							return `${i + 1}. @${p.id.split('@')[0]}${tag} — ${p.cards.length} kartu`;
						}).join('\n');

						let msg = 
							`🃏 *INFO GAME BLACKJACK* ♦️\n` +
							`┏━━━━━━━━━━━━━━━━━━\n` +
							`👥 Pemain : ${infoSess.players.length}\n` +
							`👑 Host : @${infoSess.host.split('@')[0]}\n` +
							`🎯 Leader : ${infoSess.leader ? '@' + infoSess.leader.split('@')[0] : '-'}\n` +
							`📊 Status : ${infoSess.started ? '🟢 Berjalan' : '🔴 Belum Mulai'}\n` +
							`🃏 Start Card: ${startStr}\n` +
							`📦 Sisa Deck: ${infoSess.deck.length} kartu\n` +
							`┗━━━━━━━━━━━━━━━━━━\n` +
							`*Daftar Pemain:*\n${playerList}`;

						if (!m.isGroup) {
							const myCards = infoSess.players.find(p => p.id === m.sender)?.cards?.map(c => c.rank + c.suit).join(', ') || '-';
							msg += `\n┏━━━━━━━━━━━━━━━━━━\n*Kartu kamu:*\n${myCards}`;
						}
						if (infoSess.winner.length) {
							msg += `\n┏━━━━━━━━━━━━━━━━━━\n` + `*🏆 Sudah Menang:*\n` + infoSess.winner.map((w, i) => `${i + 1}. @${w.id.split('@')[0]}`).join('\n');
						}
						m.reply(msg);
					}
					break

					case 'deck': {
						const deckSess = session || blackjack[m.chat];
						if (!deckSess) return m.reply('❌ Tidak ada sesi aktif!');
						if (!deckSess.players.some(a => a.id === m.sender)) return m.reply('❌ Kamu belum bergabung!');
						const submittedNow = deckSess.submitCard.length ? deckSess.submitCard.map(s => `@${s.id.split('@')[0]}: ${s.card.rank}${s.card.suit}`).join(', ') : '-';
						const skipNow = deckSess.skip.length ? deckSess.skip.map(s => `@${s.split('@')[0]}`).join(', ') : '-';
						const lastCards = deckSess.secondDeck.slice(-10).map(c => c.rank + c.suit).join(', ') || '-';
						m.reply(
							`🃏 *INFO DECK* ♦️\n` +
							`┏━━━━━━━━━━━━━━━━━━\n` +
							`📦 Sisa Deck : ${deckSess.deck.length} kartu\n` +
							`🔄 Kartu Terpakai: ${deckSess.secondDeck.length} kartu\n` +
							`┗━━━━━━━━━━━━━━━━━━\n` +
							`*Ronde Ini:*\n` +
							`▶️ Submit : ${submittedNow}\n` +
							`⏩ Skip : ${skipNow}\n` +
							`┏━━━━━━━━━━━━━━━━━━\n` +
							`*10 Kartu Terakhir:*\n${lastCards}`
						);
					}
					break

					case 'end': {
						if (!m.isGroup) return m.reply(mess.group);
						if (!blackjack[m.chat]) return m.reply('❌ Tidak ada sesi aktif!');
						if (blackjack[m.chat].host !== m.sender) return m.reply(`❌ Hanya host @${blackjack[m.chat].host.split('@')[0]} yang bisa menghapus sesi!`);
						delete blackjack[m.chat];
						m.reply('🗑️ Sesi Game Blackjack telah dihapus.');
					}
					break

					default: {
						m.reply(
							`🃏 *GAME BLACKJACK* ♦️\n\n` +
							`*Cara Main:*\n` +
							`Mainkan kartu dengan suit yang sama dengan Start Card.\n` +
							`Tidak punya? Tekan Minum 🍺 — ambil kartu penalti & skip ronde.\n` +
							`Pemain pertama yang habis kartunya menang!\n\n` +
							`*Commands:*\n` +
							`• \`${prefix + command} create\` — Buat room baru\n` +
							`• \`${prefix + command} join\` — Gabung room\n` +
							`• \`${prefix + command} start\` — Mulai game (host)\n` +
							`• \`${prefix + command} play\` _kartu_ — Main kartu (cth: play 3♥️)\n` +
							`• \`${prefix + command} minum\` — Minum & skip ronde\n` +
							`• \`${prefix + command} info\` — Info game & pemain\n` +
							`• \`${prefix + command} deck\` — Info deck & ronde ini\n` +
							`• \`${prefix + command} end\` — Hapus sesi (host)\n\n` +
							`*Suit:* ♥️ ♦️ ♣️ ♠️`
						);
					}
				}
			}
			break
			
			// Menu
			case 'menu': {
				if (args[0] == 'set') {
					if (!isCreator) return m.reply(mess.owner)
					if (['1','2','3'].includes(args[1])) {
						set.template = parseInt(Number(args[1]))
						m.reply('Sukses Mengubah Template Menu')
					} else m.reply(`Template Menu:\n- 1 (Button Menu)\n- 2 (List Menu)\n- 3 (Document Menu)\n\nExample: ${prefix + command} set 1`)
				} else await templateMenu(voxel, set.template, m, prefix, setv, db, { locale_day, date, date_time, botNumber, author, packname, isVip, isPremium, ucapanWaktu })
			}
			break
			case 'allmenu': {
				let profile
				try {
					profile = await voxel.profilePictureUrl(m.sender, 'image');
				} catch (e) {
					profile = fake.anonim
				}
				const menunya = `
╭──❍「 *USER INFO* 」❍
├ *Nama* : ${m.pushName ? m.pushName : 'Tanpa Nama'}
├ *Id* : @${m.sender.split('@')[0]}
├ *User* : ${isVip ? 'VIP' : isPremium ? 'PREMIUM' : 'FREE'}
├ *Limit* : ${isVip ? 'VIP' : db.users[m.sender].limit }
├ *Money* : ${db.users[m.sender] ? db.users[m.sender].money.toLocaleString('id-ID') : '0'}
╰─┬────❍
╭─┴─❍「 *BOT INFO* 」❍
├ *Nama Bot* : ${set?.botname || 'Voxel Bot'}
├ *Powered* : @${'0@s.whatsapp.net'.split('@')[0]}
├ *Owner* : @${ownerNumber[0].split('@')[0]}
├ *Mode* : ${voxel.public ? 'Public' : 'Self'}
├ *Prefix* :${set.multiprefix ? '「 MULTI-PREFIX 」' : ' *'+prefix+'*' }
├ *Premium Feature* : 🔸️
╰─┬────❍
╭─┴─❍「 *ABOUT* 」❍
├ *Date* : ${date}
├ *Day* : ${locale_day}
├ *Time* : ${date_time}
╰──────❍
╭──❍「 *BOT* 」❍
│${setv} ${prefix}profile
│${setv} ${prefix}claim
│${setv} ${prefix}buy [item] (nominal)
│${setv} ${prefix}transfer
│${setv} ${prefix}leaderboard
│${setv} ${prefix}request (text)
│${setv} ${prefix}react (emoji)
│${setv} ${prefix}tagme
│${setv} ${prefix}runtime
│${setv} ${prefix}totalfitur
│${setv} ${prefix}speed
│${setv} ${prefix}ping
│${setv} ${prefix}afk
│${setv} ${prefix}rvo (reply pesan viewone)
│${setv} ${prefix}inspect (url gc)
│${setv} ${prefix}addmsg
│${setv} ${prefix}delmsg
│${setv} ${prefix}getmsg
│${setv} ${prefix}listmsg
│${setv} ${prefix}setcmd
│${setv} ${prefix}delcmd
│${setv} ${prefix}listcmd
│${setv} ${prefix}lockcmd
│${setv} ${prefix}q (reply pesan)
│${setv} ${prefix}menfes (62xxx|fake name)
│${setv} ${prefix}confes (62xxx|fake name)
│${setv} ${prefix}roomai
│${setv} ${prefix}donasi
│${setv} ${prefix}addsewa
│${setv} ${prefix}delsewa
│${setv} ${prefix}listsewa
╰─┬────❍
╭─┴❍「 *GROUP* 」❍
│${setv} ${prefix}add (62xxx)
│${setv} ${prefix}kick (@tag/62xxx)
│${setv} ${prefix}promote (@tag/62xxx)
│${setv} ${prefix}demote (@tag/62xxx)
│${setv} ${prefix}warn (@tag/62xxx)
│${setv} ${prefix}unwarn (@tag/62xxx)
│${setv} ${prefix}setname (nama baru gc)
│${setv} ${prefix}setdesc (desk)
│${setv} ${prefix}setppgc (reply imgnya)
│${setv} ${prefix}delete (reply pesan)
│${setv} ${prefix}linkgrup
│${setv} ${prefix}revoke
│${setv} ${prefix}tagall
│${setv} ${prefix}pinm (reply pesan)
│${setv} ${prefix}unpinm (reply pesan)
│${setv} ${prefix}hidetag
│${setv} ${prefix}totag (reply pesan)
│${setv} ${prefix}listonline
│${setv} ${prefix}group set
│${setv} ${prefix}group (khusus admin)
╰─┬────❍
╭─┴❍「 *SEARCH* 」❍
│${setv} ${prefix}ytsearch (query)
│${setv} ${prefix}ytmp3 (url)
│${setv} ${prefix}ytmp4 (url)
│${setv} ${prefix}spotify (query)
│${setv} ${prefix}pinterest (query)
│${setv} ${prefix}wallpaper (query)
│${setv} ${prefix}google (query)
│${setv} ${prefix}gimage (query)
│${setv} ${prefix}cuaca (kota)
╰─┬────❍
╭─┴❍「 *DOWNLOAD* 」❍
│${setv} ${prefix}instagram (url)
│${setv} ${prefix}tiktok (url)
│${setv} ${prefix}tiktokmp3 (url)
│${setv} ${prefix}tiktoksearch (kata kunci)
│${setv} ${prefix}tiktokrandom (kata kunci)
│${setv} ${prefix}megadl (url)
│${setv} ${prefix}facebook (url)
│${setv} ${prefix}spotifydl (url)
╰─┬────❍
╭─┴❍「 *QUOTES* 」❍
╰─┬────❍
╭─┴❍「 *TOOLS* 」❍
│${setv} ${prefix}get (url) 🔸️
│${setv} ${prefix}toaudio (reply pesan)
│${setv} ${prefix}tomp3 (reply pesan)
│${setv} ${prefix}tovn (reply pesan)
│${setv} ${prefix}toimage (reply pesan)
│${setv} ${prefix}toptv (reply pesan)
│${setv} ${prefix}tourl (reply pesan)
│${setv} ${prefix}brat (textnya)
│${setv} ${prefix}iqc (textnya)
│${setv} ${prefix}birthday
│${setv} ${prefix}removebg (reply img)
│${setv} ${prefix}hd (reply img)
│${setv} ${prefix}hdvid (reply video)
│${setv} ${prefix}findsticker (query)
│${setv} ${prefix}ssweb (url) 🔸️
│${setv} ${prefix}sticker (send/reply img)
│${setv} ${prefix}colong (reply stiker)
│${setv} ${prefix}nulis
│${setv} ${prefix}readmore text1|text2
│${setv} ${prefix}translate
│${setv} ${prefix}gitclone (urlnya)
│${setv} ${prefix}fat (reply audio)
│${setv} ${prefix}fast (reply audio)
│${setv} ${prefix}bass (reply audio)
│${setv} ${prefix}slow (reply audio)
│${setv} ${prefix}tupai (reply audio)
│${setv} ${prefix}deep (reply audio)
│${setv} ${prefix}robot (reply audio)
│${setv} ${prefix}blown (reply audio)
│${setv} ${prefix}reverse (reply audio)
│${setv} ${prefix}smooth (reply audio)
│${setv} ${prefix}earrape (reply audio)
│${setv} ${prefix}nightcore (reply audio)
│${setv} ${prefix}getexif (reply sticker)
╰─┬────❍
╭─┴❍「 *ANIME* 」❍
│${setv} ${prefix}waifu
│${setv} ${prefix}neko
╰─┬────❍
╭─┴❍「 *GAME* 」❍
│${setv} ${prefix}tictactoe
│${setv} ${prefix}suit
│${setv} ${prefix}slot
│${setv} ${prefix}math (level)
│${setv} ${prefix}begal
│${setv} ${prefix}ulartangga
│${setv} ${prefix}blackjack
│${setv} ${prefix}casino (nominal)
│${setv} ${prefix}samgong (nominal)
│${setv} ${prefix}rampok (@tag)
│${setv} ${prefix}tekateki
│${setv} ${prefix}tebaklirik
│${setv} ${prefix}tebakbom
│${setv} ${prefix}susunkata
│${setv} ${prefix}tebakkimia
│${setv} ${prefix}caklontong
│${setv} ${prefix}tebakgambar
│${setv} ${prefix}tebakbendera
╰─┬────❍
╭─┴❍「 *FUN* 」❍
│${setv} ${prefix}coba
│${setv} ${prefix}dadu
│${setv} ${prefix}bisakah (text)
│${setv} ${prefix}apakah (text)
│${setv} ${prefix}kapan (text)
│${setv} ${prefix}siapa (text)
│${setv} ${prefix}kerangajaib (text)
│${setv} ${prefix}ceksifat
│${setv} ${prefix}rate (reply pesan)
│${setv} ${prefix}jodohku
│${setv} ${prefix}jadian
│${setv} ${prefix}bucin 
│${setv} ${prefix}motivasi
│${setv} ${prefix}quoted
│${setv} ${prefix}fitnah
│${setv} ${prefix}halah (text)
│${setv} ${prefix}hilih (text)
│${setv} ${prefix}huluh (text)
│${setv} ${prefix}heleh (text)
│${setv} ${prefix}holoh (text)
╰─┬────❍
╭─┴❍「 *RANDOM* 」❍
╰─┬────❍
╭─┴❍「 *STALKER* 」❍
│${setv} ${prefix}wastalk
│${setv} ${prefix}githubstalk
╰─┬────❍
╭─┴❍「 *OWNER* 」❍
│${setv} ${prefix}bot [set]
│${setv} ${prefix}setbio
│${setv} ${prefix}setppbot
│${setv} ${prefix}join
│${setv} ${prefix}leave
│${setv} ${prefix}block
│${setv} ${prefix}listblock
│${setv} ${prefix}openblock
│${setv} ${prefix}listpc
│${setv} ${prefix}listgc
│${setv} ${prefix}ban
│${setv} ${prefix}unban
│${setv} ${prefix}mute
│${setv} ${prefix}unmute
│${setv} ${prefix}creategc
│${setv} ${prefix}clearchat
│${setv} ${prefix}addprem
│${setv} ${prefix}delprem
│${setv} ${prefix}listprem
│${setv} ${prefix}addlimit
│${setv} ${prefix}adduang
│${setv} ${prefix}setbotmessages
│${setv} ${prefix}setbotauthor
│${setv} ${prefix}setbotname
│${setv} ${prefix}setbotpackname
│${setv} ${prefix}setapikey
│${setv} ${prefix}setbotlimit
│${setv} ${prefix}setbotmoney
│${setv} ${prefix}setlocale
│${setv} ${prefix}settimezone
│${setv} ${prefix}addprefix
│${setv} ${prefix}delprefix
│${setv} ${prefix}addbadword
│${setv} ${prefix}delbadword
│${setv} ${prefix}addowner
│${setv} ${prefix}delowner
│${setv} ${prefix}whitelist
│${setv} ${prefix}getmsgstore
│${setv} ${prefix}bot --settings
│${setv} ${prefix}bot settings
│${setv} ${prefix}getsession
│${setv} ${prefix}delsession
│${setv} ${prefix}delsampah
│${setv} ${prefix}upsw
│${setv} ${prefix}backup
│${setv} $
│${setv} >
│${setv} <
╰──────❍`
				await voxel.sendMessageV3(m.chat, {
					text: menunya,
					title: ucapanWaktu,
					description: packname,
					thumbnailUrl: profile,
					sourceUrl: my.gh,
					mentions: [m.sender, '0@s.whatsapp.net', ownerNumber[0] + '@s.whatsapp.net'],
					contextInfo: {
						forwardingScore: 1,
						isForwarded: true,
						forwardedNewsletterMessageInfo: {
							newsletterJid: my.ch,
							serverMessageId: null,
							newsletterName: 'Join For More Info'
						}
					}
				})
			}
			break
			case 'botmenu': {
				m.reply(`
╭──❍「 *BOT* 」❍
│${setv} ${prefix}profile
│${setv} ${prefix}claim
│${setv} ${prefix}buy [item] (nominal)
│${setv} ${prefix}transfer
│${setv} ${prefix}leaderboard
│${setv} ${prefix}request (text)
│${setv} ${prefix}react (emoji)
│${setv} ${prefix}tagme
│${setv} ${prefix}runtime
│${setv} ${prefix}totalfitur
│${setv} ${prefix}speed
│${setv} ${prefix}ping
│${setv} ${prefix}afk
│${setv} ${prefix}rvo (reply pesan viewone)
│${setv} ${prefix}inspect (url gc)
│${setv} ${prefix}addmsg
│${setv} ${prefix}delmsg
│${setv} ${prefix}getmsg
│${setv} ${prefix}listmsg
│${setv} ${prefix}setcmd
│${setv} ${prefix}delcmd
│${setv} ${prefix}listcmd
│${setv} ${prefix}lockcmd
│${setv} ${prefix}q (reply pesan)
│${setv} ${prefix}menfes (62xxx|fake name)
│${setv} ${prefix}confes (62xxx|fake name)
│${setv} ${prefix}roomai
│${setv} ${prefix}donasi
│${setv} ${prefix}addsewa
│${setv} ${prefix}delsewa
│${setv} ${prefix}listsewa
╰──────❍`)
			}
			break
			case 'groupmenu': {
				m.reply(`
╭──❍「 *GROUP* 」❍
│${setv} ${prefix}add (62xxx)
│${setv} ${prefix}kick (@tag/62xxx)
│${setv} ${prefix}promote (@tag/62xxx)
│${setv} ${prefix}demote (@tag/62xxx)
│${setv} ${prefix}warn (@tag/62xxx)
│${setv} ${prefix}unwarn (@tag/62xxx)
│${setv} ${prefix}setname (nama baru gc)
│${setv} ${prefix}setdesc (desk)
│${setv} ${prefix}setppgc (reply imgnya)
│${setv} ${prefix}delete (reply pesan)
│${setv} ${prefix}linkgrup
│${setv} ${prefix}revoke
│${setv} ${prefix}tagall
│${setv} ${prefix}pinm (reply pesan)
│${setv} ${prefix}unpinm (reply pesan)
│${setv} ${prefix}hidetag
│${setv} ${prefix}totag (reply pesan)
│${setv} ${prefix}listonline
│${setv} ${prefix}group set
│${setv} ${prefix}group (khusus admin)
╰──────❍`)
			}
			break
			case 'searchmenu': {
				m.reply(`
╭──❍「 *SEARCH* 」❍
│${setv} ${prefix}ytsearch (query)
│${setv} ${prefix}ytmp3 (url)
│${setv} ${prefix}ytmp4 (url)
│${setv} ${prefix}spotify (query)
│${setv} ${prefix}pinterest (query)
│${setv} ${prefix}wallpaper (query)
│${setv} ${prefix}google (query)
│${setv} ${prefix}gimage (query)
│${setv} ${prefix}cuaca (kota)
╰──────❍`)
			}
			break
			case 'downloadmenu': {
				m.reply(`
╭──❍「 *DOWNLOAD* 」❍
│${setv} ${prefix}instagram (url)
│${setv} ${prefix}tiktok (url)
│${setv} ${prefix}tiktokmp3 (url)
│${setv} ${prefix}tiktoksearch (kata kunci)
│${setv} ${prefix}tiktokrandom (kata kunci)
│${setv} ${prefix}megadl (url)
│${setv} ${prefix}facebook (url)
│${setv} ${prefix}spotifydl (url)
╰──────❍`)
			}
			break
			case 'quotesmenu': {
				m.reply(`
╭──❍「 *QUOTES* 」❍
╰──────❍`)
			}
			break
			case 'toolsmenu': {
				m.reply(`
╭──❍「 *TOOLS* 」❍
│${setv} ${prefix}get (url) 🔸️
│${setv} ${prefix}toaudio (reply pesan)
│${setv} ${prefix}tomp3 (reply pesan)
│${setv} ${prefix}tovn (reply pesan)
│${setv} ${prefix}toimage (reply pesan)
│${setv} ${prefix}toptv (reply pesan)
│${setv} ${prefix}tourl (reply pesan)
│${setv} ${prefix}brat (textnya)
│${setv} ${prefix}iqc (textnya)
│${setv} ${prefix}birthday
│${setv} ${prefix}removebg (reply img)
│${setv} ${prefix}hd (reply img)
│${setv} ${prefix}hdvid (reply video)
│${setv} ${prefix}findsticker (query)
│${setv} ${prefix}ssweb (url) 🔸️
│${setv} ${prefix}sticker (send/reply img)
│${setv} ${prefix}colong (reply stiker)
│${setv} ${prefix}nulis
│${setv} ${prefix}readmore text1|text2
│${setv} ${prefix}translate
│${setv} ${prefix}gitclone (urlnya)
│${setv} ${prefix}fat (reply audio)
│${setv} ${prefix}fast (reply audio)
│${setv} ${prefix}bass (reply audio)
│${setv} ${prefix}slow (reply audio)
│${setv} ${prefix}tupai (reply audio)
│${setv} ${prefix}deep (reply audio)
│${setv} ${prefix}robot (reply audio)
│${setv} ${prefix}blown (reply audio)
│${setv} ${prefix}reverse (reply audio)
│${setv} ${prefix}smooth (reply audio)
│${setv} ${prefix}earrape (reply audio)
│${setv} ${prefix}nightcore (reply audio)
│${setv} ${prefix}getexif (reply sticker)
╰──────❍`)
			}
			break
			case 'glm': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} apa itu lubang hitam`)
				m.react('⏳')
				try {
					const hasil = await fetchApi('/ai/glm47flash', { query: text });
					await m.reply(hasil?.result?.message || hasil?.result || hasil?.data || 'Maaf, tidak ada jawaban.')
					setLimit(m, db)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			case 'deepseek': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} apa itu lubang hitam`)
				m.react('⏳')
				try {
					const hasil = await fetchApi('/ai/deepseekr1', { query: text });
					await m.reply(hasil?.result?.message || hasil?.result || hasil?.data || 'Maaf, tidak ada jawaban.')
					setLimit(m, db)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			case 'txt2img': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} kucing oren pakai jas`)
				m.react('⏳')
				try {
					const hasil = await fetchApi('/ai/duckaiimage', { prompt: text });
					const imgUrl = hasil?.result?.url || hasil?.result || hasil?.data?.url;
					await m.reply({ image: { url: imgUrl }, caption: text })
					setLimit(m, db)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			// Catatan: siputzx belum punya model Grok/Claude/"Archipelago" asli,
			// jadi 3 command di bawah ini diarahkan ke model terdekat yang tersedia.
			case 'grok': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} apa itu lubang hitam`)
				m.react('⏳')
				try {
					const hasil = await fetchApi('/ai/metaai', { query: text });
					await m.reply(hasil?.result?.message || hasil?.result || hasil?.data || 'Maaf, tidak ada jawaban.')
					setLimit(m, db)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			case 'claude': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} apa itu lubang hitam`)
				m.react('⏳')
				try {
					const hasil = await fetchApi('/ai/qwq32b', { query: text });
					await m.reply(hasil?.result?.message || hasil?.result || hasil?.data || 'Maaf, tidak ada jawaban.')
					setLimit(m, db)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			case 'archipelago': {
				if (!isLimit) return m.reply(global.mess.limit)
				if (!text) return m.reply(`Example: ${prefix + command} apa itu lubang hitam`)
				m.react('⏳')
				try {
					const hasil = await fetchApi('/ai/phi2', { query: text });
					await m.reply(hasil?.result?.message || hasil?.result || hasil?.data || 'Maaf, tidak ada jawaban.')
					setLimit(m, db)
				} catch (e) {
					m.reply(global.mess.fail)
				}
			}
			break
			case 'aimenu': {
				m.reply(`
╭──❍「 *AI* 」❍
│${setv} ${prefix}ai (query)
│${setv} ${prefix}gemini (query)
│${setv} ${prefix}glm (query)
│${setv} ${prefix}grok (query)
│${setv} ${prefix}claude (query)
│${setv} ${prefix}archipelago (query)
│${setv} ${prefix}deepseek (query)
│${setv} ${prefix}txt2img (query)
├──❍「 *AI Tanpa API Key* 」❍
│${setv} ${prefix}gpt5 (query)
│${setv} ${prefix}claudehaiku (query)
│${setv} ${prefix}qwen3 (query)
│${setv} ${prefix}deepthink (query)
│${setv} ${prefix}dolphin (query)
│${setv} ${prefix}matematika (soal)
│${setv} ${prefix}muslimai (query)
│${setv} ${prefix}feelbetter (curhat)
│${setv} ${prefix}simi (query)
│${setv} ${prefix}quilbot (teks)
│${setv} ${prefix}waguri (query)
│${setv} ${prefix}kobo-ai (query)
╰──────❍`)
			}
			break
			case 'randommenu': {
				m.reply(`
╭──❍「 *RANDOM* 」❍
╰──────❍`)
			}
			break
			case 'stalkermenu': {
				m.reply(`
╭──❍「 *STALKER* 」❍
│${setv} ${prefix}wastalk
│${setv} ${prefix}githubstalk
╰──────❍`)
			}
			break
			case 'animemenu': {
				m.reply(`
╭──❍「 *ANIME* 」❍
│${setv} ${prefix}waifu
│${setv} ${prefix}neko
╰──────❍`)
			}
			break
			case 'gamemenu': {
				m.reply(`
╭──❍「 *GAME* 」❍
│${setv} ${prefix}tictactoe
│${setv} ${prefix}suit
│${setv} ${prefix}slot
│${setv} ${prefix}math (level)
│${setv} ${prefix}begal
│${setv} ${prefix}ulartangga
│${setv} ${prefix}blackjack
│${setv} ${prefix}casino (nominal)
│${setv} ${prefix}samgong (nominal)
│${setv} ${prefix}rampok (@tag)
│${setv} ${prefix}tekateki
│${setv} ${prefix}tebaklirik
│${setv} ${prefix}tebakbom
│${setv} ${prefix}susunkata
│${setv} ${prefix}tebakkimia
│${setv} ${prefix}caklontong
│${setv} ${prefix}tebakgambar
│${setv} ${prefix}tebakbendera
╰──────❍`)
			}
			break
			case 'funmenu': {
				m.reply(`
╭──❍「 *FUN* 」❍
│${setv} ${prefix}coba
│${setv} ${prefix}dadu
│${setv} ${prefix}bisakah (text)
│${setv} ${prefix}apakah (text)
│${setv} ${prefix}kapan (text)
│${setv} ${prefix}siapa (text)
│${setv} ${prefix}kerangajaib (text)
│${setv} ${prefix}ceksifat
│${setv} ${prefix}rate (reply pesan)
│${setv} ${prefix}jodohku
│${setv} ${prefix}jadian
│${setv} ${prefix}bucin
│${setv} ${prefix}motivasi
│${setv} ${prefix}quoted
│${setv} ${prefix}fitnah
│${setv} ${prefix}halah (text)
│${setv} ${prefix}hilih (text)
│${setv} ${prefix}huluh (text)
│${setv} ${prefix}heleh (text)
│${setv} ${prefix}holoh (text)
╰──────❍`)
			}
			break
			case 'ownermenu': {
				m.reply(`
╭──❍「 *OWNER* 」❍
│${setv} ${prefix}bot [set]
│${setv} ${prefix}setbio
│${setv} ${prefix}setppbot
│${setv} ${prefix}join
│${setv} ${prefix}leave
│${setv} ${prefix}block
│${setv} ${prefix}listblock
│${setv} ${prefix}openblock
│${setv} ${prefix}listpc
│${setv} ${prefix}listgc
│${setv} ${prefix}ban
│${setv} ${prefix}unban
│${setv} ${prefix}mute
│${setv} ${prefix}unmute
│${setv} ${prefix}creategc
│${setv} ${prefix}clearchat
│${setv} ${prefix}addprem
│${setv} ${prefix}delprem
│${setv} ${prefix}listprem
│${setv} ${prefix}addlimit
│${setv} ${prefix}adduang
│${setv} ${prefix}setbotmessages
│${setv} ${prefix}setbotauthor
│${setv} ${prefix}setbotname
│${setv} ${prefix}setbotpackname
│${setv} ${prefix}setapikey
│${setv} ${prefix}setbotlimit
│${setv} ${prefix}setbotmoney
│${setv} ${prefix}setlocale
│${setv} ${prefix}settimezone
│${setv} ${prefix}addprefix
│${setv} ${prefix}delprefix
│${setv} ${prefix}addbadword
│${setv} ${prefix}delbadword
│${setv} ${prefix}addowner
│${setv} ${prefix}delowner
│${setv} ${prefix}whitelist
│${setv} ${prefix}getmsgstore
│${setv} ${prefix}bot --settings
│${setv} ${prefix}bot settings
│${setv} ${prefix}getsession
│${setv} ${prefix}delsession
│${setv} ${prefix}delsampah
│${setv} ${prefix}upsw
│${setv} ${prefix}backup
│${setv} ${prefix}rcon
│${setv} $
│${setv} >
│${setv} <
╰──────❍`)
			}
			break

      case 'rcon': {
        const senderJid = m.chat.endsWith('@g.us') ? m.sender : m.chat

        if (!global.rconAccess.includes(senderJid)) {
          return m.reply('🔒 Nomor kamu tidak terdaftar untuk akses RCON')
        }

        if (args.length === 0) {
          return m.reply('Format: .rcon <command>\nContoh: .rcon list')
        }

        const { Rcon } = require('rcon-client')
        const rconCommand = args.join(' ')

        try {
          const rcon = await Rcon.connect({
            host: rconConfig.host,
            port: rconConfig.port,
            password: rconConfig.password
          })
          const response = await rcon.send(rconCommand)
          await rcon.end()
          m.reply(`*RCON RESPONSE:*\n\`\`\`${response || '(kosong)'}\`\`\``)
        } catch (err) {
          let errMsg = err.message
          if (err.code === 'ECONNREFUSED') errMsg = 'Server sedang offline atau masih restart.'
          m.reply(`❌ RCON error: ${errMsg}`)
        }
      }
      break

			default:
			if (budy.startsWith('>')) {
				if (!isCreator) return
				try {
					let evaled = await eval(budy.slice(2))
					if (typeof evaled !== 'string') evaled = util.inspect(evaled)
					await m.reply(evaled)
				} catch (err) {
					await m.reply(String(err))
				}
			}
			if (budy.startsWith('<')) {
				if (!isCreator) return
				try {
					let evaled = await eval(`(async () => { ${budy.slice(2)} })()`)
					if (typeof evaled !== 'string') evaled = util.inspect(evaled)
					await m.reply(evaled)
				} catch (err) {
					await m.reply(String(err))
				}
			}
			if (budy.startsWith('$')) {
				if (!isCreator) return
				if (!text) return
				exec(budy.slice(2), (err, stdout) => {
					if (err) return m.reply(`${err}`)
					if (stdout) return m.reply(stdout)
				})
			}
			if ((!isCmd || isCreator) && budy.toLowerCase() != undefined) {
				if (m.chat.endsWith('broadcast')) return
				if (!(budy.toLowerCase() in db.database)) return
				await voxel.relayMessage(m.chat, db.database[budy.toLowerCase()], {})
			}
		}
	} catch (e) {
		console.log(e);
		if (e?.message?.includes('No sessions') || e?.message?.includes('ffmpeg exited with code') || e?.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED' || e?.message?.includes('maxBodyLength limit') || e?.message?.includes('rate-overlimit')) return;
		const errorKey = e?.code || e?.name || e?.message?.slice(0, 100) || 'unknown_error';
		const now = Date.now();
		if (!errorCache[errorKey]) errorCache[errorKey] = [];
		errorCache[errorKey] = errorCache[errorKey].filter(ts => now - ts < 600000);
		if (errorCache[errorKey].length >= 3) return;
		errorCache[errorKey].push(now);
		const isAxiosError = e?.isAxiosError || !!e?.response; 
		const statusCode = e?.response?.status || e?.statusCode || e?.data;
		const errorUrl = e?.config?.url || e?.request?.host || '';
		if (statusCode === 500) {
			m.reply('Server API Error: Terjadi gangguan pada server tujuan.');
		} else if (statusCode === 429) {
			if (errorUrl.includes('api.voxel.biz.id')) {
				return m.reply('Limit Reached: ' + mess.key);
			} else m.reply('Limit Reached (Sistem/WA): Terlalu banyak permintaan.\nLog Error Telah dikirim ke Owner');
		} else if (statusCode === 403) {
			if (isAxiosError) {
				if (errorUrl.includes('api.voxel.biz.id')) {
					return m.reply('Akses Khusus Premium!');
				} else m.reply('API Error: Akses ke server API ditolak (403 Forbidden).');
			} else console.log(chalk.yellowBright('[SYSTEM] Akses grup ditolak (Baileys 403 / Forbidden).'));
		} else if (statusCode === 401) {
			if (isAxiosError) {
				if (errorUrl.includes('api.voxel.biz.id')) {
					return m.reply('Invalid Apikey!');
				} else m.reply('API Error: Akses ke server API ditolak (401 Unauthorized).');
			} else console.log(chalk.yellowBright('[SYSTEM] Akses ditolak (401 Unauthorized).'));
		} else m.reply('Error: ' + (e?.name || e?.code || e?.message || 'Terjadi kesalahan tidak diketahui') + '\nLog Error Telah dikirim ke Owner\n\n');
		return voxel.sendFromOwner(ownerNumber, `Halo sayang, sepertinya ada yang error nih, jangan lupa diperbaiki ya\n\nVersion : *${require('./package.json').version}*\nType : *${m.type || errorKey}*\n\n*Log error:*\n\n` + util.format(e), m, { contextInfo: { isForwarded: true }})
	}
}

export default voxel;
