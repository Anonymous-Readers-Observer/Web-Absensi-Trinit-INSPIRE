# Absensi Digital SMA Trinitas Bandung

Aplikasi absensi sekolah berbasis GPS dengan akun siswa, orang tua, guru, wali kelas, guru BK, dan administrator. Frontend dan backend berjalan dalam satu aplikasi Node.js tanpa proses build.

## Status data saat ini

- Database aktif: `data/absensi.db`
- **Daftar siswa dan staf sekolah sengaja kosong** agar dapat diisi sendiri lewat menu admin.
- Data demo tidak dimuat ulang (`SEED_DEMO=false`).
- Hanya akun administrator yang tersisa. Akun guru, wali kelas, dan guru BK dapat dibuat kembali lewat menu Pengguna.
- Login administrator: `admin@test.local` / `Admin#12345`
  Ganti password ini sebelum server dibuka ke publik.

## Menjalankan di komputer lokal

Prasyarat: **Node.js 24 atau lebih baru**.

```bash
npm install
npm start
```

Buka `http://localhost:3100`.

Konfigurasi ada di `.env`. File tersebut tidak ikut ter-commit dan harus disertakan saat mengunggah ke server trial.

## Mengisi daftar siswa

Masuk sebagai administrator, lalu buka **Pengguna**.

- **Tambah akun** untuk satu siswa.
- **Impor siswa** untuk banyak siswa sekaligus.

Format impor:

```csv
Nama,Email,NIS,Kelas,Telepon,Password
Nama Siswa,siswa@student.trinitas.sch.id,262001,X-1,08123456789,Siswa#12345
```

Kolom `Telepon` dan `Password` boleh dikosongkan. Maksimal 150 siswa per impor. Password kosong akan dibuat otomatis oleh sistem dan dapat diunduh setelah impor.

Setelah siswa masuk, orang tua dapat membuat akun sendiri menggunakan NIS anak, atau admin dapat membuatkannya.

## Mengisi akun staf sekolah

Masuk sebagai administrator, buka **Pengguna → Tambah akun**, lalu pilih peran **Guru**, **Wali Kelas**, atau **Guru BK**. Wali kelas wajib diisi nama kelas yang diampu.

Staf juga dapat mendaftar sendiri melalui halaman **Daftar** menggunakan `STAFF_CODE` yang ada di `.env`. Setelah itu admin dapat menyesuaikan peran atau kelasnya.

## Peran dan akses

| Peran | Akses utama |
| --- | --- |
| `siswa` | Absen GPS, riwayat pribadi, notifikasi |
| `ortu` | Riwayat dan notifikasi anak |
| `guru`, `wali`, `bk` | Rekap, pembinaan, ekspor CSV |
| `admin` | Semua data, pengguna, pengaturan sekolah, audit |

Pendaftaran akun staf membutuhkan `STAFF_CODE` yang ada di `.env`.

## Privasi papan publik

Papan publik hanya menampilkan **nama, kelas, jam, dan status**. NIS, koordinat GPS, jarak, dan catatan staf hanya dapat diakses akun berwenang. Pembatasan dilakukan di server.

## Upload ke server trial

1. Gunakan VPS/server yang mendukung **Node.js 24**.
2. Salin seluruh folder proyek, termasuk `.env` dan `data/absensi.db`.
3. Jalankan `npm install --omit=dev`.
4. Sesuaikan `.env`:
   - `NODE_ENV=production`
   - `TRUST_PROXY=1` jika memakai Nginx/Caddy
   - `COOKIE_SECURE=true` setelah HTTPS aktif
   - `JWT_SECRET` diganti dengan string acak minimal 32 karakter
   - `ADMIN_PASSWORD` diganti
5. Jalankan `node server.js` lewat systemd/PM2 agar tetap hidup.
6. Pasang HTTPS. GPS browser hanya berfungsi di HTTPS, kecuali `localhost`.

Contoh konfigurasi tersedia di folder [`deploy/`](deploy/).

> Catatan: `ADMIN_PASSWORD` di `.env` hanya dipakai saat akun admin pertama kali dibuat. Jika database sudah berisi admin, ganti password melalui halaman **Akun Saya**.

## Perintah penting

```bash
npm start       # jalankan server
npm run dev     # jalankan dengan watch mode
npm test        # 18 tes integrasi API
npm run seed    # muat data demo (perlu SEED_DEMO=true dan database kosong)
```

## Backup

Database SQLite berada di `data/absensi.db`. Hentikan server sebelum menyalin file `.db`, atau gunakan fitur backup dari halaman admin. Simpan salinan di luar folder aplikasi.

## Struktur singkat

```text
server.js              Entry point
src/                   Backend Express, SQLite, autentikasi, API
public/                Frontend SPA (HTML, CSS, JavaScript)
data/                  Database SQLite
deploy/                Contoh konfigurasi Nginx, Caddy, dan systemd
tests/                 Tes integrasi API
```
