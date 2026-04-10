# 📋 Spec: Freelance Time & Earning Tracker (PWA)

## Overview

Aplikasi **PWA** untuk freelancer yang memungkinkan pencatatan log waktu kerja secara manual, kalkulasi pendapatan otomatis berdasarkan hourly rate, tracking target mingguan, dan manajemen daftar kebutuhan finansial.

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | React + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand / React Context |
| Storage | localStorage (IndexedDB opsional untuk skala besar) |
| PWA | Vite PWA Plugin (`vite-plugin-pwa`) |
| Build | Vite |

---

## Core Features

### 1. Log Time (Manual Entry)

User dapat menambahkan log waktu kerja secara manual.

**Input fields:**
- `Date` — tanggal kerja (date picker)
- `Description` — deskripsi pekerjaan (text input)
- `Duration` — durasi dalam format `HH:MM` atau angka desimal (contoh: `1.5` = 1 jam 30 menit)
- `Project` *(opsional)* — nama proyek/klien

**Actions:**
- Tambah log baru
- Edit log yang sudah ada
- Hapus log

**Storage:** Semua log disimpan di localStorage dengan key `logtime_entries`.

---

### 2. Rate Configuration

User menentukan **hourly rate** yang digunakan sebagai dasar kalkulasi earning.

**Fields:**
- `Rate per hour` — angka dalam USD (contoh: `15.00`)
- `Currency` — default `USD`

**Storage:** Disimpan di localStorage key `logtime_rate`.

---

### 3. Earning Calculation

Kalkulasi dilakukan otomatis setiap kali log atau rate berubah.

#### Formula:

```
Total Hours     = Σ semua durasi log (dalam jam)
Gross Earning   = Total Hours × Rate per Hour
Deduction       = (Gross Earning × 10%) + $1
Net Earning     = Gross Earning - Deduction
```

#### Tampilan:

| Label | Nilai |
|---|---|
| Total Jam Kerja | `XX jam YY menit` |
| Pendapatan Kotor | `$XXX.XX` |
| Potongan (10% + $1) | `- $XX.XX` |
| **Pendapatan Bersih** | `$XXX.XX` |

> Kalkulasi bisa difilter berdasarkan **periode waktu**: hari ini, minggu ini, bulan ini, atau semua waktu.

---

### 4. Weekly Target

User dapat menetapkan **target pendapatan mingguan**.

**Fields:**
- `Weekly Target` — jumlah dalam USD (contoh: `200`)

**Tampilan:**
- Progress bar visual: `Net Earning minggu ini / Weekly Target`
- Label status:
  - 🔴 `Belum mulai` (0%)
  - 🟡 `Sedang berjalan` (1–99%)
  - 🟢 `Target tercapai!` (≥100%)
- Persentase pencapaian
- Sisa yang harus dicapai: `Target - Net Earning minggu ini`

**Storage:** Disimpan di localStorage key `logtime_weekly_target`.

---

### 5. Needs List (Daftar Kebutuhan)

User dapat membuat daftar kebutuhan/pengeluaran yang ingin dipenuhi dari pendapatan.

**Fields per item:**
- `Name` — nama kebutuhan (contoh: "Bayar kost", "Beli headset")
- `Amount` — nominal dalam USD
- `Priority` — `High / Medium / Low`
- `Status` — `Belum terpenuhi / Sudah terpenuhi`

**Actions:**
- Tambah kebutuhan baru
- Tandai sebagai sudah terpenuhi / belum
- Hapus item
- Edit item

**Summary:**
```
Total Kebutuhan   = Σ Amount semua item
Sudah Terpenuhi   = Σ Amount item yang sudah ditandai
Belum Terpenuhi   = Total - Sudah Terpenuhi
Selisih vs Net Earning = Net Earning (periode) - Total Kebutuhan
```

**Storage:** Disimpan di localStorage key `logtime_needs`.

---

## UI/UX Structure

### Pages / Views

```
/               → Dashboard (ringkasan earning, progress target, shortcut)
/log            → Log Time (list + form tambah/edit log)
/settings       → Pengaturan (rate, weekly target)
/needs          → Daftar Kebutuhan
```

### Dashboard Widgets

1. **Earning Summary Card** — Gross & Net Earning (periode: minggu ini)
2. **Weekly Target Progress** — progress bar + label status
3. **Quick Log Button** — shortcut tambah log baru
4. **Needs Overview** — total kebutuhan vs net earning
5. **Recent Logs** — 5 log terbaru

---

## PWA Configuration

### Requirements

- **Installable** di Android & iOS (Add to Home Screen)
- **Offline support** — semua data dari localStorage, tidak butuh koneksi
- **Service Worker** — cache aset statis (via Workbox)
- **Manifest** — icon, nama, warna tema

### `manifest.json` (minimal)

```json
{
  "name": "FreelanceTracker",
  "short_name": "FLTracker",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f0f0f",
  "theme_color": "#10b981",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### `vite.config.ts` snippet

```ts
import { VitePWA } from 'vite-plugin-pwa'

plugins: [
  VitePWA({
    registerType: 'autoUpdate',
    manifest: { /* ... */ },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg}']
    }
  })
]
```

---

## Data Models (TypeScript)

```ts
// Log entry
interface LogEntry {
  id: string              // uuid
  date: string            // ISO date: "2025-04-10"
  description: string
  durationHours: number   // desimal, contoh: 1.5
  project?: string
  createdAt: string       // ISO datetime
}

// Rate config
interface RateConfig {
  ratePerHour: number     // USD
  currency: string        // default "USD"
}

// Weekly target
interface WeeklyTarget {
  amount: number          // USD
}

// Needs item
interface NeedsItem {
  id: string
  name: string
  amount: number          // USD
  priority: 'high' | 'medium' | 'low'
  fulfilled: boolean
  createdAt: string
}
```

---

## Earning Logic (Pseudocode)

```ts
function calculateEarnings(logs: LogEntry[], rate: number, period: Period) {
  const filtered = filterByPeriod(logs, period)
  const totalHours = filtered.reduce((sum, log) => sum + log.durationHours, 0)
  const grossEarning = totalHours * rate
  const deduction = (grossEarning * 0.10) + 1
  const netEarning = grossEarning - deduction

  return { totalHours, grossEarning, deduction, netEarning }
}
```

---

## Filter Periode

Semua kalkulasi earning mendukung filter:

| Filter | Keterangan |
|---|---|
| `today` | Hari ini saja |
| `this_week` | Senin–Minggu minggu berjalan |
| `this_month` | Bulan berjalan |
| `all` | Semua data |

---

## localStorage Keys Summary

| Key | Tipe | Isi |
|---|---|---|
| `logtime_entries` | `LogEntry[]` | Semua log waktu |
| `logtime_rate` | `RateConfig` | Hourly rate & currency |
| `logtime_weekly_target` | `WeeklyTarget` | Target mingguan |
| `logtime_needs` | `NeedsItem[]` | Daftar kebutuhan |

---

## Out of Scope (v1)

- Sinkronisasi cloud / backend
- Multi-user / auth
- Export ke PDF/Excel *(bisa jadi v2)*
- Notifikasi push reminder *(bisa jadi v2)*
- Multi-currency conversion

---

## Future Enhancements (v2)

- Export laporan ke PDF/CSV
- Notifikasi reminder log harian
- Grafik tren pendapatan per minggu/bulan
- Integrasi dengan Upwork time tracker API
- Backup & restore data (JSON export/import)
