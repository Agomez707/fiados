'use strict';

/* ---------- Datos (se guardan solo en este celular) ---------- */
const KEY = 'fiados-v1';
let db = load();

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.clientes) && Array.isArray(d.movs)) return d;
  } catch (e) { /* datos vacíos o dañados */ }
  return { clientes: [], movs: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { alert('No se pudo guardar. Revisá que el celular tenga espacio.'); }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function saldo(clienteId) {
  return db.movs.reduce((s, m) => m.clienteId !== clienteId ? s : s + (m.tipo === 'fiado' ? m.monto : -m.monto), 0);
}
const movsDe = id => db.movs.filter(m => m.clienteId === id).sort((a, b) => b.fecha - a.fecha);

/* ---------- Utilidades ---------- */
const money = n => '$ ' + Math.abs(Math.round(n)).toLocaleString('es-AR');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fechaTxt = t => new Date(t).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function telWhatsApp(raw) {
  let d = String(raw || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!d) return '';
  if (d.startsWith('54')) { if (!d.startsWith('549')) d = '549' + d.slice(2); return d; }
  return '549' + d;
}

/* ---------- Estado de pantalla ---------- */
let view = { name: 'home' };
let busqueda = '';
let monto = '';
const $app = document.getElementById('app');

function go(v) { view = v; monto = ''; render(); window.scrollTo(0, 0); }

/* ---------- Pantallas ---------- */
function render() {
  if (view.name === 'home') return renderHome();
  if (view.name === 'cliente') return renderCliente();
  if (view.name === 'monto') return renderMonto();
  if (view.name === 'form') return renderForm();
  if (view.name === 'respaldo') return renderRespaldo();
}

function renderHome() {
  const filas = db.clientes.map(c => ({ c, s: saldo(c.id) }));
  const total = filas.reduce((t, f) => t + Math.max(f.s, 0), 0);
  const deudores = filas.filter(f => f.s > 0).length;
  const q = norm(busqueda.trim());
  const lista = filas
    .filter(f => !q || norm(f.c.nombre).includes(q))
    .sort((a, b) => b.s - a.s || a.c.nombre.localeCompare(b.c.nombre, 'es'));

  $app.innerHTML = `
    <div class="total ${total === 0 ? 'zero' : ''}">
      <div class="label">TOTAL QUE LE DEBEN</div>
      <div class="amount">${money(total)}</div>
      <div class="sub">${deudores === 0 ? 'Nadie debe nada' : deudores === 1 ? '1 cliente debe' : deudores + ' clientes deben'}</div>
    </div>
    <button class="btn-green" data-a="nuevo">+ Nuevo cliente</button>
    ${db.clientes.length > 4 ? `<label for="q">Buscar cliente</label>
      <input id="q" type="search" placeholder="Escribí un nombre" value="${esc(busqueda)}" autocomplete="off">` : ''}
    <div class="list">
      ${lista.length ? lista.map(({ c, s }) => `
        <button class="row" data-a="abrir" data-id="${c.id}">
          <span class="name">${esc(c.nombre)}</span>
          <span class="bal ${s > 0 ? 'debe' : 'ok'}"><small>${s > 0 ? 'DEBE' : s < 0 ? 'A FAVOR' : 'AL DÍA'}</small>${s === 0 ? '✓' : money(s)}</span>
        </button>`).join('')
        : `<p class="empty">${db.clientes.length ? 'No hay ningún cliente con ese nombre.' : 'Todavía no cargaste clientes.<br>Tocá “+ Nuevo cliente”.'}</p>`}
    </div>
    <button class="btn-ghost" data-a="respaldo">Copia de seguridad</button>`;

  const q$ = document.getElementById('q');
  if (q$) q$.addEventListener('input', e => {
    busqueda = e.target.value;
    const pos = e.target.selectionStart;
    renderHome();
    const n = document.getElementById('q');
    n.focus(); n.setSelectionRange(pos, pos);
  });
}

function renderCliente() {
  const c = db.clientes.find(x => x.id === view.id);
  if (!c) return go({ name: 'home' });
  const s = saldo(c.id);
  const movs = movsDe(c.id);
  $app.innerHTML = `
    <div class="topbar">
      <button class="btn-back" data-a="home" aria-label="Volver">←</button>
      <h1>${esc(c.nombre)}</h1>
    </div>
    <div class="balance ${s > 0 ? 'debe' : 'ok'}">
      <div class="label">${s > 0 ? 'DEBE' : s < 0 ? 'TIENE SALDO A FAVOR' : 'NO DEBE NADA'}</div>
      <div class="amount">${s === 0 ? '✓' : money(s)}</div>
    </div>
    ${c.telefono ? `<p class="phone">Tel: ${esc(c.telefono)}</p>` : ''}
    <div class="actions">
      <button class="btn-red" data-a="fiado">Anotar fiado</button>
      <button class="btn-green" data-a="pago">Registrar pago</button>
      ${s > 0 && c.telefono ? `<button class="btn-wa" data-a="wa">Avisar por WhatsApp</button>` : ''}
      ${s > 0 && !c.telefono ? `<button class="btn-ghost" data-a="editar">Agregar teléfono para avisar</button>` : ''}
    </div>
    <h2 class="section">Movimientos</h2>
    ${movs.length ? movs.map(m => `
      <div class="mov">
        <div>
          <div class="what ${m.tipo === 'fiado' ? 'debe' : 'ok'}">${m.tipo === 'fiado' ? 'Fiado' : 'Pagó'}</div>
          <div class="when">${fechaTxt(m.fecha)}${m.nota ? ' · ' + esc(m.nota) : ''}</div>
        </div>
        <div class="right">
          <div class="amt ${m.tipo === 'fiado' ? 'debe' : 'ok'}">${m.tipo === 'fiado' ? '+' : '−'} ${money(m.monto)}</div>
          <button class="btn-small btn-ghost" data-a="borrarmov" data-id="${m.id}">Borrar</button>
        </div>
      </div>`).join('') : '<p class="empty">Todavía no hay movimientos.</p>'}
    <div class="actions" style="margin-top:22px">
      <button class="btn-ghost" data-a="editar">Cambiar nombre o teléfono</button>
      <button class="btn-ghost" data-a="borrarcliente">Borrar este cliente</button>
    </div>`;
}

function renderMonto() {
  const c = db.clientes.find(x => x.id === view.id);
  if (!c) return go({ name: 'home' });
  const fiado = view.tipo === 'fiado';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => `<button data-a="tecla" data-k="${k}">${k}</button>`).join('');
  $app.innerHTML = `
    <div class="topbar">
      <button class="btn-back" data-a="cancelarmonto" aria-label="Volver">←</button>
      <h1>${fiado ? 'Anotar fiado' : 'Registrar pago'}<br><small>${esc(c.nombre)}</small></h1>
    </div>
    <div class="display ${fiado ? 'red' : 'green'}" id="display">${money(Number(monto || 0))}</div>
    <div class="keypad">
      ${keys}
      <button data-a="tecla" data-k="000">000</button>
      <button data-a="tecla" data-k="0">0</button>
      <button data-a="tecla" data-k="del" aria-label="Borrar último número">⌫</button>
      <button class="wide btn-ghost" data-a="tecla" data-k="clear">Borrar todo</button>
      ${!fiado && saldo(c.id) > 0 ? `<button class="btn-ghost" data-a="todo">Pagó todo</button>` : '<span></span>'}
    </div>
    <label for="nota">Nota (opcional)</label>
    <input id="nota" type="text" placeholder="${fiado ? 'Ej: pan, leche, yerba' : 'Ej: efectivo'}" maxlength="80" autocomplete="off">
    <div class="actions">
      <button class="${fiado ? 'btn-red' : 'btn-green'}" data-a="confirmarmonto">Guardar</button>
    </div>`;
}

function renderForm() {
  const c = view.id ? db.clientes.find(x => x.id === view.id) : null;
  $app.innerHTML = `
    <div class="topbar">
      <button class="btn-back" data-a="${c ? 'abrir' : 'home'}" data-id="${c ? c.id : ''}" aria-label="Volver">←</button>
      <h1>${c ? 'Editar cliente' : 'Nuevo cliente'}</h1>
    </div>
    <label for="nombre">Nombre</label>
    <input id="nombre" type="text" placeholder="Ej: Juan Pérez" value="${c ? esc(c.nombre) : ''}" maxlength="50" autocomplete="off">
    <label for="tel">Teléfono (para WhatsApp)</label>
    <input id="tel" type="tel" inputmode="tel" placeholder="Ej: 11 2345 6789" value="${c ? esc(c.telefono) : ''}" maxlength="20" autocomplete="off">
    <p class="hint">Con código de área, sin 0 y sin 15. Si no tiene, dejalo vacío.</p>
    <div class="actions" style="margin-top:22px">
      <button class="btn-green" data-a="guardarcliente">Guardar</button>
    </div>`;
  if (!c) document.getElementById('nombre').focus();
}

function renderRespaldo() {
  $app.innerHTML = `
    <div class="topbar">
      <button class="btn-back" data-a="home" aria-label="Volver">←</button>
      <h1>Copia de seguridad</h1>
    </div>
    <p style="margin-bottom:14px">Los datos están guardados solo en este celular. Si lo perdés o lo borrás, se pierden. Guardá una copia de vez en cuando.</p>
    <div class="actions">
      <button class="btn-green" data-a="exportar">Guardar copia</button>
      <button data-a="importar">Restaurar copia</button>
    </div>
    <input id="archivo" type="file" accept="application/json,.json" hidden>`;
  document.getElementById('archivo').addEventListener('change', importar);
}

/* ---------- Ventanas y avisos ---------- */
function confirmar(texto, okTxt, esRojo) {
  return new Promise(res => {
    const m = document.getElementById('modal');
    m.innerHTML = `<div class="box" role="dialog" aria-modal="true"><p>${texto}</p>
      <div class="stack">
        <button class="${esRojo ? 'btn-red' : 'btn-green'}" data-r="1">${okTxt}</button>
        <button data-r="0">Cancelar</button>
      </div></div>`;
    m.hidden = false;
    m.onclick = e => {
      const b = e.target.closest('button[data-r]');
      if (!b) return;
      m.hidden = true; m.onclick = null; res(b.dataset.r === '1');
    };
  });
}

let toastTimer;
function aviso(texto, deshacer) {
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${texto}</span>${deshacer ? '<button>Deshacer</button>' : ''}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, deshacer ? 9000 : 3000);
  const b = t.querySelector('button');
  if (b) b.onclick = () => { deshacer(); t.hidden = true; };
}

/* ---------- Acciones ---------- */
const acciones = {
  home: () => go({ name: 'home' }),
  nuevo: () => go({ name: 'form' }),
  abrir: d => go({ name: 'cliente', id: d.id }),
  editar: () => go({ name: 'form', id: view.id }),
  fiado: () => go({ name: 'monto', id: view.id, tipo: 'fiado' }),
  pago: () => go({ name: 'monto', id: view.id, tipo: 'pago' }),
  cancelarmonto: () => go({ name: 'cliente', id: view.id }),
  respaldo: () => go({ name: 'respaldo' }),

  tecla(d) {
    const k = d.k;
    if (k === 'del') monto = monto.slice(0, -1);
    else if (k === 'clear') monto = '';
    else if ((monto + k).replace(/^0+/, '').length <= 9) monto = (monto + k).replace(/^0+/, '');
    document.getElementById('display').textContent = money(Number(monto || 0));
  },
  todo() {
    monto = String(Math.round(saldo(view.id)));
    document.getElementById('display').textContent = money(Number(monto));
  },

  async confirmarmonto() {
    const n = Number(monto || 0);
    if (n <= 0) return aviso('Escribí cuánto es con el teclado');
    const fiado = view.tipo === 'fiado';
    const c = db.clientes.find(x => x.id === view.id);
    const nota = document.getElementById('nota').value.trim();
    const ok = await confirmar(`${fiado ? 'Anotar fiado de' : 'Registrar pago de'}<br><span class="${fiado ? 'debe' : 'ok'}" style="font-size:2rem">${money(n)}</span><br>${esc(c.nombre)}`, 'Sí, guardar', fiado);
    if (!ok) return;
    const mov = { id: uid(), clienteId: c.id, tipo: view.tipo, monto: n, nota, fecha: Date.now() };
    db.movs.push(mov);
    save();
    go({ name: 'cliente', id: c.id });
    aviso(fiado ? 'Fiado anotado' : 'Pago registrado', () => {
      db.movs = db.movs.filter(m => m.id !== mov.id);
      save(); render();
    });
  },

  async borrarmov(d) {
    const m = db.movs.find(x => x.id === d.id);
    if (!m) return;
    const ok = await confirmar(`¿Borrar este ${m.tipo === 'fiado' ? 'fiado' : 'pago'} de ${money(m.monto)}?`, 'Sí, borrar', true);
    if (!ok) return;
    db.movs = db.movs.filter(x => x.id !== m.id);
    save(); render();
    aviso('Movimiento borrado', () => { db.movs.push(m); save(); render(); });
  },

  guardarcliente() {
    const nombre = document.getElementById('nombre').value.trim();
    const telefono = document.getElementById('tel').value.trim();
    if (!nombre) return aviso('Escribí el nombre del cliente');
    if (view.id) {
      const c = db.clientes.find(x => x.id === view.id);
      c.nombre = nombre; c.telefono = telefono;
      save(); go({ name: 'cliente', id: c.id });
    } else {
      const c = { id: uid(), nombre, telefono, creado: Date.now() };
      db.clientes.push(c);
      save(); go({ name: 'cliente', id: c.id });
    }
  },

  async borrarcliente() {
    const c = db.clientes.find(x => x.id === view.id);
    const s = saldo(c.id);
    const ok = await confirmar(`¿Borrar a <b>${esc(c.nombre)}</b> y todo su historial?${s > 0 ? `<br><br>Todavía debe ${money(s)}.` : ''}`, 'Sí, borrar', true);
    if (!ok) return;
    const movs = db.movs.filter(m => m.clienteId === c.id);
    db.clientes = db.clientes.filter(x => x.id !== c.id);
    db.movs = db.movs.filter(m => m.clienteId !== c.id);
    save(); go({ name: 'home' });
    aviso('Cliente borrado', () => { db.clientes.push(c); db.movs.push(...movs); save(); render(); });
  },

  wa() {
    const c = db.clientes.find(x => x.id === view.id);
    const tel = telWhatsApp(c.telefono);
    if (!tel) return aviso('El teléfono no es válido');
    const nombre = c.nombre.split(' ')[0];
    const texto = `Hola ${nombre}, te recuerdo que tenés un saldo pendiente de ${money(saldo(c.id))} en el almacén. ¡Gracias!`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  },

  exportar() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const hoy = new Date().toISOString().slice(0, 10);
    a.href = URL.createObjectURL(blob);
    a.download = `fiados-copia-${hoy}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    aviso('Copia guardada');
  },
  importar() { document.getElementById('archivo').click(); }
};

async function importar(e) {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.clientes) || !Array.isArray(d.movs)) throw new Error('formato');
    const ok = await confirmar(`Esto reemplaza todo lo que hay ahora por la copia (${d.clientes.length} clientes). ¿Seguro?`, 'Sí, restaurar', true);
    if (!ok) return;
    db = { clientes: d.clientes, movs: d.movs };
    save(); go({ name: 'home' }); aviso('Copia restaurada');
  } catch (err) {
    aviso('Ese archivo no es una copia válida');
  }
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const fn = acciones[b.dataset.a];
  if (fn) fn(b.dataset);
});

/* ---------- Inicio ---------- */
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
