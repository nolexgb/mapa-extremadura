const categorias = {
  SOCIALES: '#FFD700',
  AMBIENTALES: '#009b4d',
  ECONÓMICAS: '#FF7F00'
};

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-6.38, 39.39],
  zoom: 7
});

const loader = document.getElementById('loader');
map.on('load', () => loader.style.display = 'none');

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

    // Contar entidades por categoría
    features.forEach(f => {
      const cat = f.properties.categoria?.toUpperCase();
      if (counts[cat] !== undefined) counts[cat]++;
    });

    // Crear botones de categoría
    const filtersDiv = document.getElementById('filters');
    Object.keys(categorias).forEach(cat => {
      const label = document.createElement('label');
      label.dataset.cat = cat;
      label.innerHTML = `<input type="checkbox" checked data-cat="${cat}" /> ${cat} (${counts[cat] || 0})`;
      filtersDiv.appendChild(label);
    });

    const checkboxes = filtersDiv.querySelectorAll('input[type="checkbox"]');

    // Crear marcadores y popups
    features.forEach(f => {
      const p = f.properties || {};
      const cat = p.categoria?.toUpperCase();
      const color = categorias[cat] || '#666';
      const coords = f.geometry?.coordinates;

      if (!coords || coords.length !== 2) return;

      const el = document.createElement('div');
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.borderRadius = '50%';
      el.style.background = color;
      el.style.border = '2px solid #fff';
      el.style.boxShadow = '0 1px 4px rgba(0,0,0,.35)';
      el.style.cursor = 'pointer';

      const popupHTML = `
        <h3>${p.nombre_entidad || ''}</h3>
        <p><strong>Categoría:</strong> ${p.categoria || ''}</p>
        <p><strong>Dirección:</strong> ${p.direccion || ''}</p>
        <p><strong>Localidad:</strong> ${p.localidad || ''}</p>
        <p><strong>Sitio web:</strong> ${
          p.pagina_contacto ? `<a href="${p.pagina_contacto}" target="_blank">Sitio web</a>` : ''
        }</p>
        <p><strong>Temáticas:</strong> ${p.tematica || ''}</p>
      `;

      const popup = new maplibregl.Popup({
        offset: 25,
        anchor: 'top',
        closeButton: true,
        maxWidth: '360px'
      }).setHTML(popupHTML);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map);

      el.addEventListener('click', () => {
        map.flyTo({ center: coords, zoom: 12, essential: true });
        popup.addTo(map);
      });

      markers.push({ marker, el, cat });

      // Guardar en índice de búsqueda
      const name = (p.nombre_entidad || '').trim().toLowerCase();
      if (name) byName.set(name, { coords, open: () => {
        map.flyTo({ center: coords, zoom: 12, essential: true });
        popup.addTo(map);
      }});
    });

    // Filtrado por categoría
    checkboxes.forEach(cb => cb.addEventListener('change', () => {
      const active = new Set(
        [...checkboxes].filter(x => x.checked).map(x => x.dataset.cat)
      );
      markers.forEach(m => {
        const visible = active.has(m.cat);
        m.el.style.display = visible ? 'block' : 'none';
      });
    }));

    // Búsqueda
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
    console.error('Error:', err);
  });
