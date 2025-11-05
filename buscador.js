mapboxgl.accessToken = 'pk.eyJ1IjoibW1pbGFjIiwiYSI6ImNpeWhkNXZsMDA1ZDgzMm4wdWRzdzRleWcifQ.crLVL3iFWYSbE5zrlkIA7w';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-6.4, 39.3],
  zoom: 7
});

let categoriasActivas = new Set();
let textoBusqueda = '';
let entidades = [];
let activeIndex = -1;

function aplicarFiltro() {
  const filtroCategorias = categoriasActivas.size
    ? ['in', ['get', 'categoria'], ['literal', Array.from(categoriasActivas)]]
    : true;
  if (map.getLayer('entidades-puntos')) map.setFilter('entidades-puntos', filtroCategorias);
}

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function openPopup(feature) {
  const p = feature.properties;
  const web = p.pagina_contacto && p.pagina_contacto !== 'null'
    ? `<br><a href="${p.pagina_contacto}" target="_blank" rel="noopener">Sitio web</a>` : '';
  new mapboxgl.Popup({ offset: 16 })
    .setLngLat(feature.geometry.coordinates)
    .setHTML(
      `<strong>${p.nombre_entidad || ''}</strong><br>
       <em>${p.tematica || ''}</em><br>
       ${p.localidad || ''}<br>
       ${p.telefono || ''}<br>
       ${p.correo || ''}${web}`
    )
    .addTo(map);
}

function renderSuggestions(q) {
  const box = document.getElementById('suggestions');
  if (!q) { box.classList.remove('show'); box.innerHTML = ''; activeIndex = -1; return; }
  const nq = norm(q);
  const results = entidades.filter(f => norm(f.properties.nombre_entidad).startsWith(nq)).slice(0, 15);
  if (!results.length) { box.classList.remove('show'); box.innerHTML = ''; activeIndex = -1; return; }
  const list = results.map((f, i) => `<li role="option" data-i="${i}">${f.properties.nombre_entidad}</li>`).join('');
  box.innerHTML = list;
  box.classList.add('show');
  activeIndex = -1;
}

function selectEntity(index, pool) {
  const f = pool[index];
  if (!f) return;
  const p = f.properties || {};
  document.getElementById('busqueda').value = p.nombre_entidad || '';
  document.getElementById('suggestions').classList.remove('show');
  map.flyTo({ center: f.geometry.coordinates, zoom: 10 });
  openPopup(f); // abre popup automáticamente
}

map.on('load', async () => {
  const response = await fetch('entidades.geojson', { cache: 'no-store' });
  const geojson = await response.json();
  entidades = geojson.features || [];

  map.addSource('entidades', { type: 'geojson', data: geojson });

  map.addLayer({
    id: 'entidades-puntos',
    type: 'circle',
    source: 'entidades',
    paint: {
      '
