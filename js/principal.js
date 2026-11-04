// Team Manchas: efectos de la landing (hero, búhos, scroll, ciclo DevOps, menú).
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const escritorio = matchMedia('(min-width: 901px)');
  const conPuntero = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Arranque: espera las fuentes para que el titular no salte ---------- */
  const arrancar = () => document.body.classList.add('listo');
  if (reducir) arrancar();
  else Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(() => requestAnimationFrame(arrancar));

  /* ---------- Búhos: los ojos siguen el puntero y parpadean ---------- */
  const puntero = { x: innerWidth * 0.5, y: innerHeight * 0.4, t: 0 };
  const mover = (e) => { puntero.x = e.clientX; puntero.y = e.clientY; puntero.t = performance.now(); };
  addEventListener('pointermove', mover, { passive: true });
  addEventListener('pointerdown', mover, { passive: true });

  const buhos = $$('.js-buho').map((svg) => ({
    svg,
    pupilas: $$('.pupila', svg).map((g) => {
      const c = g.querySelector('circle');
      return { g, cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy'), x: 0, y: 0 };
    }),
  }));

  function mirar(t) {
    for (const b of buhos) {
      const r = b.svg.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const m = b.svg.getScreenCTM();
      if (!m) continue;
      // Sin puntero reciente (táctil o quieto): el búho mira alrededor con calma.
      let tx = puntero.x, ty = puntero.y;
      if (!puntero.t || t - puntero.t > 5000) {
        tx = r.left + r.width / 2 + Math.cos(t / 1700) * r.width * 0.8;
        ty = r.top + r.height * 0.55 + Math.sin(t / 2300) * r.height * 0.4;
      }
      for (const p of b.pupilas) {
        const sx = m.a * p.cx + m.c * p.cy + m.e;
        const sy = m.b * p.cx + m.d * p.cy + m.f;
        const dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1;
        const k = Math.min(d / 90, 1) * 7;
        p.x += ((dx / d) * k - p.x) * 0.14;
        p.y += ((dy / d) * k - p.y) * 0.14;
        p.g.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
      }
    }
    requestAnimationFrame(mirar);
  }
  if (!reducir) requestAnimationFrame(mirar);

  function parpadear(svg) {
    svg.classList.add('parpadea');
    setTimeout(() => svg.classList.remove('parpadea'), 140);
  }
  if (!reducir) {
    buhos.forEach((b, i) => {
      const ciclo = () => {
        parpadear(b.svg);
        if (Math.random() < 0.25) setTimeout(() => parpadear(b.svg), 260);
        setTimeout(ciclo, 2600 + Math.random() * 3600);
      };
      setTimeout(ciclo, 2600 + i * 900);
    });
  }

  /* ---------- Titulares que entran desde una máscara ---------- */
  const revelar = new IntersectionObserver((entradas) => {
    for (const e of entradas) if (e.isIntersecting) { e.target.classList.add('visible'); revelar.unobserve(e.target); }
  }, { threshold: 0.4 });
  $$('.js-revela').forEach((h) => {
    h.innerHTML = `<span class="revela__in">${h.innerHTML}</span>`;
    h.classList.add('revela');
    if (reducir) h.classList.add('visible'); else revelar.observe(h);
  });

  /* ---------- Manifiesto: las palabras se entintan con el scroll ---------- */
  const manifiesto = $('.manifiesto');
  const textoM = $('.js-palabras');
  textoM.innerHTML = textoM.textContent.trim().split(/\s+/).map((w) => `<span class="palabra">${w}</span>`).join(' ');
  const palabras = $$('.palabra', textoM);
  let encendidas = -1;

  /* ---------- Servicios: acordeón ---------- */
  $$('.servicio').forEach((li) => {
    const boton = $('.servicio__boton', li);
    const detalle = $('.servicio__detalle', li);
    detalle.inert = true;
    boton.addEventListener('click', () => {
      const abrir = boton.getAttribute('aria-expanded') !== 'true';
      boton.setAttribute('aria-expanded', String(abrir));
      li.classList.toggle('abierto', abrir);
      detalle.inert = !abrir;
    });
  });

  /* ---------- Ciclo DevOps ---------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const ruta = $('#ruta-ciclo');
  const largo = ruta.getTotalLength();
  const FASES = ['Planificar', 'Programar', 'Construir', 'Probar', 'Publicar', 'Desplegar', 'Operar', 'Monitorear'];
  const POS = [0.07, 0.185, 0.315, 0.43, 0.57, 0.685, 0.815, 0.93];
  const nodos = FASES.map((nombre, i) => {
    const pt = ruta.getPointAtLength(POS[i] * largo);
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'ciclo__nodo');
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', 8);
    const t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('x', pt.x);
    t.setAttribute('y', pt.y < 150 ? pt.y - 24 : pt.y + 36);
    t.setAttribute('text-anchor', 'middle');
    t.textContent = nombre;
    g.append(c, t);
    $('.ciclo__nodos').append(g);
    return g;
  });
  const marcador = $('.ciclo__marcador');
  let faseActual = -1, posMarcador = POS[0] * largo, animMarcador = 0;

  const ubicar = (l) => {
    const pt = ruta.getPointAtLength(((l % largo) + largo) % largo);
    marcador.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
  };
  ubicar(posMarcador);

  function irAFase(i) {
    if (i === faseActual) return;
    const atras = i < faseActual;
    faseActual = i;
    nodos.forEach((n, k) => { n.classList.toggle('activo', k === i); n.classList.toggle('pasado', k < i); });

    // El marcador recorre el camino del infinito, nunca salta.
    const destino = POS[i] * largo;
    const desde = posMarcador;
    let delta = atras ? -(((desde - destino) % largo) + largo) % largo : (((destino - desde) % largo) + largo) % largo;
    if (reducir) { posMarcador = destino; ubicar(destino); return; }
    const t0 = performance.now(), dur = 700 + Math.abs(delta) / largo * 900;
    cancelAnimationFrame(animMarcador);
    const paso = (t) => {
      const k = clamp((t - t0) / dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      posMarcador = desde + delta * e;
      ubicar(posMarcador);
      if (k < 1) animMarcador = requestAnimationFrame(paso);
      else posMarcador = ((destino % largo) + largo) % largo;
    };
    animMarcador = requestAnimationFrame(paso);
  }

  const pasos = $$('.paso');
  const observarPasos = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      pasos.forEach((p) => p.classList.toggle('activo', p === e.target));
      irAFase(+e.target.dataset.fase);
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  pasos.forEach((p) => observarPasos.observe(p));
  irAFase(0);
  pasos[0].classList.add('activo');

  // Monitor con datos simulados: solo corre mientras se ve.
  const lienzo = $('#mon-grafico');
  const ctx = lienzo.getContext('2d');
  const serie = Array.from({ length: 48 }, (_, i) => 140 + Math.sin(i / 3) * 12 + Math.random() * 10);
  const fmt = new Intl.NumberFormat('es-PE');
  let monitorVisible = false, monitorTimer = 0;

  function dibujarMonitor() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    if (!w) return;
    if (lienzo.width !== w * dpr) { lienzo.width = w * dpr; lienzo.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const min = 100, max = 230, dx = w / (serie.length - 1);
    const y = (v) => h - 4 - ((v - min) / (max - min)) * (h - 8);
    ctx.beginPath();
    serie.forEach((v, i) => (i ? ctx.lineTo(i * dx, y(v)) : ctx.moveTo(0, y(v))));
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(77,127,224,.35)'); grad.addColorStop(1, 'rgba(77,127,224,0)');
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath();
    serie.forEach((v, i) => (i ? ctx.lineTo(i * dx, y(v)) : ctx.moveTo(0, y(v))));
    ctx.strokeStyle = '#8FB0F0'; ctx.lineWidth = 1.75; ctx.lineJoin = 'round'; ctx.stroke();
    const ult = serie[serie.length - 1];
    ctx.beginPath(); ctx.arc(w - 2, y(ult), 3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  }
  function latirMonitor() {
    const prev = serie[serie.length - 1];
    let v = prev + (Math.random() - 0.5) * 22 + (145 - prev) * 0.12;
    if (Math.random() < 0.04) v += 70; // un pico de vez en cuando
    serie.push(clamp(v, 95, 255)); serie.shift();
    $('#mon-lat').textContent = `${Math.round(v)} ms`;
    $('#mon-rpm').textContent = fmt.format(Math.round(1150 + Math.random() * 160));
    $('#mon-disp').textContent = `${(99.95 + Math.random() * 0.04).toFixed(2)} %`;
    dibujarMonitor();
  }
  new IntersectionObserver(([e]) => {
    monitorVisible = e.isIntersecting;
    clearInterval(monitorTimer);
    if (monitorVisible && !reducir) monitorTimer = setInterval(latirMonitor, 800);
    dibujarMonitor();
  }).observe($('.ciclo'));

  /* ---------- Proyectos: scroll vertical que mueve la pista en horizontal ---------- */
  const proyectos = $('.proyectos');
  const pista = $('.proyectos__pista');
  let recorridoH = 0;
  function medirProyectos() {
    if (escritorio.matches && !reducir) {
      recorridoH = Math.max(0, pista.scrollWidth - document.documentElement.clientWidth);
      proyectos.style.height = `${recorridoH + innerHeight}px`;
    } else {
      recorridoH = 0;
      proyectos.style.height = '';
      pista.style.removeProperty('--x');
    }
  }

  /* ---------- Navegación ---------- */
  const nav = $('.nav');
  const secciones = $$('[data-tono]').filter((s) => s !== nav);
  const enlaces = $$('.nav__enlaces a');
  const hero = $('.hero');
  const barra = $('.progreso span');

  /* ---------- Bucle de scroll (un solo rAF por cuadro) ---------- */
  let pendiente = false;
  function alHacerScroll() {
    pendiente = false;
    const vh = innerHeight;
    const doc = document.documentElement;
    barra.style.setProperty('--prog', clamp(scrollY / (doc.scrollHeight - vh || 1)).toFixed(4));

    // Tono de la barra según la sección que tiene debajo
    const yNav = 36;
    const bajo = secciones.find((s) => { const r = s.getBoundingClientRect(); return r.top <= yNav && r.bottom > yNav; });
    if (bajo && !nav.classList.contains('menu-abierto')) nav.dataset.tono = bajo.dataset.tono;
    nav.classList.toggle('nav--solida', scrollY > 20);
    const idActivo = bajo && bajo.id ? `#${bajo.id}` : '';
    enlaces.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === idActivo)));

    if (reducir) return;

    const rh = hero.getBoundingClientRect();
    if (rh.bottom > 0) hero.style.setProperty('--hero-p', clamp(-rh.top / rh.height).toFixed(4));

    const rm = manifiesto.getBoundingClientRect();
    if (rm.top < vh && rm.bottom > 0) {
      const p = clamp((-rm.top + vh * 0.15) / (rm.height - vh));
      const n = Math.round(p * palabras.length);
      if (n !== encendidas) {
        encendidas = n;
        palabras.forEach((w, i) => w.classList.toggle('on', i < n));
      }
    }

    if (recorridoH) {
      const rp = proyectos.getBoundingClientRect();
      const p = clamp(-rp.top / (rp.height - vh));
      pista.style.setProperty('--x', `${(-p * recorridoH).toFixed(1)}px`);
      $('.proyectos__avance span').style.setProperty('--avance-h', p.toFixed(4));
    }
  }
  const pedirScroll = () => { if (!pendiente) { pendiente = true; requestAnimationFrame(alHacerScroll); } };
  addEventListener('scroll', pedirScroll, { passive: true });
  addEventListener('resize', () => { medirProyectos(); dibujarMonitor(); pedirScroll(); });
  escritorio.addEventListener('change', () => { medirProyectos(); pedirScroll(); });
  if (reducir) palabras.forEach((w) => w.classList.add('on'));
  medirProyectos();
  document.fonts.ready.then(() => { medirProyectos(); pedirScroll(); });
  alHacerScroll();

  /* ---------- Menú móvil ---------- */
  const botonMenu = $('.nav__menu');
  const menu = $('#menu-movil');
  let tonoPrevio = 'azul';
  function abrirMenu(abrir) {
    botonMenu.setAttribute('aria-expanded', String(abrir));
    $('.nav__menu-texto').textContent = abrir ? 'Cerrar' : 'Menú';
    document.body.style.overflow = abrir ? 'hidden' : '';
    if (abrir) {
      tonoPrevio = nav.dataset.tono;
      nav.classList.add('menu-abierto');
      nav.dataset.tono = 'azul';
      menu.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('abierto')));
      setTimeout(() => $('a', menu).focus(), 300);
    } else {
      nav.classList.remove('menu-abierto');
      nav.dataset.tono = tonoPrevio;
      menu.classList.remove('abierto');
      setTimeout(() => { if (!menu.classList.contains('abierto')) menu.hidden = true; }, reducir ? 0 : 700);
      pedirScroll();
    }
  }
  botonMenu.addEventListener('click', () => abrirMenu(botonMenu.getAttribute('aria-expanded') !== 'true'));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => abrirMenu(false)));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && botonMenu.getAttribute('aria-expanded') === 'true') { abrirMenu(false); botonMenu.focus(); }
  });

  /* ---------- Botones magnéticos ---------- */
  if (conPuntero && !reducir) {
    $$('.js-iman').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--bx', `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px`);
        b.style.setProperty('--by', `${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px`);
      });
      b.addEventListener('pointerleave', () => { b.style.setProperty('--bx', '0px'); b.style.setProperty('--by', '0px'); });
    });
  }

  /* ---------- Contacto: el búho se asoma ---------- */
  const contacto = $('.contacto');
  new IntersectionObserver(([e]) => contacto.classList.toggle('en-vista', e.isIntersecting), { threshold: 0.35 }).observe(contacto);
  $$('.js-asomar').forEach((b) => {
    const on = () => contacto.classList.add('asomado');
    const off = () => contacto.classList.remove('asomado');
    b.addEventListener('pointerenter', on); b.addEventListener('focus', on);
    b.addEventListener('pointerleave', off); b.addEventListener('blur', off);
  });

  /* ---------- Pantallas de proyectos: cada sistema se ve funcionando mientras está a la vista ---------- */
  const soles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const entero = new Intl.NumberFormat('es-PE');
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const destellar = (el) => { el.classList.remove('destello'); void el.offsetWidth; el.classList.add('destello'); };

  const DEMOS = {
    // Un cliente agrega prendas al carrito
    emoda(el, cada = 3000) {
      const items = $$('.emoda__item', el).slice(0, 4); // la segunda fila queda cortada, como al hacer scroll
      const carrito = $('[data-carrito]', el);
      const aviso = $('[data-aviso]', el);
      let i = 0;
      let n = 2;
      return [cada, () => {
        const item = items[i++ % items.length];
        item.classList.add('agregado');
        n = n >= 9 ? 1 : n + 1;
        carrito.textContent = n;
        destellar(carrito);
        aviso.textContent = `${$('p', item).textContent} se agregó al carrito`;
        aviso.classList.add('ver');
        setTimeout(() => { aviso.classList.remove('ver'); item.classList.remove('agregado'); }, 1900);
      }];
    },
    // La mesa 4 sigue pidiendo y se ocupa la mesa 5
    resto(el, cada = 2600) {
      const cuenta = $('[data-cuenta]', el);
      const total = $('[data-total]', el);
      const mesa = $('[data-mesa]', el);
      const original = cuenta.innerHTML;
      const extras = [['2× Pisco sour', 44], ['1× Ají de gallina', 36], ['1× Suspiro limeño', 16]];
      let paso = 0;
      let suma = 138;
      const ponerMesa = (estado, texto) => { mesa.className = `mesa ${estado}`; $('span', mesa).textContent = texto; };
      return [cada, () => {
        if (paso < extras.length) {
          const [plato, precio] = extras[paso++];
          const li = document.createElement('li');
          li.className = 'nuevo';
          li.innerHTML = `<span>${plato}</span><b>S/ ${soles.format(precio)}</b>`;
          cuenta.append(li);
          suma += precio;
          if (paso === 1) ponerMesa('ocupada', '2 pers.');
        } else {
          cuenta.innerHTML = original;
          suma = 138;
          paso = 0;
          ponerMesa('libre', 'Libre');
        }
        total.textContent = `S/ ${soles.format(suma)}`;
        destellar(total);
      }];
    },
    // Entran pedidos y el tablero se actualiza solo
    shop(el, cada = 3200) {
      const lista = $('[data-pedidos-lista]', el);
      const ventas = $('[data-ventas]', el);
      const pedidos = $('[data-pedidos]', el);
      const hoy = $('[data-hoy]', el);
      const nombres = ['Lucía V.', 'Carlos M.', 'Valeria S.', 'Diego R.', 'Camila T.', 'Andrés F.', 'Paola N.'];
      let nro = 1049;
      let v = 12480;
      let p = 86;
      let h = 0.58;
      return [cada, () => {
        const monto = 49.9 + Math.round(Math.random() * 28) * 10;
        const enCamino = Math.random() < 0.3;
        const li = document.createElement('li');
        li.className = 'nuevo';
        li.innerHTML = `<b>${nombres[(nro - 1049) % nombres.length]}</b><span>S/ ${soles.format(monto)}</span><small>#${nro++}</small>`
          + `<em${enCamino ? ' class="camino"' : ''}>${enCamino ? 'En camino' : 'Pagado'}</em>`;
        lista.prepend(li);
        lista.lastElementChild.remove();
        v += monto;
        ventas.textContent = `S/ ${entero.format(Math.round(v))}`;
        pedidos.textContent = ++p;
        destellar(ventas);
        destellar(pedidos);
        h = Math.min(0.96, h + 0.03);
        hoy.style.setProperty('--h', h);
      }];
    },
    // Alguien inicia sesión y el administrador ajusta un permiso
    acceso(el, cada = 6500) {
      const correo = $('[data-correo]', el);
      const clave = $('[data-clave]', el);
      const boton = $('[data-ingresar]', el);
      const nota = $('[data-sesion]', el);
      const permiso = $('[data-permiso]', el);
      const usuario = correo.textContent;
      let ocupado = false;
      return [cada, async () => {
        if (ocupado) return;
        ocupado = true;
        correo.textContent = '';
        clave.textContent = '';
        boton.textContent = 'Ingresar';
        boton.classList.remove('ok');
        nota.textContent = 'Verificación en dos pasos activa';
        correo.classList.add('foco');
        for (const c of usuario) { correo.textContent += c; await espera(45); }
        correo.classList.remove('foco');
        clave.classList.add('foco');
        for (let i = 0; i < 10; i++) { clave.textContent += '•'; await espera(55); }
        clave.classList.remove('foco');
        boton.classList.add('pulsado');
        await espera(220);
        boton.classList.remove('pulsado');
        boton.textContent = 'Verificando…';
        await espera(700);
        boton.classList.add('ok');
        boton.textContent = 'Sesión iniciada';
        nota.textContent = 'Token válido por 15 min';
        await espera(1200);
        permiso.classList.toggle('si');
        destellar(permiso);
        ocupado = false;
      }];
    },
    // Las métricas de la nube avanzan en vivo
    nube(el, cada = 1200) {
      const invocaciones = $('[data-invocaciones]', el);
      const p95 = $('[data-p95]', el);
      let n = 182340;
      return [cada, () => {
        n += 20 + Math.round(Math.random() * 60);
        invocaciones.textContent = entero.format(n);
        p95.textContent = `${78 + Math.round(Math.random() * 14)} ms`;
      }];
    },
  };

  $$('.js-pantalla').forEach((pantalla) => {
    const crear = DEMOS[pantalla.dataset.demo];
    if (!crear || reducir) return;
    const [cada, paso] = crear(pantalla);
    let timer = 0;
    new IntersectionObserver(([e]) => {
      clearInterval(timer);
      if (e.isIntersecting) { paso(); timer = setInterval(paso, cada); }
    }, { threshold: 0.5 }).observe(pantalla);
  });

  /* ---------- El hero refleja lo que pase en el simulador ---------- */
  document.addEventListener('tienda:version', (e) => {
    const { version, accion } = e.detail;
    $('#hero-estado').textContent = accion === 'revertida'
      ? `Tienda de prueba de vuelta en la versión ${version}`
      : `Tienda de prueba en línea con la versión ${version}, publicada por ti`;
  });
})();
