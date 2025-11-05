mapboxgl.accessToken = 'pk.eyJ1IjoibW1pbGFjIiwiYSI6ImNpeWhkNXZsMDA1ZDgzMm4wdWRzdzRleWcifQ.crLVL3iFWYSbE5zrlkIA7w';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-6.4, 39.3],
  zoom: 7
});

let categoriasActivas = new Set();
let textoBusqueda = '';

function aplicarFiltro() {
  const filtroCategorias = categoriasActivas.size
    ? ['in', ['get', 'categoria'], ['literal', Array.from(categoriasActivas)]]
    : true;
  const t = textoBusqueda.trim().toLowerCase();
  const filtroTexto = t.length
    ? ['any',
        ['>=', ['index-of', t, ['downcase', ['get', 'nombre_entidad']]], 0],
        ['>=', ['index-of', t, ['downcase', ['get', 'localidad']]], 0],
        ['>=', ['index-of', t, ['downcase', ['get', 'tematica']]], 0]
      ]
    : true;
  const filtroFinal =
    filtroCategorias === true && filtroTexto === true
      ? true
      : filtroCategorias === true
        ? filtroTexto
        : filtroTexto === true
          ? filtroCategorias
          : ['all', filtroCategorias, filtroTexto];
  if (map.getLayer('entidades-puntos')) map.setFilter('entidades-puntos', filtroFinal);
}

map.on('load', async () => {
  const response = await fetch('entidades.geojson', { cache: 'no-store' });
  const geojson = await response.json();

  map.addSource('entidades', { type: 'geojson', data: geojson });

  map.addLayer({
    id: 'entidades-puntos',
    type: 'circle',
    source: 'entidades',
    paint: {
      'circle-radius': 7,
      'circle-color': [
        'match',
        ['get', 'categoria'],
        'Social', '#1E90FF',
        'Ambiental', '#3CB371',
        'Económica', '#FFD700',
        'Otra', '#BA55D3',
        '#999'
      ],
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5
    }
  });

  map.on('click', 'entidades-puntos', (e) => {
    const f = e.features[0];
    const p = f.properties;
    const web = p.pagina_contacto && p.pagina_contacto !== 'null'
      ? `<br><a href="${p.pagina_contacto}" target="_blank" rel="noopener">Sitio web</a>`
      : '';
    new mapboxgl.Popup({ offset: 16 })
      .setLngLat(f.geometry.coordinates)
      .setHTML(
        `<strong>${p.nombre_entidad || ''}</strong><br>
         <em>${p.tematica || ''}</em><br>
         ${p.localidad || ''}<br>
         ${p.telefono || ''}<br>
         ${p.correo || ''}${web}`
      )
      .addTo(map);
  });

  map.on('mouseenter', 'entidades-puntos', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'entidades-puntos', () => map.getCanvas().style.cursor = '');

  const extremaduraPolygon = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-7.55, 40.53], [-7.35, 39.85], [-7.3, 39.35], [-7.15, 38.7],
        [-6.9, 38.35], [-6.2, 38.1], [-5.6, 38.3], [-5.35, 38.7],
        [-5.25, 39.3], [-5.45, 39.9], [-5.9, 40.35], [-6.4, 40.55],
        [-7.0, 40.55], [-7.55, 40.53]
      ]]
    }
  };

  map.addSource('extremadura', { type: 'geojson', data: extremaduraPolygon });

  map.addLayer(
    {
      id: 'extremadura-fill',
      type: 'fill',
      source: 'extremadura',
      paint: { 'fill-color': '#a3e3a3', 'fill-opacity': 0.18 }
    },
    'entidades-puntos'
  );

  map.addLayer(
    {
      id: 'extremadura-line',
      type: 'line',
      source: 'extremadura',
      paint: { 'line-color': '#3CB371', 'line-width': 1.2, 'line-opacity': 0.5 }
    },
    'entidades-puntos'
  );

  const bounds = new mapboxgl.LngLatBounds();
  geojson.features.forEach(f => {
    if (f.geometry && Array.isArray(f.geometry.coordinates)) bounds.extend(f.geometry.coordinates);
  });
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 9 });

  const categorias = [...new Set(geojson.features.map(f => (f.properties || {}).categoria).filter(Boolean))];
  categorias.forEach(cat => categoriasActivas.add(cat));
  const cont = document.getElementById('filters');
  cont.innerHTML = '';
  categorias.forEach(cat => {
    const label = document.createElement('label');
    label.dataset.cat = cat;
    const id = `cb-${cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}`;
    label.innerHTML = `<input type="checkbox" id="${id}" value="${cat}" checked><span>${cat}</span>`;
    cont.appendChild(label);
  });
  cont.addEventListener('change', (e) => {
    if (e.target && e.target.type === 'checkbox') {
      const { value, checked } = e.target;
      if (checked) categoriasActivas.add(value); else categoriasActivas.delete(value);
      aplicarFiltro();
    }
  });

  const input = document.getElementById('busqueda');
  input.addEventListener('input', (e) => {
    textoBusqueda = e.target.value || '';
    aplicarFiltro();
    const t = textoBusqueda.trim().toLowerCase();
    if (t.length) {
      const match = geojson.features.find(f => {
        const p = f.properties || {};
        return (
          (p.nombre_entidad || '').toLowerCase().includes(t) ||
          (p.localidad || '').toLowerCase().includes(t) ||
          (p.tematica || '').toLowerCase().includes(t)
        );
      });
      if (match && match.geometry && match.geometry.coordinates) {
        map.flyTo({ center: match.geometry.coordinates, zoom: 10 });
      }
    }
  });
});
