// ============================================================================
// 1. KONFIGURASI GOOGLE DRIVE (ISI 2 BARIS INI SAJA)
// ============================================================================
const DRIVE_FOLDER_ID = '1cShz78J7EnXJ8tngWHnU2W7dzcO7uuPc';
// PENTING: batasi key ini di Google Cloud (HTTP referrer github.io + Drive API saja) & ganti key lama.
const DRIVE_API_KEY   = 'AIzaSyCsL4Gs00TIkvItUOhFp2mCmOkhdgPN4Ak';

// Cadangan Google Apps Script /exec (otomatis terlewati jika API Key di atas diisi)
const DRIVE_API_URL   = 'https://script.google.com/macros/s/AKfycbzrQ8NM9zL704M6IxDGBVfSuoYNz-66npZH3d9oH-g2lmbYZPThwexujHwQ_nGU2YFc/exec';

// Toleransi kompresi geometri otomatis di browser (0.0004 derajat ≈ 44 meter)
const SIMPLIFY_TOLERANCE = 0.0004;

// ============================================================================
// 2. INISIALISASI PETA LEAFLET CANVAS & 100% BASEMAP RESMI ESRI
// ============================================================================
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

const layerControl = L.control.layers(
  {
    'Esri Canvas Terang (Utama)': esriCanvasTerang,
    'Esri Topografi Leuser': esriTopo,
    'Esri Citra Satelit': esriSat,
    'Esri NatGeo Map': esriNatGeo
  },
  {},
  { collapsed: true }
).addTo(map);

// ============================================================================
// 3. PEMETAAN 7 SUBFOLDER GOOGLE DRIVE ("Geojson lomba")
// ============================================================================
const paramFolder = (yr) => (yr === '2019' ? '03_Parameter_2019' : yr === '2021' ? '04_Parameter_2021' : '05_Parameter_2025');

const DRIVE_SPECS = {
  // Folder 01: Batas & Data Pendukung
  batas_tngl: { folder: '01_Batas_Dan_Data_Pendukung', file: '01_Batas_Kawasan_Inti_TNGL.geojson', kw: ['batas', 'inti', 'tngl'] },
  buffer_luar: { folder: '01_Batas_Dan_Data_Pendukung', file: '02_Zona_Buffer_100km_Luar_TNGL.geojson', kw: ['buffer', 'luar'] },
  elevasi: { folder: '01_Batas_Dan_Data_Pendukung', file: '06_Klasifikasi_Elevasi_DEM.geojson', kw: ['elevasi', 'dem'] },
  lereng: { folder: '01_Batas_Dan_Data_Pendukung', file: '07_Klasifikasi_Kemiringan_Lereng.geojson', kw: ['lereng', 'slope'] },
  zonasi_jarak: { folder: '01_Batas_Dan_Data_Pendukung', file: '10_Klasifikasi_Zonasi_Jarak_TNGL.geojson', kw: ['zonasi', 'jarak'] },

  // Folder 02: Tutupan Hutan & Permukiman
  dinamika_hutan: { folder: '02_Tutupan_Hutan_Dan_Permukiman', file: '02_Dinamika_Perubahan_Hutan_2019_2025.geojson', kw: ['dinamika', 'kehilangan', 'deforestasi'] },
  status_hutan: (yr) => ({ folder: '02_Tutupan_Hutan_Dan_Permukiman', file: `01_Status_Tutupan_Hutan_${yr}.geojson`, kw: ['status', 'tutupan', yr], year: yr }),

  // Folder 03, 04, 05: Parameter Biofisik Multi-Tahun (2019, 2021, 2025)
  carbon_stock: (yr) => ({ folder: paramFolder(yr), file: `01_Cadangan_Karbon_${yr}.geojson`, kw: ['karbon', 'carbon_stock'], year: yr }),
  agb: (yr) => ({ folder: paramFolder(yr), file: `02_Biomassa_AGB_${yr}.geojson`, kw: ['biomassa', 'agb'], year: yr }),
  lst: (yr) => ({ folder: paramFolder(yr), file: `03_Suhu_Permukaan_LST_${yr}.geojson`, kw: ['suhu', 'lst'], year: yr }),
  uhi: (yr) => ({ folder: paramFolder(yr), file: `04_Pulau_Bahang_UHI_${yr}.geojson`, kw: ['uhi', 'bahang'], year: yr }),
  utfvi: (yr) => ({ folder: paramFolder(yr), file: `05_Stres_Termal_UTFVI_${yr}.geojson`, kw: ['utfvi', 'stres'], year: yr }),
  ndbi: (yr) => ({ folder: paramFolder(yr), file: `12_Kawasan_Terbangun_NDBI_${yr}.geojson`, kw: ['ndbi', 'terbangun'], year: yr }),
  sar: (yr) => ({ folder: paramFolder(yr), file: `14_Radar_Kanopi_SAR_VH_${yr}.geojson`, kw: ['sar', 'radar'], year: yr }),
  carbon_rate: { folder: '05_Parameter_2025', file: '15_Laju_Carbon_Rate_2019_2025.geojson', kw: ['rate', 'laju'] },

  // Folder 06: Delta Perubahan 2025 vs 2019
  delta_carbon: { folder: '06_Delta_Perubahan_2019_2025', file: '01_Delta_Carbon_Stock_2025_vs_2019.geojson', kw: ['carbon', 'karbon'] },
  delta_lst: { folder: '06_Delta_Perubahan_2019_2025', file: '02_Delta_Suhu_LST_2025_vs_2019.geojson', kw: ['lst', 'suhu'] },
  delta_ndvi: { folder: '06_Delta_Perubahan_2019_2025', file: '05_Delta_Vegetasi_NDVI_2025_vs_2019.geojson', kw: ['ndvi', 'vegetasi'] },
  delta_ndbi: { folder: '06_Delta_Perubahan_2019_2025', file: '08_Delta_Terbangun_NDBI_2025_vs_2019.geojson', kw: ['ndbi', 'terbangun'] },

  // Folder 07: Titik Sampel Validasi Statistik
  sampel_dalam: { folder: '07_Titik_Sampel_Dan_Ringkasan', file: '01_Titik_Sampel_Dalam_TNGL.geojson', kw: ['dalam', 'tngl'] },
  sampel_luar: { folder: '07_Titik_Sampel_Dan_Ringkasan', file: '02_Titik_Sampel_Permukiman_Buffer.geojson', kw: ['luar', 'buffer', 'permukiman'] }
};

// ============================================================================
// 4. KOMPRESOR GEOJSON REAL-TIME DI BROWSER (ITERATIVE DOUGLAS-PEUCKER)
// ============================================================================
const ALLOWED_PROPS = new Set([
  'Kategori', 'Parameter', 'Tahun', 'Rentang_Nilai', 'Luas_Ha',
  'Persentase_Area', 'Interpretasi', 'Warna_Hex', 'Kelas_Kode',
  'Zona', 'Carbon_Stock', 'LST', 'UHI', 'UTFVI', 'NDVI', 'NDMI',
  'NDBI', 'SAR_VH', 'Elevation', 'Slope', 'Name'
]);

const round5 = (n) => Math.round(n * 1e5) / 1e5;

// Helper aman untuk HTML (cegah XSS dari atribut GeoJSON) & angka kosong
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeColor = (c, fallback) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.trim()) ? c.trim() : fallback);
const fmtNum = (v, d) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '-' : Number(v).toFixed(d));

function perpDistanceSq(p, a, b) {
  let x = a[0], y = a[1];
  let dx = b[0] - x, dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function simplifyCoordsIterative(coords, tolerance, isPolygonRing) {
  const len = coords.length;
  if (len <= 6) {
    return coords.map((c) => [round5(c[0]), round5(c[1])]);
  }

  const sqTol = tolerance * tolerance;
  const keep = new Uint8Array(len);
  keep[0] = 1;
  keep[len - 1] = 1;

  const stack = [[0, len - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxSqDist = 0;
    let index = 0;

    for (let i = first + 1; i < last; i++) {
      const sqDist = perpDistanceSq(coords[i], coords[first], coords[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTol) {
      keep[index] = 1;
      if (index - first > 1) stack.push([first, index]);
      if (last - index > 1) stack.push([index, last]);
    }
  }

  const out = [];
  for (let i = 0; i < len; i++) {
    if (keep[i]) {
      out.push([round5(coords[i][0]), round5(coords[i][1])]);
    }
  }

  if (isPolygonRing && out.length < 4) {
    return coords.map((c) => [round5(c[0]), round5(c[1])]);
  }
  return out;
}

function compressGeometry(geom, tolerance) {
  if (!geom || !geom.coordinates) return geom;
  const t = geom.type;
  if (t === 'Point') {
    return { type: t, coordinates: [round5(geom.coordinates[0]), round5(geom.coordinates[1])] };
  }
  if (t === 'MultiPoint') {
    return { type: t, coordinates: geom.coordinates.map((c) => [round5(c[0]), round5(c[1])]) };
  }
  if (t === 'LineString') {
    return { type: t, coordinates: simplifyCoordsIterative(geom.coordinates, tolerance, false) };
  }
  if (t === 'MultiLineString') {
    return { type: t, coordinates: geom.coordinates.map((line) => simplifyCoordsIterative(line, tolerance, false)) };
  }
  if (t === 'Polygon') {
    return { type: t, coordinates: geom.coordinates.map((ring) => simplifyCoordsIterative(ring, tolerance, true)) };
  }
  if (t === 'MultiPolygon') {
    return {
      type: t,
      coordinates: geom.coordinates.map((poly) => poly.map((ring) => simplifyCoordsIterative(ring, tolerance, true)))
    };
  }
  return geom;
}

function compressGeoJSONInMemory(rawGj, tolerance = SIMPLIFY_TOLERANCE) {
  if (!rawGj || !Array.isArray(rawGj.features)) return rawGj;

  const compressedFeatures = rawGj.features.map((feat) => {
    const cleanProps = {};
    if (feat.properties) {
      for (const key of Object.keys(feat.properties)) {
        if (ALLOWED_PROPS.has(key)) {
          cleanProps[key] = feat.properties[key];
        }
      }
    }
    return {
      type: 'Feature',
      properties: cleanProps,
      geometry: compressGeometry(feat.geometry, tolerance)
    };
  });

  return { type: 'FeatureCollection', features: compressedFeatures };
}

// ============================================================================
// 5. ENGINE PENGAMBILAN DATA GOOGLE DRIVE (DIRECT API V3 & FALLBACK SCRIPT)
// ============================================================================
const geojsonCache = {};
const layerInstances = {};
const catalogByFolder = {};
let activeDataLayers = [];
let currentYear = '2025';
let currentChapter = 'sampul';
let currentSublayer = null;
let apiDiagnosticError = null;
let pendingLoads = 0;

const loaderToast = document.getElementById('loader-toast');

function useDirectDriveAPI() {
  return (
    DRIVE_API_KEY &&
    !DRIVE_API_KEY.includes('PASTE_GOOGLE_DRIVE') &&
    DRIVE_FOLDER_ID &&
    !DRIVE_FOLDER_ID.includes('PASTE_ID_FOLDER')
  );
}

function setApiStatusError(shortTitle, detailMsg) {
  if (!apiDiagnosticError) apiDiagnosticError = detailMsg;
  const brandEl = document.getElementById('brand-title');
  const dotEl = document.getElementById('sync-dot');
  if (brandEl) brandEl.textContent = `STORYMAP TNGL • ${shortTitle}`;
  if (dotEl) {
    dotEl.style.background = '#dc2626';
    dotEl.style.boxShadow = '0 0 8px rgba(220, 38, 38, 0.7)';
  }
}

async function fetchJSONSafe(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'follow' });
  if (!res.ok) {
    let extraMsg = '';
    try {
      const errBody = await res.json();
      if (errBody && errBody.error && errBody.error.message) {
        extraMsg = ` (${errBody.error.message})`;
      }
    } catch (_) {}
    throw new Error(`HTTP ${res.status}${extraMsg}: Pastikan Google Drive API aktif & folder "Geojson lomba" dibagikan publik (Anyone with the link).`);
  }
  const rawText = await res.text();
  const trimmed = rawText.trim();
  if (trimmed.startsWith('<')) {
    throw new Error(
      'Google mengembalikan halaman HTML Login. Isi DRIVE_FOLDER_ID & DRIVE_API_KEY di baris 4–5 app.js untuk akses langsung tanpa batas ukuran.'
    );
  }
  return JSON.parse(trimmed);
}

function resolveCatalogItem(specOrTuple) {
  if (Array.isArray(specOrTuple)) {
    const [fName, fn] = specOrTuple;
    const found = (catalogByFolder[fName] || []).find((x) => x.filename.toLowerCase() === fn.toLowerCase());
    return found || { folder: fName, filename: fn, fileId: null };
  }

  const list = catalogByFolder[specOrTuple.folder] || [];
  if (list.length === 0) return { folder: specOrTuple.folder, filename: specOrTuple.file, fileId: null };

  const exact = list.find((f) => f.filename.toLowerCase() === specOrTuple.file.toLowerCase());
  if (exact) return exact;

  const prefix = specOrTuple.file.slice(0, 3).toLowerCase();
  const byPrefix = list.find((f) => {
    const fn = f.filename.toLowerCase();
    return fn.startsWith(prefix) && (!specOrTuple.year || fn.includes(specOrTuple.year));
  });
  if (byPrefix) { console.warn('[Drive] Nama file tidak persis, memakai kecocokan prefix:', byPrefix.filename); return byPrefix; }

  if (specOrTuple.kw && specOrTuple.kw.length > 0) {
    const byKw = list.find((f) => specOrTuple.kw.some((k) => f.filename.toLowerCase().includes(k.toLowerCase())));
    if (byKw) { console.warn('[Drive] Nama file tidak persis, memakai kecocokan kata kunci:', byKw.filename); return byKw; }
  }

  return { folder: specOrTuple.folder, filename: specOrTuple.file, fileId: null };
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

async function getDriveGeoJSONLayer(specOrTuple, options = {}) {
  if (!specOrTuple) return null;

  const item = resolveCatalogItem(specOrTuple);
  const cacheKey = `${item.folder}/${item.filename}`;
  if (layerInstances[cacheKey]) return layerInstances[cacheKey];

  loaderToast.textContent = `Memuat & mengompresi [${item.folder.slice(0, 2)}]: ${item.filename}...`;
  pendingLoads++;
  loaderToast.classList.remove('hidden');

  try {
    if (!geojsonCache[cacheKey]) {
      let rawData;
      if (useDirectDriveAPI() && item.fileId) {
        const directUrl = `https://www.googleapis.com/drive/v3/files/${item.fileId}?alt=media&key=${encodeURIComponent(DRIVE_API_KEY)}`;
        rawData = await fetchJSONSafe(directUrl);
      } else {
        if (DRIVE_API_URL.includes('PASTE_ID_DEPLOYMENT') || !DRIVE_API_URL.includes('/exec')) {
          throw new Error('Isi DRIVE_FOLDER_ID & DRIVE_API_KEY di baris 4–5 app.js untuk memuat seluruh GeoJSON.');
        }
        const apiUrl = `${DRIVE_API_URL}?action=getFile&folder=${encodeURIComponent(item.folder)}&file=${encodeURIComponent(item.filename)}`;
        rawData = await fetchJSONSafe(apiUrl);
        if (rawData.error) throw new Error(rawData.error);
      }

      // Kompresi geometri & atribut otomatis di memori browser sebelum dirender ke peta
      geojsonCache[cacheKey] = compressGeoJSONInMemory(rawData);
    }

    const gjData = geojsonCache[cacheKey];
    const interactive = options.interactive !== false;
    const layer = L.geoJSON(gjData, {
      interactive,
      style: (feature) => {
        const p = feature.properties || {};
        return {
          fillColor: options.fillColor || p.Warna_Hex || '#15803d',
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
          fillColor: p.Warna_Hex || '#0d9488',
          color: '#ffffff',
          weight: 1.2,
          fillOpacity: 0.92
        });
      },
      onEachFeature: (feature, lyr) => {
        if (interactive && feature.properties) {
          lyr.bindPopup(buildPopupHTML(feature.properties), { maxWidth: 300 });
        }
      }
    });

    layerInstances[cacheKey] = layer;
    layer._rawGeoJSON = gjData;
    return layer;
  } catch (err) {
    setApiStatusError('KONEKSI DRIVE TERKENDALA', err.message);
    return null;
  } finally {
    pendingLoads = Math.max(0, pendingLoads - 1);
    if (pendingLoads === 0) loaderToast.classList.add('hidden');
  }
}

async function listDriveFilesViaApiV3(parentId) {
  const q = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
  const fields = encodeURIComponent('files(id,name,mimeType,size,modifiedTime)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=200&key=${encodeURIComponent(DRIVE_API_KEY)}`;
  const data = await fetchJSONSafe(url);
  return data.files || [];
}

async function syncDriveCatalog() {
  try {
    let filesList = [];

    if (useDirectDriveAPI()) {
      const topItems = await listDriveFilesViaApiV3(DRIVE_FOLDER_ID);

      // Baca isi semua subfolder secara paralel
      const folders = topItems.filter((e) => e.mimeType === 'application/vnd.google-apps.folder');
      const results = await Promise.all(
        folders.map((f) => listDriveFilesViaApiV3(f.id).then((files) => ({ folder: f.name, files })))
      );

      results.forEach(({ folder, files }) => {
        files.forEach((f) => {
          if (f.name.toLowerCase().endsWith('.geojson')) {
            filesList.push({
              folder,
              filename: f.name,
              fileId: f.id,
              lastUpdated: f.modifiedTime || new Date().toISOString(),
              sizeKB: Math.round(Number(f.size || 0) / 1024)
            });
          }
        });
      });

      // File .geojson yang langsung berada di folder induk
      topItems.forEach((e) => {
        if (e.mimeType !== 'application/vnd.google-apps.folder' && e.name.toLowerCase().endsWith('.geojson')) {
          filesList.push({
            folder: '',
            filename: e.name,
            fileId: e.id,
            lastUpdated: e.modifiedTime || new Date().toISOString(),
            sizeKB: Math.round(Number(e.size || 0) / 1024)
          });
        }
      });

      filesList.sort((a, b) => (a.folder + a.filename).localeCompare(b.folder + b.filename));
    } else {
      if (DRIVE_API_URL.includes('PASTE_ID_DEPLOYMENT') || !DRIVE_API_URL.includes('/exec')) {
        setApiStatusError(
          'KONFIGURASI DRIVE BELUM DIISI',
          'Isi DRIVE_FOLDER_ID & DRIVE_API_KEY di baris 4–5 file app.js di GitHub untuk memuat seluruh file GeoJSON besar tanpa batas ukuran.'
        );
        return;
      }
      const meta = await fetchJSONSafe(`${DRIVE_API_URL}?action=catalog`);
      if (meta.error) throw new Error(meta.error);
      if (meta.status === 'ok' && meta.files) filesList = meta.files;
    }

    if (filesList.length === 0) {
      setApiStatusError('DRIVE KOSONG', 'Tidak ada file .geojson ditemukan. Periksa DRIVE_FOLDER_ID dan pastikan folder dibagikan publik (Anyone with the link).');
      return;
    }

    apiDiagnosticError = null;
    filesList.forEach((item) => {
      if (!catalogByFolder[item.folder]) catalogByFolder[item.folder] = [];
      catalogByFolder[item.folder].push(item);

      const proxyLayer = L.layerGroup();
      const prefix = item.folder ? `[${item.folder.slice(0, 2)}] ` : '';
      const sizeTag = item.sizeKB ? ` (${(item.sizeKB / 1024).toFixed(1)} MB)` : '';
      const label = `${prefix}${item.filename.replace('.geojson', '').replace(/_/g, ' ')}${sizeTag}`;
      proxyLayer.on('add', async () => {
        const realLayer = await getDriveGeoJSONLayer([item.folder, item.filename], { fillOpacity: 0.75 });
        if (realLayer) {
          realLayer.addTo(proxyLayer);
          updateLegendFromGeoJSON(realLayer._rawGeoJSON);
        }
      });
      layerControl.addOverlay(proxyLayer, label);
    });

    const latestDate = filesList
      .map((f) => new Date(f.lastUpdated))
      .sort((a, b) => b - a)[0]
      .toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      .toUpperCase();

    document.getElementById('brand-title').textContent = `STORYMAP TNGL • DRIVE SYNC (${filesList.length} FILE • ${latestDate})`;
  } catch (err) {
    setApiStatusError('KONEKSI DRIVE TERKENDALA', err.message);
  }
}

// ============================================================================
// 6. GRAFIK STATISTIK & LIGHTBOX ZOOM (GRAFIK + GALERI FOTO ACEH)
// ============================================================================
function initChartsAndLightbox() {
  const ctxKomp = document.getElementById('chartKomparasi');
  if (ctxKomp) {
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
  if (ctxDin) {
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
  const box = document.getElementById('map-legend');
  if (!gjData || !gjData.features || gjData.features.length === 0) {
    if (apiDiagnosticError) {
      box.innerHTML = `<h4 style="color:#dc2626">Status Koneksi Drive API</h4><small style="color:#334155;line-height:1.45">${esc(apiDiagnosticError)}</small>`;
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
  const cfg = chapterMeta[currentChapter];
  if (!cfg) return;

  const refit = opts.refit !== false;   // false = jangan gerakkan peta (ganti tahun / sublayer)
  const token = ++renderToken;
  const stale = () => token !== renderToken;

  document.getElementById('chapter-label').textContent = cfg.label;
  document.getElementById('chapter-counter').textContent = cfg.count;
  map.invalidateSize();

  await catalogReady;                    // katalog Drive harus siap dulu
  if (stale()) return;

  const lyrTngl = await getDriveGeoJSONLayer(DRIVE_SPECS.batas_tngl, {
    fillColor: '#15803d',
    strokeColor: '#0f4c3a',
    weight: 2.5,
    fillOpacity: 0.08,
    interactive: false                   // agar klik tembus ke layer data di bawahnya
  });
  if (stale()) return;

  const load = (spec, fillOpacity = 0.78) => getDriveGeoJSONLayer(spec, { fillOpacity });
  let primaryLayer = null;
  let extraLayers = [];
  let customLegend = null;

  if (currentChapter === 'sampul' || currentChapter === 'deliniasi') {
    const mode = currentSublayer || 'zonasi';
    const target = mode === 'elevasi' ? DRIVE_SPECS.elevasi : mode === 'lereng' ? DRIVE_SPECS.lereng : DRIVE_SPECS.zonasi_jarak;
    primaryLayer = await load(target, 0.72);
  } else if (currentChapter === 'hutan') {
    const mode = currentSublayer || 'dinamika_hutan';
    primaryLayer = await load(mode === 'status_hutan' ? DRIVE_SPECS.status_hutan(currentYear) : DRIVE_SPECS.dinamika_hutan);
  } else if (currentChapter === 'karbon') {
    const mode = currentSublayer || 'carbon_stock';
    primaryLayer = await load(mode === 'agb' ? DRIVE_SPECS.agb(currentYear) : mode === 'carbon_rate' ? DRIVE_SPECS.carbon_rate : DRIVE_SPECS.carbon_stock(currentYear));
  } else if (currentChapter === 'termal') {
    const mode = currentSublayer || 'lst';
    const targetMap = {
      lst: DRIVE_SPECS.lst(currentYear),
      uhi: DRIVE_SPECS.uhi(currentYear),
      utfvi: DRIVE_SPECS.utfvi(currentYear),
      ndbi: DRIVE_SPECS.ndbi(currentYear)
    };
    primaryLayer = await load(targetMap[mode]);
  } else if (currentChapter === 'delta') {
    const mode = currentSublayer || 'delta_carbon';
    const mapDelta = {
      delta_carbon: DRIVE_SPECS.delta_carbon,
      delta_lst: DRIVE_SPECS.delta_lst,
      delta_ndvi: DRIVE_SPECS.delta_ndvi,
      delta_ndbi: DRIVE_SPECS.delta_ndbi
    };
    primaryLayer = await load(mapDelta[mode]);
  } else if (currentChapter === 'validasi') {
    const mode = currentSublayer || 'sampel';
    if (mode === 'sar') {
      primaryLayer = await load(DRIVE_SPECS.sar(currentYear));
    } else {
      const [lyrIn, lyrOut] = await Promise.all([
        getDriveGeoJSONLayer(DRIVE_SPECS.sampel_dalam),
        getDriveGeoJSONLayer(DRIVE_SPECS.sampel_luar)
      ]);
      extraLayers = [lyrIn, lyrOut].filter(Boolean);
      customLegend = {
        features: [
          { properties: { Kategori: 'Titik Sampel Dalam TNGL', Rentang_Nilai: 'Klik titik untuk detail atribut', Warna_Hex: '#15803d' } },
          { properties: { Kategori: 'Titik Sampel Zona Luar', Rentang_Nilai: 'Klik titik untuk detail atribut', Warna_Hex: '#dc2626' } }
        ]
      };
    }
  } else if (currentChapter === 'dampak') {
    primaryLayer = await load(DRIVE_SPECS.delta_lst, 0.75);
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
  document.getElementById('scroll-progress-fill').style.width = `${pct}%`;
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

const catalogReady = syncDriveCatalog();   // dijalankan sekali; tidak pernah reject (error ditangani di dalam)

const observer = new IntersectionObserver((entries) => {
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
}, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

document.querySelectorAll('.step, .hero-cover').forEach((sec) => observer.observe(sec));

try {
  initChartsAndLightbox();
} catch (err) {
  console.error('Gagal inisialisasi grafik/lightbox:', err);
}
catalogReady.then(() => renderScene());
