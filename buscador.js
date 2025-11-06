mapboxgl.accessToken = 'pk.eyJ1IjoibW1pbGFjIiwiYSI6ImNpeWhkNXZsMDA1ZDgzMm4wdWRzdzRleWcifQ.crLVL3iFWYSbE5zrlkIA7w';

window.addEventListener('load', async () => {
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-6.4, 39.3],
    zoom: 7
  });

  let categoriasActivas = new Set();
  let entidades = [];
  let congdex = [];
  let activeIndex = -1;

  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function getName(p) {
    return p.nombre_entidad || p.Nombre || p.name || p.Entidad || p.entidad || '';
  }
  function getAddress(p) {
    return p.direccion || p['dirección'] || p.localidad || '';
  }
  function getWebsite(p) {
    return p.pagina_contacto || p.web || p.Website || p.URL || p.url || '';
  }

  function aplicarFiltro() {
    const filtroCategorias = categoriasActivas.size
      ? ['in', ['get', 'categoria'], ['literal', Array.from(categoriasActivas)]]
      : true;
    if (map.getLayer('entidades-puntos')) map.setFilter('entidades-puntos', filtroCategorias);
    if (map.getLayer('congdex-puntos')) map.setFilter('congdex-puntos', filtroCategorias);
  }

  function openPopup(feature) {
    const p = feature.properties || {};
    const isCongdex = p.categoria === 'CONGDEX';

    if (isCongdex) {
      const nombre = getName(p);
      const direccion = getAddress(p);
      const web = getWebsite(p);
      const link = web ? `<br><a href="${web}" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline;">${web}</a>` : '';
      const html = `
        <div style="background:#009b4d;color:#fff;padding:8px 12px;border-radius:8px;font-family:'Segoe UI',sans-serif">
          <strong style="font-size:1rem">${nombre}</strong><br>
          <span>📍 ${direccion}</span>
          ${link}
        </div>`;
      new mapboxgl.Popup({ offset: 16 }).setLngLat(feature.geometry.coordinates).setHTML(html).addTo(map);
      return;
    }

    const web = p.pagina_contacto ? `<br><a href="${p.pagina_contacto}" target="_blank" rel="noopener">Sitio web</a>` : '';
    const html =
      `<strong>${p.nombre_entidad || ''}</strong><br>` +
      `<em>${p.tematica || ''}</em><br>` +
      `${p.localidad || ''}<br>` +
      `${p.correo || ''}${web}`;
    new mapboxgl.Popup({ offset: 16 }).setLngLat(feature.geometry.coordinates).setHTML(html).addTo(map);
  }

  async function cargarDatos() {
    const [resEnt, resCong] = await Promise.all([
      fetch('entidades.geojson', { cache: 'no-store' }),
      fetch('congdex.geojson', { cache: 'no-store' })
    ]);
    const geojsonEnt = await resEnt.json();
    const geojsonCong = await resCong.json();

    entidades = (geojsonEnt.features || []).map(f => f);

    // Normalizar CONGDEX, añadir categoria y campos, y deduplicar por nombre
    const seen = new Set();
    congdex = (geojsonCong.features || [])
      .map(f => {
        const p = f.properties || {};
        const nombre = getName(p).trim();
        return {
          type: 'Feature',
          properties: {
            nombre_entidad: nombre,
            direccion: getAddress(p),
            pagina_contacto: getWebsite(p),
            categoria: 'CONGDEX'
          },
          geometry: f.geometry
        };
      })
      .filter(f => {
        const key = norm(f.properties.nombre_entidad);
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

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
          'Social', '#1E90FF',
          'Ambiental', '#FF7F00',
          'Económica', '#FFD700',
          'Otra', '#BA55D3',
          '#999'
        ],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.5
      }
    });

    map.addSource('congdex', { type: 'geojson', data: { type: 'FeatureCollection', features: congdex } });
    map.addLayer({
      id: 'congdex-puntos',
      type: 'circle',
      source: 'congdex',
      paint: {
        'circle-radius': 9,
        'circle-color': '#009b4d',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2
      }
    });

    map.on('click', 'entidades-puntos', (e) => openPopup(e.features[0]));
    map.on('click', 'congdex-puntos', (e) => openPopup(e.features[0]));
    map.on('mouseenter', 'entidades-puntos', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseenter', 'congdex-puntos', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'entidades-puntos', () => map.getCanvas().style.cursor = '');
    map.on('mouseleave', 'congdex-puntos', () => map.getCanvas().style.cursor = '');

    const bounds = new mapboxgl.LngLatBounds();
    [...entidades, ...congdex].forEach(f => {
      if (f.geometry?.coordinates) bounds.extend(f.geometry.coordinates);
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 9 });

    const categorias = [...new Set(entidades.map(f => f.properties?.categoria).filter(Boolean))];
    if (!categorias.includes('CONGDEX')) categorias.push('CONGDEX');
    categorias.forEach(c => categoriasActivas.add(c));

    const counts = {};
    entidades.forEach(f => {
      const c = f.properties?.categoria;
      if (!c) return;
      counts[c] = (counts[c] || 0) + 1;
    });
    counts['CONGDEX'] = congdex.length;

    const cont = document.getElementById('filters');
    cont.innerHTML = '';
    categorias.forEach(cat => {
      const total = counts[cat] || 0;
      const label = document.createElement('label');
      label.dataset.cat = cat;
      const id = `cb-${cat.toLowerCase()}`;
      let bg = '#999', fg = '#fff';
      if (cat === 'Social') bg = '#1E90FF';
      else if (cat === 'Ambiental') bg = '#FF7F00';
      else if (cat === 'Económica') { bg = '#FFD700'; fg = '#222'; }
      else if (cat === 'Otra') bg = '#BA55D3';
      else if (cat === 'CONGDEX') bg = '#009b4d';
      label.innerHTML = `<input type="checkbox" id="${id}" value="${cat}" checked><span>${cat} (${total})</span>`;
      label.style.backgroundColor = bg;
      label.style.color = fg;
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

    const input = document.getElementById('busqueda');
    const box = document.getElementById('suggestions');
    const todas = [...entidades, ...congdex];

    function renderSuggestions(q) {
      if (!q) { box.classList.remove('show'); box.innerHTML = ''; activeIndex = -1; return; }
      const nq = norm(q);
      const results = todas
        .filter(f => norm(getName(f.properties)).includes(nq))
        .slice(0, 15);
      if (!results.length) { box.classList.remove('show'); box.innerHTML = ''; activeIndex = -1; return; }
      box.innerHTML = results.map((f, i) => `<li role="option" data-i="${i}">${getName(f.properties)}</li>`).join('');
      box.classList.add('show');
      activeIndex = -1;
    }

    function selectEntity(index, pool) {
      const f = pool[index];
      if (!f) return;
      input.value = getName(f.properties) || '';
      box.classList.remove('show');
      map.flyTo({ center: f.geometry.coordinates, zoom: 10 });
      openPopup(f);
    }

    input.addEventListener('input', (e) => renderSuggestions(e.target.value || ''));

    box.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      const q = norm(input.value);
      const pool = todas.filter(f => norm(getName(f.properties)).includes(q)).slice(0, 15);
      selectEntity(parseInt(li.dataset.i, 10), pool);
    });

    input.addEventListener('keydown', (e) => {
      const q = norm(input.value);
      const pool = todas.filter(f => norm(getName(f.properties)).includes(q)).slice(0, 15);
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
        box.classList.remove('show'); activeIndex = -1;
      }
    });

    document.addEventListener('click', (e) => {
      if (!document.querySelector('.search-box-header').contains(e.target)) {
        box.classList.remove('show'); activeIndex = -1;
      }
    });
  }

  map.on('load', cargarDatos);
});
