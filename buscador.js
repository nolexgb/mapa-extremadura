(function(){
  const input = document.getElementById('searchInput');
  const list = document.getElementById('suggestions');
  let entidades = [];

  function normalizar(str){
    return (str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  }

  function render(items){
    list.innerHTML='';
    if(!items.length){ list.style.display='none'; return; }
    list.innerHTML = items.map(e => (
      `<li data-coord="${e.coord.join(',')}"><span>${e.name}</span><span class="s-localidad">${e.localidad}</span></li>`
    )).join('');
    list.style.display='block';
  }

  input.addEventListener('input', () => {
    const q = normalizar(input.value);
    if(!q){ render([]); return; }
    const res = entidades.filter(e => normalizar(e.name).includes(q)).slice(0, 10);
    render(res);
  });

  list.addEventListener('click', (ev) => {
    const li = ev.target.closest('li'); if(!li) return;
    const [lng,lat] = li.dataset.coord.split(',').map(Number);
    const entity = entidades.find(e => e.coord[0]===lng && e.coord[1]===lat);
    render([]);
    if(window.handleSearchSelection) window.handleSearchSelection(entity);
  });

  window.initBuscador = function(arr){
    entidades = Array.isArray(arr) ? arr : [];
  };
})();