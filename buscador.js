mapboxgl.accessToken = 'pk.eyJ1IjoiZ29uemFsZXMiLCJhIjoiY2xvYzF0NnR2MDF1bjJqb2E1MG56d3d1MCJ9.-rjzF2EhXcvPCIR9_cGfaw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-6.33, 39.0], // Centro aproximado de Extremadura
  zoom: 7
});

map.on('load', async () => {
  // === FUENTE ===
  map.addSource('entidades', {
    type: 'geojson',
    data: 'entidades.geojson'
  });

  // === CAPA DE PUNTOS ===
  map.addLayer({
    id: 'entidades-puntos',
    type: 'circle',
    source: 'entidades',
    paint: {
      'circle-radius': 7,
      'circle-color': [
        'match',
        ['get', 'tipo'],
        'ambiental', '#1f77b4',
        'social', '#ff7f0e',
        'economica', '#2ca02c',
        'otra', '#9467bd',
        '#999'
      ],
      'circle-stroke-color': '#fff',
      'circle-stroke-width': 1.5
    }
  });

  // === POPUPS ===
  map.on('click', 'entidades-puntos', (e) => {
    const props = e.features[0].properties;
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <h4>${props.nombre}</h4>
        <p><strong>Tipo:</strong> ${props.tipo}</p>
        <p>${props.descripcion || ''}</p>
      `)
      .addTo(map);
  });

  // === FILTROS DINÁMICOS ===
  const response = await fetch('entidades.geojson');
  const geojson = await response.json();
  const tipos = [...new Set(geojson.features.map(f => f.properties.tipo))];

  const filtersContainer = document.getElementById('filters');
  tipos.forEach(tipo => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${tipo}" checked> ${tipo}`;
    filtersContainer.appendChild(label);
  });

  filtersContainer.addEventListener('change', () => {
    const activos = Array.from(
      filtersContainer.querySelectorAll('input[type=checkbox]:checked')
    ).map(cb => cb.value);
    map.setFilter('entidades-puntos', ['in', ['get', 'tipo'], ['literal', activos]]);
  });

  // === BUSCADOR ===
  const input = document.getElementById('busqueda');
  input.addEventListener('input', (e) => {
    const texto = e.target.value.toLowerCase();
    const coincidencias = geojson.features.filter(f =>
      f.properties.nombre.toLowerCase().includes(texto)
    );

    if (coincidencias.length > 0) {
      const primerPunto = coincidencias[0].geometry.coordinates;
      map.flyTo({ center: primerPunto, zoom: 10 });
    }
  });
});
