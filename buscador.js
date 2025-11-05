mapboxgl.accessToken = 'pk.eyJ1IjoibW1pbGFjIiwiYSI6ImNpeWhkNXZsMDA1ZDgzMm4wdWRzdzRleWcifQ.crLVL3iFWYSbE5zrlkIA7w';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-6.4, 39.3],
  zoom: 7
});

let categoriasActivas = new Set();
let textoBusqueda = '';

function aplicarFiltro() {
  const filtroCategorias = categoriasActivas.size
    ? ['in', ['get', 'categoria'], ['literal', Array.from(categoriasActivas)]]
    : true;
  const t = textoBusqueda.trim().toLowerCase();
  const filtroTexto = t.length
    ? ['any',
        ['>=', ['index-of', t, ['downcase', ['get', 'nombre_entidad']]], 0],
        ['>=', ['index-of', t, ['downcase', ['get', 'localidad']]], 0],
        ['>=', ['index-of', t, ['downcase', ['get', 'tematica']]], 0]
      ]
    : true;
  const filtroFinal =
    filtroCategorias === true && filtroTexto === true
      ? true
      : filtroCategorias === true
        ? filtroTexto
        : filtroTexto === true
          ? filtroCategorias
          : ['all', filtroCategorias, filtroTexto];
  if (map.getLayer('entidades-puntos')) map.setFilter('entidades-puntos', filtroFinal);
}

map.on('load', async () => {
  const response = await fetch('entidades.geojson', { cache: 'no-store' });
  const geojson = await response.json();

  map.addSource('entidades', { type: 'geojson', data: geojson });

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

  map.on('click', 'entidades-puntos', (e) => {
    const f = e.features[0];
    const p = f.properties;
    const web = p
