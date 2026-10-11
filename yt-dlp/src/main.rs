// Wrapper yt-dlp untuk bot WhatsApp.
//
// Dua masalah yang dipecah di sini (bukan "fitur"):
//
// 1. Resolusi. `-f bv*+ba/b` = "ambil yang terbaik", dan yang terbaik itu sering
//    4K/60fps VRR 700MB+ (terverifikasi: 679MiB buat trailer 1 menit). WhatsApp
//    gak bisa kirim itu, jadi VIDEO_CAP membatasi tinggi (default 720) -- bagian
//    video, audio gak dibatasi karena yang kecil.
//
// 2. Deteksi bot / age-restriction. Client default YouTube_now Youth web_"
//    sekarang diblokir buat sebagian video; age-restricted butuh auth. Wrapper
//    ini mencoba beberapa PLAYER_CLIENTS dan cookies (kalau ada) sampai satu
//    berhasil, jadi gak perlu hardcode satu client yang bisa basi besok.
//
// Pakai:   ytdlp-rs <url> [--audio] [--max <tinggi px>] [--out <path>]

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

// Tinggi maksimum video (px). 720 = batas aman WhatsApp; naikkan kalau mau 1080.
const DEFAULT_MAX_HEIGHT: u32 = 720;

// Percobaan pertama = client DEFAULT yt-dlp (dipakai `None`), karena itu yang
// paling sering jalan: yt-dlp sudah milih client terbaiknya sendiri.
//
// JANGAN hardcode `player_client`! Yang dicoba eksperimen:
//   - `android_vr` lolos dari "Sign in to confirm you're not a bot" saat
//     metadata, TAPI download-nya 403: formatnya butuh GVS PO Token
//     ("android_vr client https formats require a GVS PO Token").
//   - `web`/`web_embedded`/`tv` kena bot-check.
// Jadi memaksa client = bikin masalah, bukan ngatasin. `None` dulu, fallback
// ke `web_embedded` cuma sebagai upaya terakhir.
const PLAYER_CLIENTS: &[Option<&str>] = &[None, Some("web_embedded"), Some("ios")];

// Ditempel otomatis kalau ada -- dipakai buat video age-restricted / yang
// nge-detek bot.
//
// PENTING: binary ini selalu dijalankan dengan `cwd` = folder kerja per job
// (supaya file unduhan gak numpuk di root project). Makanya path RELATIF di
// bawah ini nyaris gak pernah ketemu -- working directory bukan folder project.
// Env YTDLP_COOKIES (path ABSOLUT) dicek DULU supaya caller yang tahu lokasi
// folder project bisa menunjuk langsung. Baru kalau kosong, dicoba kandidat
// lama sebagai jaring pengaman.
const COOKIE_CANDIDATES: &[&str] = &[
    "cookies.txt",
    "/sdcard/Download/cookies.txt",
    "./cookies/cookies.txt",
];

struct Opts {
    url: String,
    audio_only: bool,
    max_height: u32,
    out: String,
}

fn parse_opts() -> Result<Opts, String> {
    let mut it = std::env::args().skip(1);
    let mut url = None;
    let mut audio_only = false;
    let mut max_height = DEFAULT_MAX_HEIGHT;
    let mut out = String::from("downloads/%(title).80s.%(ext)s");

    while let Some(a) = it.next() {
        match a.as_str() {
            "--audio" | "-x" => audio_only = true,
            "--max" => {
                max_height = it
                    .next()
                    .ok_or("--max butuh angka (mis. --max 1080)")?
                    .parse()
                    .map_err(|_| "--max bukan angka")?
            }
            "--out" | "-o" => {
                out = it.next().ok_or("--out butuh path")?;
            }
            "--help" | "-h" => {
                println!(
                    "yt-dlp-rs <url> [--audio] [--max <px>] [--out <template>]\n\
                     maks tinggi default {DEFAULT_MAX_HEIGHT}px"
                );
                std::process::exit(0);
            }
            u if u.starts_with('-') => return Err(format!("opsi tak dikenal: {u}")),
            u => url = Some(u.to_string()),
        }
    }
    Ok(Opts {
        url: url.ok_or("url wajib diisi")?,
        audio_only,
        max_height,
        out,
    })
}

/// Template `-o`: judul 80 char biar nama file gak lewat batas filesystem.
fn out_template(opts: &Opts) -> String {
    if opts.audio_only {
        "downloads/%(title).80s.%(ext)s".into()
    } else {
        opts.out.clone()
    }
}

fn find_cookies() -> Option<PathBuf> {
    // 1) Env wins: caller yang tau folder project tinggal kirim path absolut.
    //    Path relatif di env juga diteruskan apa adanya (dipakai bersama cwd).
    if let Ok(p) = std::env::var("YTDLP_COOKIES") {
        let p = p.trim();
        if !p.is_empty() {
            let pb = PathBuf::from(p);
            if pb.exists() {
                return Some(pb);
            }
            eprintln!("[yt-dlp] YTDLP_COOKIES diset tapi file-nya gak ada: {}", p);
        }
    }
    // 2) Kandidat lama. Path relatif cuma kepakai kalau cwd memang project root.
    COOKIE_CANDIDATES
        .iter()
        .map(Path::new)
        .find(|p| p.exists())
        .map(|p| p.to_path_buf())
}

/// Flag inti. `-f` dibatasi tinggi supaya gak kena file 700MB.
fn base_args(opts: &Opts) -> Vec<String> {
    let fmt = if opts.audio_only {
        "ba[ext=m4a]/b".to_string()
    } else {
        // `vcodec^=avc1` (h264) DIPERTAHANKAN DI PALING DEPAN, bukan sekadar
        // "ambil mp4 yg ada": hasil yt-dlp default untuk 720p sering AV1/VP9,
        // dan WhatsApp gak bisa play itu. Kalau force h264 di sini, yt-dlp
        // langsung pilih stream h264 => TIDAK ada re-encode ffmpeg sama sekali
        // (re-encode AV1 10 menit film = 10 menit CPU, gak layak buat bot chat).
        // Rantai di bawahnya tetap jadi cadangan buat video yg gak punya h264.
        format!(
            "bv*[height<={h}][vcodec^=avc1]+ba[ext=m4a]/bv*[height<={h}]+ba/b[height<={h}][vcodec^=avc1]/b[height<={h}]",
            h = opts.max_height
        )
    };
    vec![
        "-f".into(),
        fmt,
        "--no-playlist".into(),
        "--no-warnings".into(),
        "--newline".into(),
        "--retries".into(),
        "3".into(),
        // .part dibiarin (tanpa --no-part) supaya download yg kepotong bisa
        // di-resume; bot sering mati mendadak karena koneksi HP.
        "-o".into(),
        out_template(opts),
    ]
}

fn run(ytdlp: &Path, args: &[String]) -> std::io::Result<bool> {
    let st = Command::new(ytdlp)
        .args(args)
        .stdout(Stdio::null()) // progress yt-dlp polluting stdout; yang kita butuh cuma exit code
        .status()?;
    Ok(st.success())
}

/// Salah satu percobaan. True = sukses. `client: None` = pakai default yt-dlp.
fn try_client(ytdlp: &Path, opts: &Opts, client: Option<&str>, cookies: Option<&Path>) -> bool {
    let mut args = base_args(opts);
    if opts.audio_only {
        args.push("--extract-audio".into());
        args.push("--audio-format".into());
        args.push("mp3".into());
    }
    args.push("--merge-output-format".into());
    args.push("mp4".into());
    if let Some(c) = client {
        args.push("--extractor-args".into());
        args.push(format!("youtube:player_client={c}"));
    }
    if let Some(c) = cookies {
        args.push("--cookies".into());
        args.push(c.display().to_string());
    }
    args.push(opts.url.clone());
    matches!(run(ytdlp, &args), Ok(true))
}

fn download(ytdlp: &Path, opts: &Opts) -> Result<PathBuf, String> {
    let cookies = find_cookies();
    let mut last = String::from("gagal, sebab tidak diketahui");

    for &client in PLAYER_CLIENTS {
        match try_client(ytdlp, opts, client, cookies.as_deref()) {
            true => {
                let file = newest_output();
                return file.ok_or_else(|| {
                    "yt-dlp sukses tapi file hasil nggak ketemu -- cek filter -o".to_string()
                });
            }
            false => last = format!("gagal di client {}", client.unwrap_or("default")),
        }
    }
    // Semua percobaan kena blok. Kalau cookies ada, ini hampir pasti video yang
    // butuh login: pesan aslinya jauh lebih berguna.
    //
    // PENTING: jangan sebut "age-restricted" di sini. Pemanggil (command .video)
    // classifies error dari teks stderr, dan kata "age-restricted" di sini bikin
    // SETIAP kegagalan (video mati, private, dll) ketuker jadi "butuh login".
    Err(format!(
        "semua player_client ditolak ({last}). {hint}",
        hint = cookies.as_ref().map(|_| "cookies.txt ada tapi belum cukup -- mungkin kadaluarsa.")
            .unwrap_or_else(|| "Kalau videonya butuh login, taruh cookies.txt hasil export browser di root project.")
    ))
}

/// File terbaru di folder output -- hasil `-o` sudah unik per judul, jadi ini
/// cara paling murah tanpa parsing output yt-dlp.
fn newest_output() -> Option<PathBuf> {
    let dir = Path::new("downloads");
    let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
    for e in std::fs::read_dir(dir).ok()? {
        let e = e.ok()?;
        let p = e.path();
        // Lewati file sementara & thumbnail.
        let n = p.file_name()?.to_string_lossy().to_lowercase();
        if n.ends_with(".part") || n.ends_with(".ytdl") || n.ends_with(".webp") || n.ends_with(".temp") {
            continue;
        }
        let t = e.metadata().ok()?.modified().ok()?;
        if best.as_ref().is_none_or(|(bt, _)| t > *bt) {
            best = Some((t, p));
        }
    }
    best.map(|(_, p)| p)
}

fn main() {
    let opts = match parse_opts() {
        Ok(o) => o,
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(2);
        }
    };

    // yt-dlp di sebelah binary ini kalau ada, kalau bukan andalkan PATH.
    let ytdlp = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("yt-dlp")))
        .filter(|p| p.exists())
        .unwrap_or_else(|| PathBuf::from("yt-dlp"));

    if let Err(e) = download(&ytdlp, &opts) {
        eprintln!("error: {e}");
        std::process::exit(1);
    }
    println!("{}", newest_output().unwrap_or_default().display());
}