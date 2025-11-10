mapboxgl.accessToken = 'pk.eyJ1IjoibW1pbGFjIiwiYSI6ImNpeWhkNXZsMDA1ZDgzMm4wdWRzdzRleWcifQ.crLVL3iFWYSbE5zrlkIA7w';

if (!mapboxgl.supported()) {
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

const loading = document.createElement('div');
loading.innerText = 'Cargando mapa...';
loading.style.position = 'absolute';
loading.style.top = '50%';
loading.style.left = '50%';
loading.style.transform = 'translate(-50%, -50%)';
loading.style.color = '#009b4d';
loading.style.fontWeight = 'bold';
document.body.appendChild(loading);

map.on('load', () => {
  fetch('entidades.geojson')
    .then(response => response.json())
    .then(data => {
      document.body.removeChild(loading);

      const features = data.features;
      const categoryCounts = { SOCIALES: 0, AMBIENTALES: 0, ECONÓMICAS: 0 };

      features.forEach(f => {
        const cat = f.properties.categoria?.trim().toUpperCase();
        if (categoryCounts[cat] !== undefined) categoryCounts[cat]++;
      });

      const filtersDiv = document.getElementById('filters');
      for (const cat in categorias) {
        const label = document.createElement('label');
        label.dataset.cat = cat;
        label.innerHTML = `<input type="checkbox" checked data-cat="${cat}" /> ${cat} (${categoryCounts[cat]})`;
        filtersDiv.appendChild(label);
      }

      const markers = [];

      features.forEach(feature => {
        const props = feature.properties;
        const categoria = props.categoria?.trim().toUpperCase();
        const color = categorias[categoria] || '#999';

        const marker = new mapboxgl.Marker({ color })
          .setLngLat(feature.geometry.coordinates)
          .addTo(map);

        const popupHTML = `
          <div>
            <h3>${props.nombre_entidad}</h3>
            <p><strong>Categoría:</strong> ${props.categoria}</p>
            <p><strong>Dirección:</strong> ${props.direccion}</p>
            <p><strong>Localidad:</strong> ${props.localidad}</p>
            <p><strong>Sitio web:</strong> <a href="${props.pagina_contacto}" target="_blank">Sitio web</a></p>
            <p><strong>Temáticas:</strong> ${props.tematica}</p>
          </div>
        `;

        const popup = new mapboxgl.Popup({ offset: 25, maxWidth: '320px' }).setHTML(popupHTML);

        marker.getElement().addEventListener('click', () => {
          popup.addTo(map);
          map.flyTo({ center: feature.geometry.coordinates, zoom: 11 });
        });

        markers.push({ marker, categoria, nombre: props.nombre_entidad.toLowerCase() });
      });

      document.querySelectorAll('#filters input[type=checkbox]').forEach(input => {
        input.addEventListener('change', () => {
          const cat = input.dataset.cat;
          markers.forEach(({ marker, categoria }) => {
            if (categoria === cat) {
              input.checked ? marker.addTo(map) : marker.remove();
            }
          });
        });
      });

      const busqueda = document.getElementById('busqueda');
      const suggestions = document.getElementById('suggestions');

      busqueda.addEventListener('input', e => {
        const query = e.target.value.toLowerCase().trim();
        suggestions.innerHTML = '';
        if (query.length < 2) return;
        const resultados = markers.filter(m => m.nombre.includes(query));
        if (resultados.length > 0) {
          suggestions.classList.add('show');
          resultados.forEach(({ marker, nombre }) => {
            const li = document.createElement('li');
            li.textContent = nombre;
            li.addEventListener('click', () => {
              map.flyTo({ center: marker.getLngLat(), zoom: 12 });
              suggestions.classList.remove('show');
            });
            suggestions.appendChild(li);
          });
        } else {
          suggestions.classList.remove('show');
        }
      });
    })
    .catch(err => {
      console.error("Error al cargar entidades.geojson:", err);
      alert("No se pudo cargar el mapa. Revisa el archivo entidades.geojson o su ruta.");
    });
});
