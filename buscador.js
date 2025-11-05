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
  const t = textoBusqueda.trim().toLowerCase();
  const filtroTexto = t.length
    ? ['any',
        ['>=', ['index-of', t, ['downcase', ['get', 'nombre_entidad']]], 0],
        ['>=', ['index-of', t, ['downcase', ['get', 'localidad']]], 0],
        ['>=', ['index-of', t, ['downcase', ['get', 'tematica']]], 0]
      ]
    : true;
  const filtroFinal =
    filtroCategorias === true && filtroTexto === true ? true :
    filtroCategorias === true ? filtroTexto :
    filtroTexto === true ? filtroCategorias :
    ['all', filtroCategorias, filtroTexto];
  if (map.getLayer('entidades-puntos')) map.setFilter('entidades-puntos', filtroFinal);
}

function norm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

function renderSuggestions(q) {
  const box = document.getElementById('suggestions');
  if (!q) { box.classList.remove('show'); box.innerHTML = ''; activeIndex = -1; return; }
  const nq = norm(q);
  const starts = entidades.filter(f => {
    const p = f.properties||{};
    return norm(p.nombre_entidad).startsWith(nq) || norm(p.localidad).startsWith(nq) || norm(p.tematica).startsWith(nq);
  });
  const pool = starts.length ? starts : entidades.filter(f => {
    const p = f.properties||{};
    return norm(p.nombre_entidad).includes(nq) || norm(p.localidad).includes(nq) || norm(p.tematica).includes(nq);
  });
  const list = pool.slice(0,12).map((f,i) => {
    const p=f.properties||{};
    const name=p.nombre_entidad||'';
    const meta=[p.localidad,p.tematica].filter(Boolean).join(' · ');
    return `<li role="option" data-i="${i}"><span class="s-name">${name}</span><span class="s-meta">${meta}</span></li>`;
  }).join('');
  if (!list){ box.classList.remove('show'); box.innerHTML=''; activeIndex=-1; return; }
  box.innerHTML = list;
  box.classList.add('show');
  activeIndex = -1;
}

function selectSuggestionByIndex(idx, pool) {
  const f = pool[idx];
  if (!f || !f.geometry || !f.geometry.coordinates) return;
  const p = f.properties||{};
  const input = document.getElementById('busqueda');
  input.value = p.nombre_entidad || '';
  document.getElementById('suggestions').classList.remove('show');
  map.flyTo({ center: f.geometry.coordinates, zoom: 10 });
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
      ? `<br><a href="${p.pagina_contacto}" target="_blank" rel="noopener">Sitio web</a>` : '';
    new mapboxgl.Popup({ offset: 16 })
      .setLngLat(f.geometry.coordinates)
      .setHTML(
        `<strong>${p.nombre_entidad || ''}</strong><br>
         <em>${p.tematica || ''}</em><br>
         ${p.localidad || ''}<br>
         ${p.telefono || ''}<br>
         ${p.correo || ''}${web}`
      ).addTo(map);
  });
  map.on('mouseenter', 'entidades-puntos', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'entidades-puntos', () => map.getCanvas().style.cursor = '');

  map.addLayer(
    {
      id: 'extremadura-outline',
      type: 'line',
      source: 'composite',
      'source-layer': 'admin',
      filter: ['all',
        ['==', ['get','admin_level'], 1],
        ['any',
          ['==', ['get','iso_3166_2_left'], 'ES-EX'],
          ['==', ['get','iso_3166_2_right'], 'ES-EX']
        ]
      ],
      paint: { 'line-color': '#3CB371', 'line-width': 1.5, 'line-opacity': 0.9 }
    },
    'entidades-puntos'
  );

  const bounds = new mapboxgl.LngLatBounds();
  entidades.forEach(f => { if (f.geometry && Array.isArray(f.geometry.coordinates)) bounds.extend(f.geometry.coordinates); });
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 9 });

  const categorias = [...new Set(entidades.map(f => (f.properties||{}).categoria).filter(Boolean))];
  categorias.forEach(cat => categoriasActivas.add(cat));
  const cont = document.getElementById('filters');
  cont.innerHTML = '';
  categorias.forEach(cat => {
    const label = document.createElement('label');
    label.dataset.cat = cat;
    const id = `cb-${cat.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}`;
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
  const box = document.getElementById('suggestions');

  input.addEventListener('input', (e) => {
    textoBusqueda = e.target.value || '';
    aplicarFiltro();
    renderSuggestions(textoBusqueda);
  });

  box.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const nq = norm(document.getElementById('busqueda').value);
    const pool = entidades.filter(f => {
      const p=f.properties||{};
      return norm(p.nombre_entidad).startsWith(nq) || norm(p.localidad).startsWith(nq) || norm(p.tematica).startsWith(nq);
    });
    const list = (pool.length ? pool : entidades).slice(0,12);
    selectSuggestionByIndex(parseInt(li.dataset.i,10), list);
    box.classList.remove('show');
  });

  input.addEventListener('keydown', (e) => {
    const nq = norm(input.value);
    const starts = entidades.filter(f => {
      const p=f.properties||{};
      return norm(p.nombre_entidad).startsWith(nq) || norm(p.localidad).startsWith(nq) || norm(p.tematica).startsWith(nq);
    });
    const pool = (starts.length ? starts : entidades).slice(0,12);
    const items = box.querySelectorAll('li');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      items.forEach((li,i)=>li.classList.toggle('active', i===activeIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      items.forEach((li,i)=>li.classList.toggle('active', i===activeIndex));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) selectSuggestionByIndex(activeIndex, pool);
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
});
