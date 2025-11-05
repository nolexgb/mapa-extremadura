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
  let entidadesCongdex = [];
  let activeIndex = -1;

  function aplicarFiltro() {
    const filtroCategorias = categoriasActivas.size
      ? ['in', ['get', 'categoria'], ['literal', Array.from(categoriasActivas)]]
      : true;
    if (map.getLayer('entidades-puntos')) map.setFilter('entidades-puntos', filtroCategorias);
    if (map.getLayer('congdex-puntos')) map.setFilter('congdex-puntos', filtroCategorias);
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

  async function cargarDatos() {
    try {
      // Cargar ambos archivos
      const [resEnt, resCong] = await Promise.all([
        fetch('entidades.geojson', { cache: 'no-store' }),
        fetch('congdex.geojson', { cache: 'no-store' })
      ]);

      const geojsonEnt = await resEnt.json();
      const geojsonCong = await resCong.json();

      entidades = geojsonEnt.features || [];
      entidadesCongdex = geojsonCong.features || [];

      // === Fuente general ===
      map.addSource('entidades', { type: 'geojson', data: geojsonEnt });
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

      // === Fuente CONGDEX ===
      map.addSource('congdex', { type: 'geojson', data: geojsonCong });
      map.addLayer({
        id: 'congdex-puntos',
        type: 'circle',
        source: 'congdex',
        paint: {
          'circle-radius': 9,
          'circle-color': '#FF7F00', // Naranja
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2
        }
      });

      // === POPUPS ===
      map.on('click', 'entidades-puntos', (e) => openPopup(e.features[0]));
      map.on('click', 'congdex-puntos', (e) => openPopup(e.features[0]));
      map.on('mouseenter', 'entidades-puntos', () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseenter', 'congdex-puntos', () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', 'entidades-puntos', () => map.getCanvas().style.cursor = '');
      map.on('mouseleave', 'congdex-puntos', () => map.getCanvas().style.cursor = '');

      // === Ajuste inicial del mapa ===
      const bounds = new mapboxgl.LngLatBounds();
      [...entidades, ...entidadesCongdex].forEach(f => {
        if (f.geometry && Array.isArray(f.geometry.coordinates)) bounds.extend(f.geometry.coordinates);
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 9 });

      // === Categorías + conteo ===
      const categorias = [...new Set(entidades.map(f => (f.properties || {}).categoria).filter(Boolean))];
      categorias.push('CONGDEX');
      categorias.forEach(cat => categoriasActivas.add(cat));

      const counts = {};
      entidades.forEach(f => {
        const cat = f.properties.categoria;
        if (!cat) return;
        counts[cat] = (counts[cat] || 0) + 1;
      });
      counts['CONGDEX'] = entidadesCongdex.length; // Conteo exacto (debería ser 52)

      const cont = document.getElementById('filters');
      cont.innerHTML = '';
      categorias.forEach(cat => {
        const total = counts[cat] || 0;
        const label = document.createElement('label');
        label.dataset.cat = cat;
        const id = `cb-${cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}`;
        let bgColor = '';
        if (cat === 'Social') bgColor = '#1E90FF';
        else if (cat === 'Ambiental') bgColor = '#3CB371';
        else if (cat === 'Económica') bgColor = '#FFD700';
        else if (cat === 'Otra') bgColor = '#BA55D3';
        else if (cat === 'CONGDEX') bgColor = '#FF7F00';
        label.innerHTML = `<input type="checkbox" id="${id}" value="${cat}" checked><span>${cat} (${total})</span>`;
        label.style.backgroundColor = bgColor;
        if (cat === 'Económica') label.style.color = '#222';
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

      // === BUSCADOR (incluye ambas fuentes) ===
      const input = document.getElementById('busqueda');
      const box = document.getElementById('suggestions');
      const todasEntidades = [...entidades, ...entidadesCongdex];

      function renderSuggestions(q) {
        if (!q) { box.classList.remove('show'); box.innerHTML = ''; activeIndex = -1; return; }
        const nq = norm(q);
        const results = todasEntidades.filter(f => norm(f.properties.nombre_entidad).startsWith(nq)).slice(0, 15);
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
        openPopup(f); // Abre popup automáticamente
      }

      input.addEventListener('input', (e) => renderSuggestions(e.target.value || ''));

      box.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const q = norm(document.getElementById('busqueda').value);
        const pool = todasEntidades.filter(f => norm(f.properties.nombre_entidad).startsWith(q)).slice(0, 15);
        selectEntity(parseInt(li.dataset.i, 10), pool);
      });

      input.addEventListener('keydown', (e) => {
        const q = norm(input.value);
        const pool = todasEntidades.filter(f => norm(f.properties.nombre_entidad).startsWith(q)).slice(0, 15);
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

      console.log(`✅ Cargadas ${entidades.length} entidades generales y ${entidadesCongdex.length} de CONGDEX`);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      alert('Error al cargar los archivos GeoJSON. Verifica que estén en la raíz.');
    }
  }

  map.on('load', cargarDatos);
});
