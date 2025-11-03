// === BUSCADOR INTUITIVO PARA EL MAPA DE EXTREMADURA ===
// Este script funciona con el mapa, los iconos y la fuente de datos cargada en index.html

document.addEventListener("DOMContentLoaded", () => {
  const searchBox = document.getElementById("searchBox");
  let suggestionBox = document.createElement("div");
  suggestionBox.className = "suggestion-box";
  suggestionBox.style.position = "absolute";
  suggestionBox.style.top = "50px";
  suggestionBox.style.right = "20px";
  suggestionBox.style.background = "white";
  suggestionBox.style.borderRadius = "10px";
  suggestionBox.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  suggestionBox.style.zIndex = "999";
  suggestionBox.style.maxHeight = "200px";
  suggestionBox.style.overflowY = "auto";
  suggestionBox.style.display = "none";
  document.body.appendChild(suggestionBox);

  // Escucha cambios en el cuadro de búsqueda
  searchBox.addEventListener("input", (e) => {
    const value = e.target.value.trim().toLowerCase();
    if (!value || !window.allData) {
      suggestionBox.style.display = "none";
      return;
    }

    // Buscar coincidencias
    const matches = window.allData.features.filter(f =>
      f.properties.nombre_entidad.toLowerCase().includes(value)
    ).slice(0, 10);

    // Mostrar sugerencias
    suggestionBox.innerHTML = "";
    if (matches.length > 0) {
      matches.forEach(m => {
        const div = document.createElement("div");
        div.style.padding = "6px 10px";
        div.style.cursor = "pointer";
        div.style.borderBottom = "1px solid #eee";
        div.textContent = m.properties.nombre_entidad;
        div.addEventListener("mouseover", () => div.style.background = "#f5f5f5");
        div.addEventListener("mouseout", () => div.style.background = "white");

        div.addEventListener("click", () => {
          const coords = m.geometry.coordinates;
          map.flyTo({ center: coords, zoom: 12, speed: 0.8 });
          suggestionBox.style.display = "none";
          searchBox.value = m.properties.nombre_entidad;

          // Cerrar popup anterior
          if (window.openPopup) window.openPopup.remove();

          // Crear nuevo popup
          const p = m.properties;
          const iconPath = `icono_${p.categoria.toLowerCase()}.png`;
          window.openPopup = new mapboxgl.Popup()
            .setLngLat(coords)
            .setHTML(`
              <div style="display:flex;align-items:center;gap:8px;">
                <img src="${iconPath}" alt="${p.categoria}" width="28" height="28">
                <h3 style="margin:0;">${p.nombre_entidad}</h3>
              </div>
              <p><b>Temática:</b> ${p.tematica}</p>
              <p><b>Ámbito:</b> ${p.ambito_geografico}</p>
              <p><b>Localidad:</b> ${p.localidad}</p>
              <p><b>Teléfono:</b> ${p.telefono}</p>
              <p><b>Correo:</b> <a href="mailto:${p.correo}">${p.correo}</a></p>
              <p><a href="${p.pagina_contacto}" target="_blank">Web</a></p>
            `)
            .addTo(map);
        });
        suggestionBox.appendChild(div);
      });
      suggestionBox.style.display = "block";
    } else {
      suggestionBox.style.display = "none";
    }
  });

  // Ocultar sugerencias al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!searchBox.contains(e.target) && !suggestionBox.contains(e.target)) {
      suggestionBox.style.display = "none";
    }
  });
});
