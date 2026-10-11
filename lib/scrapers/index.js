import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// Nama Asli = implementasi bawaan; yang diekspor di bawah dibungkus scrapr.
const { tiktokDl: tiktokDlAsli, tiktokv1, tiktokv2, tiktokv3 } = require('./tiktok.cjs')
const { igdl: igdlAsli } = require('./instagram.cjs')
const spotifydlAsli = require('./spotify.cjs')
const { threadsdl: threadsdlAsli } = require('./threads.cjs')
const mediafireAsli = require('./mediafire.cjs')
const { pinterest: pinterestAsli } = require('./pinterest.cjs')
const { wallpaperScraper, deviantartSearch, wallpaperFlareSearch } = require('./wallpaper.cjs')
const { generateIQC } = require('./iqc.cjs')
const RemoveBG = require('./removebg.cjs')
const { imgupscale } = require('./imgupscale.cjs')
const { videoenhancer } = require('./vidupscale.cjs')
const stickerPack = require('./stickerpack.cjs')
const { githubstalkFallback, facebookFallback } = require('./cantarella-fallback.cjs')
const { ffstalk, mlstalk, npmstalk, lyricsSearch, twitterdl: twitterdlAsli, nanoEdit, animeSearch } = require('./cantarella-new.cjs')

// --- @coflyn/scrapr: coba DULU, jatuh ke scraper bawaan kalau gagal ----------
// scrapr itu satu paket multi-backend (23 platform). Scraper bawaan di atas
// cuma satu backend per platform, jadi gampang mati. Jadi tiap fungsi di bawah
// dicoba pake scrapr dulu; kalau backend-nya mati / konten privat / kena
// rate-limit, otomatis balik ke implementasi bawaan yang sudah stabil.
//
// Cukup bungkus DI SINI (batas export), bukan di tiap call site -- jadi semua
// perintah di voxel.js dapet penggantian ini tanpa satu baris pun diubah di sana.
import * as scraprAdapter from '../scrapr.js'

// Bungkus: coba scrapr, kalau throw -> pakai asli, kalau dua-duanya gagal baru
// lempar error asli (pesan scraper biasanya lebih informatif untuk user).
const withScrapr = (scraprFn, asli) => async (...args) => {
	try {
		return await scraprFn(...args)
	} catch (e) {
		try {
			return await asli(...args)
		} catch (e2) {
			throw new Error(`${e.message} | ${e2.message}`)
		}
	}
}

export const tiktokDl = withScrapr(scraprAdapter.tiktokScrapr, tiktokDlAsli)
export const igdl = withScrapr(scraprAdapter.instagramScrapr, igdlAsli)
export const threadsdl = withScrapr(scraprAdapter.threadsScrapr, threadsdlAsli)
export const spotifydl = withScrapr(scraprAdapter.spotifyScrapr, spotifydlAsli)
export const twitterdl = withScrapr(scraprAdapter.twitterScrapr, twitterdlAsli)
export const pinterest = withScrapr(scraprAdapter.pinterestScrapr, pinterestAsli)
export const mediafire = withScrapr(scraprAdapter.mediafireScrapr, mediafireAsli)

// tiktokDl / igdl / spotifydl / threadsdl / mediafire / pinterest / twitterdl
// SENGAJA TIDAK ada di daftar ini -- semuanya sudah diekspor di atas dalam
// bentuk yang dibungkus scrapr (didelegasikan ulang di sinibakal error).
export {
  tiktokv1,
  tiktokv2,
  tiktokv3,
  wallpaperScraper,
  deviantartSearch,
  wallpaperFlareSearch,
  generateIQC,
  RemoveBG,
  imgupscale,
  videoenhancer,
  stickerPack,
  githubstalkFallback,
  facebookFallback,
  ffstalk,
  mlstalk,
  npmstalk,
  lyricsSearch,
  nanoEdit,
  animeSearch
}
