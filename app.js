// ============================================================================
// 1. KONFIGURASI DATA LOKAL (GitHub Pages)
// ============================================================================
// Struktur folder di repo:  data/<nama_folder>/<nama_file>.geojson
// Nama folder & file harus PERSIS seperti di DATA_SPECS (huruf besar-kecil berpengaruh).
const DATA_BASE = 'data';
const FETCH_TIMEOUT_MS = 45000;   // batas waktu tiap unduhan

// CADANGAN OPSIONAL: Google Drive. Dipakai HANYA jika file lokal di data/ tidak ditemukan.
// Kosongkan kedua nilai ('') untuk menonaktifkannya. Kegagalan Drive tidak pernah menampilkan error ke pengunjung.
// PENTING: batasi API key di Google Cloud (HTTP referrer github.io + Drive API saja).
const DRIVE_FOLDER_ID = '1cShz78J7EnXJ8tngWHnU2W7dzcO7uuPc';
const DRIVE_API_KEY   = 'AIzaSyCsL4Gs00TIkvItUOhFp2mCmOkhdgPN4Ak';

// ============================================================================
// 2. INISIALISASI PETA LEAFLET CANVAS & 100% BASEMAP RESMI ESRI
// ============================================================================
// Pelindung awal: Leaflet harus termuat sebelum peta dibuat
const $ = (id) => document.getElementById(id);
if (typeof L === 'undefined') {
  const mapEl = $('map');
  if (mapEl) mapEl.innerHTML = '<p style="padding:24px;font:14px sans-serif">Pustaka peta (Leaflet) gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.</p>';
  throw new Error('Leaflet tidak termuat');
}
// Error tak terduga hanya dicatat di console, tidak menghentikan halaman
window.addEventListener('unhandledrejection', (e) => { console.error('[Unhandled]', e.reason); e.preventDefault(); });
window.addEventListener('error', (e) => console.error('[Error]', e.message));

const map = L.map('map', {
  center: [3.55, 97.45],
  zoom: 8,
  zoomControl: true,
  preferCanvas: true // Merender poligon besar pada HTML5 Canvas agar ringan di browser
});

// Pane khusus label: di atas data, tapi tidak menangkap klik
map.createPane('labels');
map.getPane('labels').style.zIndex = 650;
map.getPane('labels').style.pointerEvents = 'none';

// Basemap Utama: Esri World Gray Canvas (Terang Editorial + Label Wilayah)
const esriGrayBase = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 16, attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ' }
);
const esriGrayRef = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 16, pane: 'labels' }
);
const esriCanvasTerang = L.layerGroup([esriGrayBase, esriGrayRef]).addTo(map);

// Basemap Alternatif 2: Esri World Topo Map
const esriTopo = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 18, attribution: 'Tiles &copy; Esri &mdash; Esri, Garmin, USGS, NPS' }
);

// Basemap Alternatif 3: Esri World Imagery (Citra Satelit)
const esriSat = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 18, attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics' }
);

// Basemap Alternatif 4: Esri National Geographic World Map
const esriNatGeo = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 16, attribution: 'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme' }
);

// Basemap Cadangan: OpenStreetMap (otomatis dipakai bila tile Esri gagal total dimuat)
const osmCadangan = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18, attribution: '&copy; OpenStreetMap contributors'
});
let tilesLoaded = 0, tilesFailed = 0;
esriGrayBase.on('tileload', () => { tilesLoaded++; });
esriGrayBase.on('tileerror', () => {
  tilesFailed++;
  if (tilesLoaded === 0 && tilesFailed === 8 && map.hasLayer(esriCanvasTerang)) {
    map.removeLayer(esriCanvasTerang);
    osmCadangan.addTo(map);
  }
});

const layerControl = L.control.layers(
  {
    'Esri Canvas Terang (Utama)': esriCanvasTerang,
    'Esri Topografi Leuser': esriTopo,
    'Esri Citra Satelit': esriSat,
    'Esri NatGeo Map': esriNatGeo,
    'OpenStreetMap (cadangan)': osmCadangan
  },
  {},
  { collapsed: true }
).addTo(map);

// ============================================================================
// 3. PEMETAAN FILE DATA (data/<folder>/<file>)
// ============================================================================
const paramFolder = (yr) => (yr === '2019' ? '03_Parameter_2019' : yr === '2021' ? '04_Parameter_2021' : '05_Parameter_2025');

const DATA_SPECS = {
  // Folder 01: Batas & Data Pendukung
  batas_tngl: { folder: '01_Batas_Dan_Data_Pendukung', file: '01_Batas_Kawasan_Inti_TNGL.geojson' },
  buffer_luar: { folder: '01_Batas_Dan_Data_Pendukung', file: '02_Zona_Buffer_100km_Luar_TNGL.geojson' },
  elevasi: { folder: '01_Batas_Dan_Data_Pendukung', file: '06_Klasifikasi_Elevasi_DEM.geojson' },
  lereng: { folder: '01_Batas_Dan_Data_Pendukung', file: '07_Klasifikasi_Kemiringan_Lereng.geojson' },
  zonasi_jarak: { folder: '01_Batas_Dan_Data_Pendukung', file: '10_Klasifikasi_Zonasi_Jarak_TNGL.geojson' },

  // Folder 02: Tutupan Hutan & Permukiman
  dinamika_hutan: { folder: '02_Tutupan_Hutan_Dan_Permukiman', file: '02_Dinamika_Perubahan_Hutan_2019_2025.geojson' },
  status_hutan: (yr) => ({ folder: '02_Tutupan_Hutan_Dan_Permukiman', file: `01_Status_Tutupan_Hutan_${yr}.geojson`, year: yr }),

  // Folder 03, 04, 05: Parameter Biofisik Multi-Tahun (2019, 2021, 2025)
  carbon_stock: (yr) => ({ folder: paramFolder(yr), file: `01_Cadangan_Karbon_${yr}.geojson`, year: yr }),
  agb: (yr) => ({ folder: paramFolder(yr), file: `02_Biomassa_AGB_${yr}.geojson`, year: yr }),
  lst: (yr) => ({ folder: paramFolder(yr), file: `03_Suhu_Permukaan_LST_${yr}.geojson`, year: yr }),
  uhi: (yr) => ({ folder: paramFolder(yr), file: `04_Pulau_Bahang_UHI_${yr}.geojson`, year: yr }),
  utfvi: (yr) => ({ folder: paramFolder(yr), file: `05_Stres_Termal_UTFVI_${yr}.geojson`, year: yr }),
  ndbi: (yr) => ({ folder: paramFolder(yr), file: `12_Kawasan_Terbangun_NDBI_${yr}.geojson`, year: yr }),
  sar: (yr) => ({ folder: paramFolder(yr), file: `14_Radar_Kanopi_SAR_VH_${yr}.geojson`, year: yr }),
  carbon_rate: { folder: '05_Parameter_2025', file: '15_Laju_Carbon_Rate_2019_2025.geojson' },

  // Folder 06: Delta Perubahan 2025 vs 2019
  delta_carbon: { folder: '06_Delta_Perubahan_2019_2025', file: '01_Delta_Carbon_Stock_2025_vs_2019.geojson' },
  delta_lst: { folder: '06_Delta_Perubahan_2019_2025', file: '02_Delta_Suhu_LST_2025_vs_2019.geojson' },
  delta_ndvi: { folder: '06_Delta_Perubahan_2019_2025', file: '05_Delta_Vegetasi_NDVI_2025_vs_2019.geojson' },
  delta_ndbi: { folder: '06_Delta_Perubahan_2019_2025', file: '08_Delta_Terbangun_NDBI_2025_vs_2019.geojson' },

  // Folder 07: Titik Sampel Validasi Statistik
  sampel_dalam: { folder: '07_Titik_Sampel_Dan_Ringkasan', file: '01_Titik_Sampel_Dalam_TNGL.geojson' },
  sampel_luar: { folder: '07_Titik_Sampel_Dan_Ringkasan', file: '02_Titik_Sampel_Permukiman_Buffer.geojson' }
};

// ============================================================================
// 4. HELPER
// ============================================================================
// Escape HTML (cegah XSS dari atribut GeoJSON), validasi warna, format angka kosong
const esc = (s) => String(s ?? '').replace(/\bTNGL\b/g, 'Kawasan Ekosistem Leuser').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeColor = (c, fallback) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.trim()) ? c.trim() : fallback);
const fmtNum = (v, d) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '-' : Number(v).toFixed(d));

// ============================================================================
// 5. ENGINE PEMUATAN DATA LOKAL (fetch dari folder data/ di situs yang sama)
// ============================================================================
const geojsonCache = {};     // url -> Promise<GeoJSON> (mencegah unduhan ganda)
const layerInstances = {};   // url -> L.geoJSON untuk scene utama
let activeDataLayers = [];
let currentYear = '2025';
let currentChapter = 'sampul';
let currentSublayer = null;
let dataError = null;
let pendingLoads = 0;

const loaderToast = $('loader-toast');
const brandEl = $('brand-title');
const dotEl = $('sync-dot');
const BRAND_TEXT = brandEl ? brandEl.textContent : '';

function setDataError(shortTitle, detailMsg) {
  if (!dataError) dataError = detailMsg;
  if (brandEl) brandEl.textContent = `STORYMAP TNGL • ${shortTitle}`;
  if (dotEl) {
    dotEl.style.background = '#dc2626';
    dotEl.style.boxShadow = '0 0 8px rgba(220, 38, 38, 0.7)';
  }
}

function clearDataError() {
  if (!dataError) return;
  dataError = null;
  if (brandEl) brandEl.textContent = BRAND_TEXT;
  if (dotEl) {
    dotEl.style.background = '';
    dotEl.style.boxShadow = '';
  }
}

function dataUrl(spec) {
  return [DATA_BASE, spec.folder, spec.file].map(encodeURIComponent).join('/');
}

// Unduh JSON dengan batas waktu & 1x ulang untuk gangguan sementara (jaringan / 5xx)
async function fetchJSON(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const shown = decodeURIComponent(url.split('?')[0]);   // jangan tampilkan API key di pesan error
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) {
        const e = new Error(`HTTP ${res.status} saat memuat "${shown}". Pastikan file ada di repo GitHub dengan nama folder & file yang persis sama (huruf besar-kecil berpengaruh).`);
        e.status = res.status;
        throw e;
      }
      const text = (await res.text()).trim();
      if (text.startsWith('<')) throw Object.assign(new Error(`"${shown}" berisi HTML, bukan GeoJSON. Periksa path file.`), { status: 422 });
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        throw Object.assign(new Error(`"${shown}" bukan JSON yang valid (file rusak atau terpotong).`), { status: 422 });
      }
    } catch (err) {
      lastErr = err.name === 'AbortError' ? new Error(`Waktu tunggu habis saat memuat "${shown}". Periksa koneksi internet.`) : err;
      if (err.status && err.status < 500) break;          // 4xx tidak perlu diulang
      if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

// Pastikan bentuknya FeatureCollection & buang fitur tanpa geometri
function normalizeGeoJSON(gj, label) {
  let fc = null;
  if (gj && gj.type === 'FeatureCollection' && Array.isArray(gj.features)) fc = gj;
  else if (gj && gj.type === 'Feature') fc = { type: 'FeatureCollection', features: [gj] };
  else if (gj && gj.type && gj.coordinates) fc = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: gj }] };
  if (!fc) throw new Error(`"${label}" bukan GeoJSON yang valid.`);
  return { ...fc, features: fc.features.filter((f) => f && f.geometry) };
}

// ---- Cadangan Google Drive (opsional; semua kegagalan hanya dicatat di console) ----
let driveIndexPromise = null;
function getDriveIndex() {
  if (!DRIVE_FOLDER_ID || !DRIVE_API_KEY) return Promise.resolve(null);
  if (!driveIndexPromise) {
    driveIndexPromise = (async () => {
      const list = async (parentId) => {
        const q = encodeURIComponent(`'${parentId}' in parents and trashed=false`);
        const fields = encodeURIComponent('files(id,name,mimeType)');
        const j = await fetchJSON(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=200&key=${encodeURIComponent(DRIVE_API_KEY)}`, 20000);
        return j.files || [];
      };
      const index = {};
      const top = await list(DRIVE_FOLDER_ID);
      const folders = top.filter((e) => e.mimeType === 'application/vnd.google-apps.folder');
      const lists = await Promise.all(folders.map(async (f) => ({ name: f.name, files: await list(f.id) })));
      lists.forEach(({ name, files }) => files.forEach((f) => { index[`${name}/${f.name}`] = f.id; }));
      return index;
    })().catch((err) => {
      console.warn('[Drive] Cadangan tidak tersedia:', err.message);
      return null;
    });
  }
  return driveIndexPromise;
}

async function fetchFromDrive(spec) {
  const index = await getDriveIndex();
  const id = index && index[`${spec.folder}/${spec.file}`];
  if (!id) return null;
  return fetchJSON(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(DRIVE_API_KEY)}`);
}

// Urutan: file lokal data/ dulu -> (opsional) Google Drive -> baru dilaporkan gagal
function loadGeoJSON(spec) {
  const url = dataUrl(spec);
  if (!geojsonCache[url]) {
    geojsonCache[url] = (async () => {
      let localErr;
      try {
        return normalizeGeoJSON(await fetchJSON(url), spec.file);
      } catch (err) {
        localErr = err;
      }
      try {
        const viaDrive = await fetchFromDrive(spec);
        if (viaDrive) {
          console.info('[Data] Memakai cadangan Google Drive:', spec.file);
          return normalizeGeoJSON(viaDrive, spec.file);
        }
      } catch (err) {
        console.warn('[Drive]', err.message);
      }
      throw localErr;
    })().catch((err) => {
      delete geojsonCache[url];   // izinkan coba lagi nanti
      throw err;
    });
  }
  return geojsonCache[url];
}

function buildPopupHTML(props) {
  if (props.Zona) {
    return `
      <strong>${esc(props.Zona)}</strong>
      <table class="popup-table">
        <tr><td>Carbon Stock</td><td>${fmtNum(props.Carbon_Stock, 2)} Ton/Ha</td></tr>
        <tr><td>Suhu LST</td><td>${fmtNum(props.LST, 2)} °C</td></tr>
        <tr><td>UHI / UTFVI</td><td>${fmtNum(props.UHI, 2)} / ${fmtNum(props.UTFVI, 4)}</td></tr>
        <tr><td>NDVI / NDMI</td><td>${fmtNum(props.NDVI, 3)} / ${fmtNum(props.NDMI, 3)}</td></tr>
        <tr><td>NDBI / SAR VH</td><td>${fmtNum(props.NDBI, 3)} / ${fmtNum(props.SAR_VH, 2)} dB</td></tr>
        <tr><td>Elevasi / Lereng</td><td>${fmtNum(props.Elevation, 0)} mdpl / ${fmtNum(props.Slope, 1)}°</td></tr>
      </table>
    `;
  }

  const luasFmt = props.Luas_Ha ? Number(props.Luas_Ha).toLocaleString('id-ID') + ' Ha' : '-';
  const pctFmt = props.Persentase_Area ? esc(props.Persentase_Area) + ' %' : '-';
  return `
    <strong style="color:${safeColor(props.Warna_Hex, '#15803d')}">${esc(props.Kategori || props.Name || 'Objek Spasial')}</strong>
    <table class="popup-table">
      <tr><td>Parameter</td><td>${esc(props.Parameter || '-')} (${esc(props.Tahun || '-')})</td></tr>
      <tr><td>Kriteria</td><td>${esc(props.Rentang_Nilai || '-')}</td></tr>
      <tr><td>Luas Area</td><td>${luasFmt} (${pctFmt})</td></tr>
      <tr><td>Keterangan</td><td>${esc(props.Interpretasi || '-')}</td></tr>
    </table>
  `;
}

function makeLayer(gjData, options = {}) {
  const interactive = options.interactive !== false;
  return L.geoJSON(gjData, {
    interactive,
    style: (feature) => {
      const p = feature.properties || {};
      return {
        fillColor: options.fillColor || safeColor(p.Warna_Hex, '#15803d'),
        color: options.strokeColor || '#334155',
        weight: options.weight !== undefined ? options.weight : 0.7,
        fillOpacity: options.fillOpacity !== undefined ? options.fillOpacity : 0.75,
        dashArray: options.dashArray || null
      };
    },
    pointToLayer: (feature, latlng) => {
      const p = feature.properties || {};
      return L.circleMarker(latlng, {
        radius: 5,
        fillColor: safeColor(p.Warna_Hex, '#0d9488'),
        color: '#ffffff',
        weight: 1.2,
        fillOpacity: 0.92,
        interactive
      });
    },
    onEachFeature: (feature, lyr) => {
      if (interactive && feature.properties) {
        lyr.bindPopup(buildPopupHTML(feature.properties), { maxWidth: 300 });
      }
    }
  });
}

async function getGeoJSONLayer(spec, options = {}) {
  if (!spec) return null;

  const key = dataUrl(spec);
  if (layerInstances[key]) return layerInstances[key];

  if (loaderToast) loaderToast.textContent = `Memuat [${spec.folder.slice(0, 2)}]: ${spec.file.replace(/TNGL/g, 'Kawasan Ekosistem Leuser')}...`;
  pendingLoads++;
  if (loaderToast) loaderToast.classList.remove('hidden');

  try {
    const gjData = await loadGeoJSON(spec);
    const layer = makeLayer(gjData, options);
    layer._rawGeoJSON = gjData;
    layerInstances[key] = layer;
    clearDataError();
    return layer;
  } catch (err) {
    console.error('[Data]', err);
    setDataError('DATA GAGAL DIMUAT', err.message);
    return null;
  } finally {
    pendingLoads = Math.max(0, pendingLoads - 1);
    if (pendingLoads === 0 && loaderToast) loaderToast.classList.add('hidden');
  }
}

// Daftar semua file (termasuk varian tahun) untuk kontrol layer bebas di peta
function allSpecs() {
  const out = [];
  Object.values(DATA_SPECS).forEach((s) => {
    if (typeof s === 'function') ['2019', '2021', '2025'].forEach((yr) => out.push(s(yr)));
    else out.push(s);
  });
  return out;
}

function registerOverlays() {
  allSpecs().forEach((spec) => {
    const group = L.layerGroup();
    const label = `[${spec.folder.slice(0, 2)}] ${spec.file.replace('.geojson', '').replace(/_/g, ' ').replace(/\bTNGL\b/g, 'Kawasan Ekosistem Leuser')}`;
    group.on('add', async () => {
      try {
        const gj = await loadGeoJSON(spec);
        if (!map.hasLayer(group)) return;     // sudah dimatikan sebelum selesai dimuat
        group.clearLayers();
        group.addLayer(makeLayer(gj, { fillOpacity: 0.75 }));   // instance baru, tidak berbagi dengan scene utama
        updateLegendFromGeoJSON(gj);
      } catch (err) {
        console.error('[Data]', err);
        setDataError('DATA GAGAL DIMUAT', err.message);
        updateLegendFromGeoJSON(null);
      }
    });
    layerControl.addOverlay(group, label);
  });
}

// ============================================================================
// 6. GRAFIK STATISTIK & LIGHTBOX ZOOM (GRAFIK + GALERI FOTO ACEH)
// ============================================================================
function initChartsAndLightbox() {
  const ctxKomp = document.getElementById('chartKomparasi');
  if (ctxKomp && typeof Chart !== 'undefined') {
    new Chart(ctxKomp, {
      type: 'bar',
      data: {
        labels: ['Cadangan Karbon (Ton/Ha)', 'Suhu Permukaan LST (°C)'],
        datasets: [
          { label: 'Dalam Kawasan Inti TNGL', data: [64.48, 22.61], backgroundColor: '#15803d', borderRadius: 5 },
          { label: 'Luar Buffer', data: [57.10, 27.90], backgroundColor: '#d97706', borderRadius: 5 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#14241c', font: { size: 11, weight: '600' } } } },
        scales: {
          x: { ticks: { color: '#334155', font: { size: 11 } }, grid: { display: false } },
          y: { ticks: { color: '#334155', font: { size: 10 } }, grid: { color: '#e2dfd7' } }
        }
      }
    });
  }

  const ctxDin = document.getElementById('chartDinamika');
  if (ctxDin && typeof Chart !== 'undefined') {
    new Chart(ctxDin, {
      type: 'bar',
      data: {
        labels: ['Neraca Karbon (7,01 Jt Ha)', 'Dinamika Termal (13,73 Jt Ha)'],
        datasets: [
          { label: 'Positif (Sink 48,6% / Cooling 56,9%)', data: [48.6, 56.9], backgroundColor: '#15803d', borderRadius: 4 },
          { label: 'Tekanan (Defisit 51,4% / Warming 43,1%)', data: [51.4, 43.1], backgroundColor: '#dc2626', borderRadius: 4 }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { labels: { color: '#14241c', font: { size: 10, weight: '600' } } } },
        scales: {
          x: { max: 100, ticks: { color: '#334155', font: { size: 10 } }, grid: { color: '#e2dfd7' } },
          y: { ticks: { color: '#334155', font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }

  const modal = document.getElementById('lightbox-modal');
  const modalImg = document.getElementById('lightbox-img');
  const modalCap = document.getElementById('lightbox-caption');
  if (!modal || !modalImg || !modalCap) return;   // lightbox tidak ada di HTML

  document.querySelectorAll('.figure-box').forEach((box) => {
    box.addEventListener('click', () => {
      const canvas = box.querySelector('canvas');
      const img = box.querySelector('img');
      const cap = box.querySelector('.figure-caption');

      if (canvas) {
        modalImg.src = canvas.toDataURL('image/png');
      } else if (img && img.style.display !== 'none') {
        modalImg.src = img.src;
      } else {
        return;
      }

      modalCap.textContent = cap ? cap.textContent : '';
      modal.hidden = false;
    });
  });

  const closeBtn = document.getElementById('lightbox-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.hidden = true;
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.hidden) {
      modal.hidden = true;
    }
  });
}

// ============================================================================
// 7. LEGENDA DINAMIS & KONTROL SCENE BAB STORYMAP
// ============================================================================
function updateLegendFromGeoJSON(gjData, fallbackTitle = 'Legenda Peta') {
  const box = $('map-legend');
  if (!box) return;
  if (!gjData || !gjData.features || gjData.features.length === 0) {
    if (dataError) {
      box.innerHTML = `<h4 style="color:#dc2626">Status Pemuatan Data</h4><small style="color:#334155;line-height:1.45">${esc(dataError)}</small>`;
    } else {
      box.innerHTML = `<h4>${fallbackTitle}</h4><small>Pilih layer dari ikon kontrol kanan atas peta.</small>`;
    }
    return;
  }

  const firstProps = gjData.features[0].properties || {};
  const title = firstProps.Parameter ? esc(`${firstProps.Parameter} (${firstProps.Tahun || ''})`) : esc(fallbackTitle);
  // Deduplikasi per kelas agar legenda tidak membengkak, maksimal 30 item
  const seen = new Map();
  gjData.features.forEach((f) => {
    const p = f.properties || {};
    const key = `${p.Kelas_Kode ?? ''}|${p.Kategori ?? p.Zona ?? p.Name ?? ''}`;
    if (!seen.has(key)) seen.set(key, f);
  });
  const sorted = [...seen.values()]
    .sort((a, b) => ((a.properties || {}).Kelas_Kode || 0) - ((b.properties || {}).Kelas_Kode || 0))
    .slice(0, 30);

  const itemsHTML = sorted.map((feat) => {
    const p = feat.properties || {};
    const luasText = p.Luas_Ha ? ` • ${Number(p.Luas_Ha).toLocaleString('id-ID')} Ha` : '';
    return `
      <div class="legend-item">
        <span class="legend-color" style="background:${safeColor(p.Warna_Hex, '#15803d')}"></span>
        <div class="legend-meta">
          <span>${esc(p.Kategori || p.Zona || p.Name || 'Kelas Spasial')}</span>
          <small>${esc(p.Rentang_Nilai || '')}${luasText}</small>
        </div>
      </div>
    `;
  }).join('');

  box.innerHTML = `<h4>${title}</h4>${itemsHTML}`;
}

const chapterMeta = {
  sampul: { label: 'Sampul', count: '00 / 07', center: [3.55, 97.45], zoom: 8 },
  deliniasi: { label: 'Desain Spasial', count: '01 / 07', center: [3.60, 97.42], zoom: 8 },
  hutan: { label: 'Tutupan Hutan', count: '02 / 07', center: [3.52, 97.48], zoom: 8 },
  karbon: { label: 'Neraca Karbon', count: '03 / 07', center: [3.48, 97.52], zoom: 9 },
  termal: { label: 'Iklim Mikro', count: '04 / 07', center: [3.68, 97.70], zoom: 9 },
  delta: { label: 'Delta 2019–2025', count: '05 / 07', center: [3.55, 97.50], zoom: 8 },
  validasi: { label: 'Validasi AI', count: '06 / 07', center: [3.55, 97.50], zoom: 8 },
  dampak: { label: 'Dampak & Aksi', count: '07 / 07', center: [3.50, 97.60], zoom: 8 }
};

function clearActiveLayers() {
  activeDataLayers.forEach((lyr) => {
    if (lyr && map.hasLayer(lyr)) map.removeLayer(lyr);
  });
  activeDataLayers = [];
}

let renderToken = 0;

async function renderScene(opts = {}) {
  try {
    await renderSceneInner(opts);
  } catch (err) {
    console.error('[renderScene]', err);
    setDataError('TAMPILAN GAGAL', err.message);
  }
}

async function renderSceneInner(opts = {}) {
  const cfg = chapterMeta[currentChapter];
  if (!cfg) return;

  const refit = opts.refit !== false;   // false = jangan gerakkan peta (ganti tahun / sublayer)
  const token = ++renderToken;
  const stale = () => token !== renderToken;

  const lbl = $('chapter-label'), cnt = $('chapter-counter');
  if (lbl) lbl.textContent = cfg.label;
  if (cnt) cnt.textContent = cfg.count;
  map.invalidateSize();

  const lyrTngl = await getGeoJSONLayer(DATA_SPECS.batas_tngl, {
    fillColor: '#15803d',
    strokeColor: '#0f4c3a',
    weight: 2.5,
    fillOpacity: 0.08,
    interactive: false                   // agar klik tembus ke layer data di bawahnya
  });
  if (stale()) return;

  const load = (spec, fillOpacity = 0.78) => getGeoJSONLayer(spec, { fillOpacity });
  let primaryLayer = null;
  let extraLayers = [];
  let customLegend = null;

  if (currentChapter === 'sampul' || currentChapter === 'deliniasi') {
    const mode = currentSublayer || 'zonasi';
    const target = mode === 'elevasi' ? DATA_SPECS.elevasi : mode === 'lereng' ? DATA_SPECS.lereng : DATA_SPECS.zonasi_jarak;
    primaryLayer = await load(target, 0.72);
  } else if (currentChapter === 'hutan') {
    const mode = currentSublayer || 'dinamika_hutan';
    primaryLayer = await load(mode === 'status_hutan' ? DATA_SPECS.status_hutan(currentYear) : DATA_SPECS.dinamika_hutan);
  } else if (currentChapter === 'karbon') {
    const mode = currentSublayer || 'carbon_stock';
    primaryLayer = await load(mode === 'agb' ? DATA_SPECS.agb(currentYear) : mode === 'carbon_rate' ? DATA_SPECS.carbon_rate : DATA_SPECS.carbon_stock(currentYear));
  } else if (currentChapter === 'termal') {
    const mode = currentSublayer || 'lst';
    const targetMap = {
      lst: DATA_SPECS.lst(currentYear),
      uhi: DATA_SPECS.uhi(currentYear),
      utfvi: DATA_SPECS.utfvi(currentYear),
      ndbi: DATA_SPECS.ndbi(currentYear)
    };
    primaryLayer = await load(targetMap[mode]);
  } else if (currentChapter === 'delta') {
    const mode = currentSublayer || 'delta_carbon';
    const mapDelta = {
      delta_carbon: DATA_SPECS.delta_carbon,
      delta_lst: DATA_SPECS.delta_lst,
      delta_ndvi: DATA_SPECS.delta_ndvi,
      delta_ndbi: DATA_SPECS.delta_ndbi
    };
    primaryLayer = await load(mapDelta[mode]);
  } else if (currentChapter === 'validasi') {
    const mode = currentSublayer || 'sampel';
    if (mode === 'sar') {
      primaryLayer = await load(DATA_SPECS.sar(currentYear));
    } else {
      const [lyrIn, lyrOut] = await Promise.all([
        getGeoJSONLayer(DATA_SPECS.sampel_dalam),
        getGeoJSONLayer(DATA_SPECS.sampel_luar)
      ]);
      extraLayers = [lyrIn, lyrOut].filter(Boolean);
      customLegend = {
        features: [
          { properties: { Kategori: 'Titik Sampel Dalam Kawasan Ekosistem Leuser', Rentang_Nilai: 'Klik titik untuk detail atribut', Warna_Hex: '#15803d' } },
          { properties: { Kategori: 'Titik Sampel Zona Luar', Rentang_Nilai: 'Klik titik untuk detail atribut', Warna_Hex: '#dc2626' } }
        ]
      };
    }
  } else if (currentChapter === 'dampak') {
    primaryLayer = await load(DATA_SPECS.delta_lst, 0.75);
  }

  if (stale()) return;                   // render yang lebih baru sudah berjalan, batalkan yang ini

  // Ganti layer secara sinkron: tidak ada kedipan & tidak ada tumpukan layer lama
  clearActiveLayers();
  const add = (l) => { if (l) { l.addTo(map); activeDataLayers.push(l); } };
  add(lyrTngl);
  if (primaryLayer && primaryLayer !== lyrTngl) add(primaryLayer);
  extraLayers.forEach(add);
  if (lyrTngl && primaryLayer) lyrTngl.bringToFront();

  const flyHome = () => { if (refit) map.flyTo(cfg.center, cfg.zoom, { duration: 1.1 }); };

  if (customLegend) {
    updateLegendFromGeoJSON(customLegend, 'Validasi Sampel Spasial');
    flyHome();
    return;
  }

  if (primaryLayer) {
    updateLegendFromGeoJSON(primaryLayer._rawGeoJSON);
    if (refit) {
      const bounds = primaryLayer.getBounds();
      if (bounds.isValid() && Math.abs(bounds.getSouth()) <= 90 && Math.abs(bounds.getWest()) <= 180) {
        map.flyToBounds(bounds, { padding: [24, 24], maxZoom: 10, duration: 1.1 });
      } else {
        flyHome();
      }
    }
  } else {
    updateLegendFromGeoJSON(null, 'Kawasan Ekosistem Leuser');
    flyHome();
  }
}

// ============================================================================
// 8. KONTROL INTERAKTIF & BILAH PROGRES BACA
// ============================================================================
window.addEventListener('scroll', () => {
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? Math.min(100, Math.max(0, (window.scrollY / docHeight) * 100)) : 0;
  const fill = $('scroll-progress-fill');
  if (fill) fill.style.width = `${pct}%`;
});

document.querySelectorAll('.year-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.year-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentYear = btn.dataset.year;
    renderScene({ refit: false });
  });
});

document.querySelectorAll('.pill-btn').forEach((pill) => {
  pill.addEventListener('click', () => {
    const parent = pill.closest('.layer-pills');
    parent.querySelectorAll('.pill-btn').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    currentSublayer = pill.dataset.sublayer;
    renderScene({ refit: false });
  });
});

document.querySelectorAll('.tab-btn').forEach((tab) => {
  tab.addEventListener('click', () => {
    const stepCard = tab.closest('.step');
    stepCard.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
    stepCard.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById(`tab-${tab.dataset.tab}`);
    if (panel) panel.classList.add('active');
  });
});

try {
  registerOverlays();
} catch (err) {
  console.error('Gagal membuat daftar layer:', err);
}

const observer = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const newChapter = entry.target.dataset.step || (entry.target.classList.contains('hero-cover') ? 'sampul' : null);
      if (!newChapter) return;
      document.querySelectorAll('.step').forEach((s) => s.classList.remove('active'));
      entry.target.classList.add('active');
      if (newChapter === currentChapter) return;   // bab sama, tidak perlu render ulang
      currentChapter = newChapter;

      const firstPill = entry.target.querySelector('.pill-btn');
      if (firstPill) {
        entry.target.querySelectorAll('.pill-btn').forEach((p) => p.classList.remove('active'));
        firstPill.classList.add('active');
        currentSublayer = firstPill.dataset.sublayer;
      } else {
        currentSublayer = null;
      }
      renderScene();
    }
  });
}, { rootMargin: '-45% 0px -45% 0px', threshold: 0 }) : null;

if (observer) document.querySelectorAll('.step, .hero-cover').forEach((sec) => observer.observe(sec));

try {
  initChartsAndLightbox();
} catch (err) {
  console.error('Gagal inisialisasi grafik/lightbox:', err);
}
renderScene();

window.addEventListener('resize', () => map.invalidateSize());
