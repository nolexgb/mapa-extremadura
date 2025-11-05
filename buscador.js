mapboxgl.accessToken = 'pk.eyJ1IjoibW1pbGFjIiwiYSI6ImNpeWhkNXZsMDA1ZDgzMm4wdWRzdzRleWcifQ.crLVL3iFWYSbE5zrlkIA7w'; 

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-6.4, 39.3], // Extremadura
  zoom: 7
});

// Estado para combinar filtros
let categoriasActivas = new Set(); // se rellenará con todas al cargar
let textoBusqueda = '';

/** Construye y aplica la expresión de filtro en base a categoría + búsqueda */
function aplicarFiltro() {
  // 1) filtro por categorías
  const filtroCategorias = categoriasActivas.size
    ? ['in', ['get', 'categoria'], ['literal', Array.from(categoriasActivas)]]
    : true; // si no hay ninguna (no debería), mostramos todo

  // 2) filtro por texto (en nombre_entidad, localidad o tematica)
  const t = textoBusqueda.trim().toLowerCase();
  const filtroTexto = t.length
    ? ['any',
        ['>=', ['index-of', t, ['downcase', ['get', 'nombre_entidad']]], 0],
        ['>=', ['index-of', t, ['downcase', ['get', 'localidad']]], 0],
        ['>=', ['index-of', t, ['downcase', ['get', 'tematica']]], 0]
      ]
    : true;

  // 3) combinación
  const filtroFinal =
    filtroCategorias === true && filtroTexto === true
      ? true
      : filtroCategorias === true
        ? filtroTexto
        : filtroTexto === true
          ? filtroCategorias
          : ['all', filtroCategorias, filtroTexto];

  if (map.getLayer('entidades-puntos')) {
    map.setFilter('entidades-puntos', filtroFinal);
  }
}

map.on('load', async () => {
  // Cargar GeoJSON
  const response = await fetch('entidades.geojson');
  const geojson = await response.json();

  // Fuente
  map.addSource('entidades', { type: 'geojson', data: geojson });

  // Capa de puntos (colores por categoría del GeoJSON: Social, Ambiental, Económica, Otra)
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

  // Popups
  map.on('click', 'entidades-puntos', (e) => {
    const f = e.features[0];
    const p = f.properties;

    const web = p.pagina_contacto && p.pagina_contacto !== 'null'
      ? `<br>🌐 <a href="${p.pagina_contacto}" target="_blank" rel="noopener">Sitio web</a>`
      : '';

    new mapboxgl.Popup({ offset: 16 })
      .setLngLat(f.geometry.coordinates)
      .setHTML(`
        <strong>${p.nombre_entidad || 'Entidad'}</strong><br>
        <em>${p.tematica || ''}</em><br>
        📍 ${p.localidad || ''}<br>
        ☎️ ${p.telefono || ''}<br>
        ✉️ ${p.correo || ''}${web}
      `)
      .addTo(map);
  });

  map.on('mouseenter', 'entidades-puntos', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'entidades-puntos', () => map.getCanvas().style.cursor = '');

  // Ajuste de vista a todas las entidades
  const bounds = new mapboxgl.LngLatBounds();
  geojson.features.forEach(f => bounds.extend(f.geometry.coordinates));
  map.fitBounds(bounds, { padding: 60, maxZoom: 9 });

  // ====== Filtros por categoría (checkboxes) ======
  const categorias = [...new Set(geojson.features.map(f => f.properties.categoria))];
  categorias.forEach(cat => categoriasActivas.add(cat));

  const cont = document.getElementById('filters');
  cont.innerHTML = ''; // por si se recarga

  categorias.forEach(cat => {
    const label = document.createElement('label');
    label.dataset.cat = cat;
    const id = `cb-${cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}`;
    label.innerHTML = `
      <input type="checkbox" id="${id}" value="${cat}" checked>
      <span>${cat}</span>
    `;
    cont.appendChild(label);
  });

  cont.addEventListener('change', (e) => {
    if (e.target && e.target.type === 'checkbox') {
      const { value, checked } = e.target;
      if (checked) categoriasActivas.add(value);
      else categoriasActivas.delete(value);
      aplicarFiltro();
    }
  });

  // ====== Buscador ======
  const input = document.getElementById('busqueda');
  input.addEventListener('input', (e) => {
    textoBusqueda = e.target.value || '';
    aplicarFiltro();

    // zoom a primera coincidencia cuando hay texto
    const t = textoBusqueda.trim().toLowerCase();
    if (t.length) {
      const match = geojson.features.find(f => {
        const p = f.properties;
        return (
          (p.nombre_entidad || '').toLowerCase().includes(t) ||
          (p.localidad || '').toLowerCase().includes(t) ||
          (p.tematica || '').toLowerCase().includes(t)
        );
      });
      if (match) {
        map.flyTo({ center: match.geometry.coordinates, zoom: 10 });
      }
    }
  });
});
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
