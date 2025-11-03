document.addEventListener("DOMContentLoaded", () => {
  const searchBox = document.getElementById("searchBox");

  searchBox.addEventListener("input", () => {
    const val = searchBox.value.trim().toLowerCase();
    if (!val || !window.allData) return;

    const matches = allData.features.filter(f =>
      f.properties.nombre_entidad.toLowerCase().includes(val)
    );

    if (matches.length > 0) {
      const m = matches[0];
      const coords = m.geometry.coordinates;
      map.flyTo({ center: coords, zoom: 12 });
    }
  });
});
