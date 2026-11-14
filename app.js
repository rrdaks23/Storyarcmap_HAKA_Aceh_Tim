// ============================================================================
// 1. KONFIGURASI GOOGLE DRIVE WEB APP API (GANTI DENGAN URL /exec ANDA)
// ============================================================================
const DRIVE_API_URL = 'https://script.google.com/macros/s/AKfycbxXg9WpIXAs9MFzVsJCyABorQdmZhfaWlpDeH7qYd6HUjMMF9ijKDLtjWVQbbTytNLp/exec';

// ============================================================================
// 2. INISIALISASI PETA LEAFLET & BASEMAP
// ============================================================================
const map = L.map('map', {
  center: [3.55, 97.45],
  zoom: 8,
  zoomControl: true
});

const esriSat = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { attribution: 'Esri World Imagery' }
).addTo(map);

const cartoDark = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  { attribution: 'CARTO Dark Matter' }
);

const osmMap = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { attribution: 'OpenStreetMap' }
);

const layerControl = L.control.layers(
  { 'Citra Satelit (Esri)': esriSat, 'Peta Gelap (CARTO)': cartoDark, 'OpenStreetMap': osmMap },
  {},
  { collapsed: true }
).addTo(map);

// ============================================================================
// 3. PEMETAAN FILE GEOJSON DI FOLDER GOOGLE DRIVE ("Geojson lomba")
// ============================================================================
const DRIVE_FILES = {
  batas_tngl: ['01_Batas_Dan_Data_Pendukung', '01_Batas_Kawasan_Inti_TNGL.geojson'],
  buffer_luar: ['01_Batas_Dan_Data_Pendukung', '02_Zona_Buffer_100km_Luar_TNGL.geojson'],
  elevasi: ['01_Batas_Dan_Data_Pendukung', '06_Klasifikasi_Elevasi_DEM.geojson'],
  lereng: ['01_Batas_Dan_Data_Pendukung', '07_Klasifikasi_Kemiringan_Lereng.geojson'],
  zonasi_jarak: ['01_Batas_Dan_Data_Pendukung', '10_Klasifikasi_Zonasi_Jarak_TNGL.geojson'],

  dinamika_hutan: ['02_Tutupan_Hutan_Dan_Permukiman', '02_Dinamika_Perubahan_Hutan_2019_2025.geojson'],
  status_hutan: (yr) => ['02_Tutupan_Hutan_Dan_Permukiman', `01_Status_Tutupan_Hutan_${yr}.geojson`],

  carbon_stock: (yr) => [`0${yr === '2019' ? 3 : yr === '2021' ? 4 : 5}_Parameter_${yr}`, `01_Cadangan_Karbon_${yr}.geojson`],
  agb: (yr) => [`0${yr === '2019' ? 3 : yr === '2021' ? 4 : 5}_Parameter_${yr}`, `02_Biomassa_AGB_${yr}.geojson`],
  lst: (yr) => [`0${yr === '2019' ? 3 : yr === '2021' ? 4 : 5}_Parameter_${yr}`, `03_Suhu_Permukaan_LST_${yr}.geojson`],
  uhi: (yr) => [`0${yr === '2019' ? 3 : yr === '2021' ? 4 : 5}_Parameter_${yr}`, `04_Pulau_Bahang_UHI_${yr}.geojson`],
  utfvi: (yr) => [`0${yr === '2019' ? 3 : yr === '2021' ? 4 : 5}_Parameter_${yr}`, `05_Stres_Termal_UTFVI_${yr}.geojson`],
  ndbi: (yr) => [`0${yr === '2019' ? 3 : yr === '2021' ? 4 : 5}_Parameter_${yr}`, `12_Kawasan_Terbangun_NDBI_${yr}.geojson`],
  sar: (yr) => [`0${yr === '2019' ? 3 : yr === '2021' ? 4 : 5}_Parameter_${yr}`, `14_Radar_Kanopi_SAR_VH_${yr}.geojson`],
  carbon_rate: ['05_Parameter_2025', '15_Laju_Carbon_Rate_2019_2025.geojson'],

  delta_carbon: ['06_Delta_Perubahan_2019_2025', '01_Delta_Carbon_Stock_2025_vs_2019.geojson'],
  delta_lst: ['06_Delta_Perubahan_2019_2025', '02_Delta_Suhu_LST_2025_vs_2019.geojson'],
  delta_ndvi: ['06_Delta_Perubahan_2019_2025', '05_Delta_Vegetasi_NDVI_2025_vs_2019.geojson'],
  delta_ndbi: ['06_Delta_Perubahan_2019_2025', '08_Delta_Terbangun_NDBI_2025_vs_2019.geojson'],

  sampel_dalam: ['07_Titik_Sampel_Dan_Ringkasan', '01_Titik_Sampel_Dalam_TNGL.geojson'],
  sampel_luar: ['07_Titik_Sampel_Dan_Ringkasan', '02_Titik_Sampel_Permukiman_Buffer.geojson']
};

// ============================================================================
// 4. ENGINE PEMUATAN GEOJSON DARI GOOGLE DRIVE API
// ============================================================================
const geojsonCache = {};
const layerInstances = {};
let activeDataLayers = [];
let currentYear = '2025';
let currentChapter = 'sampul';
let currentSublayer = null;

const loaderToast = document.getElementById('loader-toast');

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
    <strong style="color:${props.Warna_Hex || '#22c55e'}">${props.Kategori || 'Objek Spasial'}</strong>
    <table class="popup-table">
      <tr><td>Parameter</td><td>${props.Parameter || '-'} (${props.Tahun || '-'})</td></tr>
      <tr><td>Kriteria</td><td>${props.Rentang_Nilai || '-'}</td></tr>
      <tr><td>Luas Area</td><td>${luasFmt} (${pctFmt})</td></tr>
      <tr><td>Keterangan</td><td>${props.Interpretasi || '-'}</td></tr>
    </table>
  `;
}

async function getDriveGeoJSONLayer(fileTuple, options = {}) {
  if (!fileTuple) return null;
  const [folderName, fileName] = fileTuple;
  const cacheKey = `${folderName}/${fileName}`;

  if (layerInstances[cacheKey]) return layerInstances[cacheKey];

  loaderToast.textContent = `Mengambil dari Drive: ${fileName}...`;
  loaderToast.classList.remove('hidden');

  try {
    if (!geojsonCache[cacheKey]) {
      const apiUrl = `${DRIVE_API_URL}?action=getFile&folder=${encodeURIComponent(folderName)}&file=${encodeURIComponent(fileName)}`;
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      geojsonCache[cacheKey] = data;
    }

    const gjData = geojsonCache[cacheKey];
    const layer = L.geoJSON(gjData, {
      style: (feature) => {
        const p = feature.properties || {};
        return {
          fillColor: options.fillColor || p.Warna_Hex || '#22c55e',
          color: options.strokeColor || '#1e293b',
          weight: options.weight !== undefined ? options.weight : 0.7,
          fillOpacity: options.fillOpacity !== undefined ? options.fillOpacity : 0.72,
          dashArray: options.dashArray || null
        };
      },
      pointToLayer: (feature, latlng) => {
        const p = feature.properties || {};
        return L.circleMarker(latlng, {
          radius: 5,
          fillColor: p.Warna_Hex || '#38bdf8',
          color: '#ffffff',
          weight: 1,
          fillOpacity: 0.9
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
    console.warn(`Gagal memuat ${cacheKey}:`, err);
    return null;
  } finally {
    loaderToast.classList.add('hidden');
  }
}

async function syncDriveCatalog() {
  try {
    const res = await fetch(`${DRIVE_API_URL}?action=catalog`);
    const meta = await res.json();
    if (meta.status !== 'ok' || !meta.files) return;

    if (meta.files.length > 0) {
      const latestDate = meta.files.map(f => new Date(f.lastUpdated)).sort((a, b) => b - a)[0];
      const tglStr = latestDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      document.getElementById('brand-title').textContent = `STORYMAP TNGL • SYNC DRIVE (${meta.total} FILE • ${tglStr.toUpperCase()})`;
    }

    meta.files.forEach((item) => {
      const proxyLayer = L.layerGroup();
      const label = `[${item.folder.slice(0, 2)}] ${item.filename.replace('.geojson', '').replace(/_/g, ' ')}`;
      proxyLayer.on('add', async () => {
        const realLayer = await getDriveGeoJSONLayer([item.folder, item.filename], { fillOpacity: 0.72 });
        if (realLayer) {
          realLayer.addTo(proxyLayer);
          updateLegendFromGeoJSON(realLayer._rawGeoJSON);
        }
      });
      layerControl.addOverlay(proxyLayer, label);
    });
  } catch (err) {
    console.warn('Katalog Drive belum tersinkron:', err);
  }
}

// ============================================================================
// 5. GRAFIK STATISTIK INTERAKTIF (CHART.JS) SESUAI DATA LAPORAN
// ============================================================================
function initCharts() {
  // Grafik 1: Perbandingan Dalam TNGL vs Luar Buffer (Bab 3)
  const ctxKomp = document.getElementById('chartKomparasi');
  if (ctxKomp) {
    new Chart(ctxKomp, {
      type: 'bar',
      data: {
        labels: ['Cadangan Karbon (Ton/Ha)', 'Suhu Permukaan LST (°C)'],
        datasets: [
          {
            label: 'Dalam Kawasan Inti TNGL',
            data: [64.48, 22.61],
            backgroundColor: '#22c55e',
            borderRadius: 5
          },
          {
            label: 'Luar Buffer',
            data: [57.10, 27.90],
            backgroundColor: '#f59e0b',
            borderRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#e2e8f0', font: { size: 11 } } },
          title: {
            display: true,
            text: 'Uji Komparatif Welch’s t-test (p < 0,0001)',
            color: '#94a3b8',
            font: { size: 11 }
          }
        },
        scales: {
          x: { ticks: { color: '#cbd5e1', font: { size: 11 } }, grid: { display: false } },
          y: { ticks: { color: '#cbd5e1', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.08)' } }
        }
      }
    });
  }

  // Grafik 2: Proporsi Dinamika Spasial 2019–2025 (Bab 5)
  const ctxDin = document.getElementById('chartDinamika');
  if (ctxDin) {
    new Chart(ctxDin, {
      type: 'bar',
      data: {
        labels: ['Neraca Karbon (7,01 Jt Ha)', 'Dinamika Termal (13,73 Jt Ha)'],
        datasets: [
          {
            label: 'Positif Ekologis (Sink 48,6% / Cooling 56,9%)',
            data: [48.6, 56.9],
            backgroundColor: '#16a34a',
            borderRadius: 4
          },
          {
            label: 'Tekanan Ekologis (Defisit 51,4% / Warming 43,1%)',
            data: [51.4, 43.1],
            backgroundColor: '#dc2626',
            borderRadius: 4
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { labels: { color: '#e2e8f0', font: { size: 10 } } },
          title: {
            display: true,
            text: 'Proporsi Luasan Dinamika Spasial 2019–2025 (%)',
            color: '#94a3b8',
            font: { size: 11 }
          }
        },
        scales: {
          x: { max: 100, ticks: { color: '#cbd5e1', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.08)' } },
          y: { ticks: { color: '#cbd5e1', font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }
}

// ============================================================================
// 6. LEGENDA OTOMATIS & KONTROL BAB SCROLLYTELLING
// ============================================================================
function updateLegendFromGeoJSON(gjData, fallbackTitle = 'Legenda Peta') {
  const box = document.getElementById('map-legend');
  if (!gjData || !gjData.features || gjData.features.length === 0) {
    box.innerHTML = `<h4>${fallbackTitle}</h4><small>Memuat atribut dari Drive...</small>`;
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
        <span class="legend-color" style="background:${p.Warna_Hex || '#22c55e'}"></span>
        <div class="legend-meta">
          <span>${p.Kategori || p.Zona || 'Kelas'}</span>
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
  validasi: { label: 'Validasi ML/DL', count: '06 / 07', center: [3.55, 97.50], zoom: 8 },
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
  map.flyTo(cfg.center, cfg.zoom, { duration: 1.2 });

  clearActiveLayers();

  const lyrTngl = await getDriveGeoJSONLayer(DRIVE_FILES.batas_tngl, {
    fillColor: '#22c55e',
    strokeColor: '#22c55e',
    weight: 2.5,
    fillOpacity: 0.06
  });
  if (lyrTngl) {
    lyrTngl.addTo(map);
    activeDataLayers.push(lyrTngl);
  }

  let primaryLayer = lyrTngl;

  if (currentChapter === 'sampul') {
    const lyrBuf = await getDriveGeoJSONLayer(DRIVE_FILES.buffer_luar, {
      fillColor: '#f59e0b',
      strokeColor: '#f59e0b',
      weight: 1.8,
      fillOpacity: 0.03,
      dashArray: '6,6'
    });
    if (lyrBuf) {
      lyrBuf.addTo(map);
      activeDataLayers.push(lyrBuf);
    }
    updateLegendFromGeoJSON({
      features: [
        { properties: { Kategori: 'Kawasan Inti TNGL', Rentang_Nilai: '830.268,95 Ha (Penetapan 2014)', Warna_Hex: '#22c55e' } },
        { properties: { Kategori: 'Zona Penyangga KEL', Rentang_Nilai: 'Bentang Lahan Sekitar', Warna_Hex: '#f59e0b' } }
      ]
    }, 'Batas Kawasan Studi');
    return;
  }

  if (currentChapter === 'deliniasi') {
    const mode = currentSublayer || 'zonasi';
    const target = mode === 'elevasi' ? DRIVE_FILES.elevasi : mode === 'lereng' ? DRIVE_FILES.lereng : DRIVE_FILES.zonasi_jarak;
    primaryLayer = await getDriveGeoJSONLayer(target, { fillOpacity: 0.68 });
  } else if (currentChapter === 'hutan') {
    const mode = currentSublayer || 'dinamika_hutan';
    const target = mode === 'status_hutan' ? DRIVE_FILES.status_hutan(currentYear) : DRIVE_FILES.dinamika_hutan;
    primaryLayer = await getDriveGeoJSONLayer(target, { fillOpacity: 0.76 });
  } else if (currentChapter === 'karbon') {
    const mode = currentSublayer || 'carbon_stock';
    const target = mode === 'agb' ? DRIVE_FILES.agb(currentYear) : mode === 'carbon_rate' ? DRIVE_FILES.carbon_rate : DRIVE_FILES.carbon_stock(currentYear);
    primaryLayer = await getDriveGeoJSONLayer(target, { fillOpacity: 0.75 });
  } else if (currentChapter === 'termal') {
    const mode = currentSublayer || 'lst';
    const targetMap = {
      lst: DRIVE_FILES.lst(currentYear),
      uhi: DRIVE_FILES.uhi(currentYear),
      utfvi: DRIVE_FILES.utfvi(currentYear),
      ndbi: DRIVE_FILES.ndbi(currentYear)
    };
    primaryLayer = await getDriveGeoJSONLayer(targetMap[mode], { fillOpacity: 0.75 });
  } else if (currentChapter === 'delta') {
    const mode = currentSublayer || 'delta_carbon';
    const mapDelta = {
      delta_carbon: DRIVE_FILES.delta_carbon,
      delta_lst: DRIVE_FILES.delta_lst,
      delta_ndvi: DRIVE_FILES.delta_ndvi,
      delta_ndbi: DRIVE_FILES.delta_ndbi
    };
    primaryLayer = await getDriveGeoJSONLayer(mapDelta[mode], { fillOpacity: 0.76 });
  } else if (currentChapter === 'validasi') {
    const mode = currentSublayer || 'sampel';
    if (mode === 'sar') {
      primaryLayer = await getDriveGeoJSONLayer(DRIVE_FILES.sar(currentYear), { fillOpacity: 0.75 });
    } else {
      const lyrIn = await getDriveGeoJSONLayer(DRIVE_FILES.sampel_dalam);
      const lyrOut = await getDriveGeoJSONLayer(DRIVE_FILES.sampel_luar);
      [lyrIn, lyrOut].forEach((l) => {
        if (l) { l.addTo(map); activeDataLayers.push(l); }
      });
      updateLegendFromGeoJSON({
        features: [
          { properties: { Kategori: 'Titik Sampel Dalam TNGL', Rentang_Nilai: 'Klik titik untuk nilai RF/OLS', Warna_Hex: '#16a34a' } },
          { properties: { Kategori: 'Titik Sampel Zona Luar', Rentang_Nilai: 'Klik titik untuk nilai RF/OLS', Warna_Hex: '#dc2626' } }
        ]
      }, 'Validasi Sampel Spasial');
      return;
    }
  } else if (currentChapter === 'dampak') {
    primaryLayer = await getDriveGeoJSONLayer(DRIVE_FILES.delta_lst, { fillOpacity: 0.72 });
  }

  if (primaryLayer) {
    primaryLayer.addTo(map);
    activeDataLayers.push(primaryLayer);
    if (lyrTngl) lyrTngl.bringToFront();
    updateLegendFromGeoJSON(primaryLayer._rawGeoJSON);
  }
}

// ============================================================================
// 7. EVENT LISTENER INTERAKTIF (TAHUN, SUB-LAYER, TAB DAMPAK & SCROLL)
// ============================================================================
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

document.querySelectorAll('.nav-dot').forEach((dot) => {
  dot.addEventListener('click', () => {
    const targetEl = document.getElementById(dot.dataset.target);
    if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      document.querySelectorAll('.step').forEach((s) => s.classList.remove('active'));
      entry.target.classList.add('active');
      currentChapter = entry.target.dataset.step;

      // Sinkronkan titik navigasi kanan
      document.querySelectorAll('.nav-dot').forEach((d) => {
        d.classList.toggle('active', d.dataset.target === entry.target.id);
      });

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
}, { threshold: 0.48 });

document.querySelectorAll('.step').forEach((sec) => observer.observe(sec));

initCharts();
syncDriveCatalog();
renderScene();
