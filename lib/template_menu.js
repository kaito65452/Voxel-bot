import '../settings.js';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thumbnail dipakai bareng buat semua tipe menu (button/list/document), sumbernya
// src/media/me.jpg. Dibaca sekali & di-cache di module-level -- bukan dibaca ulang
// tiap kali menu ditampilkan.
//
// PENTING: file src/media/me.jpg BAWAAN masih 0 byte (placeholder kosong dari
// template). Kalau masih kosong/belum diganti user, JANGAN kirim buffer kosong
// itu ke WhatsApp (bakal gagal/dianggap gambar rusak) -- mendingan menu tetap
// tampil tanpa thumbnail daripada bikin command crash.
function loadMenuThumbnail() {
	try {
		const thumbPath = path.join(__dirname, '..', 'src', 'media', 'me.jpg');
		const buf = fs.readFileSync(thumbPath);
		if (!buf || buf.length === 0) {
			console.log(chalk.yellowBright('[MENU] src/media/me.jpg masih kosong (0 byte) -- menu ditampilkan tanpa thumbnail. Ganti file itu dengan gambar asli kalau mau ada thumbnail.'));
			return null;
		}
		return buf;
	} catch (e) {
		console.log(chalk.yellowBright(`[MENU] Gagal baca src/media/me.jpg (${e.message}) -- menu ditampilkan tanpa thumbnail.`));
		return null;
	}
}

const menuThumbnail = loadMenuThumbnail();

async function setTemplateMenu(voxel, type, m, prefix, setv, db, options = {}) {
	let total = Object.entries(db.hit).sort((a, b) => b[1] - a[1]).slice(0, Math.min(7, Object.keys(db.hit).length)).filter(([command]) => command !== 'totalcmd' && command !== 'todaycmd').slice(0, 5);
	
	let text = `╭──❍「 *TOP MENU* 」❍\n`
	
	if (total && total.length >= 5) {
		total.forEach(([command, hit], index) => {
			text += `│${setv} ${prefix}${command}: ${hit} hits\n`
		})
		text += '╰──────❍'
	} else text += `│${setv} ${prefix}ai
│${setv} ${prefix}brat
│${setv} ${prefix}tiktok
│${setv} ${prefix}susunkata
╰──────❍`

	// type 1 & 2 dipindah dari voxel.sendButtonMsg (format buttonsMessage lama + nativeFlowInfo
	// JSON manual, sudah deprecated di WA) ke format buttons/sections bawaan @sairidev/baileys-new
	// (native flow) lewat voxel.sendMessage biasa.
	if (type == 1 || type == 'buttonMessage') {
		const caption = `Halo @${m.sender.split('@')[0]}\n` + text;
		await voxel.sendMessage(m.chat, {
			...(menuThumbnail ? { image: menuThumbnail, caption } : { text: caption }),
			footer: options.ucapanWaktu,
			mentions: [m.sender],
			buttons: [{
				text: 'All Menu',
				id: `${prefix}allmenu`
			}, {
				text: 'SC',
				id: `${prefix}sc`
			}]
		}, { quoted: m })
	} else if (type == 2 || type == 'listMessage') {
		const caption = `Halo @${m.sender.split('@')[0]}\n` + text;
		await voxel.sendMessage(m.chat, {
			...(menuThumbnail ? { image: menuThumbnail, caption } : { text: caption }),
			footer: options.ucapanWaktu,
			mentions: [m.sender],
			buttons: [{
				text: 'All Menu',
				id: `${prefix}allmenu`
			}, {
				text: 'SC',
				id: `${prefix}sc`
			}, {
				text: 'List',
				sections: [{
					title: 'List Menu',
					rows: [{
						title: 'All Menu',
						id: `${prefix}allmenu`
					}, {
						title: 'Bot Menu',
						id: `${prefix}botmenu`
					}, {
						title: 'Group Menu',
						id: `${prefix}groupmenu`
					}, {
						title: 'Search Menu',
						id: `${prefix}searchmenu`
					}, {
						title: 'Download Menu',
						id: `${prefix}downloadmenu`
					}, {
						title: 'Quotes Menu',
						id: `${prefix}quotesmenu`
					}, {
						title: 'Tools Menu',
						id: `${prefix}toolsmenu`
					}, {
						title: 'Ai Menu',
						id: `${prefix}aimenu`
					}, {
						title: 'Stalker Menu',
						id: `${prefix}stalkermenu`
					}, {
						title: 'Random Menu',
						id: `${prefix}randommenu`
					}, {
						title: 'Anime Menu',
						id: `${prefix}animemenu`
					}, {
						title: 'Game Menu',
						id: `${prefix}gamemenu`
					}, {
						title: 'Fun Menu',
						id: `${prefix}funmenu`
					}, {
						title: 'Owner Menu',
						id: `${prefix}ownermenu`
					}]
				}]
			}]
		}, { quoted: m })
	} else if (type == 3 || type == 'documentMessage') {
		const menunya = `
╭──❍「 *USER INFO* 」❍
├ *Nama* : ${m.pushName ? m.pushName : 'Tanpa Nama'}
├ *Id* : @${m.sender.split('@')[0]}
├ *User* : ${options.isVip ? 'VIP' : options.isPremium ? 'PREMIUM' : 'FREE'}
├ *Limit* : ${options.isVip ? 'VIP' : db.users[m.sender].limit }
├ *Uang* : ${db.users[m.sender] ? db.users[m.sender].money.toLocaleString('id-ID') : '0'}
╰─┬────❍
╭─┴─❍「 *BOT INFO* 」❍
├ *Nama Bot* : ${db?.set?.[options.botNumber]?.botname || 'Voxel Bot'}
├ *Powered* : @${'0@s.whatsapp.net'.split('@')[0]}
├ *Owner* : @${owner[0].split('@')[0]}
├ *Mode* : ${voxel.public ? 'Public' : 'Self'}
├ *Prefix* :${db.set[options.botNumber].multiprefix ? '「 MULTI-PREFIX 」' : ' *'+prefix+'*' }
╰─┬────❍
╭─┴─❍「 *ABOUT* 」❍
├ *Date* : ${options.date}
├ *Day* : ${options.locale_day}
├ *Time* : ${options.date_time}
╰──────❍\n`
		await m.reply({
			text: menunya + text,
			title: options.author,
			description: options.packname,
			...(menuThumbnail ? { thumbnail: menuThumbnail } : {}),
			sourceUrl: my.gh,
			mentions: [m.sender, '0@s.whatsapp.net', owner[0] + '@s.whatsapp.net'],
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
	} else if (type == 4 || type == 'videoMessage') {
		//tambahin sendiri :v
	} else {
		m.reply(`${options.ucapanWaktu} @${m.sender.split('@')[0]}\nSilahkan Gunakan ${prefix}allmenu\nUntuk Melihat Semua Menunya`)
	}
}

export default setTemplateMenu;

fs.watchFile(__filename, async () => {
	fs.unwatchFile(__filename)
	console.log(chalk.yellowBright(`[UPDATE] ${__filename}`))
	await import(`${import.meta.url}?update=${Date.now()}`)
});