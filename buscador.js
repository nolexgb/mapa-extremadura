mapboxgl.accessToken = 'pk.eyJ1IjoibW1pbGFjIiwiYSI6ImNpeWhkNXZsMDA1ZDgzMm4wdWRzdzRleWcifQ.crLVL3iFWYSbE5zrlkIA7w';

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

const loading = document.getElementById('loading');

map.on('load', () => {
  fetch('entidades.geojson')
    .then(response => response.json())
    .then(data => {
      loading.style.display = 'none';
      const features = data.features;
      const categoryCounts = { SOCIALES: 0, AMBIENTALES: 0, ECONÓMICAS: 0 };

      features.forEach(f => {
        const cat = f.properties.CATEGORIA;
        if (categoryCounts[cat] !== undefined) categoryCounts[cat]++;
      });

      const filtersDiv = document.getElementById('filters');
      for (const cat in categorias) {
        const label = document.createElement('label');
        label.dataset.cat = cat;
        label.innerHTML = `<input type="checkbox" checked data-cat="${cat}" /> ${cat} (${categoryCounts[cat]})`;
        filtersDiv.appendChild(label);
      }

      features.forEach(feature => {
        const { NOMBRE, CATEGORIA, DIRECCION, LOCALIDAD, SITIO_WEB, TEMATICAS } = feature.properties;
        const color = categorias[CATEGORIA] || '#999';
        const marker = new mapboxgl.Marker({ color })
          .setLngLat(feature.geometry.coordinates)
          .addTo(map);
        const popupHTML = `
          <div>
            <h3>${NOMBRE}</h3>
            <p><strong>Categoría:</strong> ${CATEGORIA}</p>
            <p><strong>Dirección:</strong> ${DIRECCION}</p>
            <p><strong>Localidad:</strong> ${LOCALIDAD}</p>
            <p><strong>Sitio web:</strong> <a href="${SITIO_WEB}" target="_blank">Sitio web</a></p>
            <p><strong>Temáticas:</strong> ${TEMATICAS}</p>
          </div>`;
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML);
        marker.getElement().addEventListener('click', () => {
          map.flyTo({ center: feature.geometry.coordinates, zoom: 12 });
          popup.addTo(map);
        });
      });
    })
    .catch(err => {
      console.error('Error al cargar entidades.geojson:', err);
      loading.textContent = 'Error al cargar el mapa.';
    });
});
