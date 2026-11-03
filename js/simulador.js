// Simulador de despliegue: commit, pipeline CI/CD, staging, aprobación y despliegue canario con reversión.
// Todo es local: no hay red ni servidores reales.
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const num = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const seg = (ms) => `${num.format(ms / 1000)} s`;
  const hora = (d) => d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hash = () => Math.random().toString(16).slice(2, 9).padEnd(7, '0');

  const COLORES = { azul: '#0741AD', verde: '#13804F', naranja: '#C8530F' };
  const PRODUCTOS = [
    { n: 'Chompa de alpaca', p: 'S/ 189.00', c: '#D9C9B2' },
    { n: 'Chalina tejida', p: 'S/ 79.00', c: '#BAC4D8' },
    { n: 'Gorro andino', p: 'S/ 59.00', c: '#CDB9C4' },
  ];
  const ETAPAS = ['Commit', 'Construcción', 'Pruebas', 'Seguridad', 'Staging', 'Aprobación', 'Producción'];
  const ESTADOS = { espera: 'En espera', corriendo: 'En curso', ok: 'Listo', fallo: 'Falló', pausa: 'Esperándote', omitida: 'Omitida' };
  const N_SERVIDORES = 8;

  const inicial = { titulo: 'Ofertas de temporada', color: 'azul', envio: false };
  const S = {
    prod: { ...inicial, version: '1.4.0' },
    borrador: { ...inicial, error: false },
    ultimaMenor: 4,
    ultimoHash: hash(),
    pipelineN: 212,
    corriendo: false,
    velocidad: 1,
    vista: 'prod',
    destino: null,       // versión en camino: { ...config, version }
    trafico: 0,          // fracción de visitas que ve la versión en camino
    falla: false,
    tFalla: 0,
    mensajeManual: false,
    servidores: Array.from({ length: N_SERVIDORES }, () => ({ version: '1.4.0', nueva: false, mal: false })),
    historial: [{ version: '1.4.0', mensaje: 'Versión inicial de la tienda', fecha: new Date(Date.now() - 3 * 3600e3), estado: 'vivo', config: { ...inicial } }],
    m: { despliegues: 0, intentosProd: 0, fallidosProd: 0, tiempos: [], recuperaciones: [] },
  };

  /* ---------- Referencias ---------- */
  const form = $('#sim-form');
  const campos = $('#sim-campos');
  const inTitulo = $('#sim-titulo');
  const inEnvio = $('#sim-envio');
  const inError = $('#sim-error');
  const inMensaje = $('#sim-mensaje');
  const btnPublicar = $('#sim-publicar');
  const btnVelocidad = $('#sim-velocidad');
  const nota = $('#sim-nota');
  const diffEl = $('#sim-diff');
  const pantalla = $('#sim-pantalla');
  const tiendaBase = $('#tienda-base');
  const tiendaNueva = $('#tienda-nueva');
  const tabProd = $('#tab-prod');
  const tabStaging = $('#tab-staging');
  const pipeline = $('.pipeline');
  const etapas = $$('#sim-etapas .etapa');
  const paquete = $('#sim-paquete');
  const logEl = $('#sim-log');
  const reloj = $('#sim-reloj');
  const caja = $('#sim-aprobacion');
  const gridSrv = $('#sim-servidores');
  const btnFalla = $('#sim-falla');
  const listaHist = $('#sim-historial');

  const esperar = (ms) => new Promise((r) => setTimeout(r, reducir ? Math.min(ms, 60) : ms / S.velocidad));

  /* ---------- Cambios del borrador ---------- */
  const cambios = () => {
    const p = S.prod, b = S.borrador, c = [];
    if (b.titulo !== p.titulo) c.push('titulo');
    if (b.color !== p.color) c.push('color');
    if (b.envio !== p.envio) c.push('envio');
    if (b.error) c.push('error');
    return c;
  };

  function mensajeAuto() {
    const b = S.borrador;
    const partes = cambios().map((k) => ({
      titulo: 'cambia el título del banner',
      color: `pinta el botón de ${b.color}`,
      envio: b.envio ? 'muestra el aviso de envío gratis' : 'oculta el aviso de envío gratis',
      error: 'simplifica el cálculo del total',
    }[k]));
    if (!partes.length) return '';
    let t = partes.join(', ');
    if (t.length > 72) t = b.error ? 'actualiza el banner de inicio y simplifica el cálculo del total' : 'actualiza el banner de inicio';
    return t[0].toUpperCase() + t.slice(1);
  }

  function pintarDiff() {
    const p = S.prod, b = S.borrador;
    const L = [];
    const linea = (k, v, coma) => `    "${k}": ${JSON.stringify(v)}${coma ? ',' : ''}`;
    const par = (k, a, c, coma) => {
      if (a === c) L.push(['', ' ' + linea(k, a, coma)]);
      else L.push(['d-menos', '-' + linea(k, a, coma)], ['d-mas', '+' + linea(k, c, coma)]);
    };
    if (!cambios().length) L.push(['d-vacio', 'Sin cambios respecto a producción']);
    L.push(['d-archivo', 'tienda/config/banner.json'], ['', ' {'], ['', '   "banner": {']);
    par('titulo', p.titulo, b.titulo, true);
    par('colorBoton', p.color, b.color, true);
    par('envioGratis', p.envio, b.envio, false);
    L.push(['', '   }'], ['', ' }']);
    if (b.error) {
      L.push(['d-archivo', 'tienda/src/carrito.js'],
        ['', ' export function calcularTotal(items, cupon) {'],
        ['', '   const subtotal = sumar(items);'],
        ['d-menos', '-  return subtotal - descuento(subtotal, cupon);'],
        ['d-mas', '+  return subtotal;'],
        ['', ' }']);
    }
    diffEl.innerHTML = L.map(([c, t]) => `<span${c ? ` class="${c}"` : ''}>${esc(t)}</span>`).join('');
  }

  function actualizarEditor() {
    const n = cambios().length;
    if (!S.mensajeManual) inMensaje.value = mensajeAuto();
    btnPublicar.disabled = S.corriendo || n === 0;
    pintarDiff();
    if (!S.corriendo && !nota.dataset.fija) {
      ponerNota(n ? 'Listo para publicar: tu cambio pasará por siete etapas antes de llegar a los clientes.' : 'Cambia algo en la tienda para poder publicarlo.');
    }
  }

  function ponerNota(texto, tipo = '', fija = false) {
    nota.textContent = texto;
    nota.className = `editor__nota${tipo ? ' ' + tipo : ''}`;
    if (fija) nota.dataset.fija = '1'; else delete nota.dataset.fija;
  }

  inTitulo.addEventListener('input', () => { S.borrador.titulo = inTitulo.value; delete nota.dataset.fija; actualizarEditor(); });
  $$('input[name="color"]', form).forEach((r) => r.addEventListener('change', () => { S.borrador.color = r.value; delete nota.dataset.fija; actualizarEditor(); }));
  inEnvio.addEventListener('change', () => { S.borrador.envio = inEnvio.checked; delete nota.dataset.fija; actualizarEditor(); });
  inError.addEventListener('change', () => { S.borrador.error = inError.checked; delete nota.dataset.fija; actualizarEditor(); });
  inMensaje.addEventListener('input', () => { S.mensajeManual = inMensaje.value.trim() !== ''; });
  btnVelocidad.addEventListener('click', () => {
    const rapida = btnVelocidad.getAttribute('aria-pressed') !== 'true';
    btnVelocidad.setAttribute('aria-pressed', String(rapida));
    btnVelocidad.textContent = rapida ? 'Velocidad rápida' : 'Velocidad normal';
    S.velocidad = rapida ? 2.6 : 1;
  });

  /* ---------- Vista previa de la tienda ---------- */
  const htmlTienda = (cfg) => `
    <div class="tienda__cabecera"><span class="tienda__marca">Alpaca &amp; Co.</span><span class="tienda__carrito">Carrito (2)</span></div>
    ${cfg.envio ? '<div class="tienda__aviso">Envío gratis en compras desde S/ 150</div>' : ''}
    <div class="tienda__banner"><p class="tienda__titulo">${esc(cfg.titulo.trim()) || '&nbsp;'}</p><span class="tienda__boton" style="background:${COLORES[cfg.color]}">Comprar ahora</span></div>
    <div class="tienda__productos">${PRODUCTOS.map((p) => `<div class="producto"><i style="--c:${p.c}"></i><b>${p.n}</b><span>${p.p}</span></div>`).join('')}</div>`;

  function pintarVista() {
    const staging = S.vista === 'staging' && S.destino;
    tiendaBase.innerHTML = htmlTienda(S.prod);
    tiendaNueva.innerHTML = S.destino ? htmlTienda(S.destino) : '';
    const p = staging ? 1 : S.destino ? S.trafico : 0;
    pantalla.style.setProperty('--p', p);
    pantalla.classList.toggle('dividida', !staging && p > 0 && p < 1);
    $('#sim-divisor').textContent = S.destino ? `v${S.destino.version}` : '';
    $('#sim-url').textContent = staging ? 'staging.tienda-demo.teammanchas.com.pe' : 'tienda-demo.teammanchas.com.pe';
    $('#sim-version').textContent = staging ? `v${S.destino.version} en staging` : `v${S.prod.version}`;

    const pct = Math.round(S.trafico * 100);
    $('#sim-trafico-barra').style.width = `${S.destino ? pct : 0}%`;
    $('#sim-trafico').textContent = S.destino && pct > 0
      ? (pct >= 100 ? `Todas las visitas ven la versión ${S.destino.version}` : `${pct} % de las visitas ya ve la versión ${S.destino.version}; el resto sigue en la ${S.prod.version}`)
      : `Todas las visitas ven la versión ${S.prod.version}`;
  }

  function elegirVista(v) {
    S.vista = v;
    tabProd.setAttribute('aria-selected', String(v === 'prod'));
    tabStaging.setAttribute('aria-selected', String(v === 'staging'));
    pintarVista();
  }
  tabProd.addEventListener('click', () => elegirVista('prod'));
  tabStaging.addEventListener('click', () => elegirVista('staging'));
  [tabProd, tabStaging].forEach((t) => t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const otro = t === tabProd ? tabStaging : tabProd;
    if (!otro.disabled) { otro.focus(); otro.click(); }
  }));

  /* ---------- Servidores ---------- */
  gridSrv.innerHTML = S.servidores.map((_, i) => `
    <div class="servidor" data-i="${i}">
      <div class="servidor__cara">
        <span class="servidor__nombre">srv-${i + 1}</span>
        <span class="servidor__version">v1.4.0</span>
        <span class="servidor__carga"><i></i></span>
      </div>
    </div>`).join('');
  const tarjetas = $$('.servidor', gridSrv);

  function pintarServidor(i) {
    const s = S.servidores[i], t = tarjetas[i];
    $('.servidor__version', t).textContent = `v${s.version}`;
    t.toggleAttribute('data-nueva', s.nueva);
    t.toggleAttribute('data-mal', s.mal);
    t.setAttribute('aria-label', `Servidor ${i + 1}: versión ${s.version}${s.mal ? ', con errores' : ''}`);
    const sanos = S.servidores.filter((x) => !x.mal).length;
    $('#sim-salud').textContent = `${sanos} de ${N_SERVIDORES} sanos`;
  }
  function voltear(i, cambio) {
    const t = tarjetas[i];
    t.classList.remove('girando'); void t.offsetWidth; t.classList.add('girando');
    setTimeout(() => {
      // Si la falla llegó a mitad del despliegue, la versión nueva entra ya enferma.
      Object.assign(S.servidores[i], cambio, cambio.nueva && S.falla ? { mal: true } : {});
      pintarServidor(i);
    }, reducir ? 0 : 300);
    setTimeout(() => t.classList.remove('girando'), 650);
  }
  async function actualizarServidores(desde, hasta, cambio) {
    for (let i = desde; i < hasta; i++) { voltear(i, cambio); await esperar(140); }
    await esperar(320);
  }
  tarjetas.forEach((_, i) => pintarServidor(i));

  // Carga de CPU de cada servidor, solo mientras la sección se ve.
  let cargaTimer = 0;
  const latirCarga = () => tarjetas.forEach((t, i) => {
    const s = S.servidores[i];
    const c = s.mal ? 0.92 : 0.22 + Math.random() * 0.4;
    $('.servidor__carga i', t).style.setProperty('--c', c.toFixed(2));
  });
  new IntersectionObserver(([e]) => {
    clearInterval(cargaTimer);
    if (e.isIntersecting) { latirCarga(); if (!reducir) cargaTimer = setInterval(latirCarga, 1300); }
  }).observe(gridSrv);

  /* ---------- Historial ---------- */
  function pintarHistorial() {
    listaHist.innerHTML = [...S.historial].reverse().map((h, k) => {
      const i = S.historial.length - 1 - k;
      let lado;
      if (h.estado === 'vivo') lado = '<span class="etiqueta etiqueta--vivo">En línea</span>';
      else if (h.estado === 'revertida') lado = '<span class="etiqueta etiqueta--fallo">Revertida</span>';
      else if (h.version === S.prod.version) lado = '<span class="etiqueta etiqueta--neutra">Anterior</span>';
      else lado = `<button class="boton boton--mini" type="button" data-volver="${i}"${S.corriendo ? ' disabled' : ''}>Volver a esta versión</button>`;
      return `<li><span class="historial__version">v${h.version}</span><span class="historial__mensaje" title="${esc(h.mensaje)}">${esc(h.mensaje)}<span class="historial__hora">${hora(h.fecha)}</span></span>${lado}</li>`;
    }).join('');
  }
  listaHist.addEventListener('click', (e) => {
    const b = e.target.closest('[data-volver]');
    if (b && !S.corriendo) volverA(+b.dataset.volver);
  });

  /* ---------- Métricas DORA de la sesión ---------- */
  function ponerMetrica(id, valor) {
    const dd = $(id);
    if (dd.textContent === valor) return;
    dd.textContent = valor;
    dd.classList.remove('cambia'); void dd.offsetWidth; dd.classList.add('cambia');
  }
  function pintarMetricas() {
    const m = S.m, prom = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    ponerMetrica('#m-despliegues', String(m.despliegues));
    ponerMetrica('#m-tiempo', m.tiempos.length ? seg(prom(m.tiempos)) : '—');
    ponerMetrica('#m-fallos', m.intentosProd ? `${Math.round((m.fallidosProd / m.intentosProd) * 100)} %` : '—');
    ponerMetrica('#m-recuperacion', m.recuperaciones.length ? seg(prom(m.recuperaciones)) : '—');
  }

  /* ---------- Registro y etapas ---------- */
  function log(texto, tipo = '') {
    if (logEl.dataset.vacio !== 'no') { logEl.innerHTML = ''; logEl.dataset.vacio = 'no'; }
    const p = document.createElement('p');
    p.className = `log${tipo ? ' log--' + tipo : ''}`;
    p.textContent = texto;
    logEl.append(p);
    logEl.scrollTop = logEl.scrollHeight;
  }
  async function lineas(lista) {
    for (const [ms, texto, tipo] of lista) { await esperar(ms); log(texto, tipo); }
  }

  let tEtapa = 0, iEtapa = -1, tInicio = 0, relojTimer = 0;
  function estado(i, est, texto) {
    const li = etapas[i];
    li.dataset.estado = est;
    $('.etapa__estado', li).textContent = texto || ESTADOS[est];
    li.setAttribute('aria-label', `${ETAPAS[i]}: ${texto || ESTADOS[est]}`);
  }
  function empezarEtapa(i) {
    iEtapa = i; tEtapa = performance.now();
    estado(i, 'corriendo');
    pipeline.style.setProperty('--avance', (i / (ETAPAS.length - 1)).toFixed(3));
  }
  function terminarEtapa(i, est = 'ok', texto) {
    estado(i, est, texto || (est === 'ok' ? `Listo en ${seg(performance.now() - tEtapa)}` : undefined));
    iEtapa = -1;
  }
  function tic() {
    reloj.textContent = seg(performance.now() - tInicio);
    if (iEtapa >= 0 && etapas[iEtapa].dataset.estado === 'corriendo') {
      $('.etapa__estado', etapas[iEtapa]).textContent = `En curso ${seg(performance.now() - tEtapa)}`;
    }
  }
  function reiniciarPipeline() {
    etapas.forEach((_, i) => estado(i, 'espera'));
    pipeline.classList.remove('fallo', 'listo-ok');
    pipeline.classList.add('en-marcha');
    pipeline.style.setProperty('--avance', 0);
    logEl.innerHTML = ''; logEl.dataset.vacio = 'no';
  }

  function bloquear(si) {
    S.corriendo = si;
    campos.disabled = si;
    inMensaje.disabled = si;
    btnPublicar.disabled = si || cambios().length === 0;
    pintarHistorial();
  }

  /* ---------- Publicar: el pipeline completo ---------- */
  form.addEventListener('submit', (e) => { e.preventDefault(); if (!S.corriendo && cambios().length) publicar(); });

  async function publicar() {
    const b = { ...S.borrador };
    const version = `1.${S.ultimaMenor + 1}.0`;
    const h = hash();
    const mensaje = inMensaje.value.trim() || mensajeAuto() || 'Actualiza la tienda';
    const nArchivos = (b.titulo !== S.prod.titulo || b.color !== S.prod.color || b.envio !== S.prod.envio ? 1 : 0) + (b.error ? 1 : 0);
    S.pipelineN += 1;

    bloquear(true);
    reiniciarPipeline();
    ponerNota('Publicando… sigue el avance en el pipeline.');
    paquete.textContent = h;
    tInicio = performance.now();
    clearInterval(relojTimer); relojTimer = setInterval(tic, 100);
    S.destino = null; S.trafico = 0;
    elegirVista('prod');
    // En pantallas angostas el pipeline queda lejos del botón: lo traemos a la vista.
    if (pipeline.getBoundingClientRect().top > innerHeight * 0.75) pipeline.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });

    try {
      // 1. Commit
      empezarEtapa(0);
      await lineas([
        [0, '▸ Commit', 'etapa'],
        [250, `git commit -m "${mensaje}"`, 'cmd'],
        [380, `[main ${h}] ${mensaje}`],
        [200, ` ${nArchivos} ${nArchivos === 1 ? 'archivo modificado' : 'archivos modificados'}`, 'tenue'],
        [350, 'git push origin main', 'cmd'],
        [550, 'To git.teammanchas.com.pe:tienda-demo.git', 'tenue'],
        [200, `   ${S.ultimoHash}..${h}  main -> main`, 'tenue'],
        [300, `Pipeline #${S.pipelineN} iniciado para ${h}`, 'info'],
      ]);
      S.ultimoHash = h;
      terminarEtapa(0);

      // 2. Construcción
      empezarEtapa(1);
      await lineas([
        [350, '▸ Construcción', 'etapa'],
        [200, 'npm ci', 'cmd'],
        [700, 'added 812 packages in 4.2s', 'tenue'],
        [250, 'npm run build', 'cmd'],
        [500, '✓ 214 módulos transformados', 'ok'],
        [250, 'dist/assets/app.js  186 kB (gzip 61 kB)', 'tenue'],
        [300, `docker build -t tienda-demo:${version} .`, 'cmd'],
        [800, `Imagen tienda-demo:${version} creada (87 MB)`, 'ok'],
      ]);
      terminarEtapa(1);

      // 3. Pruebas
      empezarEtapa(2);
      const sinTitulo = !b.titulo.trim();
      await lineas([
        [350, '▸ Pruebas automáticas', 'etapa'],
        [200, 'npm test', 'cmd'],
        [600, ' PASS  catalogo.test.js (31 pruebas)', 'ok'],
        [350, ` ${sinTitulo ? 'FAIL' : 'PASS'}  banner.test.js (6 pruebas)`, sinTitulo ? 'error' : 'ok'],
        ...(sinTitulo ? [[150, '   ✕ el banner muestra un título', 'error'], [100, '     Esperado: un texto  Recibido: ""', 'error']] : []),
        [400, ' PASS  pagos.test.js (18 pruebas)', 'ok'],
      ]);
      if (b.error) {
        await lineas([
          [500, ' FAIL  carrito.test.js', 'error'],
          [150, '   ✕ aplica el cupón del 10 % al total', 'error'],
          [150, '     Esperado: S/ 170.10', 'error'],
          [100, '     Recibido: S/ 189.00', 'error'],
          [100, '       at calcularTotal (src/carrito.js:3)', 'tenue'],
        ]);
      } else {
        await lineas([[500, ' PASS  carrito.test.js (24 pruebas)', 'ok']]);
      }
      const fallidas = (b.error ? 1 : 0) + (sinTitulo ? 1 : 0);
      if (fallidas) {
        await lineas([[300, `Pruebas: ${fallidas} ${fallidas === 1 ? 'falló' : 'fallaron'}, ${79 - fallidas} pasaron, 79 en total`, 'error']]);
        terminarEtapa(2, 'fallo', 'Falló');
        pipeline.classList.add('fallo');
        etapas.slice(3).forEach((_, k) => estado(k + 3, 'omitida'));
        await lineas([
          [400, `✕ Pipeline #${S.pipelineN} detenido en Pruebas`, 'error'],
          [200, `Producción no se tocó: tus clientes siguen viendo la versión ${S.prod.version}`, 'aviso'],
        ]);
        ponerNota(b.error
          ? 'Las pruebas detuvieron el error antes de llegar a los clientes. Apaga «Colar un error» y publica otra vez.'
          : 'Las pruebas piden que el banner tenga un título. Escribe uno y publica otra vez.', 'error', true);
        return;
      }
      await lineas([[300, 'Pruebas: 79 pasaron, 79 en total. Cobertura 87 %', 'ok']]);
      terminarEtapa(2);

      // 4. Seguridad
      empezarEtapa(3);
      await lineas([
        [350, '▸ Análisis de seguridad', 'etapa'],
        [200, 'npm audit --omit=dev', 'cmd'],
        [600, 'found 0 vulnerabilities', 'ok'],
        [250, `trivy image tienda-demo:${version}`, 'cmd'],
        [800, 'Total: 0 (CRITICAL: 0, HIGH: 0)', 'ok'],
        [250, 'Contraseñas o llaves en el código: ninguna', 'ok'],
      ]);
      terminarEtapa(3);

      // 5. Staging
      empezarEtapa(4);
      await lineas([
        [350, '▸ Staging', 'etapa'],
        [200, `kubectl set image deploy/tienda tienda=tienda-demo:${version} -n staging`, 'cmd'],
        [500, 'deployment.apps/tienda image updated', 'tenue'],
        [700, 'deployment "tienda" successfully rolled out', 'ok'],
        [350, 'Prueba de humo: GET /  200 OK (138 ms)', 'ok'],
        [250, 'Prueba de humo: POST /api/carrito  201 Created (94 ms)', 'ok'],
      ]);
      S.destino = { ...b, version };
      tabStaging.disabled = false;
      elegirVista('staging');
      log('Vista previa lista: staging.tienda-demo.teammanchas.com.pe', 'info');
      terminarEtapa(4);

      // 6. Aprobación
      iEtapa = 5; tEtapa = performance.now();
      estado(5, 'pausa');
      pipeline.style.setProperty('--avance', (5 / 6).toFixed(3));
      await lineas([[300, '▸ Aprobación', 'etapa'], [150, 'Esperando tu aprobación para pasar a producción…', 'aviso']]);
      ponerNota('Revisa la versión en la pestaña Staging y decide si pasa a producción.');
      const aprobado = await pedirAprobacion(version);
      if (!aprobado) {
        terminarEtapa(5, 'fallo', 'Cancelado');
        estado(6, 'omitida');
        pipeline.classList.add('fallo');
        log(`Despliegue cancelado. Producción sigue con la versión ${S.prod.version}`, 'aviso');
        S.destino = null; tabStaging.disabled = true; elegirVista('prod');
        ponerNota('Cancelaste el despliegue. Tu cambio sigue en el editor por si quieres publicarlo después.', '', true);
        return;
      }
      log(`Aprobado por ti a las ${hora(new Date())}`, 'ok');
      terminarEtapa(5, 'ok', 'Aprobado');

      // 7. Producción (canario)
      await desplegarCanario(version, mensaje, b);
    } finally {
      clearInterval(relojTimer); tic();
      bloquear(false);
      actualizarEditor();
    }
  }

  function pedirAprobacion(version) {
    return new Promise((resolve) => {
      $('#sim-aprobacion-titulo').textContent = `¿Pasamos la versión ${version} a producción?`;
      caja.hidden = false;
      const aprobar = $('#sim-aprobar'), rechazar = $('#sim-rechazar');
      const fin = (ok) => { caja.hidden = true; aprobar.onclick = rechazar.onclick = null; resolve(ok); };
      aprobar.onclick = () => fin(true);
      rechazar.onclick = () => fin(false);
      aprobar.focus({ preventScroll: true });
      caja.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'nearest' });
    });
  }

  btnFalla.addEventListener('click', () => {
    if (S.falla || !S.destino) return;
    S.falla = true; S.tFalla = performance.now();
    btnFalla.hidden = true;
    S.servidores.forEach((s, i) => { if (s.nueva) { s.mal = true; pintarServidor(i); } });
    latirCarga();
    log('Algo salió mal en la versión nueva…', 'tenue');
  });

  async function desplegarCanario(version, mensaje, b) {
    empezarEtapa(6);
    elegirVista('prod');
    S.falla = false;
    S.m.intentosProd += 1;
    const anterior = S.prod.version;
    ponerNota('Desplegando en producción por partes. Si quieres, provoca una falla para ver la reversión automática.');
    await lineas([
      [300, '▸ Producción: despliegue canario', 'etapa'],
      [200, `kubectl argo rollouts set image tienda tienda=tienda-demo:${version}`, 'cmd'],
    ]);
    btnFalla.hidden = false;

    const tramos = [1, 4, 8];
    let hechos = 0;
    for (const n of tramos) {
      const pct = Math.round((n / N_SERVIDORES) * 100);
      log(`Actualizando ${n} de ${N_SERVIDORES} servidores: ${pct} % de las visitas`, 'info');
      await actualizarServidores(hechos, n, { version, nueva: true, mal: S.falla });
      hechos = n;
      S.trafico = n / N_SERVIDORES;
      pintarVista();
      for (let k = 0; k < 2; k++) {
        await esperar(950);
        if (S.falla) break;
        const lat = 120 + Math.round(Math.random() * 60);
        log(`Salud: errores ${num.format(Math.random() * 0.2)} %, respuesta p95 ${lat} ms`, 'ok');
      }
      if (S.falla) break;
    }

    btnFalla.hidden = true;
    if (S.falla) {
      // Reversión automática: la métrica de errores supera el límite.
      await lineas([
        [100, `✕ Salud: errores ${num.format(12 + Math.random() * 6)} % (límite 1 %) en los servidores con v${version}`, 'error'],
        [300, `Revirtiendo automáticamente a v${anterior}…`, 'aviso'],
      ]);
      await actualizarServidores(0, hechos, { version: anterior, nueva: false, mal: false });
      S.trafico = 0; S.destino = null;
      tabStaging.disabled = true;
      pintarVista();
      const recuperacion = performance.now() - S.tFalla;
      S.m.fallidosProd += 1;
      S.m.recuperaciones.push(recuperacion);
      S.historial.push({ version, mensaje, fecha: new Date(), estado: 'revertida', config: { ...b } });
      S.ultimaMenor += 1;
      log(`✓ Reversión completa en ${seg(recuperacion)}. Los clientes vuelven a ver v${anterior}`, 'ok');
      terminarEtapa(6, 'fallo', 'Revertido');
      pipeline.classList.add('fallo');
      ponerNota(`La versión ${version} falló en producción y se revirtió sola. Puedes volver a publicarla cuando quieras.`, 'error', true);
      pintarMetricas();
      document.dispatchEvent(new CustomEvent('tienda:version', { detail: { version: anterior, accion: 'revertida' } }));
      return;
    }

    // Éxito: la versión nueva queda en producción.
    const total = performance.now() - tInicio;
    S.historial.forEach((h) => { if (h.estado === 'vivo') h.estado = 'anterior'; });
    S.historial.push({ version, mensaje, fecha: new Date(), estado: 'vivo', config: { titulo: b.titulo, color: b.color, envio: b.envio } });
    S.ultimaMenor += 1;
    S.prod = { titulo: b.titulo, color: b.color, envio: b.envio, version };
    S.destino = null; S.trafico = 0;
    tabStaging.disabled = true;
    S.m.despliegues += 1;
    S.m.tiempos.push(total);
    terminarEtapa(6);
    pipeline.style.setProperty('--avance', 1);
    pipeline.classList.add('listo-ok');
    await lineas([
      [200, `✓ v${version} en producción en ${N_SERVIDORES} de ${N_SERVIDORES} servidores`, 'ok'],
      [150, `Del commit a producción: ${seg(total)}`, 'tenue'],
    ]);
    pintarVista();
    pintarMetricas();
    ponerNota(`Publicado: la versión ${version} ya está en línea. Haz otro cambio o vuelve a una versión anterior desde el historial.`, 'ok', true);
    document.dispatchEvent(new CustomEvent('tienda:version', { detail: { version, accion: 'publicada' } }));
  }

  /* ---------- Volver a una versión anterior (sin repetir el pipeline) ---------- */
  async function volverA(i) {
    const h = S.historial[i];
    if (!h || h.version === S.prod.version) return;
    bloquear(true);
    reiniciarPipeline();
    pipeline.classList.remove('en-marcha');
    etapas.slice(0, 6).forEach((_, k) => estado(k, 'omitida'));
    tInicio = performance.now();
    clearInterval(relojTimer); relojTimer = setInterval(tic, 100);
    const actual = S.prod.version;
    try {
      empezarEtapa(6);
      pipeline.style.setProperty('--avance', 0);
      S.destino = { ...h.config, version: h.version };
      await lineas([
        [0, '▸ Reversión manual', 'etapa'],
        [200, `kubectl argo rollouts undo tienda --to-version=${h.version}`, 'cmd'],
        [300, 'La imagen ya fue construida y probada: no hace falta repetir el pipeline', 'tenue'],
      ]);
      await actualizarServidores(0, N_SERVIDORES, { version: h.version, nueva: false, mal: false });
      S.trafico = 1; pintarVista();
      await esperar(500);
      const t = performance.now() - tInicio;
      S.historial.forEach((x) => { if (x.estado === 'vivo') x.estado = 'anterior'; });
      S.historial.push({ version: h.version, mensaje: `Vuelve a la versión ${h.version} desde la ${actual}`, fecha: new Date(), estado: 'vivo', config: { ...h.config } });
      S.prod = { ...h.config, version: h.version };
      S.destino = null; S.trafico = 0;
      S.m.despliegues += 1;
      terminarEtapa(6, 'ok', `Listo en ${seg(t)}`);
      log(`✓ Producción de vuelta en v${h.version} en ${seg(t)}`, 'ok');
      // El editor parte de lo que hay en producción.
      Object.assign(S.borrador, { titulo: S.prod.titulo, color: S.prod.color, envio: S.prod.envio });
      inTitulo.value = S.prod.titulo;
      $(`input[name="color"][value="${S.prod.color}"]`, form).checked = true;
      inEnvio.checked = S.prod.envio;
      pintarVista();
      pintarMetricas();
      ponerNota(`Volviste a la versión ${h.version}. El editor ya muestra lo que hay en producción.`, 'ok', true);
      document.dispatchEvent(new CustomEvent('tienda:version', { detail: { version: h.version, accion: 'revertida' } }));
    } finally {
      clearInterval(relojTimer); tic();
      bloquear(false);
      actualizarEditor();
    }
  }

  /* ---------- Estado inicial ---------- */
  pintarHistorial();
  pintarMetricas();
  actualizarEditor();
  pintarVista();
})();
