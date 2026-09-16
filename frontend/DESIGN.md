# SYLORA — Design System
**"Jelas untuk semua orang, bukan cuma orang crypto"** · v1.0 · kawaii-coffee theme

## 0. Prinsip: bahasa dulu, visual belakangan

SYLORA dipakai ibu-ibu bank sampah, siswa SMP, dan kader lingkungan — bukan dev web3.
**Aturan bahasa #1: tidak ada jargon crypto di UI.** Kalau harus menyebut konsep teknis, pakai padanan hariannya:

| Jangan tulis… | Tulis… | Kenapa |
|---|---|---|
| Wallet / MetaMask | **Dompet digital** | orang paham "dompet", bukan "extension" |
| Connect wallet | **Masuk dengan dompet digital** | verba aksi manusia |
| Mint / token issuance | **Poin dicetak** | mint = bahasa penambang |
| Burn | **Poin ditukar & hilang** (ikon 🔥 coret → pakai "terpakai") | burn terdengar rusak, padahal ditukar |
| Transaction / tx hash | **Catatan di buku besar internet** | fungsi, bukan mekanik |
| Smart contract | **Aturan otomatis yang tidak bisa diubah siapa pun** | ini janji produknya |
| Verify (verifier desk) | **Sahkan** / **Setujui** | formal-friendly, bisa di-terjemahkan guru |
| Pending / Verified / Rejected | **Menunggu diperiksa / Disahkan / Belum bisa diterima** | nada lembut, ada alasan |
| Streak | **Runtutan hari** (ikon 🔥 kecil) | streak = gamifikasi barat |
| Reward pool | **Celengan hadiah** | metafora yang dimengerti semua umur |
| Gas fee | **Biaya jaringan (±Rp200)** | orang perlu angka, bukan istilah |
| On-chain | **Tercatat permanen** | hasil, bukan cara |
| Redeem voucher | **Tukar jadi voucher** | verba yang sudah dikenal dari poin bank |
| Address 0x… | tetap `0x…` (mono, kecil) | jangan bohong; taruh di detail, bukan headline |

Aturan #2: **setiap angka diberi nama benda** ("Celengan: 999.800 poin", bukan "pool: 999800e18").
Aturan #3: **error = kalimat + jalan keluar**, bukan kode. "Belum bisa nih — aksi serupa sudah kamu catat kemarin. Coba lagi besok ya."

## 1. Token warna — "kawaii coffee"

Diambil dari rasa kedai kopi lucu: cream susu, matcha, sakura, gula aren. **Bukan** dark-mode crypto.

```css
:root{
  /* kanvas & tinta */
  --cream:      #FFF7EE;  /* background utama — hangat, seperti kertas menu */
  --paper:      #FFFFFF;  /* permukaan kartu */
  --cocoa:      #4A342A;  /* teks utama — bukan hitam pekat, lebih ramah */
  --latte:      #8C7466;  /* teks sekunder */
  --milkline:   #F0E4D6;  /* border lembut */

  /* karakter */
  --matcha:     #7CBF8E;  /* warna brand — hijau pastel, ketenangan */
  --matcha-deep:#3E7A52;  /* CTA, badge sukses, link */
  --matcha-foam:#E7F4E9;  /* isi badge/panel sukses */
  --sakura:     #F5B8C4;  /* aksen gembira, highlight hero, streak */
  --sakura-soft:#FDEBF0;
  --caramel:    #E8A54B;  /* menunggu / warning hangat (bukan merah alarm) */
  --caramel-soft:#FBF0DC;
  --azuki:      #C96A6A;  /* error/tolak — tetap lembut, tidak menghakimi */
  --azuki-soft: #F9E7E7;

  /* status = warna, konsisten di seluruh app */
  --s-wait: var(--caramel);  --s-ok: var(--matcha-deep);  --s-no: var(--azuki);
  --r:20px;                  /* radius besar & bulat = kawaii */
  --r-pill:999px;
}
```
Larangan: tanpa indigo/violet AI-default, tanpa gradient ungu crypto, tanpa hitam pekat.

## 2. Tipografi — bubbly tapi kebaca

- **Display/heading: `Baloo 2`** (700) — huruf bulat gendut, seperti logo kedai. Google Fonts.
- **Body: `Nunito`** — humanist rounded, sangat kebaca di HP orang tua.
- **Angka/kode: `Nunito` dengan `font-variant-numeric: tabular-nums`** untuk statistik; `0x…` pakai mono kecil (`IBM Plex Mono`, 11px, warna latte).
- Hierarki: hero 40/48 · section 26/32 · body 16/26 · label 13 caps tracking .08 · micro 12.
- Kalimat pendek. < 20 kata per baris. One idea per screen.

## 3. Komponen inti

- **Kartu `menu-card`** — putih, radius 20, border 1px `milkline`, shadow super lembut `0 8px 24px rgba(74,52,42,.06)`. Ini "kartu menu" kedai — wajar karena tiap aksi memang seperti memesan.
- **Tombol**: `pill btn-primary` matcha-deep, teks putih, tinggi 48px; `btn-soft` matcha-foam; `btn-ghost` border. Disabled = opacity .5 + tetap bulat. Semua tombol: **verba + objek** ("Catat aksi", "Tukar 50 poin").
- **Badge status**: pill + ikon titik, teks penuh (bukan cuma warna — buta warna aman). `Menunggu diperiksa` / `Disahkan ✓` / `Belum diterima`.
- **Maskot "Syl"**: cangkir matcha latte dengan tunas, mata titik, pipi sakura, uap hati. SVG inline — muncul di hero, empty state ("belum ada catatan"), dan success. Ekspresi berubah: senang (sukses), menahan uap (pending), simpati (ditolak). Maskot = tempat orang awam menaruh empati; jangan ganti dengan robot blockchain.
- **Strip angka "dapur hari ini"**: bilah lembut berisi Celengan / Aksi disahkan / Poin terpakai — seperti kapur tulis kedai, bukan ticker bursa.
- **Step card bernomor 1-2-3** di setiap alur; tidak pernah lebih dari 3 langkah.

## 4. Pola interaksi non-web3

1. **Sebelum connect**: semua button aksi memuncikan tooltip "Masuk dulu dengan dompet digital ya" — tidak ada state kosong misterius.
2. **Setiap aksi = 1 kalimat + 1 konfirmasi**: "Kita catat foto tanam mangrove kamu ke buku besar internet. Bisa ya?" → `Oke, catat!`. Tidak ada popup istilah gas/nonce.
3. **Loading**: maskot meniup uap + label manusiawi ("Lagi dicatat… ±15 detik"). Setelah selesai: "Sudah tercatat permanen ✓" (bukan "tx confirmed").
4. **Error**: kalimat + sebab + langkah berikutnya + emoji maskot simpati. Contoh cooldown: "Satu jenis aksi sehari satu kali ya — biar adil. Nanti jam 9 besok bisa lagi."
5. **Uang selalu ada angka rupiahnya** ("biaya jaringan ±Rp200"), koin selalu "poin".
6. **Mode demo** dijelaskan apa adanya: "Lihat-lihat dulu, belum sungguhan" — jujur, bukan tipuan.

## 5. Struktur halaman

- `index.html` = **landing** (wireframe kawaii-coffee-hero): nav → hero maskot → strip cara kerja 3 langkah → "menu" aksi → bukti/jaminan → tanya-jawab → CTA → footer.
- `app.html` = dapp (catat/sahkan/tukar). Memakai token + bahasa dokumen ini.
- Copy landing default **Bahasa Indonesia**; istilah teknis Inggris kecil (0x…, chain id) hanya di panel detail.

## 6. Checklist anti-slop & aksesibilitas

- ☐ Tanpa indigo/violet, tanpa dark-default, tanpa emoji standar jadi ikon UI (maskot SVG khusus, bukan 😀)
- ☐ Kontras teks ≥ 4.5:1 di atas cream (cocoa #4A342A = aman)
- ☐ Status tidak pernah cuma warna (selalu teks + ikon)
- ☐ Tap target ≥ 44px, radius besar tetap focus-visible ring 2px matcha-deep offset 2
- ☐ Heading hierarchy utuh, `label for=` semua input
- ☐ Test 360px: hero stack vertikal, strip jadi 2 kolom, tabel → kartu
