import '../settings.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';
import axios from 'axios';
import chalk from 'chalk';
import crypto from 'crypto';
import { Jimp } from 'jimp';
import chokidar from 'chokidar';
import { fileURLToPath } from 'url';
import { parsePhoneNumber } from 'awesome-phonenumber';
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';

import { writeExif } from '../lib/exif.js';
import { checkStatus } from './database.js';
import { getBuffer, fixBytes, sleep } from '../lib/function.js';
import { jidNormalizedUser, proto, getBinaryNodeChild, generateWAMessageContent, prepareWAMessageMedia, areJidsSameUser, extractMessageContent, generateMessageID, downloadContentFromMessage, generateWAMessageFromContent, jidDecode, generateWAMessage, getContentType, getDevice } from '@sairidev/baileys-new';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const voxelPath = fileURLToPath(new URL('../voxel.js', import.meta.url));

let voxelHandler = null;
const botStartTime = Date.now();
const groupMetadataTimers = {};

// ============================================================
// FIX BUG KRITIKAL: user "hilang" datanya (kelihatan tidak terdaftar
// padahal sebelumnya sudah terdaftar).
// ============================================================
// Penyebabnya: WhatsApp sekarang kadang ngasih identitas pengirim sebagai
// `@lid` (linked ID / privacy ID), bukan nomor telepon asli (`@s.whatsapp.net`).
// Resolusi dari @lid ke nomor asli SEBELUM PATCH INI cuma mengandalkan cache
// sesi yang sedang berjalan (`store.groupMetadata` / `store.contacts`) --
// begitu cache itu belum ke-sync (misal abis restart bot, atau grup yang
// jarang di-refresh metadata-nya), resolusi gagal dan `m.sender` jatuh balik
// ke `@lid` mentah. Karena `global.db.users` di-key langsung pakai `m.sender`,
// orang yang SAMA bisa kesimpen di 2 baris berbeda: satu di bawah nomor
// teleponnya (data lama, `register`/limit/uang dsb), satu lagi di bawah
// `@lid` (data baru, kosong/default) -- makanya kelihatan "tidak terdaftar".
//
// Perbaikannya: simpan hasil resolusi @lid -> nomor telepon secara PERMANEN
// di `global.db.lidMap` (bukan cuma di `store` yang hilang tiap restart), dan
// begitu resolusi berhasil, otomatis GABUNGKAN data user yang sempat kepisah
// di bawah key @lid ke key nomor telepon yang benar.
function linkLidToPhone(lidJid, phoneJid) {
	if (!lidJid || !phoneJid || lidJid === phoneJid || !lidJid.endsWith('@lid') || phoneJid.endsWith('@lid')) {
		return phoneJid || lidJid;
	}
	if (!global.db) return phoneJid;
	global.db.lidMap = global.db.lidMap || {};
	global.db.lidMap[lidJid] = phoneJid;

	if (global.db.users?.[lidJid]) {
		const lidUser = global.db.users[lidJid];
		const phoneUser = global.db.users[phoneJid];
		if (!phoneUser) {
			global.db.users[phoneJid] = lidUser;
		} else {
			// Union sederhana: pertahankan status yang lebih "baik" & jangan
			// sampai limit/uang yang sudah dikumpulkan hilang begitu saja.
			phoneUser.register = phoneUser.register || lidUser.register;
			phoneUser.vip = phoneUser.vip || lidUser.vip;
			phoneUser.ban = phoneUser.ban || lidUser.ban;
			if (typeof lidUser.limit === 'number') phoneUser.limit = Math.max(phoneUser.limit || 0, lidUser.limit);
			if (typeof lidUser.money === 'number') phoneUser.money = (phoneUser.money || 0) + lidUser.money;
			for (const key of ['name', 'age', 'regTime', 'afkReason']) {
				if (lidUser[key] && !phoneUser[key]) phoneUser[key] = lidUser[key];
			}
		}
		delete global.db.users[lidJid];
	}
	return phoneJid;
}

// Konsultasi peta permanen buat jid yang belum sempat ke-resolve live turn ini
// (misal baru abis restart, store.groupMetadata masih kosong).
function resolveFromLidMap(jid) {
	if (!jid || !jid.endsWith('@lid')) return jid;
	return global.db?.lidMap?.[jid] || jid;
}

// ============================================================
// RELOAD PESERTA + RESOLVER LID -> JID
// ============================================================
// Gejalanya: .tagall/.hidetag nampilin @<lid>, leaderboard nampilin orang yang
// sama 2x, dan .profile "hilang" padahal datanya ada -- semua karena peta
// lid -> nomorHp belum lengkap. Sumber kebenaran-nya ada di participants:
// bentuknya (dari lib/Socket/groups.js) { id, phoneNumber?, lid?, admin? }.
// Kalau `id` berakhiran @lid, nomor aslinya ada di `phoneNumber` (dan sebaliknya).
// Peta ini disimpan PERMANEN di global.db.lidMap supaya nggak hilang tiap restart.

const isLid = (jid) => !!jid?.endsWith('@lid')
const isPn = (jid) => !!jid?.endsWith('@s.whatsapp.net')

// WA balas 429 "rate-overlimit" (statusCode 500) kalau query metadata grup
// ditembak terlalu rapat. Boot dengan 60+ grup = 60+ query beruntun = bom
// rate-limit, dan setiap send di grup juga bisa ikut gagal karena itu.
// Jeda 1,2 detik/query jauh di bawah batas aman; 62 grup ~ 75 detik, ainda worth it
// karena hasil_sync ini yang bikin tagall/leaderboard akurat.
const jedaAntarGrup = 1200

// Catat satu pasangan lid <-> nomorHp ke peta permanen, lalu GABUNGKAN data user
// yang pernah kesimpen di key @lid ke key nomorHp (linkLidToPhone yang di atas).
function rememberLidPair(lid, pn) {
	if (!isLid(lid) || !isPn(pn)) return false
	if (!global.db) return false
	global.db.lidMap ||= {}
	if (global.db.lidMap[lid] === pn) return false
	global.db.lidMap[lid] = pn
	if (global.db.users?.[lid]) linkLidToPhone(lid, pn)
	return true
}

/**
 * Telusuri SEMUA participants di store (grup + contacts) lalu:
 * 1) isi global.db.lidMap,
 * 2) pastikan tiap participant punya `id` DAN `phoneNumber` terisi -- tanpa ini
 *    .tagall/.hidetag/.totag crash (mem.phoneNumber.split) atau nge-tag @lid,
 * 3) rapikan key user yang nyangkut di @lid supaya leaderboard/profil nggak dobel.
 * Idempotent & murah, aman dipanggil tiap metadata sync.
 */
export function normalizeLidParticipants(store) {
	const stat = { mapped: 0, merged: 0, participants: 0 }
	if (!global.db) return stat
	global.db.lidMap ||= {}

	for (const contact of Object.values(store?.contacts || {})) {
		if (rememberLidPair(contact?.id, contact?.phoneNumber)) stat.mapped++
	}
	for (const meta of Object.values(store?.groupMetadata || {})) {
		if (!meta?.participants) continue
		for (const p of meta.participants) {
			// Bentuk 1: id = @lid, phoneNumber = nomorHp
			if (isLid(p?.id) && isPn(p?.phoneNumber)) {
				if (rememberLidPair(p.id, p.phoneNumber)) stat.mapped++
			} else if (isPn(p?.id) && isLid(p?.lid)) {
				// Bentuk 2: id = nomorHp, lid ada di field terpisah
				if (rememberLidPair(p.lid, p.id)) stat.mapped++
			} else if (isLid(p?.phoneNumber) && isPn(p?.id)) {
				if (rememberLidPair(p.phoneNumber, p.id)) stat.mapped++
			}
		}
		// Jaring pengaman: participant yang datanya belum lengkap (misal cuma ada
		// satu sisi, atau sisi @lid yang belum terpetakan) dicoba dicocokkan lewat
		// peta -- kalau ketemu, kedua field diisi dengan nomor yang sama.
		meta.participants = meta.participants.map((p) => {
			const pair = rememberFromPeta(p)
			if (pair) {
				p.id = p.id || pair
				p.phoneNumber = pair
			} else {
				p.id = p.id || p.phoneNumber || p.lid
				p.phoneNumber = p.phoneNumber || (isPn(p.id) ? p.id : p.lid || p.id)
			}
			return p
		})
		stat.participants += meta.participants.length
	}

	// Sisa-sisa key @lid yang peta-nya sudah ada tapi barisnya belum pernah kebaca
	// live turn ini (misal user yang cuma aktif di grup lain).
	for (const [lid, pn] of Object.entries(global.db.lidMap)) {
		if (global.db.users?.[lid]) { linkLidToPhone(lid, pn); stat.merged++ }
	}
	for (const [k, v] of Object.entries(store?.contacts || {})) {
		if (isLid(k) && global.db.lidMap[k]) store.contacts[global.db.lidMap[k]] = { ...v, id: global.db.lidMap[k] }
	}
	return stat
}

function rememberFromPeta(p) {
	const kandidat = [p?.id, p?.phoneNumber, p?.lid].filter(Boolean)
	for (const k of kandidat) {
		const pn = global.db.lidMap?.[k]
		if (isPn(pn)) return pn
	}
	return null
}

/**
 * Minta ulang metadata SEMUA grup yang bot ini ikuti, lalu normalisasi
 * lid -> nomorHp-nya. Dipakai .reloadparticipant, dan juga otomatis saat start /
 * sebelum shutdown lewat syncGroupMetadataCache({ force: true }).
 */
export async function reloadAllParticipants(voxel, store) {
	if (!voxel || !store) return { groups: 0, mapped: 0, participants: 0 }
	store.groupMetadata ||= {}
	const semua = await voxel.groupFetchAllParticipating().catch(() => ({}))
	const ids = new Set([...Object.keys(semua || {}), ...Object.keys(store.groupMetadata)])
	let groups = 0
	for (const id of ids) {
		if (groups) await sleep(jedaAntarGrup) // anti rate-overlimit, lihat jedaAntarGrup
		const fresh = await voxel.groupMetadata(id).catch(() => null)
		const meta = fresh || semua?.[id]
		if (!meta) continue
		store.groupMetadata[id] = { ...(store.groupMetadata[id] || {}), ...meta }
		groups++
	}
	return { groups, ...normalizeLidParticipants(store) }
}

/*
	* Create By Voxel
	* Base Bot: Hitori MD - https://github.com/nazedev/hitori
	* Whatsapp : https://whatsapp.com/channel/0029VaWOkNm7DAWtkvkJBK43
*/

const reloadHandler = async () => {
	try {
		voxelHandler = (await import(`../voxel.js?update=${Date.now()}`)).default;
	} catch (err) {
		console.error(chalk.redBright(`[ERROR] ${err}`));
	}
};

reloadHandler();

export async function syncGroupMetadataCache(voxel, store, { force = false } = {}) {
	if (!voxel || !store) return null;
	store.groupMetadata = store.groupMetadata || {};

	const refreshTargets = new Set(Object.keys(store.groupMetadata));
	try {
		const participating = await voxel.groupFetchAllParticipating().catch(() => ({}));
		if (participating && typeof participating === 'object') {
			for (const [id, metadata] of Object.entries(participating)) {
				if (!id) continue;
				refreshTargets.add(id);
				if (metadata) store.groupMetadata[id] = { ...(store.groupMetadata[id] || {}), ...metadata };
			}
		}
	} catch (e) {
		console.warn('[METADATA] Gagal refresh daftar grup participating:', e?.message || e);
	}

	let sudah = 0;
	for (const id of [...refreshTargets]) {
		try {
			if (sudah++) await sleep(jedaAntarGrup); // anti rate-overlimit, lihat jedaAntarGrup
			const fresh = await voxel.groupMetadata(id).catch(() => null);
			if (fresh) {
				store.groupMetadata[id] = { ...(store.groupMetadata[id] || {}), ...fresh };
			}
		} catch (e) {
			console.warn(`[METADATA] Gagal sync metadata grup ${id}:`, e?.message || e);
		}
	}

	// Resolusi lid -> nomorHp WAJIB jalan di setiap sync (bukan cuma force):
	// inilah yang bikin .tagall nampilin @nomor (bukan @lid) dan leaderboard
	// nggak dobel, termasuk langsung setelah restart.
	const lid = normalizeLidParticipants(store);
	if (force && (lid.mapped || lid.merged)) {
		console.log(`[METADATA] Resolved ${lid.mapped} lid, merge ${lid.merged} user, ${lid.participants} peserta dari ${Object.keys(store.groupMetadata).length} grup.`);
	}

	return store.groupMetadata;
}

async function GroupUpdate(voxel, m, store) {
	function clearParse(parse) {
		try {
			return JSON.parse(parse);
		} catch {
			return parse;
		}
	}
	if (!m.messageStubType || !m.isGroup) return
	if (global.db?.groups?.[m.chat] && store?.groupMetadata?.[m.chat]) {
		const admin = `@${m.sender.split('@')[0]}`
		const metadata = store.groupMetadata[m.chat];
		const normalizedTarget = clearParse(m.messageStubParameters[0]);
		const type = m.messageStubType;
		const messages = {
			1: 'mereset link grup!',
			21: `mengubah Subject Grup menjadi :\n*${normalizedTarget}*`,
			22: 'telah mengubah icon grup.',
			23: 'mereset link grup!',
			24: `mengubah deskripsi grup.\n\n${normalizedTarget}`,
			25: `telah mengatur agar *${normalizedTarget == 'on' ? 'hanya admin' : 'semua peserta'}* yang dapat mengedit info grup.`,
			26: `telah *${normalizedTarget == 'on' ? 'menutup' : 'membuka'}* grup!\nSekarang ${normalizedTarget == 'on' ? 'hanya admin yang' : 'semua peserta'} dapat mengirim pesan.`,
			29: `telah menjadikan @${normalizedTarget?.id?.split('@')?.[0]} sebagai admin.`,
			30: `telah memberhentikan @${normalizedTarget?.id?.split('@')?.[0]} dari admin.`,
			72: `mengubah durasi pesan sementara menjadi *@${normalizedTarget}*`,
			123: 'menonaktifkan pesan sementara.',
			132: 'mereset link grup!',
			172: `@${normalizedTarget?.pn?.split('@')?.[0]} meminta bergabung`,
		}
		if (voxel.public && global.db?.groups?.[m.chat]?.setinfo && messages[type]) {
			await voxel.sendMessage(m.chat, { text: `${admin} ${messages[type]}`, mentions: [m.sender, ...((normalizedTarget?.id || normalizedTarget)?.includes('@') ? [`${normalizedTarget.id || normalizedTarget}`] : [])].filter(Boolean)}, { ephemeralExpiration: m.expiration || m?.metadata?.ephemeralDuration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
		}
		if (type === 20) {
			clearTimeout(groupMetadataTimers[m.chat])
			groupMetadataTimers[m.chat] = setTimeout(async () => {
				store.groupMetadata[m.chat] = await voxel.groupMetadata(m.chat).catch(e => ({ ...store.groupMetadata[m.chat] }));
				delete groupMetadataTimers[m.chat];
			}, 5000);
		} else if (type === 29 || type === 30) {
			const target = jidNormalizedUser(normalizedTarget.id || normalizedTarget)
			const newAdminValue = type === 29 ? 'admin' : null
			if (metadata?.participants?.length) {
				metadata.participants = metadata.participants.map(p => {
					const key = metadata.addressingMode === 'lid' ? jidNormalizedUser(p.id) : jidNormalizedUser(p.phoneNumber)
					if (key === target) {
						return { ...p, admin: newAdminValue }
					}
					return p
				})
			}
		} else if (type === 27) {
			if (!metadata.participants.some(a => (a.id === (normalizedTarget.id || normalizedTarget) || a.phoneNumber === (normalizedTarget.id || normalizedTarget)))) {
				clearTimeout(groupMetadataTimers[m.chat])
				groupMetadataTimers[m.chat] = setTimeout(async () => {
					store.groupMetadata[m.chat] = await voxel.groupMetadata(m.chat).catch(e => ({ ...store.groupMetadata[m.chat] }));
					delete groupMetadataTimers[m.chat];
				}, 5000);
			}
		} else if (type === 28 || type === 32) {
			if (m.fromMe && ((jidNormalizedUser(voxel.user.id) == (normalizedTarget.id || normalizedTarget)) || (jidNormalizedUser(voxel.user.lid) == (normalizedTarget.id || normalizedTarget)))) {
				delete store.messages[m.chat];
				delete store.presences[m.chat];
				delete store.groupMetadata[m.chat];
			}
			if(!!metadata) metadata.participants = metadata.participants.filter(p => {
				const key = metadata.addressingMode === 'lid' ? jidNormalizedUser(p.id) : jidNormalizedUser(p.phoneNumber)
				return key !== (normalizedTarget.id || normalizedTarget)
			});
		} else {
			console.log({
				messageStubType: m.messageStubType, type,
				messageStubParameters: m.messageStubParameters,
			})
		}
	}
}

async function GroupParticipantsUpdate(voxel, update, store) {
	try {
		const { id, participants, author, action } = update;
		function updateAdminStatus(participants, metadataParticipants, status) {
			for (const participant of metadataParticipants) {
				if (participants.includes(jidNormalizedUser(participant.id)) || participants.includes(jidNormalizedUser(participant.phoneNumber))) {
					participant.admin = status;
				}
			}
		}
		if (global.db?.groups?.[id] && store?.groupMetadata?.[id]) {
			const metadata = store.groupMetadata[id];
			for (let n of participants) {
				const jid = typeof n === 'string' ? n : (n?.phoneNumber || n?.id || '');
				const participant = metadata.participants.find(a => a.id == jidNormalizedUser(jid))
				let profile;
				try {
					profile = await voxel.profilePictureUrl(jid, 'image');
				} catch {
					profile = 'https://telegra.ph/file/95670d63378f7f4210f03.png';
				}
				let messageText;
				if (action === 'add') {
					if (global.db.groups[id]?.welcome) messageText = global.db.groups[id]?.text?.setwelcome || `Welcome to ${metadata.subject}\n@`;
					if (!participant) {
						clearTimeout(groupMetadataTimers[id])
						groupMetadataTimers[id] = setTimeout(async () => {
							store.groupMetadata[id] = await voxel.groupMetadata(id).catch(e => ({ ...store.groupMetadata[id] }));
							delete groupMetadataTimers[id];
						}, 5000);
					}
				} else if (action === 'remove') {
					if (global.db.groups[id]?.leave) messageText = global.db.groups[id]?.text?.setleave || `@\nLeaving From ${metadata.subject}`;
					if ((jidNormalizedUser(voxel.user.lid) == jidNormalizedUser(jid)) || (jidNormalizedUser(voxel.user.id) == jidNormalizedUser(jid))) {
						delete store.messages[id];
						delete store.presences[id];
						delete store.groupMetadata[id];
					}
					if(metadata) metadata.participants = metadata.participants.filter(p => !participants.includes(metadata.addressingMode === 'lid' ? jidNormalizedUser(p.id) : jidNormalizedUser(p.phoneNumber)));
				} else if (action === 'promote') {
					if (global.db.groups[id]?.promote) messageText = global.db.groups[id]?.text?.setpromote || `@\nPromote From ${metadata.subject}\nBy @admin`;
					updateAdminStatus(participants, metadata.participants, 'admin');
				} else if (action === 'demote') {
					if (global.db.groups[id]?.demote) messageText = global.db.groups[id]?.text?.setdemote || `@\nDemote From ${metadata.subject}\nBy @admin`;
					updateAdminStatus(participants, metadata.participants, null);
				}
				if (messageText && voxel.public) {
					await voxel.sendMessageV3(id, {
						text: messageText.replace('@subject', metadata.subject).replace('@admin', author ? `@${author.split('@')[0]}` : '@admin').replace(/(?<=\s|^)@(?!\w)/g, `@${jid.split('@')[0]}`),
						title: action == 'add' ? 'Welcome' : action == 'remove' ? 'Leaving' : action.charAt(0).toUpperCase() + action.slice(1),
						description: metadata.subject,
						thumbnailUrl: profile,
						sourceUrl: global.my.gh,
						mentions: [jid, author].filter(Boolean),
						contextInfo: {
							forwardingScore: 1,
							isForwarded: true,
							forwardedNewsletterMessageInfo: {
								newsletterJid: my.ch,
								serverMessageId: null,
								newsletterName: 'Join For More Info'
							}
						}
					}, { ephemeralExpiration: metadata?.ephemeralDuration || store?.messages[id]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
				}
			}
		}
	} catch (e) {
		throw e;
	}
}

async function LoadDataBase(voxel, m) {
	try {
		const botNumber = await voxel.decodeJid(voxel.user.id);
		// Jaga-jaga terakhir: kalau m.sender masih @lid sampai sini (belum
		// ke-resolve di Serialize), tetap coba pakai peta permanen supaya
		// data user tidak sampai kesimpen di key @lid yang salah.
		if (m.sender?.endsWith('@lid')) m.sender = resolveFromLidMap(m.sender);
		let game = global.db.game || {};
		let premium = global.db.premium || [];
		let user = global.db.users[m.sender] || {};
		let setBot = global.db.set[botNumber] || {};
		
		global.db.game = game;
		global.db.set[botNumber] = setBot;
		if (!m.sender.endsWith('@g.us')) global.db.users[m.sender] = user;
		
		const defaultSetBot = {
			lang: 'id',
			limit: 0,
			money: 0,
			status: 0,
			log: true,
			join: false,
			public: true,
			anticall: false,
			original: true,
			readsw: false,
			autobio: false,
			autoread: false,
			antispam: false,
			autotyping: false,
			grouponly: true,
			multiprefix: false,
			privateonly: true,
			whitelistonly: false,
			didyoumean: false,
			author: global.author || 'Voxel',
			// null = belum diatur owner, wajib pakai prefix normal seperti user lain.
			// Owner bisa jalankan `authorprefix off` bila memang ingin bypass prefix secara sengaja.
			authorPrefix: null,
			autobackup: false,
			botname: global.botname || 'Hitori Bot',
			packname: global.packname || 'Bot WhatsApp',
			template: 'documentMessage',
			owner: global.owner,
			whitelist: [],
		};
		for (let key in defaultSetBot) {
			if (!(key in setBot)) setBot[key] = defaultSetBot[key];
		}
		// Migrasi bug lama: authorPrefix pernah default '' sehingga owner bisa jalankan
		// command apapun tanpa prefix sama sekali. Reset ke null (ikut aturan prefix normal).
		// Owner yang memang sengaja mau tanpa-prefix cukup jalankan `authorprefix off` lagi.
		if (setBot.authorPrefix === '') setBot.authorPrefix = null;
		
		const limitUser = user.vip ? global.limit.vip : checkStatus(m.sender, premium) ? global.limit.premium : global.limit.free;
		const moneyUser = user.vip ? global.money.vip : checkStatus(m.sender, premium) ? global.money.premium : global.money.free;
		
		const defaultUser = {
			vip: false,
			ban: false,
			afkTime: -1,
			afkReason: '',
			register: false,
			limit: limitUser,
			money: moneyUser,
			lastclaim: Date.now(),
			lastbegal: Date.now(),
			lastrampok: Date.now(),
			// --- PROFIL ---
			// Cuma name/gender/age/bio yang boleh diubah user sendiri (lewat
			// command .profile set*), sisanya Strictly dikelola sistem.
			name: m.pushName || '-',
			gender: '-',
			age: '-',
			bio: '-',
			role: 'User',
			level: 1,
			xp: 0,
			xpRequired: 100,
			premium: false,
			chatCount: 0,
			commandCount: 0,
			lastCommand: '-',
			createdAt: new Date().toISOString(),
			lastSeen: new Date().toISOString(),
			badges: [], // Disiapkan saja, belum ada logika badge sama sekali.
		};
		// Status premium mengikuti daftar premium global, bukan diisi user.
		user.premium = checkStatus(m.sender, premium) || false;
		for (let key in defaultUser) {
			if (!(key in user)) user[key] = defaultUser[key];
		}
		
		if (m.isGroup) {
			let group = global.db.groups[m.chat] || {};
			global.db.groups[m.chat] = group;
			
			const defaultGroup = {
				url: '',
				text: {},
				warn: {},
				tagsw: {},
				nsfw: false,
				mute: false,
				leave: false,
				setinfo: false,
				antilink: false,
				demote: false,
				antitoxic: false,
				promote: false,
				welcome: false,
				antivirtex: false,
				antitagsw: false,
				antidelete: false,
				antihidetag: false,
				waktusholat: false,
			};
			for (let key in defaultGroup) {
				if (!(key in group)) group[key] = defaultGroup[key];
			}
		}
		
		const defaultGame = {
			suit: {},
			chess: {},
			chat_ai: {},
			menfes: {},
			tekateki: {},
			tictactoe: {},
			tebaklirik: {},
			kuismath: {},
			blackjack: {},
			tebaklagu: {},
			tebakkata: {},
			family100: {},
			susunkata: {},
			tebakbom: {},
			ulartangga: {},
			tebakkimia: {},
			caklontong: {},
			tebakangka: {},
			tebaknegara: {},
			tebakgambar: {},
			tebakbendera: {},
		};
		for (let key in defaultGame) {
			if (!(key in game)) game[key] = defaultGame[key];
		}
	} catch (e) {
		throw e
	}
}

async function MessagesUpsert(voxel, message, store) {
	try {
		let botNumber = await voxel.decodeJid(voxel.user.id);
		const msg = message.messages[0];
		if ((msg?.messageTimestamp * 1000) < botStartTime) return;
		const remoteJid = msg.key.remoteJid;
		(store.messages ??= {})[remoteJid] ??= {};
		store.messages[remoteJid].array ??= [];
		store.messages[remoteJid].keyId ??= new Set();
		if (!(store.messages[remoteJid].keyId instanceof Set)) {
			store.messages[remoteJid].keyId = new Set(store.messages[remoteJid].array.map(m => m.key.id));
		}
		if (store.messages[remoteJid].keyId.has(msg.key.id)) return;
		store.messages[remoteJid].array.push(msg);
		store.messages[remoteJid].keyId.add(msg.key.id);
		if (store.messages[remoteJid].array.length > (global.chatLength || 1000)) {
			const lastChat = store.messages[remoteJid].array.shift();
			store.messages[remoteJid].keyId.delete(lastChat.key.id);
		}
		if (!store.groupMetadata || Object.keys(store.groupMetadata).length === 0) store.groupMetadata ??= await voxel.groupFetchAllParticipating().catch(e => ({}));
		const type = msg.message ? (getContentType(msg.message) || Object.keys(msg.message)[0]) : '';
		const m = await Serialize(voxel, msg, store);
		if (voxelHandler) {
			voxelHandler(voxel, m, msg, store);
		} else {
			await reloadHandler();
			if (voxelHandler) voxelHandler(voxel, m, msg, store);
		}
		if (global.db?.set?.[botNumber]?.readsw && msg.key.remoteJid === 'status@broadcast') {
			await voxel.readMessages([msg.key]);
			if (/protocolMessage/i.test(type)) await voxel.sendFromOwner(global.db?.set?.[botNumber]?.owner || global.owner, 'Status dari @' + msg.key.participant.split('@')[0] + ' Telah dihapus', msg, { mentions: [msg.key.participant] });
			if (/(audioMessage|imageMessage|videoMessage|extendedTextMessage)/i.test(type)) {
				let keke = (type == 'extendedTextMessage') ? `Story Teks Berisi : ${msg.message.extendedTextMessage.text ? msg.message.extendedTextMessage.text : ''}` : (type == 'imageMessage') ? `Story Gambar ${msg.message.imageMessage.caption ? 'dengan Caption : ' + msg.message.imageMessage.caption : ''}` : (type == 'videoMessage') ? `Story Video ${msg.message.videoMessage.caption ? 'dengan Caption : ' + msg.message.videoMessage.caption : ''}` : (type == 'audioMessage') ? 'Story Audio' : '\nTidak diketahui cek saja langsung'
				await voxel.sendFromOwner(global.db?.set?.[botNumber]?.owner || global.owner, `Melihat story dari @${msg.key.participant.split('@')[0]}\n${keke}`, msg, { mentions: [msg.key.participant] });
			}
		}
	} catch (e) {
		console.log(message);
		throw e;
	}
}

async function Solving(voxel, store) {
	voxel.serializeM = (m) => MessagesUpsert(voxel, m, store)
	
	voxel.decodeJid = (jid) => {
		if (!jid) return jid
		if (/:\d+@/gi.test(jid)) {
			let decode = jidDecode(jid) || {}
			return decode.user && decode.server && decode.user + '@' + decode.server || jid
		} else return jid
	}
	
	voxel.findJidByLid = (lid, store, resolve = false) => {
		const groupMeta = store?.groupMetadata
		if (groupMeta) {
			for (const g of Object.values(groupMeta)) {
				if (!g?.participants) continue
				for (const contact of g.participants) {
					if (((contact?.id?.includes(lid)) || (contact?.phoneNumber?.includes(lid))) && contact?.phoneNumber) {
						return contact.phoneNumber
					}
				}
			}
		}
		const contacts = store?.contacts
		if (contacts) {
			for (const contact of Object.values(contacts)) {
				if (((contact?.id?.includes(lid)) || (contact?.phoneNumber?.includes(lid))) && contact?.phoneNumber) {
					return contact.phoneNumber
				}
			}
		}
		if (resolve) return lid
		return null
	}
	
	voxel.getName = async (jid, withoutContact = false) => {
		const id = voxel.decodeJid(jid);
		if (id.endsWith('@g.us')) {
			const groupInfo = store.contacts[id] || (store.groupMetadata[id] ? store.groupMetadata[id] : (store.groupMetadata[id] = await voxel.groupMetadata(id).catch(e => ({ ...store.groupMetadata[id] })))) || {};
			return groupInfo.name || groupInfo.subject || parsePhoneNumber('+' + id.replace('@g.us', '')).number?.international;
		} else {
			if (id === '0@s.whatsapp.net') {
				return 'WhatsApp';
			}
		const contactInfo = store.contacts[id] || {};
		return withoutContact ? '' : contactInfo.name || contactInfo.subject || contactInfo.verifiedName || parsePhoneNumber('+' + id.replace('@s.whatsapp.net', '')).number?.international;
		}
	}
	
	voxel.sendContact = async (jid, kon, quoted = '', opts = {}) => {
		let list = []
		for (let i of kon) {
			list.push({
				displayName: await voxel.getName(i + '@s.whatsapp.net'),
				vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await voxel.getName(i + '@s.whatsapp.net')}\nFN:${await voxel.getName(i + '@s.whatsapp.net')}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Ponsel\nitem2.ADR:;;Indonesia;;;;\nitem2.X-ABLabel:Region\nEND:VCARD`
			})
		}
		voxel.sendMessage(jid, { contacts: { displayName: `${list.length} Kontak`, contacts: list }, ...opts }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
	}
	
	voxel.profilePictureUrl = async (jid, type = 'image', timeoutMs) => {
		const result = await voxel.query({
			tag: 'iq',
			attrs: {
				target: jidNormalizedUser(jid),
				to: '@s.whatsapp.net',
				type: 'get',
				xmlns: 'w:profile:picture'
			},
			content: [{
				tag: 'picture',
				attrs: {
					type, query: 'url'
				},
			}]
		}, timeoutMs);
		const child = getBinaryNodeChild(result, 'picture');
		return child?.attrs?.url;
	}
	
	voxel.setStatus = (status) => {
		voxel.query({
			tag: 'iq',
			attrs: {
				to: '@s.whatsapp.net',
				type: 'set',
				xmlns: 'status',
			},
			content: [{
				tag: 'status',
				attrs: {},
				content: Buffer.from(status, 'utf-8')
			}]
		})
		return status
	}
	
	voxel.relayMessageV2 = async (jid, message, options) => {
		const msg = generateWAMessageFromContent(jid, message, {
			upload: voxel.waUploadToServer,
			messageId: generateMessageID(),
			...options
		});
		const hasil = await voxel.relayMessage(jid, msg.message, {
			messageId: msg.key.id,
			...options
		});
		return hasil;
	}

	voxel.sendPoll = (jid, name = '', values = [], quoted, selectableCount = 1) => {
		return voxel.sendMessage(jid, { poll: { name, values, selectableCount }}, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
	}
	
	voxel.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
		const quotedOptions = { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 }
		try {
			const res = await axios.head(url);
			let mime = res.headers['content-type'];
			if (mime && mime.includes('gif')) {
				return voxel.sendMessage(jid, { video: { url }, caption: caption, gifPlayback: true, ...options }, quotedOptions);
			} else if (mime && mime === 'application/pdf') {
				return voxel.sendMessage(jid, { document: { url }, mimetype: 'application/pdf', caption: caption, ...options }, quotedOptions);
			} else if (mime && mime.includes('image')) {
				return voxel.sendMessage(jid, { image: { url }, caption: caption, ...options }, quotedOptions);
			} else if (mime && mime.includes('video')) {
				return voxel.sendMessage(jid, { video: { url }, caption: caption, mimetype: 'video/mp4', ...options }, quotedOptions);
			} else if (mime && mime.includes('audio')) {
				return voxel.sendMessage(jid, { audio: { url }, mimetype: 'audio/mpeg', ...options }, quotedOptions);
			} else {
				return voxel.sendMessage(jid, { document: { url }, caption: caption, mimetype: mime, ...options }, quotedOptions);
			}
		} catch (e) {
			return voxel.sendMessage(jid, { text: url, ...options }, quotedOptions);
		}
	}
	
	voxel.sendGroupInviteV4 = async (jid, participant, inviteCode, inviteExpiration, groupName = 'Unknown Subject', caption = 'Invitation to join my WhatsApp group', jpegThumbnail = null, options = {}) => {
		const msg = proto.Message.create({
			groupInviteMessage: {
				inviteCode,
				inviteExpiration: parseInt(inviteExpiration) || + new Date(new Date + (3 * 86400000)),
				groupJid: jid,
				groupName,
				jpegThumbnail: Buffer.isBuffer(jpegThumbnail) ? jpegThumbnail : null,
				caption,
				contextInfo: {
					mentionedJid: options.mentions || []
				}
			}
		});
		const message = generateWAMessageFromContent(participant, msg, options);
		const invite = await voxel.relayMessage(participant, message.message, { messageId: message.key.id })
		return invite
	}
	
	voxel.sendFromOwner = async (jids, text, quoted, options = {}) => {
		for (const a of jids) {
			const jid = a.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
			await voxel.sendMessage(jid, { text, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
		}
	}
	
	voxel.sendText = async (jid, text, quoted, options = {}) => voxel.sendMessage(jid, { text: text, mentions: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net'), ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
	
	voxel.sendAsSticker = async (jid, pathMedia, quoted, options = {}) => {
		let buff = Buffer.isBuffer(pathMedia) ? pathMedia : /^data:.*?\/.*?;base64,/i.test(pathMedia) ? Buffer.from(pathMedia.split`,`[1], 'base64') : /^https?:\/\//.test(pathMedia) ? await (await getBuffer(pathMedia)) : fs.existsSync(pathMedia) ? pathMedia : Buffer.alloc(0);
		const result = await writeExif(buff, options);
		try {
			let anu = await voxel.sendMessage(jid, { sticker: { url: result }, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
			return anu;
		} finally {
			if (fs.existsSync(pathMedia)) fs.unlinkSync(pathMedia);
			if (fs.existsSync(result)) fs.unlinkSync(result);
		}
	}
	
	voxel.downloadMediaMessage = async (message) => {
		const msg = message.msg || message;
		msg.mediaKey = fixBytes(msg.mediaKey);
		msg.fileSha256 = fixBytes(msg.fileSha256);
		msg.fileEncSha256 = fixBytes(msg.fileEncSha256);
		const mime = msg.mimetype || '';
		const messageType = (message.type || mime.split('/')[0]).replace(/Message/gi, '');
		const stream = await downloadContentFromMessage(msg, messageType);
		let buffer = Buffer.from([]);
		for await (const chunk of stream) {
			buffer = Buffer.concat([buffer, chunk]);
		}
		return buffer
	}
	
	voxel.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
	    const msg = message.msg || message;
	    msg.mediaKey = fixBytes(msg.mediaKey);
	    msg.fileSha256 = fixBytes(msg.fileSha256);
	    msg.fileEncSha256 = fixBytes(msg.fileEncSha256);
	    const mime = msg.mimetype || '';
	    const messageType = (message.type || mime.split('/')[0]).replace(/Message/gi, '');
	    const ext = mime.split('/')[1]?.split(';')[0] || 'bin';
	    
	    const dir = path.join(__dirname, '../database/temp');
	    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	    
	    const randomName = crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
	    const trueFileName = attachExtension ? path.join(dir, `${filename ? filename : randomName}.${ext}`) : path.join(dir, filename || randomName);
	    
	    const stream = await downloadContentFromMessage(msg, messageType);
	    return new Promise((resolve, reject) => {
	        const writeStream = fs.createWriteStream(trueFileName);
	        stream.pipe(writeStream);
	        writeStream.on('finish', () => resolve(trueFileName));
	        writeStream.on('error', (err) => {
	            if (fs.existsSync(trueFileName)) fs.unlinkSync(trueFileName);
	            reject(err);
	        });
	    });
	}
	
	voxel.getFile = async (PATH) => {
		let filename;
		let mime = 'application/octet-stream';
		let ext = 'bin';
		let isTemp = false;
		
		const dir = path.join(__dirname, '../database/temp');
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		
		const randomName = crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
		
		if (Buffer.isBuffer(PATH)) {
			let type = await fileTypeFromBuffer(PATH) || { mime, ext };
			mime = type.mime; ext = type.ext;
			filename = path.join(dir, `${randomName}.${ext}`);
			fs.writeFileSync(filename, PATH);
			isTemp = true;
		} else if (/^data:.*?\/.*?;base64,/i.test(PATH)) {
			let buffer = Buffer.from(PATH.split`,`[1], 'base64');
			let type = await fileTypeFromBuffer(buffer) || { mime, ext };
			mime = type.mime; ext = type.ext;
			filename = path.join(dir, `${randomName}.${ext}`);
			fs.writeFileSync(filename, buffer);
			isTemp = true;
		} else if (typeof PATH === 'string' && /^https?:\/\//.test(PATH)) {
			const res = await axios.get(PATH, { responseType: 'stream' });
			mime = res.headers['content-type'] || 'application/octet-stream';
			ext = mime.split('/')[1]?.split(';')[0] || 'tmp';
			if (ext === 'jpeg') ext = 'jpg';
			filename = path.join(dir, `${randomName}.${ext}`);
			const writeStream = fs.createWriteStream(filename);
			res.data.pipe(writeStream);
			await new Promise((resolve, reject) => {
				writeStream.on('finish', resolve);
				writeStream.on('error', reject);
			});
			isTemp = true;
		} else if (typeof PATH === 'string' && fs.existsSync(PATH)) {
			let type = await fileTypeFromFile(PATH) || { mime, ext };
			mime = type.mime; ext = type.ext;
			filename = PATH;
			isTemp = false;
		} else {
			throw new Error("Format media tidak didukung");
		}
		return { filename, mime, ext, isTemp };
	}
	
	voxel.appendResponseMessage = async (m, text) => {
		let apb = await generateWAMessage(m.chat, { text, mentions: m.mentionedJid }, { userJid: voxel.user.id, quoted: m.quoted && m.quoted.fakeObj(), ephemeralExpiration: m.expiration || m?.metadata?.ephemeralDuration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
		apb.key = m.key
		apb.key.id = [...Array(32)].map(() => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
		apb.key.fromMe = areJidsSameUser(m.sender, voxel.user.id);
		if (m.isGroup) apb.participant = m.sender;
		return voxel.ev.emit('messages.upsert', {
			...m,
			messages: [proto.WebMessageInfo.create(apb)],
			type: 'append'
		});
	}

	voxel.appendResponseMessageV2 = async (jid, content) => {
		let msg = await generateWAMessage(jid, content, { userJid: voxel.user.id, ephemeralExpiration: store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
		msg.key.fromMe = areJidsSameUser(jid, voxel.user.id);
		msg.key.id = [...Array(32)].map(() => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
		return voxel.ev.emit('messages.upsert', { type: 'append', messages: [proto.WebMessageInfo.create(msg)] });
	}
	
	voxel.sendMedia = async (jid, pathMedia, fileName = '', caption = '', quoted = '', options = {}) => {
		const { mime, filename, isTemp } = await voxel.getFile(pathMedia);
		const botNumber = voxel.decodeJid(voxel.user.id);
		const isWebpSticker = options.asSticker || /webp/.test(mime);
		let type = 'document', mimetype = mime, pathFile = filename;
		let filesToDelete = [];
		if (isTemp) filesToDelete.push(filename);
		try {
			if (isWebpSticker) {
				pathFile = await writeExif(filename, {
					packname: options.packname || global.db?.set?.[botNumber]?.packname || 'Bot WhatsApp',
					author: options.author || global.db?.set?.[botNumber]?.author || 'Voxel',
					categories: options.categories || [],
				});
				filesToDelete.push(pathFile);
				type = 'sticker';
				mimetype = 'image/webp';
			} else if (/image|video|audio/.test(mime)) {
				type = mime.split('/')[0];
				mimetype = type == 'video' ? 'video/mp4' : type == 'audio' ? 'audio/mpeg' : mime;
			}
			let anu = await voxel.sendMessage(jid, { [type]: { url: pathFile }, caption, mimetype, fileName, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0, ...options });
			return anu;
		} finally {
			filesToDelete.forEach(file => {
				if (fs.existsSync(file)) fs.unlinkSync(file);
			});
		}
	}
	
	voxel.sendAlbumMessage = async (jid, content = {}, options = {}) => {
		const { album, mentions, contextInfo, ...others } = content;
		for (const media of album) {
			if (!media.image && !media.video) throw new TypeError(`album[i] must have image or video property`);
		}
		if (album.length < 2) throw new RangeError("Minimum 2 media");
		const medias = await generateWAMessageFromContent(jid, {
			albumMessage: {
				expectedImageCount: album.filter(m => m.image).length,
				expectedVideoCount: album.filter(m => m.video).length,
			}
		}, { quoted: options?.quoted || null });
		await voxel.relayMessage(jid, medias.message, { messageId: medias.key.id });
		for (const media of album) {
			const msg = await generateWAMessage(jid, { ...others, ...media }, { upload: voxel.waUploadToServer });
			msg.message.messageContextInfo = {
				messageAssociation: {
					associationType: 1,
					parentMessageKey: medias.key
				}
			}
			await voxel.relayMessage(jid, msg.message, { messageId: msg.key.id });
		}
		return medias;
	}
	
	/**
	 * Send an Android-only AIRich HTML Mini App.
	 *
	 * ⚠️ PERINGATAN (ditemukan saat audit): fungsi ini membangun message type
	 * `GenAIaeacdsnwHtmlPrimitive` yang TIDAK ADA di skema resmi WhatsApp/
	 * @sairidev/baileys-new (bandingkan dengan typename asli yang terdokumentasi:
	 * GenAIMarkdownTextUXPrimitive, GenAICodeUXPrimitive, GenATableUXPrimitive -
	 * WhatsApp cuma dukung primitif tetap itu, TIDAK ADA primitif HTML bebas).
	 * String "aeacdsnw" di nama typename ini kemungkinan besar hasil karangan,
	 * bukan hasil riset ke protokol asli. Trik "bypassDownload" (kirim pesan lalu
	 * MESSAGE_EDIT ke pesan yang sama) juga tidak berdasar. Fungsi ini kemungkinan
	 * besar gagal total atau berisiko kena flag anti-abuse karena meniru struktur
	 * protokol internal bot Meta. commands/birthday.js SUDAH dipindah untuk tidak
	 * memakai fungsi ini lagi (lihat commit terkait) - dibiarkan di sini hanya
	 * supaya commands/flappybird.js (belum diaudit) tidak langsung rusak.
	 *
	 * This intentionally uses the low-level WhatsApp wire shape instead of
	 * replacing @sairidev/baileys. The HTML is embedded in
	 * AIRichResponseMessage.unifiedResponse.data as a GenAI HTML primitive.
	 *
	 * `bypassDownload` performs the second MESSAGE_EDIT relay used by current
	 * Android clients to force the Rich HTML renderer to materialize the
	 * WebView. No remote hosting is required for the HTML itself.
	 */
	voxel.sendHtmlApp = async (jid, html, options = {}) => {
		if (typeof html !== 'string' || !html.trim()) {
			throw new TypeError('sendHtmlApp: html must be a non-empty string')
		}

		const {
			title = 'Voxel • Birthday Card',
			text = '',
			trustedSources = [],
			bypassDownload = true,
			quoted = null,
			messageId = generateMessageID()
		} = options

		if (!Array.isArray(trustedSources)) {
			throw new TypeError('sendHtmlApp: trustedSources must be an array')
		}

		const responseId = randomUUID();
		const botResponseId = randomUUID();

		const sections = [];
		if (text) {
			sections.push({
				__typename: 'GenAIUnifiedResponseSection',
				view_model: {
					__typename: 'GenAISingleLayoutViewModel',
					primitive: {
						__typename: 'GenAIMarkdownTextUXPrimitive',
						markdown: text
					}
				}
			});
		}

		sections.push({
			__typename: 'GenAIUnifiedResponseSection',
			view_model: {
				__typename: 'GenAISingleLayoutViewModel',
				primitive: {
					__typename: 'GenAIaeacdsnwHtmlPrimitive',
					payload: html,
					trusted_sources: trustedSources
				}
			}
		});

		const unified = {
			__typename: 'GenAIUnifiedResponse',
			response_id: responseId,
			sections
		};

		const data = Buffer.from(JSON.stringify(unified), 'utf8');

		const content = {
			messageContextInfo: {
				deviceListMetadata: {},
				deviceListMetadataVersion: 2,
				botMetadata: {
					messageDisclaimerText: title,
					botResponseId
				}
			},
			botForwardedMessage: {
				message: {
					richResponseMessage: {
						messageType: 1,
						submessages: [],
						unifiedResponse: { data },
						contextInfo: {
							forwardingScore: 1,
							isForwarded: true,
							forwardOrigin: 4,
							forwardedAiBotMessageInfo: {
								botJid: '867051314767696@bot'
							}
						}
					}
				}
			}
		};


		const sent = await generateWAMessageFromContent(jid, content, {
			quoted: quoted || undefined,
			messageId
		});

		await voxel.relayMessage(jid, sent.message, {
			messageId: sent.key.id
		});

		if (bypassDownload) {
			const edit = await generateWAMessageFromContent(jid, {
				protocolMessage: proto.Message.ProtocolMessage.create({
					key: sent.key,
					type: proto.Message.ProtocolMessage.Type.MESSAGE_EDIT,
					editedMessage: sent.message,
					timestampMs: Date.now()
				})
			}, { messageId: generateMessageID() });

			await voxel.relayMessage(jid, edit.message, {
				messageId: edit.key.id
			});
		}

		return sent;
	};

	voxel.sendListMsg = async (jid, content = {}, options = {}) => {
		const { text, caption, footer = '', title, subtitle, ai, contextInfo = {}, buttons = [], messageParamsJson = {}, mentions = [], ...media } = content;
		const msg = await generateWAMessageFromContent(jid, {
			viewOnceMessage: {
				message: {
					messageContextInfo: {
						deviceListMetadata: {},
						deviceListMetadataVersion: 2,
					},
					interactiveMessage: proto.Message.InteractiveMessage.create({
						body: proto.Message.InteractiveMessage.Body.create({ text: text || caption || '' }),
						footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
						header: proto.Message.InteractiveMessage.Header.create({
							title,
							subtitle,
							hasMediaAttachment: Object.keys(media).length > 0,
							...(media && typeof media === 'object' && Object.keys(media).length > 0 ? await generateWAMessageContent(media, {
								upload: voxel.waUploadToServer
							}) : {})
						}),
						nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
							...(messageParamsJson && typeof messageParamsJson === 'object' && Object.keys(messageParamsJson).length > 0 ? messageParamsJson : {}),
							buttons: buttons.map(a => {
								return {
									name: a.name,
									buttonParamsJson: JSON.stringify(a.buttonParamsJson ? (typeof a.buttonParamsJson === 'string' ? JSON.parse(a.buttonParamsJson) : a.buttonParamsJson) : '')
								}
							})
						}),
						contextInfo: {
							...contextInfo,
							...options.contextInfo,
							mentionedJid: options.mentions || mentions,
							...(options.quoted ? {
								stanzaId: options.quoted.key.id,
								remoteJid: options.quoted.key.remoteJid,
								participant: options.quoted.key.participant || options.quoted.key.remoteJid,
								fromMe: options.quoted.key.fromMe,
								quotedMessage: options.quoted.message
							} : {})
						}
					})
				}
			}
		}, {});
		const hasil = await voxel.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [{
				tag: 'biz',
				attrs: {},
				content: [{
					tag: 'interactive',
					attrs: {
						type: 'native_flow',
						v: '1'
					},
					content: [{
						tag: 'native_flow',
						attrs: {
							v: '9',
							name: 'mixed'
						}
					}]
				}]
			}, ...(ai ? [{ attrs: { biz_bot: '1' }, tag: 'bot' }] : [])]
		})
		return hasil
	}
	
	voxel.sendButtonMsg = async (jid, content = {}, options = {}) => {
		const { text, caption, footer = '', headerType = 1, ai, contextInfo = {}, buttons = [], mentions = [], ...media } = content;
		const msg = await generateWAMessageFromContent(jid, {
			viewOnceMessage: {
				message: {
					messageContextInfo: {
						deviceListMetadata: {},
						deviceListMetadataVersion: 2,
					},
					buttonsMessage: {
						...(media && typeof media === 'object' && Object.keys(media).length > 0 ? await generateWAMessageContent(media, {
							upload: voxel.waUploadToServer
						}) : {}),
						contentText: text || caption || '',
						footerText: footer,
						buttons,
						headerType: media && Object.keys(media).length > 0 ? Math.max(...Object.keys(media).map((a) => ({ document: 3, image: 4, video: 5, location: 6 })[a] || headerType)) : headerType,
						contextInfo: {
							...contextInfo,
							...options.contextInfo,
							mentionedJid: options.mentions || mentions,
							...(options.quoted ? {
								stanzaId: options.quoted.key.id,
								remoteJid: options.quoted.key.remoteJid,
								participant: options.quoted.key.participant || options.quoted.key.remoteJid,
								fromMe: options.quoted.key.fromMe,
								quotedMessage: options.quoted.message
							} : {})
						}
					}
				}
			}
		}, {});
		const hasil = await voxel.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [{
				tag: 'biz',
				attrs: {},
				content: [{
					tag: 'interactive',
					attrs: {
						type: 'native_flow',
						v: '1'
					},
					content: [{
						tag: 'native_flow',
						attrs: {
							v: '9',
							name: 'mixed'
						}
					}]
				}]
			}, ...(ai ? [{ attrs: { biz_bot: '1' }, tag: 'bot' }] : [])]
		})
		return hasil
	}
	
	voxel.newsletterMsg = async (key, content = {}, timeout = 5000) => {
		const { type: rawType = 'INFO', name, description = '', picture = null, react, id, newsletter_id = key, ...media } = content;
		const type = rawType.toUpperCase();
		if (react) {
			if (!(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id))) throw [{ message: 'Use Id Newsletter', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}]
			if (!id) throw [{ message: 'Use Id Newsletter Message', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}]
			const hasil = await voxel.query({
				tag: 'message',
				attrs: {
					to: key,
					type: 'reaction',
					'server_id': id,
					id: generateMessageID()
				},
				content: [{
					tag: 'reaction',
					attrs: {
						code: react
					}
				}]
			});
			return hasil
		} else if (media && typeof media === 'object' && Object.keys(media).length > 0) {
			const msg = await generateWAMessageContent(media, { upload: voxel.waUploadToServer });
			const anu = await voxel.query({
				tag: 'message',
				attrs: { to: newsletter_id, type: 'text' in media ? 'text' : 'media' },
				content: [{
					tag: 'plaintext',
					attrs: /image|video|audio|sticker|poll/.test(Object.keys(media).join('|')) ? { mediatype: Object.keys(media).find(key => ['image', 'video', 'audio', 'sticker','poll'].includes(key)) || null } : {},
					content: proto.Message.encode(msg).finish()
				}]
			})
			return anu
		} else {
			if ((/(FOLLOW|UNFOLLOW|DELETE)/.test(type)) && !(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id))) return [{ message: 'Use Id Newsletter', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}]
			const _query = await voxel.query({
				tag: 'iq',
				attrs: {
					to: 's.whatsapp.net',
					type: 'get',
					xmlns: 'w:mex'
				},
				content: [{
					tag: 'query',
					attrs: {
						query_id: type == 'FOLLOW' ? '9926858900719341' : type == 'UNFOLLOW' ? '7238632346214362' : type == 'CREATE' ? '6234210096708695' : type == 'DELETE' ? '8316537688363079' : '6563316087068696'
					},
					content: new TextEncoder().encode(JSON.stringify({
						variables: /(FOLLOW|UNFOLLOW|DELETE)/.test(type) ? { newsletter_id } : type == 'CREATE' ? { newsletter_input: { name, description, picture }} : { fetch_creation_time: true, fetch_full_image: true, fetch_viewer_metadata: false, input: { key, type: (newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id)) ? 'JID' : 'INVITE' }}
					}))
				}]
			}, timeout);
			const res = JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_join_v2 || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_leave_v2 || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_create || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_delete_v2 || JSON.parse(_query.content[0].content)?.errors || JSON.parse(_query.content[0].content)
			res.thread_metadata ? (res.thread_metadata.host = 'https://mmg.whatsapp.net') : null
			return res
		}
	}
	
	voxel.sendCarouselMsg = async (jid, body = '', footer = '', cards = [], options = {}) => {
		async function getImageMsg(url) {
			const { imageMessage } = await generateWAMessageContent({ image: { url } }, { upload: voxel.waUploadToServer });
			return imageMessage;
		}
		const cardPromises = cards.map(async (a) => {
			const imageMessage = await getImageMsg(a.url);
			return {
				header: {
					imageMessage: imageMessage,
					hasMediaAttachment: true
				},
				body: { text: a.body },
				footer: { text: a.footer },
				nativeFlowMessage: {
					buttons: a.buttons.map(b => ({
						name: b.name,
						buttonParamsJson: JSON.stringify(b.buttonParamsJson ? JSON.parse(b.buttonParamsJson) : '')
					}))
				}
			};
		});
		
		const cardResults = await Promise.all(cardPromises);
		const msg = await generateWAMessageFromContent(jid, {
			viewOnceMessage: {
				message: {
					messageContextInfo: {
						deviceListMetadata: {},
						deviceListMetadataVersion: 2
					},
					interactiveMessage: proto.Message.InteractiveMessage.create({
						body: proto.Message.InteractiveMessage.Body.create({ text: body }),
						footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
						carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
							cards: cardResults,
							messageVersion: 1
						})
					})
				}
			}
		}, {});
		const hasil = await voxel.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id });
		return hasil
	}

	voxel.sendMessageV3 = async (jid, content = {}, options = {}) => {
		const { text, title = '', description = '', thumbnailUrl, sourceUrl, contextInfo = {}, mentions = [] } = content;
		if (thumbnailUrl && text) {
			let compressedMedia;
			let meta = { width: 1024, height: 576 };
			try {
				const image = await Jimp.read(thumbnailUrl);
				meta.width = image.bitmap.width;
				meta.height = image.bitmap.height;
				compressedMedia = await image.quality(90).getBufferAsync(Jimp.MIME_JPEG);
			} catch (error) {
				compressedMedia = { url: thumbnailUrl };
			}
			const { imageMessage: img } = await prepareWAMessageMedia({ image: compressedMedia }, { upload: voxel.waUploadToServer, mediaTypeOverride: 'thumbnail-link' });
			const linkUrl = sourceUrl || thumbnailUrl;
			const customContextInfo = {
				...contextInfo, ...options.contextInfo,
				mentionedJid: options.mentions || mentions,
				...(options.quoted ? {
					stanzaId: options.quoted.key.id,
					remoteJid: options.quoted.key.remoteJid,
					participant: options.quoted.key.participant || options.quoted.key.remoteJid,
					fromMe: options.quoted.key.fromMe,
					quotedMessage: options.quoted.message
				} : {})
			};
			const payloadMessage = {
				extendedTextMessage: {
					text: `${linkUrl}\n\n${text}`.trim(),
					matchedText: linkUrl,
					title, description, previewType: 0,
					renderLargerThumbnail: true,
					jpegThumbnail: img.jpegThumbnail,
					thumbnailDirectPath: img.directPath,
					thumbnailSha256: img.fileSha256,
					thumbnailEncSha256: img.fileEncSha256,
					mediaKey: img.mediaKey,
					mediaKeyTimestamp: img.mediaKeyTimestamp,
					thumbnailHeight: meta.height,
					thumbnailWidth: meta.width,
					contextInfo: customContextInfo
				}
			};
			const hasil = await voxel.relayMessage(jid, payloadMessage, { messageId: generateMessageID() });
			return hasil;
		} else {
			return await voxel.sendMessage(jid, content, options);
		}
	}
	
	if (voxel.user && voxel.user.id) {
		const botNumber = voxel.decodeJid(voxel.user.id);
		if (global.db?.set[botNumber]) {
			voxel.public = global.db.set[botNumber].public
		} else voxel.public = true
	} else voxel.public = true

	return voxel
}

/*
	* Create By Voxel
	* Base Bot: Hitori MD - https://github.com/nazedev/hitori
	* Whatsapp : https://whatsapp.com/channel/0029VaWOkNm7DAWtkvkJBK43
*/

async function Serialize(voxel, msg, store) {
	const botLid = voxel.decodeJid(voxel.user.lid);
	const botNumber = voxel.decodeJid(voxel.user.id);
	const m = { ...msg };
	if (!m) return m
	if (m.key) {
		m.id = m.key.id
		m.chat = m.key.remoteJidAlt || m.key.remoteJid
		m.fromMe = m.key.fromMe
		m.isBot = ['HSK', 'BAE', 'B1E', '3EB0', 'B24E', 'WA'].some(a => m.id.startsWith(a) && [12, 16, 20, 22, 40].includes(m.id.length)) || /(.)\1{5,}|[^a-zA-Z0-9]|[^0-9A-F]/.test(m.id) || false
		m.isGroup = m.chat.endsWith('@g.us')
		if (!m.isGroup && m.chat.endsWith('@lid')) {
			const liveResolved = voxel.findJidByLid(m.chat, store);
			m.chat = liveResolved ? linkLidToPhone(m.chat, liveResolved) : resolveFromLidMap(m.chat);
		}
		m.sender = voxel.decodeJid(m.fromMe && voxel.user.id || m.key.participantAlt || m.key.participant || m.chat || '')
		m.sender = resolveFromLidMap(m.sender);
		if (m.isGroup) {
			if (!store.groupMetadata) store.groupMetadata = await voxel.groupFetchAllParticipating().catch(e => ({}));
			let metadata = store.groupMetadata[m.chat] ? store.groupMetadata[m.chat] : (store.groupMetadata[m.chat] = await voxel.groupMetadata(m.chat).catch(e => ({ ...store.groupMetadata[m.chat] })));
			if (!metadata) {
				metadata = await voxel.groupMetadata(m.chat).catch(e => ({ ...store.groupMetadata[m.chat] }));
				store.groupMetadata[m.chat] = metadata
			}
			m.metadata = metadata
			m.metadata.size = (metadata.participants || []).length;
			if (metadata.addressingMode === 'lid') {
				const participant = metadata.participants.find(a => a.id === m.sender || a.phoneNumber === m.sender)
				const liveResolvedSender = participant?.phoneNumber || m.key.participantAlt;
				m.sender = liveResolvedSender ? linkLidToPhone(m.sender, voxel.decodeJid(liveResolvedSender)) : resolveFromLidMap(m.sender);
				m.metadata.owner = m.metadata?.participants?.find(p => p.id === m.metadata.owner)?.id || m.metadata.owner;
				m.metadata.subjectOwner = m.metadata?.participants?.find(p => p.id === m.metadata.subjectOwner)?.id || m.metadata.subjectOwner;
				if(!m.sender.endsWith('@g.us')) store.contacts[m.sender] = { ...(store.contacts[m.sender] || {}), id: jidNormalizedUser(m.fromMe && voxel.user.lid || participant?.id || store.contacts[m.sender]?.id || m.sender), phoneNumber: jidNormalizedUser(m.fromMe && voxel.user.id || participant?.phoneNumber || store.contacts[m.sender]?.phoneNumber || m.sender), name: (m.fromMe && voxel.user.name) || m.pushName };
			}
			m.admins = m.metadata.participants ? m.metadata.participants.filter(p => p.admin).map(p => ({ id: p.id, phoneNumber: p.phoneNumber, admin: p.admin })) : [];
			// Bandingin JID setelah buang suffix device (":12") biar nggak salah anggap
			// bukan admin cuma gara-gara salah satu sisi ada device id-nya dan sisi lain nggak.
			const stripDevice = (jid) => (jid || '').replace(/:\d+(?=@)/, '')
			m.isAdmin = m.admins.some(a => stripDevice(a.id) === stripDevice(m.sender) || stripDevice(a.phoneNumber) === stripDevice(m.sender));
			m.isBotAdmin = m.admins.some(a => [botNumber, botLid].map(stripDevice).includes(stripDevice(a.id)) || [botNumber, botLid].map(stripDevice).includes(stripDevice(a.phoneNumber)));
		}
		if (m.key.addressingMode === 'lid') {
			if(!m.sender.endsWith('@g.us')) store.contacts[m.sender] = {
				...(store.contacts[m.sender] || {}),
				id: jidNormalizedUser(m.fromMe && voxel.user.lid || store.contacts[m.sender]?.id || m.key.remoteJid),
				phoneNumber: jidNormalizedUser(m.fromMe && voxel.user.id || store.contacts[m.sender]?.phoneNumber || m.sender),
				name: (m.fromMe && voxel.user.name) || m.pushName
			}
		}
	}
	if (m.message) {
		m.type = getContentType(m.message) || Object.keys(m.message)[0]
		let inner = m.message[m.type];
		m.msg = inner?.message ? inner.message[getContentType(inner.message) || Object.keys(inner.message)[0]] : (inner?.editedMessage ? inner.editedMessage : (extractMessageContent(inner) || inner));
		m.body = m.message?.conversation || m.msg?.text || m.msg?.conversation || m.msg?.caption || m.msg?.selectedButtonId || m.msg?.singleSelectReply?.selectedRowId || m.msg?.selectedId || (m.type === 'interactiveResponseMessage' && m.message.interactiveResponseMessage?.nativeFlowResponseMessage ? JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson || '{}')?.id : '') || (m.type === 'editedMessage' || m.type === 'protocolMessage' ? (m.message[m.type]?.editedMessage?.extendedTextMessage?.text || m.message[m.type]?.editedMessage?.conversation || '') : '') || m.msg?.contentText || m.msg?.title || m.msg?.name || '';
		m.mentionedJid = m.msg?.contextInfo?.mentionedJid?.map(a => voxel.findJidByLid(a, store, true)) || []
		m.text = m.msg?.text || m.msg?.caption || m.message?.conversation || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || '';
		m.prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(m.body) ? m.body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : /[\uD800-\uDBFF][\uDC00-\uDFFF]/gi.test(m.body) ? m.body.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/gi)[0] : ''
		m.command = m.body && m.body.replace(m.prefix, '').trim().split(/ +/).shift()
		m.args = m.body?.trim().replace(new RegExp("^" + m.prefix?.replace(/[.*=+:\-?^${}()|[\]\\]|\s/g, '\\$&'), 'i'), '').replace(m.command, '').split(/ +/).filter(a => a) || []
		m.device = getDevice(m.id)
		m.expiration = m.msg?.contextInfo?.expiration || m?.metadata?.ephemeralDuration || store?.messages?.[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0
		m.timestamp = (typeof m.messageTimestamp === "number" ? m.messageTimestamp : m.messageTimestamp.low ? m.messageTimestamp.low : m.messageTimestamp.high) || m.msg.timestampMs * 1000
		m.isMedia = !!m.msg?.mimetype || !!m.msg?.thumbnailDirectPath
		if (m.isMedia) {
			m.mime = m.msg?.mimetype
			m.size = m.msg?.fileLength
			m.height = m.msg?.height || ''
			m.width = m.msg?.width || ''
			if (/webp/i.test(m.mime)) {
				m.isAnimated = m.msg?.isAnimated
			}
		}
		m.quoted = m.msg?.contextInfo?.quotedMessage || null
		if (m.quoted) {
			let qMsg = JSON.parse(JSON.stringify(m.msg?.contextInfo?.quotedMessage));
			if (m.msg?.contextInfo?.participant?.endsWith('@lid')) m.msg.contextInfo.participant =  m?.metadata?.participants?.find(a => a.id === m.msg.contextInfo.participant)?.phoneNumber || m.msg.contextInfo.participant;
			m.quoted = {
				...qMsg,
				message: extractMessageContent(qMsg) || qMsg,
				type: getContentType(qMsg) || Object.keys(qMsg)[0],
				id: m.msg.contextInfo.stanzaId,
				chat: m.msg.contextInfo.remoteJid || m.chat,
				sender: voxel.decodeJid(m.msg.contextInfo.participant),
				fromMe: voxel.decodeJid(m.msg.contextInfo.participant) === voxel.decodeJid(voxel.user.id),
				text: qMsg?.conversation || qMsg?.caption || '',
			};
			m.quoted.msg = extractMessageContent(qMsg[m.quoted.type]) || qMsg[m.quoted.type];
			m.quoted.device = getDevice(m.quoted.id)
			m.quoted.isBot = m.quoted.id ? ['HSK', 'BAE', 'B1E', '3EB0', 'B24E', 'WA'].some(a => m.quoted.id.startsWith(a) && [12, 16, 20, 22, 40].includes(m.quoted.id.length)) || /(.)\1{5,}|[^a-zA-Z0-9]|[^0-9A-F]/.test(m.quoted.id) : false
			m.quoted.fromMe = m.quoted.sender === voxel.decodeJid(voxel.user.id)
			m.quoted.mentionedJid = m.quoted?.msg?.contextInfo?.mentionedJid?.map(a => voxel.findJidByLid(a, store, true)) || []
			m.quoted.body = m.quoted.message?.conversation || m.quoted.msg?.text || m.quoted.msg?.conversation || m.quoted.msg?.caption || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || (m.quoted.type === 'interactiveResponseMessage' && m.quoted.message?.interactiveResponseMessage?.nativeFlowResponseMessage ? JSON.parse(m.quoted.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson || '{}')?.id : '') || (m.quoted.type === 'editedMessage' || m.quoted.type === 'protocolMessage' ? (m.quoted.message[m.quoted.type]?.editedMessage?.extendedTextMessage?.text || m.quoted.message[m.quoted.type]?.editedMessage?.conversation || '') : '') || m.quoted.msg?.contentText || m.quoted.msg?.title || m.quoted.msg?.name || '';
			m.getQuotedObj = async () => {
				if (!m.quoted.id) return null
				let q = await global.loadMessage(m.chat, m.quoted.id, voxel)
				if (q) {
					return await Serialize(voxel, q, store)
				} else {
					return null
				}
			}
			m.quoted.key = {
				remoteJid: m.msg?.contextInfo?.remoteJid || m.chat,
				participant: m.quoted.sender,
				fromMe: areJidsSameUser(voxel.decodeJid(m.msg?.contextInfo?.participant), voxel.decodeJid(voxel?.user?.id)),
				id: m.msg?.contextInfo?.stanzaId
			}
			m.quoted.isGroup = m.quoted.chat.endsWith('@g.us')
			m.quoted.mentions = m.quoted.msg?.contextInfo?.mentionedJid || []
			m.quoted.prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(m.quoted.body) ? m.quoted.body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : /[\uD800-\uDBFF][\uDC00-\uDFFF]/gi.test(m.quoted.body) ? m.quoted.body.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/gi)[0] : ''
			m.quoted.command = m.quoted.body && m.quoted.body.replace(m.quoted.prefix, '').trim().split(/ +/).shift()
			m.quoted.isMedia = !!m.quoted.msg?.mimetype || !!m.quoted.msg?.thumbnailDirectPath
			if (m.quoted.isMedia) {
				m.quoted.fileSha256 = m.quoted[m.quoted.type]?.fileSha256 || ''
				m.quoted.mime = m.quoted.msg?.mimetype
				m.quoted.size = m.quoted.msg?.fileLength
				m.quoted.height = m.quoted.msg?.height || ''
				m.quoted.width = m.quoted.msg?.width || ''
				if (/webp/i.test(m.quoted.mime)) {
					m.quoted.isAnimated = m?.quoted?.msg?.isAnimated || false
				}
			}
			m.quoted.fakeObj = () => ({
				key: {
					remoteJid: m.quoted.chat,
					fromMe: m.quoted.fromMe,
					id: m.quoted.id
				},
				message: m.quoted,
				...(m.isGroup ? { participant: m.quoted.sender } : {})
			});
			m.quoted.download = () => voxel.downloadMediaMessage(m.quoted)
			m.quoted.delete = () => {
				voxel.sendMessage(m.quoted.chat, {
					delete: {
						remoteJid: m.quoted.chat,
						fromMe: m.isBotAdmin ? false : true,
						id: m.quoted.id,
						participant: m.quoted.sender
					}
				})
			}
		}
	}
	
	m.download = () => voxel.downloadMediaMessage(m)
	
	m.copy = () => Serialize(voxel, JSON.parse(JSON.stringify(m)), store)
	
	m.react = (u) => voxel.sendMessage(m.chat, { react: { text: u, key: m.key }})
	
	m.reply = async (content, options = {}) => {
		const { quoted = m, chat = m.chat, caption = '', mentions = [], ephemeralExpiration = m.expiration || m?.metadata?.ephemeralDuration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0, ...validate } = options;
		const textBody = typeof content === 'string' ? content : (content.text || content.caption || '');
		const providedMentions = Array.isArray(mentions) ? mentions : [];
		const extractedMentions = [...textBody.matchAll(/@(\d{5,16})/g)].map(v => v[1] + '@s.whatsapp.net');
		const fixMentions = [...new Set([...providedMentions, ...extractedMentions])];
		if (typeof content === 'object') {
			return voxel.sendMessage(chat, content, { ...validate, quoted, ephemeralExpiration })
		} else if (typeof content === 'string') {
			try {
				if (/^https?:\/\//.test(content)) {
					const res = await axios.head(content).catch(() => null);
					const mime = res?.headers['content-type'] || '';
					if (/gif|image|video|audio|pdf|stream/i.test(mime)) {
						let type = /image/.test(mime) ? 'image' : /video/.test(mime) ? 'video' : /audio/.test(mime) ? 'audio' : 'document';
						return voxel.sendMessage(chat, { [type]: { url: content }, caption, mimetype: mime, ...validate }, { quoted, ephemeralExpiration })
					} else {
						return voxel.sendMessage(chat, { text: content, mentions: fixMentions, ...validate }, { quoted, ephemeralExpiration })
					}
				} else {
					return voxel.sendMessage(chat, { text: content, mentions: fixMentions, ...validate }, { quoted, ephemeralExpiration })
				}
			} catch (e) {
				return voxel.sendMessage(chat, { text: content, mentions: fixMentions, ...validate }, { quoted, ephemeralExpiration })
			}
		}
	}

	return m
}

export {
	GroupUpdate,
	GroupParticipantsUpdate,
	LoadDataBase,
	MessagesUpsert,
	Solving
};

// Reload Handler
const watcher = chokidar.watch(voxelPath, {
	ignored: /^\./,
	persistent: true,
	awaitWriteFinish: {
		stabilityThreshold: 100,
		pollInterval: 100
	}
});

watcher.on('change', async (filePath) => {
	console.log(chalk.yellowBright(`[UPDATE] ${filePath}`));
	await reloadHandler();
});