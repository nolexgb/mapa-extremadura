document.addEventListener("DOMContentLoaded", () => {
  const searchBox = document.getElementById("searchBox");
  const suggestionBox = document.createElement("div");
  suggestionBox.className = "suggestion-box";
  Object.assign(suggestionBox.style, {
    position: "absolute",
    top: "190px",
    right: "40px",
    background: "white",
    borderRadius: "8px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
    zIndex: "999",
    maxHeight: "200px",
    overflowY: "auto",
    display: "none",
    width: "200px"
  });
  document.body.appendChild(suggestionBox);

  searchBox.addEventListener("input", (e) => {
    const value = e.target.value.trim().toLowerCase();
    if (!value || !window.allData) {
      suggestionBox.style.display = "none";
      return;
    }

    const matches = window.allData.features.filter(f =>
      f.properties.nombre_entidad.toLowerCase().includes(value)
    ).slice(0, 10);

    suggestionBox.innerHTML = "";
    if (matches.length > 0) {
      matches.forEach(m => {
        const div = document.createElement("div");
        div.textContent = m.properties.nombre_entidad;
        Object.assign(div.style, {
          padding: "6px 10px",
          cursor: "pointer",
          borderBottom: "1px solid #eee"
        });
        div.addEventListener("click", () => {
          const coords = m.geometry.coordinates;
          map.flyTo({ center: coords, zoom: 12 });
          suggestionBox.style.display = "none";
          searchBox.value = m.properties.nombre_entidad;
        });
        suggestionBox.appendChild(div);
      });
      suggestionBox.style.display = "block";
    } else {
      suggestionBox.style.display = "none";
    }
  });
});
