mapboxgl.accessToken = 'pk.eyJ1IjoibW1pbGFjIiwiYSI6ImNpeWhkNXZsMDA1ZDgzMm4wdWRzdzRleWcifQ.crLVL3iFWYSbE5zrlkIA7w';

if (typeof mapboxgl === 'undefined') {
  console.error('Mapbox GL no está disponible');
} else if (!mapboxgl.supported()) {
  alert('Tu navegador no soporta Mapbox GL. Por favor, usa una versión más reciente.');
}

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-6.38, 39.39],
  zoom: 7
});

const categorias = {
  SOCIALES: '#FFD700',
  AMBIENTALES: '#009b4d',
  ECONÓMICAS: '#FF7F00'
};

map.on('load', () => {
  fetch('entidades.geojson', { cache: 'no-store' })
    .then(r => {
      if (!r.ok) throw new Error('No se pudo cargar entidades.geojson');
      return r.json();
    })
    .then(data => {
      document.getElementById('loading')?.classList.add('hide');

      const features = data.features || [];
      const counts = { SOCIALES: 0, AMBIENTALES: 0, ECONÓMICAS: 0 };

      features.forEach(f => {
        const cat = f.properties.CATEGORIA;
        if (counts[cat] != null) counts[cat]++;
      });

      const filtersDiv = document.getElementById('filters');
      Object.keys(categorias).forEach(cat => {
        const label = document.createElement('label');
        label.dataset.cat = cat;
        label.innerHTML = `<input type="checkbox" checked data-cat="${cat}" /> ${cat} (${counts[cat] || 0})`;
        filtersDiv.appendChild(label);
      });

      const markers = [];

      features.forEach(f => {
        const { NOMBRE, CATEGORIA, DIRECCION, LOCALIDAD, SITIO_WEB, TEMATICAS } = f.properties;
        const color = categorias[CATEGORIA] || '#888';
        const lngLat = f.geometry.coordinates;

        const marker = new mapboxgl.Marker({ color }).setLngLat(lngLat).addTo(map);
        markers.push({ marker, cat: CATEGORIA });

        const html = `
          <div>
            <h3>${NOMBRE}</h3>
            <p><strong>Categoría:</strong> ${CATEGORIA}</p>
            <p><strong>Dirección:</strong> ${DIRECCION}</p>
            <p><strong>Localidad:</strong> ${LOCALIDAD}</p>
            <p><strong>Sitio web:</strong> <a href="${SITIO_WEB}" target="_blank" rel="noopener">Sitio web</a></p>
            <p><strong>Temáticas:</strong> ${TEMATICAS}</p>
          </div>
        `;
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(html);

        marker.getElement().addEventListener('click', () => {
          map.easeTo({ center: lngLat, zoom: 12 });
          popup.addTo(map);
        });
      });

      filtersDiv.addEventListener('change', (e) => {
        const input = e.target;
        if (!input || input.type !== 'checkbox') return;

        const cat = input.getAttribute('data-cat');
        const visible = input.checked;

        markers.forEach(m => {
          if (m.cat === cat) {
            const el = m.marker.getElement();
            el.style.display = visible ? '' : 'none';
          }
        });
      });

      const input = document.getElementById('busqueda');
      const list = document.getElementById('suggestions');
      const nombres = features.map(f => ({
        name: f.properties.NOMBRE,
        coord: f.geometry.coordinates,
        html: `
          <div>
            <h3>${f.properties.NOMBRE}</h3>
            <p><strong>Categoría:</strong> ${f.properties.CATEGORIA}</p>
            <p><strong>Dirección:</strong> ${f.properties.DIRECCION}</p>
            <p><strong>Localidad:</strong> ${f.properties.LOCALIDAD}</p>
            <p><strong>Sitio web:</strong> <a href="${f.properties.SITIO_WEB}" target="_blank" rel="noopener">Sitio web</a></p>
            <p><strong>Temáticas:</strong> ${f.properties.TEMATICAS}</p>
          </div>`
      }));

      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (!q) { list.classList.remove('show'); list.innerHTML = ''; return; }
        const hits = nombres.filter(n => n.name.toLowerCase().includes(q)).slice(0, 12);
        list.innerHTML = hits.map(h => `<li data-name="${h.name}">${h.name}</li>`).join('');
        list.classList.add('show');
      });

      list.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const name = li.getAttribute('data-name');
        const found = nombres.find(n => n.name === name);
        list.classList.remove('show');
        list.innerHTML = '';
        input.value = name;

        if (found) {
          map.easeTo({ center: found.coord, zoom: 12 });
          new mapboxgl.Popup({ offset: 25 }).setHTML(found.html).setLngLat(found.coord).addTo(map);
        }
      });

      document.addEventListener('click', (e) => {
        if (!document.querySelector('.search-box-header').contains(e.target)) {
          list.classList.remove('show'); list.innerHTML = '';
        }
      });
    })
    .catch(err => {
      console.error(err);
      const loader = document.getElementById('loading');
      if (loader) loader.textContent = 'No se pudo cargar el mapa. Revisa entidades.geojson.';
    });
});
