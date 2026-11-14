# 🌿 Benteng Ekologis Taman Nasional Gunung Leuser (2019–2025)

**WebGIS StoryMap Interaktif — Evaluasi Efektivitas Kawasan Ekosistem Leuser sebagai Benteng Penyerapan Karbon dan Penyangga Perubahan Iklim Mikro Lokal**

[![Live Demo](https://img.shields.io/badge/Live_StoryMap-GitHub_Pages-15803d?style=for-the-badge&logo=github)](https://rrdaks23.github.io/Storyarcmap_HAKA_Aceh_Tim/)
[![Tim Penyusun](https://img.shields.io/badge/Tim-TIM_Hard_Ground_Solid-d97706?style=for-the-badge)](#identitas-tim)
[![Platform](https://img.shields.io/badge/Geospatial-Google_Earth_Engine_%7C_Leaflet.js-0f4c3a?style=for-the-badge)](#arsitektur-teknis)

---

## 👥 Identitas Tim & Mitra

* **Tim Penyusun:** **TIM Hard Ground Solid**
* **Muhammad Luthfan Nabil & Harun Al Rasyid**
* **Kemitraan & Kolaborasi:** Universitas & **HAKA Aceh** (Hutan, Alam dan Lingkungan Aceh)
* **Tautan Publikasi WebGIS:** [https://rrdaks23.github.io/Storyarcmap_HAKA_Aceh_Tim/](https://rrdaks23.github.io/Storyarcmap_HAKA_Aceh_Tim/)

---

## 📖 Ringkasan Kajian

Aplikasi **WebGIS StoryMap** ini memvisualisasikan hasil evaluasi ilmiah dan spasial mengenai peran **Taman Nasional Gunung Leuser (TNGL)** sebagai benteng alami penyerapan karbon dan penyangga perubahan iklim mikro pada periode **2019–2025**. Kajian membandingkan kawasan konservasi inti TNGL (**830.268,95 Ha** berdasarkan penetapan kawasan hutan 2014) terhadap lanskap non-hutan di zona penyangga eksternal radius **100 km** di dalam bentang **Kawasan Ekosistem Leuser (±2,28 juta Ha)**.

### Sorotan Temuan Utama (2019–2025)

| Indikator Biofisik & Spasial | Dalam Inti TNGL | Zona Luar Buffer (100 km) | Selisih & Keterangan Ilmiah |
| :--- | :---: | :---: | :--- |
| **Cadangan Karbon (`Carbon_Stock`)** | **64,48 Ton/Ha** | 57,10 Ton/Ha | **+7,38 Ton/Ha (+12,9%)** • $t = 11,7848$; $p = 4,07 \times 10^{-29}$ |
| **Suhu Permukaan (`LST`)** | **22,61 °C** | 27,90 °C | **−5,29 °C** • $t = -19,5547$; $p = 5,14 \times 10^{-70}$ (dipengaruhi gradien *lapse rate* ±6,5 °C/km) |
| **Indeks Terbangun (`NDBI`)** | **−0,2080** | −0,1807 | **−0,0273** • Fase awal tekanan konversi lahan di zona penyangga |
| **Neraca Karbon Regional** | — | — | Defisit karbon **51,4%** (3,60 jt Ha) melampaui surplus **48,6%** (3,41 jt Ha) |
| **Dinamika Termal Regional** | — | — | Pendinginan **56,9%** (7,81 jt Ha) vs. Pemanasan **43,1%** (5,92 jt Ha) |
| **Kehilangan Hutan Total** | — | — | **31.745,90 Ha** (±4.500–5.300 Ha/tahun pada 2019–2025) |

> **Sintesis Evaluasi:** Kawasan inti TNGL terbukti konsisten berfungsi sebagai penyangga karbon dan iklim mikro, namun predikat *"benteng"* lebih tepat disematkan pada kawasan intinya dibandingkan bentang lahan penyangga 100 km di sekitarnya yang mengalami tekanan defisit karbon, pemanasan permukaan, dan deforestasi yang berdampak langsung pada **±690.000 jiwa** masyarakat sekitar.

---

## 🛰️ Metodologi & Arsitektur Teknis

1. **Integrasi Penginderaan Jauh Multi-Sensor (Google Earth Engine):**
   * **Optik & Tutupan Lahan:** Sentinel-2 SR Harmonized + Cloud Score+ (`cs_cdf ≥ 0,5`).
   * **Termal & Kawasan Terbangun:** Landsat 8/9 Collection 2 Level 2 (`LST`, `UHI`, `UTFVI`, `NDBI`).
   * **Radar Apertur Sintetis (SAR):** Sentinel-1 GRD Mode IW polarisasi `VH` lintasan tunggal `DESCENDING` untuk menembus awan dan meminimalkan distorsi lereng pegunungan.
   * **Topografi, Cahaya Malam & LiDAR:** NASADEM (30 m), NOAA VIIRS DNB, dan referensi biomassa independen **NASA GEDI L4B**.
2. **Ekonometrika Spasial & Pemodelan AI:**
   * **Uji Komparatif:** *Welch’s Independent Two-Sample T-Test* (`equal_var = False`) pada 1.500 sampel dalam inti vs. 1.500 sampel luar buffer.
   * **Regresi Spasial OLS:** Pemodelan faktor pengendali LST menggunakan 8 variabel fisik non-kolinear ($\text{VIF} < 5$, $R^2 = 0,3871$).
   * **Machine Learning:** *Random Forest Regressor* (200 pohon) terkalibrasi LiDAR NASA GEDI L4B ($R^2 = 0,9994$; $\text{RMSE} = 1,5876\text{ Ton/Ha}$).
   * **Deep Learning:** *Long Short-Term Memory (LSTM)* 8-fitur spatio-temporal pada 28 langkah waktu kuartalan (Q1 2019 – Q4 2025).
3. **Arsitektur WebGIS & Sinkronisasi Cloud:**
   * **Frontend:** HTML5, CSS3 (*Editorial Warm Ivory & Deep Forest Emerald*), Leaflet.js, dan Chart.js dengan fitur *lightbox zoom*.
   * **Backend GeoJSON API:** Google Apps Script Web App (`Code.gs`) yang memindai secara rekursif 7 subfolder data spasial (`EPSG:4326`) di dalam folder Google Drive **`Geojson lomba`**.

---

## 📂 Struktur Repositori & Data Google Drive

### Susunan Berkas GitHub (`main`)

```text
Storyarcmap_HAKA_Aceh_Tim/
├── .nojekyll               # Menonaktifkan pemrosesan Jekyll pada GitHub Pages
├── index.html              # Struktur utama StoryMap (Sampul, 7 Bab Analisis, Peta & Grafik)
├── style.css               # Tata letak split-screen, tema editorial terang, & animasi interaktif
├── app.js                  # Mesin peta Leaflet, pemuat GeoJSON Drive API, & grafik Chart.js
├── README.md               # Dokumentasi proyek
└── assets/
    ├── logo-univ.png       # Logo Universitas
    └── logo-haka.png       # Logo HAKA Aceh
```

### Struktur Direktori GeoJSON di Google Drive (`Geojson lomba/`)

```text
Geojson lomba/
├── 01_Batas_Dan_Data_Pendukung/
├── 02_Tutupan_Hutan_Dan_Permukiman/
├── 03_Parameter_2019/
├── 04_Parameter_2021/
├── 05_Parameter_2025/
├── 06_Delta_Perubahan_2019_2025/
└── 07_Titik_Sampel_Dan_Ringkasan/
```

---

*Dikembangkan oleh **TIM Hard Ground Solid** dalam kolaborasi dengan **HAKA Aceh** untuk mendukung pemantauan konservasi berbasis bukti di Kawasan Ekosistem Leuser.*
