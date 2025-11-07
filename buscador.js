mapboxgl.accessToken = 'pk.eyJ1IjoibW1pbGFjIiwiYSI6ImNpeWhkNXZsMDA1ZDgzMm4wdWRzdzRleWcifQ.crLVL3iFWYSbE5zrlkIA7w';

window.addEventListener('load', async () => {
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-6.4, 39.3],
    zoom: 7
  });

  const COLORS = {
    'SOCIALES': '#FFD700',
    'AMBIENTALES': '#009b4d',
    'ECONÓMICAS': '#FF7F00'
  };

  let entidades = [];
  let categoriasActivas = new Set(['SOCIALES', 'AMBIENTALES', 'ECONÓMICAS']);
  let activeIndex = -1;

  const $ = (s) => document.querySelector(s);

  function normalize(t) {
    return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function openPopup(feature) {
    const p = feature.properties;
    const web = p.pagina_contacto
      ? `<a href="${p.pagina_contacto}" target="_blank" style="color:#009b4d;text-decoration:underline;">Sitio web</a>`
      : 'No disponible';

    const html = `
      <div style="font-family:'Segoe UI',sans-serif;line-height:1.8;font-size:0.95rem;min-width:250px;max-width:320px;">
        <div style="font-size:1.2rem;font-weight:700;color:#009b4d;margin-bottom:8px;">
          ${p.nombre_entidad || ''}
        </div>
        <div style="margin-bottom:4px;"><b>Categoría:</b> ${p.categoria || ''}</div>
        <div style="margin-bottom:4px;"><b>Dirección:</b> ${p.direccion || 'No disponible'}</div>
        <div style="margin-bottom:4px;"><b>Localidad:</b> ${p.localidad || 'No disponible'}</div>
        <div style="margin-bottom:4px;"><b>${web}</b></div>
        <div><b>Temáticas:</b> ${p.tematica || 'No especificadas'}</div>
      </div>`;

    new mapboxgl.Popup({ offset: 20, maxWidth: '360px' })
      .setLngLat(feature.geometry.coordinates)
      .setHTML(html)
      .addTo(map);

    map.flyTo({ center: feature.geometry.coordinates, zoom: 12, speed: 0.8 });
  }

  async function cargarDatos() {
    const res = await fetch('entidades.geojson', { cache: 'no-store' });
    const geojson = await res.json();

    entidades = geojson.features.filter(f =>
      ['SOCIALES', 'AMBIENTALES', 'ECONÓMICAS'].includes(f.properties.categoria.toUpperCase())
    );

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
          'SOCIALES', COLORS.SOCIALES,
          'AMBIENTALES', COLORS.AMBIENTALES,
          'ECONÓMICAS', COLORS.ECONÓMICAS,
          '#999'
        ],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.5
      }
    });

    map.on('click', 'entidades-puntos', e => openPopup(e.features[0]));
    map.on('mouseenter', 'entidades-puntos', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'entidades-puntos', () => map.getCanvas().style.cursor = '');

    const bounds = new mapboxgl.LngLatBounds();
    entidades.forEach(f => f.geometry?.coordinates && bounds.extend(f.geometry.coordinates));
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 9 });

    const counts = { SOCIALES: 89, AMBIENTALES: 22, ECONÓMICAS: 14 };
    const cont = $('#filters');
    cont.innerHTML = '';
    Object.keys(counts).forEach(cat => {
      const label = document.createElement('label');
      label.dataset.cat = cat;
      label.innerHTML = `<input type="checkbox" value="${cat}" checked><span>${cat} (${counts[cat]})</span>`;
      label.style.backgroundColor = COLORS[cat];
      label.style.color = '#fff';
      cont.appendChild(label);
    });

    cont.addEventListener('change', e => {
      if (e.target?.type === 'checkbox') {
        const { value, checked } = e.target;
        if (checked) categoriasActivas.add(value);
        else categoriasActivas.delete(value);
        const filtro = categoriasActivas.size
          ? ['in', ['get', 'categoria'], ['literal', Array.from(categoriasActivas)]]
          : true;
        if (map.getLayer('entidades-puntos')) map.setFilter('entidades-puntos', filtro);
      }
    });

    const input = $('#busqueda');
    const box = $('#suggestions');

    function renderSuggestions(q) {
      if (!q) { box.classList.remove('show'); box.innerHTML = ''; activeIndex = -1; return; }
      const nq = normalize(q);
      const results = entidades.filter(f => normalize(f.properties.nombre_entidad).includes(nq)).slice(0, 15);
      if (!results.length) { box.classList.remove('show'); box.innerHTML = ''; activeIndex = -1; return; }
      box.innerHTML = results.map((f, i) => `<li data-i="${i}">${f.properties.nombre_entidad}</li>`).join('');
      box.classList.add('show');
      activeIndex = -1;
    }

    function selectEntity(index, pool) {
      const f = pool[index];
      if (!f) return;
      input.value = f.properties.nombre_entidad;
      box.classList.remove('show');
      openPopup(f);
    }

    input.addEventListener('input', e => renderSuggestions(e.target.value));
    box.addEventListener('click', e => {
      const li = e.target.closest('li');
      if (!li) return;
      const q = normalize(input.value);
      const pool = entidades.filter(f => normalize(f.properties.nombre_entidad).includes(q)).slice(0, 15);
      selectEntity(parseInt(li.dataset.i), pool);
    });

    input.addEventListener('keydown', e => {
      const q = normalize(input.value);
      const pool = entidades.filter(f => normalize(f.properties.nombre_entidad).includes(q)).slice(0, 15);
      const items = box.querySelectorAll('li');
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        items.forEach((li, i) => li.classList.toggle('active', i === activeIndex));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach((li, i) => li.classList.toggle('active', i === activeIndex));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0) selectEntity(activeIndex, pool);
        box.classList.remove('show');
      } else if (e.key === 'Escape') {
        box.classList.remove('show');
        activeIndex = -1;
      }
    });

    document.addEventListener('click', e => {
      if (!document.querySelector('.search-box-header').contains(e.target)) {
        box.classList.remove('show');
        activeIndex = -1;
      }
    });
  }

  map.on('load', cargarDatos);
});
