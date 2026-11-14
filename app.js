// ============================================================================
// 1. KONFIGURASI ENDPOINT GOOGLE DRIVE (TEMPEL URL /EXEC ANDA DI BARIS INI)
// ============================================================================
const DRIVE_API_URL = 'https://script.google.com/macros/s/AKfycbzrQ8NM9zL704M6IxDGBVfSuoYNz-66npZH3d9oH-g2lmbYZPThwexujHwQ_nGU2YFc/exec';

// ============================================================================
// 2. INISIALISASI PETA LEAFLET & BASEMAP TERANG
// ============================================================================
const map = L.map('map', {
  center: [3.55, 97.45],
  zoom: 8,
  zoomControl: true
});

const cartoLight = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  { subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap © CARTO' }
).addTo(map);

const esriTopo = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 18, attribution: '© Esri World Topo' }
);

const esriSat = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 18, attribution: '© Esri World Imagery' }
);

const layerControl = L.control.layers(
  {
    'Peta Terang (CARTO Positron)': cartoLight,
    'Peta Topografi Terang (Esri)': esriTopo,
    'Citra Satelit (Esri)': esriSat
  },
  {},
  { collapsed: true }
).addTo(map);

// ============================================================================
// 3. PEMETAAN 7 SUBFOLDER GOOGLE DRIVE ("Geojson lomba")
// ============================================================================
const paramFolder = (yr) => (yr === '2019' ? '03_Parameter_2019' : yr === '2021' ? '04_Parameter_2021' : '05_Parameter_2025');

const DRIVE_SPECS = {
  batas_tngl: { folder: '01_Batas_Dan_Data_Pendukung', file: '01_Batas_Kawasan_Inti_TNGL.geojson', kw: ['batas', 'inti', 'tngl'] },
  buffer_luar: { folder: '01_Batas_Dan_Data_Pendukung', file: '02_Zona_Buffer_100km_Luar_TNGL.geojson', kw: ['buffer', 'luar'] },
  elevasi: { folder: '01_Batas_Dan_Data_Pendukung', file: '06_Klasifikasi_Elevasi_DEM.geojson', kw: ['elevasi', 'dem'] },
  lereng: { folder: '01_Batas_Dan_Data_Pendukung', file: '07_Klasifikasi_Kemiringan_Lereng.geojson', kw: ['lereng', 'slope'] },
  zonasi_jarak: { folder: '01_Batas_Dan_Data_Pendukung', file: '10_Klasifikasi_Zonasi_Jarak_TNGL.geojson', kw: ['zonasi', 'jarak'] },

  dinamika_hutan: { folder: '02_Tutupan_Hutan_Dan_Permukiman', file: '02_Dinamika_Perubahan_Hutan_2019_2025.geojson', kw: ['dinamika', 'kehilangan', 'deforestasi'] },
  status_hutan: (yr) => ({ folder: '02_Tutupan_Hutan_Dan_Permukiman', file: `01_Status_Tutupan_Hutan_${yr}.geojson`, kw: ['status', 'tutupan', yr], year: yr }),

  carbon_stock: (yr) => ({ folder: paramFolder(yr), file: `01_Cadangan_Karbon_${yr}.geojson`, kw: ['karbon', 'carbon_stock'], year: yr }),
  agb: (yr) => ({ folder: paramFolder(yr), file: `02_Biomassa_AGB_${yr}.geojson`, kw: ['biomassa', 'agb'], year: yr }),
  lst: (yr) => ({ folder: paramFolder(yr), file: `03_Suhu_Permukaan_LST_${yr}.geojson`, kw: ['suhu', 'lst'], year: yr }),
  uhi: (yr) => ({ folder: paramFolder(yr), file: `04_Pulau_Bahang_UHI_${yr}.geojson`, kw: ['uhi', 'bahang'], year: yr }),
  utfvi: (yr) => ({ folder: paramFolder(yr), file: `05_Stres_Termal_UTFVI_${yr}.geojson`, kw: ['utfvi', 'stres'], year: yr }),
  ndbi: (yr) => ({ folder: paramFolder(yr), file: `12_Kawasan_Terbangun_NDBI_${yr}.geojson`, kw: ['ndbi', 'terbangun'], year: yr }),
  sar: (yr) => ({ folder: paramFolder(yr), file: `14_Radar_Kanopi_SAR_VH_${yr}.geojson`, kw: ['sar', 'radar'], year: yr }),
  carbon_rate: { folder: '05_Parameter_2025', file: '15_Laju_Carbon_Rate_2019_2025.geojson', kw: ['rate', 'laju'] },

  delta_carbon: { folder: '06_Delta_Perubahan_2019_2025', file: '01_Delta_Carbon_Stock_2025_vs_2019.geojson', kw: ['carbon', 'karbon'] },
  delta_lst: { folder: '06_Delta_Perubahan_2019_2025', file: '02_Delta_Suhu_LST_2025_vs_2019.geojson', kw: ['lst', 'suhu'] },
  delta_ndvi: { folder: '06_Delta_Perubahan_2019_2025', file: '05_Delta_Vegetasi_NDVI_2025_vs_2019.geojson', kw: ['ndvi', 'vegetasi'] },
  delta_ndbi: { folder: '06_Delta_Perubahan_2019_2025', file: '08_Delta_Terbangun_NDBI_2025_vs_2019.geojson', kw: ['ndbi', 'terbangun'] },

  sampel_dalam: { folder: '07_Titik_Sampel_Dan_Ringkasan', file: '01_Titik_Sampel_Dalam_TNGL.geojson', kw: ['dalam', 'tngl'] },
  sampel_luar: { folder: '07_Titik_Sampel_Dan_Ringkasan', file: '02_Titik_Sampel_Permukiman_Buffer.geojson', kw: ['luar', 'buffer', 'permukiman'] }
};

// ============================================================================
// 4. ENGINE DIAGNOSTIK & PEMUATAN GEOJSON GOOGLE DRIVE
// ============================================================================
const geojsonCache = {};
const layerInstances = {};
const catalogByFolder = {};
let activeDataLayers = [];
let currentYear = '2025';
let currentChapter = 'sampul';
let currentSublayer = null;
let apiDiagnosticError = null;

const loaderToast = document.getElementById('loader-toast');

function setApiStatusError(shortTitle, detailMsg) {
  apiDiagnosticError = detailMsg;
  const brandEl = document.getElementById('brand-title');
  const dotEl = document.getElementById('sync-dot');
  if (brandEl) brandEl.textContent = `STORYMAP TNGL • ${shortTitle}`;
  if (dotEl) {
    dotEl.style.background = '#dc2626';
    dotEl.style.boxShadow = '0 0 8px rgba(220, 38, 38, 0.7)';
  }
}

async function fetchAppsScriptJSON(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'follow' });
  const rawText = await res.text();
  const trimmed = rawText.trim();

  if (trimmed.startsWith('<')) {
    throw new Error(
      'API mengembalikan halaman HTML Login Google. Pastikan: (1) URL di app.js berakhiran /exec (bukan /dev), (2) Deploy Apps Script diatur Who has access = Anyone dengan New version, dan (3) gunakan akun @gmail.com biasa jika akun kampus memblokir akses publik.'
    );
  }
  return JSON.parse(trimmed);
}

function resolveFileFromCatalog(spec) {
  if (!spec) return null;
  const list = catalogByFolder[spec.folder] || [];
  if (list.length === 0) return [spec.folder, spec.file];

  const exact = list.find((f) => f.filename.toLowerCase() === spec.file.toLowerCase());
  if (exact) return [spec.folder, exact.filename];

  const prefix = spec.file.slice(0, 3).toLowerCase();
  const byPrefix = list.find((f) => {
    const fn = f.filename.toLowerCase();
    return fn.startsWith(prefix) && (!spec.year || fn.includes(spec.year));
  });
  if (byPrefix) return [spec.folder, byPrefix.filename];

  if (spec.kw && spec.kw.length > 0) {
    const byKw = list.find((f) => spec.kw.some((k) => f.filename.toLowerCase().includes(k.toLowerCase())));
    if (byKw) return [spec.folder, byKw.filename];
  }

  return [spec.folder, spec.file];
}

function buildPopupHTML(props) {
  if (props.Zona) {
    return `
      <strong>${props.Zona}</strong>
      <table class="popup-table">
        <tr><td>Carbon Stock</td><td>${Number(props.Carbon_Stock || 0).toFixed(2)} Ton/Ha</td></tr>
        <tr><td>Suhu LST</td><td>${Number(props.LST || 0).toFixed(2)} °C</td></tr>
        <tr><td>UHI / UTFVI</td><td>${Number(props.UHI || 0).toFixed(2)} / ${Number(props.UTFVI || 0).toFixed(4)}</td></tr>
        <tr><td>NDVI / NDMI</td><td>${Number(props.NDVI || 0).toFixed(3)} / ${Number(props.NDMI || 0).toFixed(3)}</td></tr>
        <tr><td>NDBI / SAR VH</td><td>${Number(props.NDBI || 0).toFixed(3)} / ${Number(props.SAR_VH || 0).toFixed(2)} dB</td></tr>
        <tr><td>Elevasi / Lereng</td><td>${Number(props.Elevation || 0).toFixed(0)} mdpl / ${Number(props.Slope || 0).toFixed(1)}°</td></tr>
      </table>
    `;
  }

  const luasFmt = props.Luas_Ha ? Number(props.Luas_Ha).toLocaleString('id-ID') + ' Ha' : '-';
  const pctFmt = props.Persentase_Area ? props.Persentase_Area + ' %' : '-';
  return `
    <strong style="color:${props.Warna_Hex || '#15803d'}">${props.Kategori || props.Name || 'Objek Spasial'}</strong>
    <table class="popup-table">
      <tr><td>Parameter</td><td>${props.Parameter || '-'} (${props.Tahun || '-'})</td></tr>
      <tr><td>Kriteria</td><td>${props.Rentang_Nilai || '-'}</td></tr>
      <tr><td>Luas Area</td><td>${luasFmt} (${pctFmt})</td></tr>
      <tr><td>Keterangan</td><td>${props.Interpretasi || '-'}</td></tr>
    </table>
  `;
}

async function getDriveGeoJSONLayer(specOrTuple, options = {}) {
  if (!specOrTuple) return null;

  if (DRIVE_API_URL.includes('PASTE_ID_DEPLOYMENT') || !DRIVE_API_URL.includes('/exec')) {
    setApiStatusError(
      'URL /EXEC BELUM DIISI DI APP.JS',
      'Buka file app.js di GitHub dan tempel Web App URL Google Apps Script berakhiran /exec pada baris ke-4.'
    );
    return null;
  }

  const [folderName, fileName] = Array.isArray(specOrTuple)
    ? specOrTuple
    : resolveFileFromCatalog(specOrTuple);

  const cacheKey = `${folderName}/${fileName}`;
  if (layerInstances[cacheKey]) return layerInstances[cacheKey];

  loaderToast.textContent = `Memuat [${folderName.slice(0, 2)}]: ${fileName}...`;
  loaderToast.classList.remove('hidden');

  try {
    if (!geojsonCache[cacheKey]) {
      const apiUrl = `${DRIVE_API_URL}?action=getFile&folder=${encodeURIComponent(folderName)}&file=${encodeURIComponent(fileName)}`;
      const data = await fetchAppsScriptJSON(apiUrl);
      if (data.error) throw new Error(data.error);
      geojsonCache[cacheKey] = data;
    }

    const gjData = geojsonCache[cacheKey];
    const layer = L.geoJSON(gjData, {
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
        if (feature.properties) {
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
    loaderToast.classList.add('hidden');
  }
}

async function syncDriveCatalog() {
  if (DRIVE_API_URL.includes('PASTE_ID_DEPLOYMENT') || !DRIVE_API_URL.includes('/exec')) {
    setApiStatusError(
      'URL /EXEC BELUM DIISI DI APP.JS',
      'Buka file app.js di GitHub dan tempel Web App URL Google Apps Script berakhiran /exec pada baris ke-4.'
    );
    return;
  }

  try {
    const meta = await fetchAppsScriptJSON(`${DRIVE_API_URL}?action=catalog`);
    if (meta.error) throw new Error(meta.error);
    if (meta.status !== 'ok' || !meta.files) return;

    apiDiagnosticError = null;
    meta.files.forEach((item) => {
      if (!catalogByFolder[item.folder]) catalogByFolder[item.folder] = [];
      catalogByFolder[item.folder].push(item);

      const proxyLayer = L.layerGroup();
      const prefix = item.folder ? `[${item.folder.slice(0, 2)}] ` : '';
      const label = `${prefix}${item.filename.replace('.geojson', '').replace(/_/g, ' ')}`;
      proxyLayer.on('add', async () => {
        const realLayer = await getDriveGeoJSONLayer([item.folder, item.filename], { fillOpacity: 0.75 });
        if (realLayer) {
          realLayer.addTo(proxyLayer);
          updateLegendFromGeoJSON(realLayer._rawGeoJSON);
        }
      });
      layerControl.addOverlay(proxyLayer, label);
    });

    const latestDate = meta.files.length > 0
      ? meta.files.map((f) => new Date(f.lastUpdated)).sort((a, b) => b - a)[0].toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
      : 'AKTIF';

    document.getElementById('brand-title').textContent = `STORYMAP TNGL • DRIVE SYNC (${meta.total} FILE • ${latestDate})`;
  } catch (err) {
    setApiStatusError('API DRIVE TERKUNCI', err.message);
  }
}

// ============================================================================
// 5. GRAFIK STATISTIK & LIGHTBOX ZOOM
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
      } else if (img) {
        modalImg.src = img.src;
      } else {
        return;
      }

      modalCap.textContent = cap ? cap.textContent : '';
      modal.hidden = false;
    });
  });

  document.getElementById('lightbox-close').addEventListener('click', () => {
    modal.hidden = true;
  });
}

// ============================================================================
// 6. LEGENDA DINAMIS & PENGATURAN BAB PETA
// ============================================================================
function updateLegendFromGeoJSON(gjData, fallbackTitle = 'Legenda Peta') {
  const box = document.getElementById('map-legend');
  if (!gjData || !gjData.features || gjData.features.length === 0) {
    if (apiDiagnosticError) {
      box.innerHTML = `<h4 style="color:#dc2626">Status Koneksi Drive API</h4><small style="color:#334155;line-height:1.45">${apiDiagnosticError}</small>`;
    } else {
      box.innerHTML = `<h4>${fallbackTitle}</h4><small>Pilih layer dari ikon kontrol kanan atas peta.</small>`;
    }
    return;
  }

  const firstProps = gjData.features[0].properties || {};
  const title = firstProps.Parameter ? `${firstProps.Parameter} (${firstProps.Tahun || ''})` : fallbackTitle;
  const sorted = [...gjData.features].sort((a, b) => (a.properties.Kelas_Kode || 0) - (b.properties.Kelas_Kode || 0));

  const itemsHTML = sorted.map((feat) => {
    const p = feat.properties || {};
    const luasText = p.Luas_Ha ? ` • ${Number(p.Luas_Ha).toLocaleString('id-ID')} Ha` : '';
    return `
      <div class="legend-item">
        <span class="legend-color" style="background:${p.Warna_Hex || '#15803d'}"></span>
        <div class="legend-meta">
          <span>${p.Kategori || p.Zona || p.Name || 'Kelas Spasial'}</span>
          <small>${p.Rentang_Nilai || ''}${luasText}</small>
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

async function renderScene() {
  const cfg = chapterMeta[currentChapter];
  if (!cfg) return;

  document.getElementById('chapter-label').textContent = cfg.label;
  document.getElementById('chapter-counter').textContent = cfg.count;
  map.invalidateSize();
  map.flyTo(cfg.center, cfg.zoom, { duration: 1.1 });

  clearActiveLayers();

  const lyrTngl = await getDriveGeoJSONLayer(DRIVE_SPECS.batas_tngl, {
    fillColor: '#15803d',
    strokeColor: '#0f4c3a',
    weight: 2.5,
    fillOpacity: 0.08
  });
  if (lyrTngl) {
    lyrTngl.addTo(map);
    activeDataLayers.push(lyrTngl);
  }

  let primaryLayer = lyrTngl;

  if (currentChapter === 'sampul' || currentChapter === 'deliniasi') {
    const mode = currentSublayer || 'zonasi';
    const target = mode === 'elevasi' ? DRIVE_SPECS.elevasi : mode === 'lereng' ? DRIVE_SPECS.lereng : DRIVE_SPECS.zonasi_jarak;
    primaryLayer = await getDriveGeoJSONLayer(target, { fillOpacity: 0.72 });
  } else if (currentChapter === 'hutan') {
    const mode = currentSublayer || 'dinamika_hutan';
    const target = mode === 'status_hutan' ? DRIVE_SPECS.status_hutan(currentYear) : DRIVE_SPECS.dinamika_hutan;
    primaryLayer = await getDriveGeoJSONLayer(target, { fillOpacity: 0.78 });
  } else if (currentChapter === 'karbon') {
    const mode = currentSublayer || 'carbon_stock';
    const target = mode === 'agb' ? DRIVE_SPECS.agb(currentYear) : mode === 'carbon_rate' ? DRIVE_SPECS.carbon_rate : DRIVE_SPECS.carbon_stock(currentYear);
    primaryLayer = await getDriveGeoJSONLayer(target, { fillOpacity: 0.78 });
  } else if (currentChapter === 'termal') {
    const mode = currentSublayer || 'lst';
    const targetMap = {
      lst: DRIVE_SPECS.lst(currentYear),
      uhi: DRIVE_SPECS.uhi(currentYear),
      utfvi: DRIVE_SPECS.utfvi(currentYear),
      ndbi: DRIVE_SPECS.ndbi(currentYear)
    };
    primaryLayer = await getDriveGeoJSONLayer(targetMap[mode], { fillOpacity: 0.78 });
  } else if (currentChapter === 'delta') {
    const mode = currentSublayer || 'delta_carbon';
    const mapDelta = {
      delta_carbon: DRIVE_SPECS.delta_carbon,
      delta_lst: DRIVE_SPECS.delta_lst,
      delta_ndvi: DRIVE_SPECS.delta_ndvi,
      delta_ndbi: DRIVE_SPECS.delta_ndbi
    };
    primaryLayer = await getDriveGeoJSONLayer(mapDelta[mode], { fillOpacity: 0.78 });
  } else if (currentChapter === 'validasi') {
    const mode = currentSublayer || 'sampel';
    if (mode === 'sar') {
      primaryLayer = await getDriveGeoJSONLayer(DRIVE_SPECS.sar(currentYear), { fillOpacity: 0.78 });
    } else {
      const lyrIn = await getDriveGeoJSONLayer(DRIVE_SPECS.sampel_dalam);
      const lyrOut = await getDriveGeoJSONLayer(DRIVE_SPECS.sampel_luar);
      [lyrIn, lyrOut].forEach((l) => {
        if (l) { l.addTo(map); activeDataLayers.push(l); }
      });
      updateLegendFromGeoJSON({
        features: [
          { properties: { Kategori: 'Titik Sampel Dalam TNGL', Rentang_Nilai: 'Klik titik untuk detail atribut', Warna_Hex: '#15803d' } },
          { properties: { Kategori: 'Titik Sampel Zona Luar', Rentang_Nilai: 'Klik titik untuk detail atribut', Warna_Hex: '#dc2626' } }
        ]
      }, 'Validasi Sampel Spasial');
      return;
    }
  } else if (currentChapter === 'dampak') {
    primaryLayer = await getDriveGeoJSONLayer(DRIVE_SPECS.delta_lst, { fillOpacity: 0.75 });
  }

  if (primaryLayer) {
    primaryLayer.addTo(map);
    activeDataLayers.push(primaryLayer);
    if (lyrTngl) lyrTngl.bringToFront();
    updateLegendFromGeoJSON(primaryLayer._rawGeoJSON);

    const bounds = primaryLayer.getBounds();
    if (bounds.isValid() && Math.abs(bounds.getSouth()) <= 90 && Math.abs(bounds.getWest()) <= 180) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 10 });
    }
  } else {
    updateLegendFromGeoJSON(null, 'Kawasan Ekosistem Leuser');
  }
}

// ============================================================================
// 7. KONTROL INTERAKTIF & BILAH PROGRES BACA
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
    renderScene();
  });
});

document.querySelectorAll('.pill-btn').forEach((pill) => {
  pill.addEventListener('click', (e) => {
    const parent = e.target.closest('.layer-pills');
    parent.querySelectorAll('.pill-btn').forEach((p) => p.classList.remove('active'));
    e.target.classList.add('active');
    currentSublayer = e.target.dataset.sublayer;
    renderScene();
  });
});

document.querySelectorAll('.tab-btn').forEach((tab) => {
  tab.addEventListener('click', (e) => {
    const stepCard = e.target.closest('.step');
    stepCard.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
    stepCard.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    e.target.classList.add('active');
    document.getElementById(`tab-${e.target.dataset.tab}`).classList.add('active');
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      document.querySelectorAll('.step').forEach((s) => s.classList.remove('active'));
      entry.target.classList.add('active');
      currentChapter = entry.target.dataset.step;

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
}, { threshold: 0.35 });

document.querySelectorAll('.step, .hero-cover').forEach((sec) => observer.observe(sec));

initChartsAndLightbox();
syncDriveCatalog().then(() => renderScene());
