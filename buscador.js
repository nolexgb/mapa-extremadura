mapboxgl.accessToken = 'pk.eyJ1IjoibW1pbGFjIiwiYSI6ImNpeWhkNXZsMDA1ZDgzMm4wdWRzdzRleWcifQ.crLVL3iFWYSbE5zrlkIA7w';

window.addEventListener('load', () => {
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-6.4, 39.3],
    zoom: 7
  });

  let categoriasActivas = new Set();
  let entidades = [];
  let activeIndex = -1;

  function aplicarFiltro() {
    const filtroCategorias = categoriasActivas.size
      ? ['in', ['get', 'categoria'], ['literal', Array.from(categoriasActivas)]]
      : true;
    if (map.getLayer('entidades-puntos')) map.setFilter('entidades-puntos', filtroCategorias);
  }

  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function openPopup(feature) {
    const p = feature.properties;
    const web = p.pagina_contacto && p.pagina_contacto !== 'null'
      ? `<br><a href="${p.pagina_contacto}" target="_blank" rel="noopener">Sitio web</a>` : '';
    new mapboxgl.Popup({ offset: 16 })
      .setLngLat(feature.geometry.coordinates)
      .setHTML(
        `<strong>${p.nombre_entidad || ''}</strong><br>
         <em>${p.tematica || ''}</em><br>
         ${p.localidad || ''}<br>
         ${p.telefono || ''}<br>
         ${p.correo || ''}${web}`
      )
      .addTo(map);
  }

  async function cargarEntidades() {
    try {
      const res = await fetch('entidades.geojson', { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudo cargar entidades.geojson');
      const geojson = await res.json();
      entidades = geojson.features || [];

      if (!map.getSource('entidades')) {
        map.addSource('entidades', { type: 'geojson', data: geojson });
      }

      if (!map.getLayer('entidades-puntos')) {
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
      }

      map.on('click', 'entidades-puntos', (e) => openPopup(e.features[0]));
      map.on('mouseenter', 'entidades-puntos', () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', 'entidades-puntos', () => map.getCanvas().style.cursor = '');

      const bounds = new mapboxgl.LngLatBounds();
      entidades.forEach(f => {
        if (f.geometry && Array.isArray(f.geometry.coordinates)) bounds.extend(f.geometry.coordinates);
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 9 });

      const categorias = [...new Set(entidades.map(f => (f.properties || {}).categoria).filter(Boolean))];
      categorias.forEach(cat => categoriasActivas.add(cat));

      const counts = {};
      entidades.forEach(f => {
        const cat = f.properties.categoria;
        if (!cat) return;
        counts[cat] = (counts[cat] || 0) + 1;
      });

      const cont = document.getElementById('filters');
      cont.innerHTML = '';
      categorias.forEach(cat => {
        const total = counts[cat] || 0;
        const label = document.createElement('label');
        label.dataset.cat = cat;
        const id = `cb-${cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}`;
        label.innerHTML = `<input type="checkbox" id="${id}" value="${cat}" checked><span>${cat} (${total})</span>`;
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

      const input = document.getElementById('busqueda');
      const box = document.getElementById('suggestions');

      function renderSuggestions(q) {
        if (!q) { box.classList.remove('show'); box.innerHTML = ''; activeIndex = -1; return; }
        const nq = norm(q);
        const results = entidades.filter(f => norm(f.properties.nombre_entidad).startsWith(nq)).slice(0, 15);
        if (!results.length) { box.classList.remove('show'); box.innerHTML = ''; activeIndex = -1; return; }
        const list = results.map((f, i) => `<li role="option" data-i="${i}">${f.properties.nombre_entidad}</li>`).join('');
        box.innerHTML = list;
        box.classList.add('show');
        activeIndex = -1;
      }

      function selectEntity(index, pool) {
        const f = pool[index];
        if (!f) return;
        document.getElementById('busqueda').value = f.properties.nombre_entidad || '';
        document.getElementById('suggestions').classList.remove('show');
        map.flyTo({ center: f.geometry.coordinates, zoom: 10 });
        openPopup(f);
      }

      input.addEventListener('input', (e) => renderSuggestions(e.target.value || ''));

      box.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const q = norm(document.getElementById('busqueda').value);
        const pool = entidades.filter(f => norm(f.properties.nombre_entidad).startsWith(q)).slice(0, 15);
        selectEntity(parseInt(li.dataset.i, 10), pool);
      });

      input.addEventListener('keydown', (e) => {
        const q = norm(input.value);
        const pool = entidades.filter(f => norm(f.properties.nombre_entidad).startsWith(q)).slice(0, 15);
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

    } catch (err) {
      console.error('Error al cargar entidades:', err);
      alert('No se pudo cargar el archivo entidades.geojson. Asegúrate de que está en la raíz del repositorio.');
    }
  }

  map.on('load', cargarEntidades);
});
