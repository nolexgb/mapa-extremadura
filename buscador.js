mapboxgl.accessToken = 'pk.eyJ1IjoibW1pbGFjIiwiYSI6ImNpeWhkNXZsMDA1ZDgzMm4wdWRzdzRleWcifQ.crLVL3iFWYSbE5zrlkIA7w';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-6.338, 39.37],
  zoom: 7
});

const categorias = {
  SOCIALES: '#FFD700',
  AMBIENTALES: '#009b4d',
  ECONÓMICAS: '#FF7F00'
};

const popupOffset = 20;

fetch('entidades.geojson')
  .then(response => response.json())
  .then(data => {
    const features = data.features;
    const categoryCounts = {};

    for (const cat in categorias) categoryCounts[cat] = 0;

    features.forEach(f => {
      if (f.properties.CATEGORIA && categoryCounts[f.properties.CATEGORIA] !== undefined) {
        categoryCounts[f.properties.CATEGORIA]++;
      }
    });

    features.forEach(feature => {
      const { NOMBRE, CATEGORIA, DIRECCION, LOCALIDAD, SITIO_WEB, TEMATICAS } = feature.properties;
      const color = categorias[CATEGORIA] || '#999';

      const marker = new mapboxgl.Marker({ color })
        .setLngLat(feature.geometry.coordinates)
        .addTo(map);

      const popupHTML = `
        <div style="min-width:250px;max-width:280px;padding:6px 10px;line-height:1.6;">
          <h3 style="font-size:1.1rem;color:#009b4d;margin-bottom:6px;">${NOMBRE}</h3>
          <p><strong>Categoría:</strong> ${CATEGORIA}</p>
          <p><strong>Dirección:</strong> ${DIRECCION}</p>
          <p><strong>Localidad:</strong> ${LOCALIDAD}</p>
          <p><strong>Sitio web:</strong> <a href="${SITIO_WEB}" target="_blank">Sitio web</a></p>
          <p><strong>Temáticas:</strong> ${TEMATICAS}</p>
        </div>`;

      const popup = new mapboxgl.Popup({
        offset: popupOffset,
        closeButton: true,
        closeOnClick: true
      }).setHTML(popupHTML);

      marker.getElement().addEventListener('click', () => {
        map.flyTo({ center: feature.geometry.coordinates, zoom: 12 });
        popup.addTo(map);
      });
    });

    const filtersDiv = document.getElementById('filters');
    for (const cat in categorias) {
      const label = document.createElement('label');
      label.dataset.cat = cat;
      label.innerHTML = `<input type="checkbox" checked data-cat="${cat}" /> ${cat} (${categoryCounts[cat]})`;
      filtersDiv.appendChild(label);
    }

    document.querySelectorAll('#filters input').forEach(input => {
      input.addEventListener('change', e => {
        const cat = e.target.dataset.cat;
        const visible = e.target.checked;
        map.setLayoutProperty(cat, 'visibility', visible ? 'visible' : 'none');
      });
    });

    const searchInput = document.getElementById('busqueda');
    const suggestionsList = document.getElementById('suggestions');

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      suggestionsList.innerHTML = '';
      if (!query) {
        suggestionsList.classList.remove('show');
        return;
      }
      const matches = features.filter(f => f.properties.NOMBRE.toLowerCase().includes(query));
      matches.forEach(f => {
        const li = document.createElement('li');
        li.textContent = f.properties.NOMBRE;
        li.addEventListener('click', () => {
          map.flyTo({ center: f.geometry.coordinates, zoom: 12 });
          new mapboxgl.Popup()
            .setLngLat(f.geometry.coordinates)
            .setHTML(`
              <div style="min-width:250px;max-width:280px;padding:6px 10px;line-height:1.6;">
                <h3 style="font-size:1.1rem;color:#009b4d;margin-bottom:6px;">${f.properties.NOMBRE}</h3>
                <p><strong>Categoría:</strong> ${f.properties.CATEGORIA}</p>
                <p><strong>Dirección:</strong> ${f.properties.DIRECCION}</p>
                <p><strong>Localidad:</strong> ${f.properties.LOCALIDAD}</p>
                <p><strong>Sitio web:</strong> <a href="${f.properties.SITIO_WEB}" target="_blank">Sitio web</a></p>
                <p><strong>Temáticas:</strong> ${f.properties.TEMATICAS}</p>
              </div>
            `)
            .addTo(map);
          suggestionsList.classList.remove('show');
          searchInput.value = f.properties.NOMBRE;
        });
        suggestionsList.appendChild(li);
      });
      suggestionsList.classList.add('show');
    });
  })
  .catch(err => console.error('Error al cargar entidades.geojson:', err));
