mapboxgl.accessToken = 'pk.eyJ1IjoiZ29uemFsZXMiLCJhIjoiY2xvYzF0NnR2MDF1bjJqb2E1MG56d3d1MCJ9.-rjzF2EhXcvPCIR9_cGfaw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-6.338, 39.472],
  zoom: 7.2,
});

map.on('load', () => {
  // Cargar los puntos desde el GeoJSON hospedado en GitHub Pages
  map.addSource('entidades', {
    type: 'geojson',
    data: 'https://nolexgb.github.io/mapa-extremadura/entidades.geojson'
  });

  const categorias = {
    "Social": "#2a73ff",
    "Ambiental": "#27ae60",
    "Económica": "#f1c40f",
    "Otra": "#9b59b6"
  };

  for (const [categoria, color] of Object.entries(categorias)) {
    map.addLayer({
      id: categoria,
      type: 'circle',
      source: 'entidades',
      paint: {
        'circle-radius': 8,
        'circle-color': color,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff'
      },
      filter: ['==', ['get', 'categoria'], categoria]
    });
  }

  // Popup
  map.on('click', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: Object.keys(categorias) });
    if (!features.length) return;

    const feature = features[0];
    const props = feature.properties;

    new mapboxgl.Popup()
      .setLngLat(feature.geometry.coordinates)
      .setHTML(`
        <strong>${props.nombre_entidad}</strong><br>
        <em>${props.tematica}</em><br>
        <small>${props.localidad}</small><br>
        <a href="${props.pagina_contacto}" target="_blank">Visitar sitio</a>
      `)
      .addTo(map);
  });
});

// Buscador
const input = document.getElementById("searchInput");
input.addEventListener("input", (e) => {
  const value = e.target.value.toLowerCase();
  fetch('https://nolexgb.github.io/mapa-extremadura/entidades.geojson')
    .then(res => res.json())
    .then(data => {
      const result = data.features.find(f =>
        f.properties.nombre_entidad.toLowerCase().includes(value)
      );
      if (result) {
        map.flyTo({ center: result.geometry.coordinates, zoom: 10 });
      }
    });
});

// Botones
document.querySelectorAll(".btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const category = btn.getAttribute("data-category");
    btn.classList.toggle("active");

    const active = Array.from(document.querySelectorAll(".btn.active")).map(b => b.getAttribute("data-category"));
    for (const layer of Object.keys(map.style._layers)) {
      if (Object.keys(categorias).includes(layer)) {
        map.setLayoutProperty(layer, 'visibility', active.includes(layer) ? 'visible' : 'none');
      }
    }
  });
});
