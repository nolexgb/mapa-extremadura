const categorias = {
  SOCIALES: '#FFD700',
  AMBIENTALES: '#009b4d',
  ECONÓMICAS: '#FF7F00'
};

// Iniciar el mapa con MapLibre (no requiere token)
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-6.38, 39.39],
  zoom: 7
});

// Mostrar texto de carga
const loader = document.createElement('div');
loader.id = 'loader';
loader.textContent = 'Cargando mapa...';
loader.style.textAlign = 'center';
loader.style.marginTop = '20px';
document.body.appendChild(loader);

map.on('load', () => loader.remove());

fetch('entidades.geojson')
  .then(r => {
    if (!r.ok) throw new Error('No se pudo cargar entidades.geojson');
    return r.json();
  })
  .then(data => {
    const features = data.features || [];
    const counts = { SOCIALES: 0, AMBIENTALES: 0, ECONÓMICAS: 0 };
    const markers = [];
    const byName = new Map();

    // --- Normaliza categorías y cuenta ---
    features.forEach(f => {
      const rawCat = (f.properties.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cat = rawCat.trim().toUpperCase();
      if (counts[cat] !== undefined) counts[cat]++;
    });

    // --- Crea filtros de categorías ---
    const filtersDiv = document.getElementById('filters');
    filtersDiv.innerHTML = '';
    Object.keys(categorias).forEach(cat => {
      const label = document.createElement('label');
      label.dataset.cat = cat;
      label.innerHTML = <input type="checkbox" checked data-cat="${cat}" /> ${cat} (${counts[cat] || 0});
      filtersDiv.appendChild(label);
    });
    const checkboxes = filtersDiv.querySelectorAll('input[type="checkbox"]');

    // --- Popup global reutilizable ---
    const popup = new maplibregl.Popup({
      offset: 25,
      closeButton: true,
      maxWidth: '360px'
    });

    // --- Crea marcadores ---
    features.forEach(f => {
      const p = f.properties || {};
      const rawCat = (p.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cat = rawCat.trim().toUpperCase();
      const color = categorias[cat] || '#999';
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length !== 2) return;

      const el = document.createElement('div');
      el.className = 'marker';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';

      const popupHTML = `
        <div style="line-height:1.5;max-width:300px">
          <h3 style="color:#009b4d;font-size:1.1rem;margin-bottom:6px">${p.nombre_entidad || ''}</h3>
          <p><strong>Categoría:</strong> ${p.categoria || ''}</p>
          <p><strong>Dirección:</strong> ${p.direccion || ''}</p>
          <p><strong>Localidad:</strong> ${p.localidad || ''}</p>
          ${p.pagina_contacto ? <p><strong>Sitio web:</strong> <a href="${p.pagina_contacto}" target="_blank" style="color:#009b4d">Visitar sitio</a></p> : ''}
          <p><strong>Temáticas:</strong> ${p.tematica || ''}</p>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el }).setLngLat(coords).addTo(map);

      // --- Evento clic con popup persistente ---
      el.addEventListener('click', e => {
        e.stopPropagation(); // evita cierre inmediato
        popup.remove(); // cierra cualquier popup anterior
        popup.setLngLat(coords).setHTML(popupHTML).addTo(map);
        map.flyTo({ center: coords, zoom: 12, essential: true });
      });

      markers.push({ el, cat, coords, popupHTML });

      // --- Añadir al índice de búsqueda ---
      const name = (p.nombre_entidad || '').trim().toLowerCase();
      if (name) {
        byName.set(name, {
          coords,
          popupHTML,
          open: () => {
            popup.remove();
            popup.setLngLat(coords).setHTML(popupHTML).addTo(map);
            map.flyTo({ center: coords, zoom: 12, essential: true });
          }
        });
      }
    });

    // --- Filtro por categoría ---
    checkboxes.forEach(cb =>
      cb.addEventListener('change', () => {
        const active = new Set(
          [...checkboxes].filter(x => x.checked).map(x => x.dataset.cat)
        );
        markers.forEach(m => {
          m.el.style.display = active.has(m.cat) ? 'block' : 'none';
        });
      })
    );

    // --- Búsqueda con sugerencias ---
    const input = document.getElementById('busqueda');
    const list = document.getElementById('suggestions');

    function renderSuggestions(q) {
      list.innerHTML = '';
      if (!q) { list.classList.remove('show'); return; }
      const ql = q.toLowerCase();
      const results = [...byName.keys()].filter(n => n.includes(ql)).slice(0, 10);
      if (!results.length) { list.classList.remove('show'); return; }

      results.forEach(n => {
        const li = document.createElement('li');
        li.textContent = [...byName.keys()].find(k => k === n);
        li.addEventListener('click', () => {
          input.value = li.textContent;
          list.classList.remove('show');
          const item = byName.get(n);
          if (item) item.open();
        });
        list.appendChild(li);
      });
      list.classList.add('show');
    }

    input.addEventListener('input', () => renderSuggestions(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const v = input.value.trim().toLowerCase();
        const item = byName.get(v);
        if (item) { list.classList.remove('show'); item.open(); }
      }
    });

    document.addEventListener('click', e => {
      if (!document.querySelector('.search-box-header')?.contains(e.target))
        list.classList.remove('show');
    });
  })
  .catch(err => {
    document.getElementById('loader').textContent = 'No se pudo cargar el mapa.';
    console.error('Error:', err);
  });
