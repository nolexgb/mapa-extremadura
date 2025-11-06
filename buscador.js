mapboxgl.accessToken = 'pk.eyJ1IjoibW1pbGFjIiwiYSI6ImNpeWhkNXZsMDA1ZDgzMm4wdWRzdzRleWcifQ.crLVL3iFWYSbE5zrlkIA7w';

window.addEventListener('load', async () => {
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-6.4, 39.3],
    zoom: 7
  });

  let entidades = [];
  let categoriasActivas = new Set();
  let activeIndex = -1;

  const ORDER = ['SOCIALES', 'AMBIENTALES', 'ECONÓMICAS'];
  const COLORS = {
    'SOCIALES': '#FFD700',
    'AMBIENTALES': '#009b4d',
    'ECONÓMICAS': '#FF7F00'
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function aplicarFiltro() {
    const filtro = categoriasActivas.size
      ? ['in', ['get', 'categoria'], ['literal', Array.from(categoriasActivas)]]
      : true;
    if (map.getLayer('entidades-puntos')) map.setFilter('entidades-puntos', filtro);
  }

  function openPopup(feature) {
    const p = feature.properties || {};
    const web = p.pagina_contacto
      ? `<a href="${p.pagina_contacto}" target="_blank" rel="noopener" style="color:#009b4d;text-decoration:underline;">${p.pagina_contacto}</a>`
      : 'No disponible';
    const html = `
      <div style="font-family:'Segoe UI',sans-serif;line-height:1.5;">
        <strong style="font-size:1rem;color:#009b4d;">${p.nombre_entidad || ''}</strong><br>
        <b>Categoría:</b> ${p.categoria || ''}<br>
        <b>Dirección:</b> ${p.direccion || 'No disponible'}<br>
        <b>Localidad:</b> ${p.localidad || 'No disponible'}<br>
        <b>Sitio web:</b> ${web}<br>
        <b>Temáticas:</b> ${p.tematica || 'No especificadas'}
      </div>`;
    new mapboxgl.Popup({ offset: 16 })
      .setLngLat(feature.geometry.coordinates)
      .setHTML(html)
      .addTo(map);
    map.flyTo({ center: feature.geometry.coordinates, zoom: 12, speed: 0.8 });
  }

  async function cargarDatos() {
    const res = await fetch('entidades.geojson', { cache: 'no-store' });
    const geojson = await res.json();
    entidades = (geojson.features || []).filter(f => ORDER.includes((f.properties?.categoria || '').toUpperCase()));

    map.addSource('entidades', { type: 'geojson', data: { type: 'FeatureCollection', features: entidades } });

    map.addLayer({
      id: 'entidades-puntos',
      type: 'circle',
      source: 'entidades',
      paint: {
        'circle-radius': 7,
        'circle-color': [
          'match',
          ['get', 'categoria'],
          'SOCIALES', COLORS['SOCIALES'],
          'AMBIENTALES', COLORS['AMBIENTALES'],
          'ECONÓMICAS', COLORS['ECONÓMICAS'],
          '#999'
        ],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.5
      }
    });

    map.on('click', 'entidades-puntos', (e) => openPopup(e.features[0]));
    map.on('mouseenter', 'entidades-puntos', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'entidades-puntos', () => map.getCanvas().style.cursor = '');

    const bounds = new mapboxgl.LngLatBounds();
    entidades.forEach(f => f.geometry?.coordinates && bounds.extend(f.geometry.coordinates));
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 9 });

    const counts = ORDER.reduce((acc, k) => (acc[k] = 0, acc), {});
    entidades.forEach(f => { const c = (f.properties?.categoria || '').toUpperCase(); if (counts[c] !== undefined) counts[c]++; });

    const cont = $('#filters');
    cont.innerHTML = '';
    ORDER.forEach(cat => {
      categoriasActivas.add(cat);
      const label = document.createElement('label');
      label.dataset.cat = cat;
      const id = `cb-${cat.toLowerCase()}`;
      label.innerHTML = `<input type="checkbox" id="${id}" value="${cat}" checked><span>${cat} (${counts[cat] || 0})</span>`;
      label.style.backgroundColor = COLORS[cat];
      label.style.color = '#fff';
      cont.appendChild(label);
    });

    cont.addEventListener('change', (e) => {
      if (e.target?.type === 'checkbox') {
        const { value, checked } = e.target;
        if (checked) categoriasActivas.add(value);
        else categoriasActivas.delete(value);
        aplicarFiltro();
      }
    });

    const input = $('#busqueda');
    const box = $('#suggestions');

    function renderSuggestions(q) {
      if (!q) { box.classList.remove('show'); box.innerHTML = ''; activeIndex = -1; return; }
      const nq = norm(q);
      const results = entidades
        .filter(f => norm(f.properties?.nombre_entidad || '').includes(nq))
        .slice(0, 15);
      if (!results.length) { box.classList.remove('show'); box.innerHTML = ''; activeIndex = -1; return; }
      box.innerHTML = results.map((f, i) => `<li role="option" data-i="${i}">${f.properties.nombre_entidad}</li>`).join('');
      box.classList.add('show');
      activeIndex = -1;
    }

    function selectEntity(index, pool) {
      const f = pool[index];
      if (!f) return;
      input.value = f.properties.nombre_entidad || '';
      box.classList.remove('show');
      openPopup(f);
    }

    input.addEventListener('input', (e) => renderSuggestions(e.target.value || ''));

    box.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      const q = norm(input.value);
      const pool = entidades.filter(f => norm(f.properties?.nombre_entidad || '').includes(q)).slice(0, 15);
      selectEntity(parseInt(li.dataset.i, 10), pool);
    });

    input.addEventListener('keydown', (e) => {
      const q = norm(input.value);
      const pool = entidades.filter(f => norm(f.properties?.nombre_entidad || '').includes(q)).slice(0, 15);
      const items = box.querySelectorAll('li');
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault(); activeIndex = (activeIndex + 1) % items.length;
        items.forEach((li, i) => li.classList.toggle('active', i === activeIndex));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach((li, i) => li.classList.toggle('active', i === activeIndex));
      } else if (e.key === 'Enter') {
        e.preventDefault(); if (activeIndex >= 0) selectEntity(activeIndex, pool);
        box.classList.remove('show');
      } else if (e.key === 'Escape') {
        box.classList.remove('show'); activeIndex = -1;
      }
    });

    document.addEventListener('click', (e) => {
      if (!$('.search-box-header').contains(e.target)) { box.classList.remove('show'); activeIndex = -1; }
    });
  }

  map.on('load', cargarDatos);
});
