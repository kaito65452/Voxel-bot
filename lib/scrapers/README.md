# Voxel Scrapers

This directory contains selected scraper/downloader functionality ported from Alya-MD V12 and restructured for Voxel's ESM architecture.

## Ported modules

- `tiktok.cjs` — Alya multi-source TikTok downloader (`TikWM -> SaveTik -> SaveTT`) with Voxel-safe request handling.
- `instagram.cjs` — InDown -> SnapSave fallback.
- `spotify.cjs` — SpotMate metadata + conversion flow.
- `pinterest.cjs` — Pinterest GraphQL pin resolver.
- `threads.cjs` — sssthreads resolver.
- `mediafire.cjs` — MediaFire direct-link resolver.
- `wallpaper.cjs` — WallpaperFlare search.

## Voxel command mapping

- `.tiktok`, `.ttdl`, `.tt` -> new Alya-port TikTok resolver
- `.ig`, `.igdl`, `.instagram` -> new Alya-port Instagram resolver
- `.spotifydl` -> new Alya-port Spotify downloader
- `.pindl` -> new Pinterest downloader
- `.threads` -> new Threads downloader
- `.mediafire`, `.mfdl` -> MediaFire downloader
- `.wallpaper`, `.wallpaperflare` -> WallpaperFlare search

The command layer remains Voxel-native: `m.reply`, `voxel.sendAlbumMessage`, Voxel limits/database and the `@sairidev/baileys-new` socket are not replaced by Alya's socket layer.

Do not port Alya's unrelated credentials, owner data, databases, startup logic, or obfuscated bot handler into Voxel.
