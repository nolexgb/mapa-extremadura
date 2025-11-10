const COLORS = { SOCIALES: '#FFD700', AMBIENTALES: '#009b4d', ECONÓMICAS: '#FF7F00' };
const LABELS = { SOCIALES: 'SOCIALES', AMBIENTALES: 'AMBIENTALES', ECONÓMICAS: 'ECONÓMICAS' };

function normalizar(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
}

function categorizar(raw) {
  const v = normalizar(raw);
  if (v.includes('SOCIAL')) return 'SOCIALES';
  if (v.includes('AMBIENT')) return 'AMBIENTALES';
  if (v.includes('ECONOM')) return 'ECONÓMICAS';
  return 'SOCIALES'; // por defecto
}

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [-6.38, 39.39],
  zoom: 7
});

fetch('entidades.geojson')
  .then(r => r.json())
  .then(data => {
    const features = data.features || [];
    const counts = { SOCIALES: 0, AMBIENTALES: 0, ECONÓMICAS: 0 };
    const markers = [];
    const byName = new Map();

    // contar categorías
    features.forEach(f => {
      const cat = categorizar(f.properties?.categoria);
      if (counts[cat] !== undefined) counts[cat]++;
    });

    // crear filtros
    const filtersDiv = document.getElementById('filters');
    filtersDiv.innerHTML = '';
    Object.keys(COLORS).forEach(cat => {
      const label = document.createElement('label');
      label.dataset.cat = cat;
      label.innerHTML = `<input type="checkbox" checked data-cat="${cat}" /> ${LABELS[cat]} (${counts[cat] || 0})`;
      filtersDiv.appendChild(label);
    });
    const checkboxes = filtersDiv.querySelectorAll('input[type="checkbox"]');

    const popup = new maplibregl.Popup({ offset: 25, closeButton: true, maxWidth: '360px' });

    // crear marcadores
    features.forEach(f => {
      const p = f.properties || {};
      const cat = categorizar(p.categoria);
      const coords = f.geometry?.coordinates;
      if (!coords) return;

      const el = document.createElement('div');
      el.className = 'marker';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = COLORS[cat];
      el.style.border = '2px solid #fff';
      el.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
      el.style.cursor = 'pointer';

      const html = `
        <div style="line-height:1.7;max-width:320px">
          <h3 style="color:#009b4d;font-size:1.2rem;margin:0 0 6px">${p.nombre_entidad || ''}</h3>
          <p><strong>Categoría:</strong> ${LABELS[cat]}</p>
          <p><strong>Dirección:</strong> ${p.direccion || ''}</p>
          <p><strong>Localidad:</strong> ${p.localidad || ''}</p>
          ${p.pagina_contacto ? `<p><strong>Sitio web:</strong> <a href="${p.pagina_contacto}" target="_blank" style="color:#009b4d;text-decoration:underline">SITIO WEB</a></p>` : ''}
          <p><strong>Temáticas:</strong> ${p.tematica || ''}</p>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el }).setLngLat(coords).addTo(map);

      el.addEventListener('click', e => {
        e.stopPropagation();
        popup.remove();
        popup.setLngLat(coords).setHTML(html).addTo(map);
        map.flyTo({ center: coords, zoom: 12, essential: true });
      });

      markers.push({ el, cat });

      const name = (p.nombre_entidad || '').trim().toLowerCase();
      if (name) byName.set(name, { coords, html });
    });

    // activar/desactivar categorías
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const active = new Set([...checkboxes].filter(x => x.checked).map(x => x.dataset.cat));
        markers.forEach(m => (m.el.style.display = active.has(m.cat) ? 'block' : 'none'));
      });
    });

    // búsqueda
    const input = document.getElementById('busqueda');
    const list = document.getElementById('suggestions');

    function showSuggestions(q) {
      list.innerHTML = '';
      const ql = (q || '').toLowerCase().trim();
      if (!ql) return list.classList.remove('show');
      const results = [...byName.keys()].filter(n => n.includes(ql)).slice(0, 10);
      if (!results.length) return list.classList.remove('show');
      results.forEach(key => {
        const li = document.createElement('li');
        li.textContent = key;
        li.addEventListener('click', () => {
          input.value = key;
          list.classList.remove('show');
          const item = byName.get(key);
          popup.remove();
          popup.setLngLat(item.coords).setHTML(item.html).addTo(map);
          map.flyTo({ center: item.coords, zoom: 12, essential: true });
        });
        list.appendChild(li);
      });
      list.classList.add('show');
    }

    input.addEventListener('input', () => showSuggestions(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const key = input.value.toLowerCase().trim();
        const item = byName.get(key);
        if (item) {
          list.classList.remove('show');
          popup.remove();
          popup.setLngLat(item.coords).setHTML(item.html).addTo(map);
          map.flyTo({ center: item.coords, zoom: 12, essential: true });
        }
      }
    });

    document.addEventListener('click', e => {
      if (!document.querySelector('.search-box-header')?.contains(e.target)) list.classList.remove('show');
    });
  })
  .catch(err => console.error('Error al cargar entidades.geojson:', err));
