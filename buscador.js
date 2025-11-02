// Buscador predictivo independiente y robusto
(function(){
  function normalize(str){ return (str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
  window.initBuscador = function(map, data){
    try{
      const input = document.getElementById('searchInput');
      const list  = document.getElementById('suggestions');
      if(!input || !list){ return; }
      const items = (data.features||[]).map(f => ({
        nombre: f.properties?.nombre_entidad || '',
        localidad: f.properties?.localidad || '',
        coords: f.geometry?.coordinates,
        props: f.properties || {}
      }));
      function render(results){
        list.innerHTML = '';
        if(!results.length){ list.style.display='none'; return; }
        list.innerHTML = results.map(it => `<li data-coord="${it.coords?.join(',')}"><span>${it.nombre}</span><span class='s-localidad'>${it.localidad}</span></li>`).join('');
        list.style.display = 'block';
      }
      input.addEventListener('input',()=>{
        const q = normalize(input.value);
        if(!q){ render([]); return; }
        const res = items.filter(it => normalize(it.nombre).includes(q)).slice(0,10);
        render(res);
      });
      list.addEventListener('click',(ev)=>{
        const li = ev.target.closest('li'); if(!li) return;
        const [lng,lat] = (li.dataset.coord||'').split(',').map(Number);
        const it = items.find(x => x.coords && x.coords[0]===lng && x.coords[1]===lat);
        render([]);
        if(!it) return;
        map.flyTo({center: it.coords, zoom: 12});
        const html = `
          <strong>${it.props.nombre_entidad||''}</strong><br>
          <a href="${it.props.pagina_contacto||'#'}" target="_blank">Web</a><br>
          <b>Temática:</b> ${it.props.tematica||''}<br>
          <b>Ámbito:</b> ${it.props.ambito_geografico||''}<br>
          <b>Localidad:</b> ${it.props.localidad||''}<br>
          <b>Teléfono:</b> ${it.props.telefono||''}<br>
          <b>Correo:</b> ${it.props.correo||''}`;
        if(window.currentPopup) window.currentPopup.remove();
        window.currentPopup = new mapboxgl.Popup().setLngLat(it.coords).setHTML(html).addTo(map);
        const el = document.createElement('div'); el.className='pulse';
        new mapboxgl.Marker(el).setLngLat(it.coords).addTo(map);
        setTimeout(()=>{ try{ el.remove(); }catch(_){}} , 3500);
      });
    }catch(e){ console.error('Buscador error:', e); }
  };
})();