// ============================================================================
// STORYMAP KEL • TIM HIGH GROUND SOLID — app.js (v2)
// Perubahan utama dibanding v1:
//  - Peta layar penuh (laptop/landscape) + panel narasi melayang; peta sticky di atas (HP portrait)
//  - Fokus peta otomatis digeser agar tidak tertutup panel narasi
//  - Kontrol "Lapisan" berkelompok (menggantikan 35 overlay Leaflet), slider transparansi
//  - Tautan dalam (deep link) #bab=...&layer=...&tahun=...
//  - Pemuatan paralel + prefetch bab berikutnya
//  - Perbaikan: warna titik sampel sesuai legenda, tombol legenda berfungsi, API key dihapus
// ============================================================================

// ============================================================================
// 1. KONFIGURASI
// ============================================================================
const DATA_BASE = 'data';
const FETCH_TIMEOUT_MS = 45000;

// KEAMANAN: API key lama (AIza...) sudah terlanjur publik di repo GitHub.
// Hapus/regenerasi key itu di Google Cloud Console, lalu biarkan kosong di sini.
// Cadangan Drive otomatis nonaktif bila kedua nilai kosong.
const DRIVE_FOLDER_ID = '';
const DRIVE_API_KEY = '';

const $ = (id) => document.getElementById(id);
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isStackedLayout = () => window.matchMedia('(max-width: 900px) and (orientation: portrait)').matches;

if (typeof L === 'undefined') {
  const mapEl = $('map');
  if (mapEl) mapEl.innerHTML = '<p style="padding:24px;font:14px sans-serif">Pustaka peta (Leaflet) gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.</p>';
  throw new Error('Leaflet tidak termuat');
}
window.addEventListener('unhandledrejection', (e) => { console.error('[Unhandled]', e.reason); e.preventDefault(); });
window.addEventListener('error', (e) => console.error('[Error]', e.message));

// ============================================================================
// 2. PETA & BASEMAP ESRI
// ============================================================================
const map = L.map('map', {
  center: [3.55, 97.45],
  zoom: 8,
  minZoom: 6,
  maxBounds: [[-2.5, 91.0], [8.5, 102.0]],
  maxBoundsViscosity: 0.7,
  zoomControl: false,
  preferCanvas: true,
  scrollWheelZoom: false      // roda mouse dipakai menggulir cerita; aktif setelah peta diklik
});
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.control.scale({ position: 'bottomright', imperial: false, maxWidth: 110 }).addTo(map);

// Roda mouse: gulir halaman secara default, zoom hanya setelah peta diklik/difokuskan
map.on('click focus', () => map.scrollWheelZoom.enable());
map.on('mouseout blur', () => map.scrollWheelZoom.disable());

map.createPane('labels');
map.getPane('labels').style.zIndex = 650;
map.getPane('labels').style.pointerEvents = 'none';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const esriGrayBase = L.tileLayer(`${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, attribution: 'Tiles &copy; Esri' });
const esriGrayRef = L.tileLayer(`${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, pane: 'labels' });
const esriCanvasTerang = L.layerGroup([esriGrayBase, esriGrayRef]).addTo(map);
const esriTopo = L.tileLayer(`${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 18, attribution: 'Tiles &copy; Esri, Garmin, USGS, NPS' });
const esriSat = L.tileLayer(`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 18, attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics' });
const esriNatGeo = L.tileLayer(`${ESRI}/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, attribution: 'Tiles &copy; Esri, National Geographic' });
const osmCadangan = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' });

let tilesLoaded = 0, tilesFailed = 0;
esriGrayBase.on('tileload', () => { tilesLoaded++; });
esriGrayBase.on('tileerror', () => {
  tilesFailed++;
  if (tilesLoaded === 0 && tilesFailed >= 8 && map.hasLayer(esriCanvasTerang)) {
    map.removeLayer(esriCanvasTerang);
    osmCadangan.addTo(map);
  }
});

L.control.layers({
  'Esri Canvas Terang (Utama)': esriCanvasTerang,
  'Esri Topografi': esriTopo,
  'Esri Citra Satelit': esriSat,
  'Esri NatGeo': esriNatGeo,
  'OpenStreetMap (cadangan)': osmCadangan
}, {}, { collapsed: true, position: 'topright' }).addTo(map);

// ============================================================================
// 3. PEMETAAN FILE DATA
// ============================================================================
const paramFolder = (yr) => (yr === '2019' ? '03_Parameter_2019' : yr === '2021' ? '04_Parameter_2021' : '05_Parameter_2025');
const YEARS = ['2019', '2021', '2025'];

const DATA_SPECS = {
  batas_tngl: { folder: '01_Batas_Dan_Data_Pendukung', file: '01_Batas_Kawasan_Inti_TNGL.geojson' },
  buffer_luar: { folder: '01_Batas_Dan_Data_Pendukung', file: '02_Zona_Buffer_100km_Luar_TNGL.geojson' },
  elevasi: { folder: '01_Batas_Dan_Data_Pendukung', file: '06_Klasifikasi_Elevasi_DEM.geojson' },
  lereng: { folder: '01_Batas_Dan_Data_Pendukung', file: '07_Klasifikasi_Kemiringan_Lereng.geojson' },
  zonasi_jarak: { folder: '01_Batas_Dan_Data_Pendukung', file: '10_Klasifikasi_Zonasi_Jarak_TNGL.geojson' },

  dinamika_hutan: { folder: '02_Tutupan_Hutan_Dan_Permukiman', file: '02_Dinamika_Perubahan_Hutan_2019_2025.geojson' },
  status_hutan: (yr) => ({ folder: '02_Tutupan_Hutan_Dan_Permukiman', file: `01_Status_Tutupan_Hutan_${yr}.geojson`, year: yr }),

  carbon_stock: (yr) => ({ folder: paramFolder(yr), file: `01_Cadangan_Karbon_${yr}.geojson`, year: yr }),
  agb: (yr) => ({ folder: paramFolder(yr), file: `02_Biomassa_AGB_${yr}.geojson`, year: yr }),
  lst: (yr) => ({ folder: paramFolder(yr), file: `03_Suhu_Permukaan_LST_${yr}.geojson`, year: yr }),
  uhi: (yr) => ({ folder: paramFolder(yr), file: `04_Pulau_Bahang_UHI_${yr}.geojson`, year: yr }),
  utfvi: (yr) => ({ folder: paramFolder(yr), file: `05_Stres_Termal_UTFVI_${yr}.geojson`, year: yr }),
  ndbi: (yr) => ({ folder: paramFolder(yr), file: `12_Kawasan_Terbangun_NDBI_${yr}.geojson`, year: yr }),
  sar: (yr) => ({ folder: paramFolder(yr), file: `14_Radar_Kanopi_SAR_VH_${yr}.geojson`, year: yr }),
  carbon_rate: { folder: '05_Parameter_2025', file: '15_Laju_Carbon_Rate_2019_2025.geojson' },

  delta_carbon: { folder: '06_Delta_Perubahan_2019_2025', file: '01_Delta_Carbon_Stock_2025_vs_2019.geojson' },
  delta_lst: { folder: '06_Delta_Perubahan_2019_2025', file: '02_Delta_Suhu_LST_2025_vs_2019.geojson' },
  delta_ndvi: { folder: '06_Delta_Perubahan_2019_2025', file: '05_Delta_Vegetasi_NDVI_2025_vs_2019.geojson' },
  delta_ndbi: { folder: '06_Delta_Perubahan_2019_2025', file: '08_Delta_Terbangun_NDBI_2025_vs_2019.geojson' },

  sampel_dalam: { folder: '07_Titik_Sampel_Dan_Ringkasan', file: '01_Titik_Sampel_Dalam_TNGL.geojson' },
  sampel_luar: { folder: '07_Titik_Sampel_Dan_Ringkasan', file: '02_Titik_Sampel_Permukiman_Buffer.geojson' }
};
const S = DATA_SPECS;

// ============================================================================
// 4. HELPER
// ============================================================================
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeColor = (c, fallback) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.trim()) ? c.trim() : fallback);
const fmtNum = (v, d) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '-' : Number(v).toFixed(d));
const rafThrottle = (fn) => { let t = false; return (...a) => { if (t) return; t = true; requestAnimationFrame(() => { t = false; fn(...a); }); }; };

// ============================================================================
// 5. ENGINE PEMUATAN DATA
// ============================================================================
const geojsonCache = {};
const layerInstances = {};
let activeDataLayers = [];
let primaryLayerRef = null;
let currentYear = '2025';
let currentChapter = 'sampul';
let currentSublayer = null;
let opacityMul = 1;
let dataError = null;
let pendingLoads = 0;

const loaderToast = $('loader-toast');
const brandEl = $('brand-title');
const dotEl = $('sync-dot');
const BRAND_TEXT = brandEl ? brandEl.textContent : '';

function setDataError(shortTitle, detailMsg) {
  if (!dataError) dataError = detailMsg;
  if (brandEl) brandEl.textContent = `STORYMAP KEL • ${shortTitle}`;
  if (dotEl) { dotEl.style.background = '#dc2626'; dotEl.style.boxShadow = '0 0 8px rgba(220,38,38,.7)'; }
}
function clearDataError() {
  if (!dataError) return;
  dataError = null;
  if (brandEl) brandEl.textContent = BRAND_TEXT;
  if (dotEl) { dotEl.style.background = ''; dotEl.style.boxShadow = ''; }
}

const dataUrl = (spec) => [DATA_BASE, spec.folder, spec.file].map(encodeURIComponent).join('/');

async function fetchJSON(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const shown = decodeURIComponent(url.split('?')[0]);
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) {
        const e = new Error(`HTTP ${res.status} saat memuat "${shown}". Pastikan file ada di repo dengan nama folder & file persis sama (huruf besar-kecil berpengaruh).`);
        e.status = res.status;
        throw e;
      }
      const text = (await res.text()).trim();
      if (text.startsWith('<')) throw Object.assign(new Error(`"${shown}" berisi HTML, bukan GeoJSON. Periksa path file.`), { status: 422 });
      try { return JSON.parse(text); }
      catch (e) { throw Object.assign(new Error(`"${shown}" bukan JSON valid (rusak atau terpotong).`), { status: 422 }); }
    } catch (err) {
      lastErr = err.name === 'AbortError' ? new Error(`Waktu tunggu habis saat memuat "${shown}". Periksa koneksi internet.`) : err;
      if (err.status && err.status < 500) break;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

function normalizeGeoJSON(gj, label) {
  let fc = null;
  if (gj && gj.type === 'FeatureCollection' && Array.isArray(gj.features)) fc = gj;
  else if (gj && gj.type === 'Feature') fc = { type: 'FeatureCollection', features: [gj] };
  else if (gj && gj.type && gj.coordinates) fc = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: gj }] };
  if (!fc) throw new Error(`"${label}" bukan GeoJSON valid.`);
  return { ...fc, features: fc.features.filter((f) => f && f.geometry) };
}

// ---- Cadangan Google Drive (opsional) ----
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
    })().catch((err) => { console.warn('[Drive] Cadangan tidak tersedia:', err.message); return null; });
  }
  return driveIndexPromise;
}
async function fetchFromDrive(spec) {
  const index = await getDriveIndex();
  const id = index && index[`${spec.folder}/${spec.file}`];
  if (!id) return null;
  return fetchJSON(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(DRIVE_API_KEY)}`);
}

function loadGeoJSON(spec) {
  const url = dataUrl(spec);
  if (!geojsonCache[url]) {
    geojsonCache[url] = (async () => {
      let localErr;
      try { return normalizeGeoJSON(await fetchJSON(url), spec.file); }
      catch (err) { localErr = err; }
      try {
        const viaDrive = await fetchFromDrive(spec);
        if (viaDrive) return normalizeGeoJSON(viaDrive, spec.file);
      } catch (err) { console.warn('[Drive]', err.message); }
      throw localErr;
    })().catch((err) => { delete geojsonCache[url]; throw err; });
  }
  return geojsonCache[url];
}

// ---- Popup & layer ----
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
      </table>`;
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
    </table>`;
}

function makeLayer(gjData, options = {}) {
  const interactive = options.interactive !== false;
  const popupMax = Math.max(220, Math.min(300, window.innerWidth - 56));
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
        // pointColor memastikan warna titik = warna di legenda (perbaikan dari v1)
        fillColor: options.pointColor || safeColor(p.Warna_Hex, '#0d9488'),
        color: '#ffffff', weight: 1.2, fillOpacity: 0.92, interactive
      });
    },
    onEachFeature: (feature, lyr) => {
      if (interactive && feature.properties) lyr.bindPopup(buildPopupHTML(feature.properties), { maxWidth: popupMax, autoPanPadding: [16, 16] });
    }
  });
}

async function getGeoJSONLayer(spec, options = {}) {
  if (!spec) return null;
  const key = dataUrl(spec);
  if (layerInstances[key]) return layerInstances[key];

  if (loaderToast) loaderToast.textContent = `Memuat ${spec.file.replace('.geojson', '').replace(/_/g, ' ')}…`;
  pendingLoads++;
  if (loaderToast) loaderToast.classList.remove('hidden');
  try {
    const gjData = await loadGeoJSON(spec);
    const layer = makeLayer(gjData, options);
    layer._rawGeoJSON = gjData;
    layer._baseOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 0.75;
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

// ============================================================================
// 6. PENJELAJAH LAPISAN BEBAS (berkelompok, menggantikan 35 overlay Leaflet)
// ============================================================================
const FOLDER_GROUP = {
  '01': 'Batas & Data Pendukung', '02': 'Tutupan Hutan', '03': 'Parameter Biofisik', '04': 'Parameter Biofisik',
  '05': 'Parameter Biofisik', '06': 'Delta Perubahan 2019–2025', '07': 'Titik Sampel'
};
const niceLabel = (file) => file.replace(/\.geojson$/i, '').replace(/^\d+_/, '').replace(/_(2019|2021|2025)$/, '').replace(/_/g, ' ');

const userOverlays = {};          // url -> L.layerGroup
const userChecked = new Set();

function currentYearSpecs() {
  const seen = new Set(), out = [];
  Object.values(DATA_SPECS).forEach((s) => {
    const spec = typeof s === 'function' ? s(currentYear) : s;
    const k = dataUrl(spec);
    if (!seen.has(k)) { seen.add(k); out.push(spec); }
  });
  return out;
}

function clearUserOverlays() {
  Object.values(userOverlays).forEach((g) => { if (map.hasLayer(g)) map.removeLayer(g); });
  userChecked.clear();
}

async function toggleOverlay(spec, on) {
  const key = dataUrl(spec);
  if (!on) {
    userChecked.delete(key);
    if (userOverlays[key] && map.hasLayer(userOverlays[key])) map.removeLayer(userOverlays[key]);
    return;
  }
  userChecked.add(key);
  try {
    const gj = await loadGeoJSON(spec);
    if (!userChecked.has(key)) return;
    const g = userOverlays[key] || (userOverlays[key] = L.layerGroup());
    g.clearLayers();
    g.addLayer(makeLayer(gj, { fillOpacity: 0.7 }));
    g.addTo(map);
    updateLegendFromGeoJSON(gj);
  } catch (err) {
    console.error('[Data]', err);
    setDataError('DATA GAGAL DIMUAT', err.message);
    updateLegendFromGeoJSON(null);
    userChecked.delete(key);
    const cb = document.querySelector(`#overlay-list input[data-key="${CSS.escape(key)}"]`);
    if (cb) cb.checked = false;
  }
}

function renderOverlayList() {
  const host = $('overlay-list');
  if (!host) return;
  const groups = new Map();
  currentYearSpecs().forEach((spec) => {
    const g = FOLDER_GROUP[spec.folder.slice(0, 2)] || 'Lainnya';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(spec);
  });
  host.innerHTML = '';
  groups.forEach((specs, name) => {
    const det = document.createElement('details');
    det.className = 'overlay-group';
    const sum = document.createElement('summary');
    sum.textContent = name;
    det.appendChild(sum);
    specs.forEach((spec) => {
      const key = dataUrl(spec);
      const lab = document.createElement('label');
      lab.className = 'overlay-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.key = key;
      cb.checked = userChecked.has(key);
      cb.addEventListener('change', () => toggleOverlay(spec, cb.checked));
      const span = document.createElement('span');
      span.textContent = niceLabel(spec.file) + (spec.year ? ` (${spec.year})` : '');
      lab.append(cb, span);
      det.appendChild(lab);
    });
    host.appendChild(det);
  });
}

// ============================================================================
// 7. LEGENDA
// ============================================================================
function updateLegendFromGeoJSON(gjData, fallbackTitle = 'Legenda Peta') {
  const box = $('map-legend');
  if (!box) return;
  if (!gjData || !gjData.features || gjData.features.length === 0) {
    if (dataError) {
      box.innerHTML = `<h4 style="color:#dc2626">Status Pemuatan Data</h4><small style="color:#334155;line-height:1.45">${esc(dataError)}</small><button type="button" id="retry-btn" class="retry-btn">Coba lagi</button>`;
    } else {
      box.innerHTML = `<h4>${esc(fallbackTitle)}</h4><small>Buka menu “Lapisan” untuk menambah layer.</small>`;
    }
    return;
  }
  const firstProps = gjData.features[0].properties || {};
  const title = firstProps.Parameter ? esc(`${firstProps.Parameter} (${firstProps.Tahun || ''})`) : esc(fallbackTitle);
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
      </div>`;
  }).join('');
  box.innerHTML = `<h4>${title}</h4>${itemsHTML}`;
}

const legendBox = $('map-legend');
const legendBtn = $('legend-toggle-btn');
function setLegendCollapsed(collapsed) {
  if (!legendBox || !legendBtn) return;
  legendBox.classList.toggle('is-collapsed', collapsed);
  legendBtn.setAttribute('aria-expanded', String(!collapsed));
}
if (legendBtn) {
  setLegendCollapsed(isStackedLayout());       // HP portrait: legenda tertutup agar peta lega
  legendBtn.addEventListener('click', () => setLegendCollapsed(!legendBox.classList.contains('is-collapsed')));
}
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'retry-btn') { dataError = null; renderScene({ refit: false }); }
});

// ============================================================================
// 8. SCENE PER BAB
// ============================================================================
const chapterMeta = {
  sampul:    { label: 'Sampul',         count: '00 / 07', center: [3.55, 97.45], zoom: 8 },
  deliniasi: { label: 'Desain Spasial', count: '01 / 07', center: [3.60, 97.42], zoom: 8 },
  hutan:     { label: 'Tutupan Hutan',  count: '02 / 07', center: [3.52, 97.48], zoom: 8 },
  karbon:    { label: 'Neraca Karbon',  count: '03 / 07', center: [3.48, 97.52], zoom: 9 },
  termal:    { label: 'Iklim Mikro',    count: '04 / 07', center: [3.68, 97.70], zoom: 9 },
  delta:     { label: 'Delta 2019–2025', count: '05 / 07', center: [3.55, 97.50], zoom: 8 },
  validasi:  { label: 'Validasi AI',    count: '06 / 07', center: [3.55, 97.50], zoom: 8 },
  dampak:    { label: 'Dampak & Aksi',  count: '07 / 07', center: [3.50, 97.60], zoom: 8 }
};
const CHAPTER_ORDER = Object.keys(chapterMeta);

const TNGL_OPTS = { fillColor: '#15803d', strokeColor: '#0f4c3a', weight: 2.5, fillOpacity: 0.08, interactive: false };

// Satu tempat untuk menentukan file apa yang tampil pada bab/sublayer/tahun tertentu
function sceneSpecs(chapter, mode, yr) {
  switch (chapter) {
    case 'sampul':
    case 'deliniasi': {
      const m = mode || 'zonasi';
      return { primary: m === 'elevasi' ? S.elevasi : m === 'lereng' ? S.lereng : S.zonasi_jarak, op: 0.72 };
    }
    case 'hutan':
      return { primary: (mode || 'dinamika_hutan') === 'status_hutan' ? S.status_hutan(yr) : S.dinamika_hutan };
    case 'karbon': {
      const m = mode || 'carbon_stock';
      return { primary: m === 'agb' ? S.agb(yr) : m === 'carbon_rate' ? S.carbon_rate : S.carbon_stock(yr) };
    }
    case 'termal': {
      const fn = ({ lst: S.lst, uhi: S.uhi, utfvi: S.utfvi, ndbi: S.ndbi })[mode || 'lst'] || S.lst;
      return { primary: fn(yr) };
    }
    case 'delta':
      return { primary: ({ delta_carbon: S.delta_carbon, delta_lst: S.delta_lst, delta_ndvi: S.delta_ndvi, delta_ndbi: S.delta_ndbi })[mode || 'delta_carbon'] || S.delta_carbon };
    case 'validasi':
      if (mode === 'sar') return { primary: S.sar(yr) };
      return {
        extra: [
          { spec: S.sampel_dalam, opts: { pointColor: '#15803d' } },
          { spec: S.sampel_luar, opts: { pointColor: '#dc2626' } }
        ],
        legend: {
          features: [
            { properties: { Kategori: 'Titik Sampel Dalam TNGL', Rentang_Nilai: 'Klik titik untuk detail atribut', Warna_Hex: '#15803d' } },
            { properties: { Kategori: 'Titik Sampel Zona Luar', Rentang_Nilai: 'Klik titik untuk detail atribut', Warna_Hex: '#dc2626' } }
          ]
        }
      };
    case 'dampak':
      return { primary: S.delta_lst, op: 0.75 };
    default:
      return {};
  }
}

// Apakah tombol tahun berpengaruh pada tampilan saat ini?
function yearApplies() {
  if (currentChapter === 'hutan') return currentSublayer === 'status_hutan';
  if (currentChapter === 'karbon') return currentSublayer !== 'carbon_rate';
  if (currentChapter === 'termal') return true;
  if (currentChapter === 'validasi') return currentSublayer === 'sar';
  return false;
}

// Area peta yang TIDAK tertutup panel narasi → fokus peta digeser ke sana
function mapPadding() {
  if (isStackedLayout()) return { tl: [16, 16], br: [16, 16] };
  const panel = document.querySelector('.narrative-column');
  const w = panel ? panel.getBoundingClientRect().width : 0;
  return { tl: [Math.round(w) + 16, 16], br: [72, 40] };
}

function flyToOffset(center, zoom) {
  const pad = mapPadding();
  const dx = (pad.tl[0] - pad.br[0]) / 2, dy = (pad.tl[1] - pad.br[1]) / 2;
  const target = map.unproject(map.project(center, zoom).subtract([dx, dy]), zoom);
  if (prefersReduced) map.setView(target, zoom, { animate: false });
  else map.flyTo(target, zoom, { duration: 1.1 });
}

function clearActiveLayers() {
  activeDataLayers.forEach((lyr) => { if (lyr && map.hasLayer(lyr)) map.removeLayer(lyr); });
  activeDataLayers = [];
  primaryLayerRef = null;
}

function applyOpacity() {
  if (!primaryLayerRef) return;
  primaryLayerRef.setStyle({ fillOpacity: Math.min(1, (primaryLayerRef._baseOpacity ?? 0.75) * opacityMul) });
}

function updateChrome(cfg) {
  const lbl = $('chapter-label'), cnt = $('chapter-counter');
  if (lbl) lbl.textContent = cfg.label;
  if (cnt) cnt.textContent = cfg.count;
  const ys = $('year-switcher');
  if (ys) {
    const on = yearApplies();
    ys.classList.toggle('is-inactive', !on);
    ys.title = on ? 'Pilih tahun komposit spasial' : 'Layer bab ini tidak bergantung pada tahun';
  }
}

let renderToken = 0;
async function renderScene(opts = {}) {
  try { await renderSceneInner(opts); }
  catch (err) { console.error('[renderScene]', err); setDataError('TAMPILAN GAGAL', err.message); }
}

async function renderSceneInner(opts = {}) {
  const cfg = chapterMeta[currentChapter];
  if (!cfg) return;
  const refit = opts.refit !== false;
  const token = ++renderToken;
  const stale = () => token !== renderToken;

  updateChrome(cfg);
  map.invalidateSize();

  const sc = sceneSpecs(currentChapter, currentSublayer, currentYear);
  const [lyrTngl, primaryLayer, extraLayers] = await Promise.all([
    getGeoJSONLayer(S.batas_tngl, TNGL_OPTS),
    sc.primary ? getGeoJSONLayer(sc.primary, { fillOpacity: sc.op || 0.78 }) : null,
    Promise.all((sc.extra || []).map((e) => getGeoJSONLayer(e.spec, e.opts)))
  ]);
  if (stale()) return;

  clearActiveLayers();
  const add = (l) => { if (l) { l.addTo(map); activeDataLayers.push(l); } };
  add(lyrTngl);
  if (primaryLayer && primaryLayer !== lyrTngl) add(primaryLayer);
  extraLayers.filter(Boolean).forEach(add);
  primaryLayerRef = primaryLayer || null;
  applyOpacity();
  if (lyrTngl && primaryLayer) lyrTngl.bringToFront();

  const flyHome = () => { if (refit) flyToOffset(cfg.center, cfg.zoom); };

  if (sc.legend) {
    updateLegendFromGeoJSON(sc.legend, 'Validasi Sampel Spasial');
    flyHome();
  } else if (primaryLayer) {
    updateLegendFromGeoJSON(primaryLayer._rawGeoJSON);
    if (refit) {
      const b = primaryLayer.getBounds();
      if (b.isValid() && Math.abs(b.getSouth()) <= 90 && Math.abs(b.getWest()) <= 180) {
        const pad = mapPadding();
        map.flyToBounds(b, { paddingTopLeft: pad.tl, paddingBottomRight: pad.br, maxZoom: 10, duration: prefersReduced ? 0 : 1.1, animate: !prefersReduced });
      } else flyHome();
    }
  } else {
    updateLegendFromGeoJSON(null, 'Kawasan Ekosistem Leuser');
    flyHome();
  }

  writeHash();
  prefetchNext();
}

// Unduh diam-diam data bab berikutnya agar transisi terasa instan
function prefetchNext() {
  const i = CHAPTER_ORDER.indexOf(currentChapter);
  const next = CHAPTER_ORDER[i + 1];
  if (!next) return;
  const run = () => {
    const sc = sceneSpecs(next, null, currentYear);
    [sc.primary, ...(sc.extra || []).map((e) => e.spec)].filter(Boolean).forEach((s) => loadGeoJSON(s).catch(() => {}));
  };
  if (navigator.connection && navigator.connection.saveData) return;
  (window.requestIdleCallback || ((f) => setTimeout(f, 1200)))(run);
}

// ============================================================================
// 9. DEEP LINK (#bab=karbon&layer=agb&tahun=2021)
// ============================================================================
let hashTimer = null;
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    try {
      if (currentChapter === 'sampul') { history.replaceState(null, '', location.pathname + location.search); return; }
      const p = new URLSearchParams({ bab: currentChapter });
      if (currentSublayer) p.set('layer', currentSublayer);
      if (yearApplies()) p.set('tahun', currentYear);
      history.replaceState(null, '', '#' + p.toString());
    } catch (e) { /* abaikan pada lingkungan yang membatasi history */ }
  }, 250);
}

let restoring = false;
function restoreFromHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw.includes('bab=')) return;
  const p = new URLSearchParams(raw);
  const bab = p.get('bab');
  if (!chapterMeta[bab] || bab === 'sampul') return;
  const sec = document.querySelector(`[data-step="${bab}"]`);
  if (!sec) return;
  const yr = p.get('tahun');
  if (yr && YEARS.includes(yr)) {
    currentYear = yr;
    document.querySelectorAll('.year-btn').forEach((b) => b.classList.toggle('active', b.dataset.year === yr));
  }
  const layer = p.get('layer');
  currentChapter = bab;
  currentSublayer = null;
  sec.querySelectorAll('.pill-btn').forEach((pill, idx) => {
    const hit = layer ? pill.dataset.sublayer === layer : idx === 0;
    pill.classList.toggle('active', hit);
    if (hit) currentSublayer = pill.dataset.sublayer;
  });
  document.querySelectorAll('.step').forEach((s) => s.classList.remove('active'));
  sec.classList.add('active');
  restoring = true;
  setTimeout(() => { sec.scrollIntoView({ block: 'start', behavior: 'instant' }); }, 60);
  setTimeout(() => { restoring = false; }, 900);
}

// ============================================================================
// 10. INTERAKSI: SCROLL, TAHUN, PILL, TAB, TOOLS, LIGHTBOX
// ============================================================================
const fill = $('scroll-progress-fill');
window.addEventListener('scroll', rafThrottle(() => {
  const h = document.documentElement.scrollHeight - window.innerHeight;
  const pct = h > 0 ? Math.min(100, Math.max(0, (window.scrollY / h) * 100)) : 0;
  if (fill) fill.style.width = `${pct}%`;
}), { passive: true });

// Tinggi top bar → variabel CSS (dipakai untuk posisi peta sticky)
const topbar = $('top-progress-wrap');
function syncTopbarHeight() {
  if (!topbar) return;
  document.documentElement.style.setProperty('--topbar-h', `${topbar.offsetHeight}px`);
}
syncTopbarHeight();
if ('ResizeObserver' in window && topbar) new ResizeObserver(syncTopbarHeight).observe(topbar);

document.querySelectorAll('.year-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.year-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentYear = btn.dataset.year;
    clearUserOverlays();
    renderOverlayList();
    renderScene({ refit: false });
  });
});

document.querySelectorAll('.pill-btn').forEach((pill) => {
  pill.addEventListener('click', () => {
    pill.closest('.layer-pills').querySelectorAll('.pill-btn').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    currentSublayer = pill.dataset.sublayer;
    renderScene({ refit: false });
  });
});

document.querySelectorAll('.tab-btn').forEach((tab) => {
  tab.addEventListener('click', () => {
    const card = tab.closest('.step');
    card.querySelectorAll('.tab-btn').forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    card.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    const panel = document.getElementById(`tab-${tab.dataset.tab}`);
    if (panel) panel.classList.add('active');
  });
});

// Tabel lebar → bisa digeser horizontal di HP
document.querySelectorAll('.data-table').forEach((t) => {
  const wrap = document.createElement('div');
  wrap.className = 'table-scroll';
  t.parentNode.insertBefore(wrap, t);
  wrap.appendChild(t);
});

// Panel "Lapisan"
const toolsBtn = $('tools-btn'), toolsPanel = $('tools-panel');
if (toolsBtn && toolsPanel) {
  const setTools = (open) => { toolsPanel.hidden = !open; toolsBtn.setAttribute('aria-expanded', String(open)); };
  toolsBtn.addEventListener('click', () => setTools(toolsPanel.hidden));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !toolsPanel.hidden) setTools(false); });
  L.DomEvent.disableClickPropagation(toolsPanel);
  L.DomEvent.disableScrollPropagation(toolsPanel);
}
const opRange = $('opacity-range'), opOut = $('opacity-out');
if (opRange) {
  opRange.addEventListener('input', () => {
    opacityMul = Number(opRange.value) / 100;
    if (opOut) opOut.textContent = `${opRange.value}%`;
    applyOpacity();
  });
}

// Tombol peta: kembali ke tampilan bab & perbesar/perkecil peta (HP)
const homeBtn = $('map-home-btn');
if (homeBtn) homeBtn.addEventListener('click', () => { const c = chapterMeta[currentChapter]; if (c) flyToOffset(c.center, c.zoom); });
const expandBtn = $('map-expand-btn');
const mapCol = document.querySelector('.map-column');
if (expandBtn && mapCol) {
  expandBtn.addEventListener('click', () => {
    const tall = mapCol.classList.toggle('map-tall');
    expandBtn.setAttribute('aria-pressed', String(tall));
    expandBtn.textContent = tall ? 'Perkecil peta' : 'Perbesar peta';
    setTimeout(() => map.invalidateSize(), 320);
  });
}

// Lightbox
(function initLightbox() {
  const modal = $('lightbox-modal'), img = $('lightbox-img'), cap = $('lightbox-caption');
  if (!modal || !img || !cap) return;
  const close = () => { modal.hidden = true; img.removeAttribute('src'); };
  document.querySelectorAll('.figure-box').forEach((box) => {
    box.setAttribute('tabindex', '0');
    box.setAttribute('role', 'button');
    const open = () => {
      const im = box.querySelector('img');
      if (!im || im.style.display === 'none') return;
      img.src = im.currentSrc || im.src;
      img.alt = im.alt || '';
      const c = box.querySelector('.figure-caption');
      cap.textContent = c ? c.textContent.trim() : '';
      modal.hidden = false;
    };
    box.addEventListener('click', open);
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  const bd = $('lightbox-close');
  if (bd) bd.addEventListener('click', close);
  const body = modal.querySelector('.lightbox-body');
  if (body) body.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
})();

// ============================================================================
// 11. OBSERVER BAB (menentukan bab aktif saat menggulir)
// ============================================================================
const observer = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
  if (restoring) return;
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const newChapter = entry.target.dataset.step || (entry.target.classList.contains('hero-cover') ? 'sampul' : null);
    if (!newChapter) return;
    document.querySelectorAll('.step').forEach((s) => s.classList.remove('active'));
    entry.target.classList.add('active');
    if (newChapter === currentChapter) return;
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
  });
}, { rootMargin: '-45% 0px -45% 0px', threshold: 0 }) : null;
if (observer) document.querySelectorAll('.step, .hero-cover').forEach((sec) => observer.observe(sec));

// ============================================================================
// 12. START
// ============================================================================
renderOverlayList();
restoreFromHash();
renderScene();

window.addEventListener('resize', rafThrottle(() => map.invalidateSize()));
window.addEventListener('orientationchange', () => setTimeout(() => { syncTopbarHeight(); map.invalidateSize(); }, 250));
