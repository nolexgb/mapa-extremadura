// --- CONFIG PRINCIPAL ---
const EXT_BOUNDS = L.latLngBounds([[37.56, -7.53],[40.49, -4.79]]);
const iconos = {
  'Social': L.icon({ iconUrl: 'icon_social.png', iconSize:[30,30], iconAnchor:[15,30], popupAnchor:[0,-24] }),
  'Ambiental': L.icon({ iconUrl: 'icon_ambiental.png', iconSize:[30,30], iconAnchor:[15,30], popupAnchor:[0,-24] }),
  'Económica': L.icon({ iconUrl: 'icon_economica.png', iconSize:[30,30], iconAnchor:[15,30], popupAnchor:[0,-24] }),
  'Otra': L.icon({ iconUrl: 'icon_otra.png', iconSize:[30,30], iconAnchor:[15,30], popupAnchor:[0,-24] }),
};

// --- MAPA ---
const map = L.map('map', {
  zoomControl: true,
  minZoom: 6,
  maxZoom: 18,
  preferCanvas: true
});

// Capa base
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:'© OpenStreetMap'
}).addTo(map);

// Centra automáticamente en Extremadura ✅
map.fitBounds(EXT_BOUNDS, { padding:[20,20] });

// --- ILUMINAR EXTREMADURA Y ATENUAR RESTO ✅ ---
fetch('extremadura.geojson')
  .then(r => r.json())
  .then(geo => {
    L.geoJSON(geo, {
      style: { color:'#2b8a3e', weight:2, fillColor:'#a3e6b5', fillOpacity:0.35 }
    }).addTo(map);

    const world = [
      [[-90,-180],[-90,180],[90,180],[90,-180]]
    ];
    const holes = geo.features.flatMap(f =>
      f.geometry.type === 'MultiPolygon'
        ? f.geometry.coordinates.map(rings => rings[0].map(([x,y]) => [y,x]))
        : [f.geometry.coordinates[0].map(([x,y]) => [y,x])]
    );

    const mask = L.polygon(world.concat(holes), {
      stroke:false,
      fill:true,
      fillOpacity:0.45,
      fillColor:'#000'
    }).addTo(map);
    mask.bringToFront();
  });

// --- PUNTOS ---
let capaPuntos;
const indexSearch = [];

fetch('entidades.geojson')
  .then(r => r.json())
  .then(geojson => {
    capaPuntos = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        const cat = feature.properties?.categoria || 'Otra';
        const marker = L.marker(latlng, { icon: iconos[cat] || iconos['Otra'] });
        const nombre = feature.properties?.nombre || 'Entidad';
        const muni = feature.properties?.municipio || '';
        const catTxt = feature.properties?.categoria || '';
        marker.bindPopup(`<strong>${nombre}</strong><br>${muni}<br><em>${catTxt}</em>`);
        indexSearch.push({
          title: `${nombre} ${muni}`.trim(),
          loc: latlng
        });
        return marker;
      }
    }).addTo(map);

    const b = capaPuntos.getBounds();
    if (b.isValid()) map.fitBounds(b.pad(0.1));

    // Buscador funcional ✅
    const searchCtrl = new L.Control.Search({
      layer: L.layerGroup(),
      textPlaceholder: 'Busca por nombre o municipio…',
      initial: false,
      zoom: 14,
      sourceData: function(text, callback) {
        const t = text.toLowerCase();
        const res = {};
        indexSearch
          .filter(it => it.title.toLowerCase().includes(t))
          .slice(0,50)
          .forEach(it => { res[it.title] = it.loc; });
        callback(res);
      }
    }).addTo(map);

    const input = document.getElementById('searchBox');
    if (input) {
      input.addEventListener('input', e => {
        const q = e.target.value.trim();
        if (q.length >= 2) searchCtrl.searchText(q);
      });
    }
  })
  .catch(err => console.error('Error cargando entidades.geojson:', err));

// --- FILTROS (botones coloridos que funcionan) ✅ ---
const toolbar = document.querySelector('.toolbar');
toolbar.addEventListener('click', e => {
  if (!(e.target instanceof HTMLButtonElement)) return;
  const filtro = e.target.dataset.filter;
  if (!capaPuntos) return;
  capaPuntos.eachLayer(marker => {
    const cat = marker.getPopup()?.getContent()?.match(/<em>(.*?)<\/em>/)?.[1] || '';
    const visible = (filtro === '*') || (cat === filtro);
    if (visible) marker.addTo(map); else map.removeLayer(marker);
  });
});

// Ajuste responsivo
window.addEventListener('resize', () => map.invalidateSize());
