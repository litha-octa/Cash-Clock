# CashClock

Aplikasi **PWA** untuk freelancer — pencatatan waktu kerja, kalkulasi pendapatan otomatis, tracking target mingguan, dan manajemen kebutuhan dengan sistem kantong (seperti Bank Jago).

## Fitur

### Log Waktu Kerja
- Input manual: tanggal, deskripsi, durasi (`1:30` atau `1.5`), proyek
- Siklus mingguan (Senin–Minggu), reset setiap Minggu malam
- Edit & hapus log

### Kalkulasi Pendapatan
- **Pendapatan Kotor** = Total Jam × Rate per Jam
- **Potongan** = (Kotor × 10%) + $1
- **Pendapatan Bersih** = Kotor − Potongan
- Filter periode: Hari Ini, Minggu Ini, Semua
- Tampilan dual currency (USD + IDR)

### Pending & Balance
- Log minggu lalu menjadi **Pending Earning** selama 10 hari setelah cutoff
- Setelah 10 hari, masuk ke **Balance** (cleared)
- Saldo tersedia = Balance − total yang dialokasikan ke kantong

### Kantong Kebutuhan (seperti Bank Jago)
- Buat kantong dengan target (USD atau IDR)
- Isi saldo ke kantong dari balance
- Tarik saldo dari kantong
- Progress bar per kantong, otomatis terpenuhi saat saldo ≥ target
- Prioritas: Tinggi / Sedang / Rendah

### Target Mingguan
- Set target pendapatan bersih per minggu
- Progress bar dengan status: Belum mulai / Sedang berjalan / Target tercapai

### Pengaturan
- Rate per jam (USD)
- Nilai tukar USD → IDR
- Target mingguan

### PWA
- Installable (Add to Home Screen)
- Splash screen dengan animasi
- Offline support — semua data di localStorage
- Service worker (Workbox)

## Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand (persist → localStorage) |
| Build | Vite 8 |
| PWA | vite-plugin-pwa (Workbox) |
| Routing | React Router v7 |

## Menjalankan

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build production
npm run build

# Preview build
npm run preview
```

## Struktur Project

```
src/
├── components/
│   └── Layout.tsx          # Bottom nav + layout wrapper
├── pages/
│   ├── Dashboard.tsx       # Ringkasan, balance, pending, target
│   ├── LogPage.tsx         # CRUD log waktu + riwayat mingguan
│   ├── NeedsPage.tsx       # Kantong kebutuhan
│   └── Settings.tsx        # Rate, kurs, target
├── store.ts                # Zustand stores (localStorage persist)
├── types.ts                # TypeScript interfaces
├── utils.ts                # Kalkulasi, format, filter
├── sw.ts                   # Service worker
├── main.tsx                # Entry point + routing
└── index.css               # Tailwind import
```

## localStorage Keys

| Key | Isi |
|---|---|
| `logtime_entries` | Log waktu kerja |
| `logtime_rate` | Rate, currency, nilai tukar |
| `logtime_weekly_target` | Target mingguan |
| `logtime_needs` | Daftar kantong kebutuhan |
