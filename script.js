/* INDICE DE SCRIPTS

    0. Utilidades y ajustes
    3. Header / Cabecera (menú móvil, enlace activo, ocultar al bajar)
    4. Bloqueo de scroll y estados (reinicio de checkboxes, inert, foco)
    5. Hero (puntos de la ola y aviso de chip sin revisar)
    6. Ojo (sigue el cursor)
    8. Idioma (selector del header)
   10. Carrusel de lujos (flechas, deslizar, autoplay, se cierra al salir)
   13. Monitoreo / zona de errores (aparece de a poco)
   14. Pop-ups molestos (aparecen, se cambian de lugar y nunca se salen de su sección)
   15. Blackout y reinicio (arranca solo al llegar al final)
   16. Overlays (escáner automático y aviso: foco, Esc)
   20. Parallax (respaldo para navegadores sin animation-timeline)
   21. Final (pantalla final y reinicio limpio)
   22. Rendimiento y accesibilidad (labels con teclado, pausa fuera de vista)
   23. Arranque

*/

(() => {
    'use strict';

    /* 0. Utilidades y ajustes */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    const AJUSTES = {
        ESCANER_INICIO_MS: 2400, // "detecta" el chip 2.4 s antes de empezar a analizarlo (igual que en el CSS)
        ESCANER_MS: 2600, // duración del análisis (igual que en el CSS, sección 16)
        LECTURA_MS: 3400, // tiempo para leer los resultados antes de que el escáner se cierre solo
        AVISO_CHIP_MS: 2600, // cuánto se ve el aviso "revise su chip"
        AUTOPLAY_MS: 6000, // cambio automático del carrusel (0 = desactivar)
        REINICIO_MS: 900, // tiempo mirando el vacío antes de que arranque el reinicio
        OJO_REPOSO_MS: 3500, // sin mover el mouse, el ojo vuelve a vigilar solo
        HEADER_UMBRAL_PX: 8, // cuánto hay que desplazarse para ocultar/mostrar el header
        POPUP_MARGEN_PX: 16 // distancia mínima entre un pop-up y el borde de su sección
    };

    /* Traducciones: viven en textos.js ("texto en inglés" → "texto traducido").
       La página está escrita en inglés, así que el inglés no necesita diccionario. */
    const TEXTOS = Object.assign({ en: {} }, window.SMARTLIFE_TEXTOS);
    let idiomaActual = 'en';
    const traducir = texto => TEXTOS[idiomaActual]?.[texto] || texto;

    const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const soportaTimeline = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()'));

    const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
    const azar = (min, max) => min + Math.random() * Math.max(0, max - min);
    const estado = id => document.getElementById(id);
    const activo = id => !!(estado(id) && estado(id).checked);

    // Cambia un checkbox/radio y avisa a quien escuche (el CSS reacciona solo con :checked)
    const poner = (id, valor) => {
        const el = estado(id);
        if (el && el.checked !== valor) {
            el.checked = valor;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };

    // Ejecuta como máximo una vez por frame, con los argumentos más recientes
    const porFrame = fn => {
        let esperando = false, ultimos = [];
        return (...args) => {
            ultimos = args;
            if (esperando) return;
            esperando = true;
            requestAnimationFrame(() => { esperando = false; fn(...ultimos); });
        };
    };


    /* 4. Bloqueo de scroll y estados */
    function s4_estados() {
        // Siempre se empieza desde arriba y sin estados guardados por el navegador
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

        const reiniciarEstados = () => {
            $$('input.estado').forEach(i => { i.checked = i.defaultChecked; });
            window.scrollTo(0, 0);
            actualizarInert();
        };

        reiniciarEstados();
        addEventListener('pageshow', e => { if (e.persisted) reiniciarEstados(); });

        ['chip-ok', 'escaner-abierto', 'desconectado', 'apagado'].forEach(id => {
            const el = estado(id);
            if (el) el.addEventListener('change', actualizarInert);
        });
    }

    // Mientras el chip no está verificado (o hay un diálogo abierto), el resto no se puede tabular
    function actualizarInert() {
        const verificado = activo('chip-ok');
        const modal = (activo('escaner-abierto') && !verificado)
                   || (activo('desconectado') && !activo('apagado'))
                   || activo('apagado');

        const marcar = (el, v) => { if (el) el.inert = v; };
        const pie = $('#contacto');
        const resto = [$('.transicion-glitch'), $('.monitoreo'), $('.blackout')];

        marcar($('main'), modal);
        // El selector de idioma siempre se puede usar; el resto del header espera al chip
        $$('#cabecera-principal > :not(.selector-idioma)').forEach(el => marcar(el, modal || !verificado));
        marcar($('.selector-idioma'), modal);
        marcar(pie, modal || !verificado);
        resto.forEach(el => marcar(el, modal || !verificado));
        $$('main > section:not(#inicio)').forEach(s => marcar(s, modal || !verificado));
    }


    /* 3. Header / Cabecera */
    function s3_cabecera() {
        const cab = $('#cabecera-principal');
        const pie = $('#contacto');
        if (!cab) return;

        // Menú móvil: aria, cerrar al elegir un enlace y con Esc
        const menu = estado('menu');
        const boton = $('.menu-hamburguesa');
        if (menu && boton) {
            boton.setAttribute('aria-expanded', 'false');
            menu.addEventListener('change', () => boton.setAttribute('aria-expanded', String(menu.checked)));
            $$('.nav-principal a', cab).forEach(a => a.addEventListener('click', () => poner('menu', false)));
            addEventListener('keydown', e => { if (e.key === 'Escape') poner('menu', false); });
        }

        // Enlace activo según la sección que se está leyendo
        const enlaces = $$('.nav-principal a[href^="#"]');
        const secciones = ['inicio', 'lujos', 'noticias', 'bienestar', 'contacto'].map(id => estado(id)).filter(Boolean);
        const observador = new IntersectionObserver(entradas => {
            entradas.forEach(en => {
                if (!en.isIntersecting) return;
                enlaces.forEach(a => {
                    if (a.hash === '#' + en.target.id) a.setAttribute('aria-current', 'true');
                    else a.removeAttribute('aria-current');
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        secciones.forEach(s => observador.observe(s));

        // El header se esconde al bajar, vuelve al subir y desaparece cuando la página se rompe
        let ultimoY = window.scrollY;
        const alDesplazar = porFrame(() => {
            const y = window.scrollY;
            const limite = pie ? pie.offsetTop : Infinity;
            if (y > limite) cab.classList.add('oculta');
            else if (y < 80 || menu?.checked) cab.classList.remove('oculta');
            else if (y > ultimoY + AJUSTES.HEADER_UMBRAL_PX) cab.classList.add('oculta');
            else if (y < ultimoY - AJUSTES.HEADER_UMBRAL_PX) cab.classList.remove('oculta');
            ultimoY = y;
        });
        addEventListener('scroll', alDesplazar, { passive: true });
    }


    /* 5. Hero */

    // Ola de partículas: los puntos se crean aquí para que el HTML quede liviano
    function s5_ola() {
        const svg = $('.ola-puntos');
        if (!svg || svg.querySelector('circle')) return;

        const NS = 'http://www.w3.org/2000/svg';
        const FILAS = 8, COLUMNAS = 58;
        const ola = document.createElementNS(NS, 'g');
        ola.setAttribute('fill', 'url(#grad-ola)');

        for (let f = 0; f < FILAS; f++) {
            const t = f / (FILAS - 1);             // 0 = fila del fondo, 1 = fila del frente
            const y = 230 + Math.pow(t, 1.3) * 190;
            const paso = 20 + t * 14;
            const fila = document.createElementNS(NS, 'g');
            fila.setAttribute('opacity', (0.3 + t * 0.65).toFixed(2));

            for (let k = 0; k < COLUMNAS; k++) {
                const x = 800 + (k - (COLUMNAS - 1) / 2) * paso;
                if (x < -40 || x > 1640) continue;
                const punto = document.createElementNS(NS, 'circle');
                punto.setAttribute('cx', x.toFixed(1));
                punto.setAttribute('cy', (y + Math.sin(k * 0.22 + f * 0.5) * 26).toFixed(1));
                punto.setAttribute('r', (1.1 + t * 2.6).toFixed(2));
                punto.style.setProperty('--d', `-${(k * 0.11 + f * 0.32).toFixed(2)}s`); // desfase: la ola viaja
                punto.style.setProperty('--a', Math.round(16 + t * 18));            // adelante sube y baja más
                fila.appendChild(punto);
            }
            ola.appendChild(fila);
        }
        svg.appendChild(ola);
    }

    // Si se intenta seguir sin revisar el chip: el botón tiembla y aparece un aviso
    function s5_bloqueo() {
        const hero = $('.hero');
        if (!hero) return;

        let quitar = null;
        const avisar = () => {
            if (activo('chip-ok') || activo('escaner-abierto')) return;
            hero.classList.remove('bloqueado');
            void hero.offsetWidth; // reinicia la sacudida aunque ya estuviera puesta
            hero.classList.add('bloqueado');
            clearTimeout(quitar);
            quitar = setTimeout(() => hero.classList.remove('bloqueado'), AJUSTES.AVISO_CHIP_MS);
        };

        addEventListener('wheel', e => { if (e.deltaY > 0) avisar(); }, { passive: true });

        let y0 = null;
        addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
        addEventListener('touchmove', e => {
            if (y0 !== null && y0 - e.touches[0].clientY > 30) { avisar(); y0 = null; }
        }, { passive: true });

        addEventListener('keydown', e => {
            const enCampo = e.target.closest && e.target.closest('input, select, textarea');
            if (!enCampo && ['ArrowDown', 'PageDown', 'End', ' '].includes(e.key)) avisar();
        });

        // Clics en cualquier parte que no sea el botón del chip (los enlaces están bloqueados)
        document.addEventListener('click', e => {
            if (!e.target.closest('.hero-contenido .boton, .overlay, .selector-idioma')) avisar();
        });
    }


    /* 6. Ojo (sigue el cursor) */
    function s6_ojo() {
        const hero = $('.hero');
        const ojo = $('.ojo-hero');
        if (!hero || !ojo || reducirMovimiento) return;

        let reposo;
        const mirar = (mx, my) => {
            hero.style.setProperty('--mx', mx.toFixed(3));
            hero.style.setProperty('--my', my.toFixed(3));
        };

        const alMover = porFrame(e => {
            if (hero.classList.contains('fuera-de-vista')) return;
            const r = ojo.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const sobreBoton = e.target && e.target.closest && e.target.closest('.hero-contenido .boton');

            let mx, my;
            if (sobreBoton) { mx = 0; my = 0.45; } // sobre el botón te mira fijo
            else {
                mx = limitar((e.clientX - cx) / (innerWidth / 2), -1, 1) * 0.9;
                // Hacia abajo el iris baja hasta que la pupila toca el párpado (ver .ojo-hero .iris en el CSS)
                my = limitar((e.clientY - cy) / (innerHeight / 2.2), -0.45, 1);
            }

            hero.classList.add('mirando');
            mirar(mx, my);

            clearTimeout(reposo);
            reposo = setTimeout(() => { hero.classList.remove('mirando'); mirar(0, 0); }, AJUSTES.OJO_REPOSO_MS);
        });

        addEventListener('pointermove', e => { if (e.pointerType !== 'touch') alMover(e); }, { passive: true });
    }


    /* 8. Idioma
       Se recorren todos los textos y atributos de la página una sola vez y se guarda su versión
       en inglés; al cambiar de idioma se busca cada uno en el diccionario de textos.js. */
    function s8_idioma() {
        const selector = estado('idioma');
        if (!selector) return;

        const limpio = s => s.replace(/\s+/g, ' ').trim();

        // Textos visibles (se conservan los espacios del principio: la terminal los usa para sangrar)
        const nodos = [];
        const recorrido = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: n => (limpio(n.nodeValue) && !n.parentElement.closest('script, style, svg, option'))
                ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        });
        while (recorrido.nextNode()) {
            const n = recorrido.currentNode;
            const [, antes, texto, despues] = n.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/);
            nodos.push({ n, antes, clave: limpio(texto), despues });
        }

        // Atributos que también se leen (lectores de pantalla, imágenes)
        const atributos = [];
        $$('[alt], [aria-label], [title]').forEach(el => ['alt', 'aria-label', 'title'].forEach(at => {
            if (el.hasAttribute(at)) atributos.push({ el, at, clave: el.getAttribute(at) });
        }));
        const meta = $('meta[name="description"]');
        const titulo = document.title, descripcion = meta?.content;

        const aplicar = idioma => {
            idiomaActual = idioma in TEXTOS ? idioma : 'en';
            document.documentElement.lang = idiomaActual;
            nodos.forEach(({ n, antes, clave, despues }) => { n.nodeValue = antes + traducir(clave) + despues; });
            atributos.forEach(({ el, at, clave }) => el.setAttribute(at, traducir(clave)));
            document.title = traducir(titulo);
            if (meta) meta.content = traducir(descripcion);
            document.documentElement.style.setProperty('--txt-proyectando', JSON.stringify(traducir('Projecting onto your visual cortex…')));
            recalcularTerminal();
        };

        // Como toda la experiencia, la página siempre empieza de cero: en inglés
        selector.value = 'en';
        aplicar('en');

        selector.addEventListener('change', () => {
            aplicar(selector.value);
        });
    }


    // Cada idioma tiene líneas de distinto largo: se recalcula cuánto tarda en escribirse cada una
    function recalcularTerminal() {
        const terminal = $('.reinicio-terminal');
        const blackout = $('.blackout');
        if (!terminal || !blackout) return;
        const POR_LETRA = 0.028, PAUSA = 0.32;
        let t = 1, largo = 0;
        // Los caracteres japoneses o chinos ocupan el ancho de dos letras en una fuente monoespaciada
        const ancho = texto => [...texto].reduce((suma, c) => suma + (/[　-鿿＀-￯]/.test(c) ? 2 : 1), 0);
        $$('.linea', terminal).forEach(linea => {
            const n = Math.max(1, ancho(linea.textContent));
            largo = Math.max(largo, n);
            linea.style.setProperty('--n', n);
            linea.style.setProperty('--d', `${t.toFixed(2)}s`);
            t += n * POR_LETRA + (n <= 3 ? PAUSA * 1.6 : PAUSA);
        });
        terminal.style.setProperty('--largo', largo);
        blackout.style.setProperty('--t1', `${(t + 1.6).toFixed(2)}s`);
        blackout.style.setProperty('--t2', `${(t + 12).toFixed(2)}s`);
    }


    /* 10. Carrusel de lujos */
    function s10_carrusel() {
        const car = $('.carrusel');
        const pila = $('.carrusel-pila', car || document);
        if (!car || !pila) return;

        const radios = $$('input[type="radio"][name="carrusel"]', car);
        const voltear = $$('input[type="checkbox"][id^="v"]', car);
        const total = radios.length;
        const actual = () => Math.max(0, radios.findIndex(r => r.checked));
        const cerrarTarjetas = () => voltear.forEach(v => { v.checked = false; });

        let usuarioInteractuo = false;
        let moviendoSolo = false;
        let visible = false;
        let reloj = null;

        const parar = () => { clearInterval(reloj); reloj = null; };

        const ir = (i, automatico = false) => {
            i = (i + total) % total;
            moviendoSolo = automatico;
            radios[i].checked = true;
            radios[i].dispatchEvent(new Event('change', { bubbles: true }));
            moviendoSolo = false;
        };

        // Al cambiar de tarjeta, ninguna queda volteada; si lo hizo la persona, se acaba el autoplay
        radios.forEach(r => r.addEventListener('change', () => {
            cerrarTarjetas();
            if (!moviendoSolo) { usuarioInteractuo = true; parar(); }
        }));

        // Teclado: flechas, inicio/fin y Enter/Espacio para voltear la tarjeta central
        pila.tabIndex = 0;
        pila.setAttribute('role', 'group');
        pila.setAttribute('aria-label', traducir('City luxuries: use the arrow keys to change cards'));
        pila.addEventListener('keydown', e => {
            const teclas = {
                ArrowRight: () => ir(actual() + 1), ArrowLeft: () => ir(actual() - 1),
                Home: () => ir(0), End: () => ir(total - 1),
                Enter: () => voltear[actual()].click(), ' ': () => voltear[actual()].click()
            };
            if (teclas[e.key]) { e.preventDefault(); teclas[e.key](); }
        });

        // Deslizar con el dedo o el mouse
        let x0 = null, arrastro = false;
        pila.addEventListener('pointerdown', e => { x0 = e.clientX; arrastro = false; pila.classList.add('arrastrando'); });
        addEventListener('pointerup', e => {
            if (x0 === null) return;
            const dx = e.clientX - x0;
            if (Math.abs(dx) > 40) { arrastro = true; ir(actual() + (dx < 0 ? 1 : -1)); }
            x0 = null;
            pila.classList.remove('arrastrando');
        });
        pila.addEventListener('click', e => { if (arrastro) { e.preventDefault(); e.stopPropagation(); arrastro = false; } }, true);

        // Autoplay suave: solo si está a la vista, sin tarjetas volteadas y hasta que la persona lo toque
        const reproducir = () => {
            if (!AJUSTES.AUTOPLAY_MS || reducirMovimiento || usuarioInteractuo || reloj) return;
            reloj = setInterval(() => {
                if (!visible || document.hidden || voltear.some(v => v.checked)) return;
                ir(actual() + 1, true);
            }, AJUSTES.AUTOPLAY_MS);
        };

        // Al alejarse del carrusel, la tarjeta abierta se cierra sola
        new IntersectionObserver(([en]) => {
            visible = en.intersectionRatio >= 0.4;
            if (en.intersectionRatio < 0.25) cerrarTarjetas();
        }, { threshold: [0, 0.25, 0.4] }).observe(car);

        car.addEventListener('pointerenter', parar);
        car.addEventListener('pointerleave', reproducir);
        car.addEventListener('focusin', parar);
        car.addEventListener('focusout', reproducir);
        reproducir();
    }


    /* 13. Monitoreo / zona de errores */
    function s13_caos() {
        const capas = $('.caos-capas');
        if (!capas) return;

        // Los avisos, ventanas y ojos aparecen "de la nada" cuando se llega a ellos
        const observador = new IntersectionObserver(entradas => {
            entradas.forEach(en => {
                if (!en.isIntersecting) return;
                en.target.classList.add('en-vista');
                observador.unobserve(en.target);
            });
        }, { rootMargin: '0px 0px -8% 0px' });

        [...capas.children].forEach(el => observador.observe(el));
    }


    /* 14. Pop-ups molestos
       Anuncio → (✕) "¿Cerrar todas?" en el mismo lugar → (OK) el primero se cierra;
       los demás reaparecen en otra parte junto con un anuncio extra.
       Cada pop-up se queda siempre dentro de su sección, también en celular. */
    function s14_popups() {
        const popups = $$('.popup');
        if (!popups.length) return;

        const M = AJUSTES.POPUP_MARGEN_PX;
        let capaSuperior = 30;

        // Coloca el anuncio extra pegado al pop-up, pero sin salirse de la sección
        const colocarExtra = (p, ancho, alto) => {
            const extra = $('.popup-extra', p);
            if (!extra || !p.querySelector('.pok:checked') || extra.classList.contains('cerrada')) return;
            const ew = extra.offsetWidth, eh = extra.offsetHeight;
            const x = limitar(p.offsetWidth * 0.18, M - p.offsetLeft, ancho - M - p.offsetLeft - ew);
            // Si no cabe abajo, sale por arriba
            let y = p.offsetHeight * 0.7;
            if (p.offsetTop + y + eh > alto - M) y = -eh * 0.7;
            y = limitar(y, M - p.offsetTop, alto - M - p.offsetTop - eh);
            Object.assign(extra.style, { left: `${x}px`, top: `${y}px` });
        };

        // Lleva el pop-up a otro lugar de su sección (o solo lo acomoda para que no se corte)
        const recolocar = (p, cambiarDeLugar = true) => {
            const seccion = p.offsetParent;
            if (!seccion) return;
            const ancho = seccion.clientWidth, alto = seccion.clientHeight;
            const w = p.offsetWidth, h = p.offsetHeight;
            const maxX = ancho - w - M, maxY = alto - h - M;
            let x = p.offsetLeft, y = p.offsetTop;

            if (cambiarDeLugar) {
                // Solo dentro de la parte de la sección que se ve en pantalla, para que no se pierda de vista
                const arriba = -seccion.getBoundingClientRect().top;
                const minY = limitar(arriba + M, M, maxY);
                const topeY = limitar(arriba + innerHeight - h - M, minY, maxY);
                // Busca un lugar claramente distinto al anterior
                const antes = { x, y };
                for (let i = 0; i < 8; i++) {
                    x = azar(M, maxX);
                    y = azar(minY, topeY);
                    if (Math.hypot(x - antes.x, y - antes.y) > Math.min(ancho, innerHeight) * 0.25) break;
                }
                p.style.setProperty('--giro', `${azar(-3, 3).toFixed(1)}deg`);
            }

            Object.assign(p.style, {
                left: `${limitar(x, M, Math.max(M, maxX))}px`,
                top: `${limitar(y, M, Math.max(M, maxY))}px`,
                right: 'auto',
                bottom: 'auto'
            });
            colocarExtra(p, ancho, alto);
        };

        const observador = new IntersectionObserver(entradas => {
            entradas.forEach(en => {
                if (!en.isIntersecting) return;
                const p = en.target;
                recolocar(p, false);
                setTimeout(() => p.classList.add('visible'), Math.random() * 450);
                observador.unobserve(p);
            });
        }, { rootMargin: '0px 0px -10% 0px' });

        popups.forEach(p => {
            observador.observe(p);
            p.addEventListener('pointerdown', () => { p.style.zIndex = String(++capaSuperior); });

            // ✕ y Cancelar: la confirmación aparece en el mismo lugar que el anuncio (solo se acomoda si no cabe)
            $('.px', p)?.addEventListener('change', () => recolocar(p, false));

            // OK: el primer pop-up solo se cierra; los demás desaparecen y vuelven en otra parte con dos anuncios más
            $('.pok', p)?.addEventListener('change', () => {
                if (!p.querySelector('.pok:checked')) return recolocar(p, false);
                if (p.classList.contains('popup-unico')) return p.classList.add('terminado');
                p.classList.add('saltando');   // desaparece de golpe…
                recolocar(p);
                void p.offsetWidth;
                setTimeout(() => p.classList.remove('saltando'), 60); // …y aparece en el lugar nuevo
            });

            // El premio y el anuncio extra se cierran cada uno por su lado; cada cierre puede generar 1 o 2 pop-ups más
            $$('.pop-premio .cerrar-circulo, .popup-extra .cerrar-circulo', p).forEach(x => {
                x.addEventListener('click', e => {
                    e.preventDefault();
                    x.closest('.pop-cara').classList.add('cerrada');
                    const quedan = $$('.pop-premio, .popup-extra', p).some(c => !c.classList.contains('cerrada'));
                    if (!quedan) p.classList.add('terminado');
                    quizasMultiplicar(p);
                });
            });
        });

        /* Pop-ups que se multiplican: al cerrar uno (menos el primero de la página) hay un 65 % de
           probabilidad de que aparezcan 1 o 2 más. Cada sección tiene un tope para no volverse infinita. */
        const PROBABILIDAD = 0.65, TOPE_POR_SECCION = 8;
        const generados = new Map();

        const quizasMultiplicar = origen => {
            const seccion = origen.closest('section');
            if (!seccion || Math.random() > PROBABILIDAD) return;
            const cantidad = Math.random() < 0.5 ? 1 : 2;
            for (let i = 0; i < cantidad; i++) {
                const ya = generados.get(seccion) || 0;
                if (ya >= TOPE_POR_SECCION) return;
                generados.set(seccion, ya + 1);
                setTimeout(() => crearPopup(seccion), 250 + i * 350);
            }
        };

        // Copia al azar una de las caras de los pop-ups de la página, ya traducida
        const crearPopup = seccion => {
            const modelos = $$('.popup:not(.popup-clon) :is(.pop-anuncio, .pop-premio, .popup-extra)');
            const cara = modelos[Math.floor(Math.random() * modelos.length)].cloneNode(true);
            cara.classList.remove('cerrada');
            $$('label[for]', cara).forEach(l => l.removeAttribute('for')); // no debe tocar los checkbox del original

            const nuevo = document.createElement('div');
            nuevo.className = 'popup popup-clon saltando';
            nuevo.appendChild(cara);
            seccion.appendChild(nuevo);
            nuevo.style.zIndex = String(++capaSuperior);
            popups.push(nuevo);

            recolocar(nuevo);
            nuevo.classList.add('visible');
            void nuevo.offsetWidth;
            setTimeout(() => nuevo.classList.remove('saltando'), 60);

            nuevo.addEventListener('pointerdown', () => { nuevo.style.zIndex = String(++capaSuperior); });
            $('.cerrar-circulo', nuevo)?.addEventListener('click', e => {
                e.preventDefault();
                nuevo.classList.add('terminado');
                quizasMultiplicar(nuevo);
            });
        };

        addEventListener('resize', porFrame(() => popups.forEach(p => recolocar(p, false))));
    }


    /* 15. Blackout y reinicio */
    function s15_blackout() {
        const pantalla = $('.pantalla-reinicio');
        const activar = $('.activar-reinicio');
        if (!pantalla) return;

        let viendoVacio = false, espera = null;
        const arrancar = () => poner('reiniciar', true); // una vez iniciado, ya no se detiene
        const programar = () => {
            clearTimeout(espera);
            if (viendoVacio && !activo('reiniciar')) espera = setTimeout(() => { if (viendoVacio) arrancar(); }, AJUSTES.REINICIO_MS);
        };

        // Tocar o hacer clic nunca lo apaga (el label alternaría el checkbox)
        if (activar) activar.addEventListener('click', e => { e.preventDefault(); arrancar(); });
        pantalla.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch' && viendoVacio) arrancar(); });

        // Al llegar al vacío, el reinicio arranca solo. En celular la barra del navegador cambia
        // el alto de la pantalla, así que basta con ver el 60 % o haber llegado al final de la página.
        new IntersectionObserver(([en]) => {
            viendoVacio = en.intersectionRatio >= 0.6;
            programar();
        }, { threshold: [0, 0.3, 0.6, 0.9, 1] }).observe(pantalla);

        addEventListener('scroll', porFrame(() => {
            const alFinal = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
            if (alFinal && !viendoVacio) { viendoVacio = true; programar(); }
        }), { passive: true });
    }


    /* 16. Overlays (escáner del chip y aviso final) */
    function s16_overlays() {
        const dialogos = [
            { el: $('.overlay-escaner'), abierto: () => activo('escaner-abierto') && !activo('chip-ok'), primero: '.cerrar-circulo' },
            { el: $('.overlay-aviso'), abierto: () => activo('desconectado') && !activo('apagado'), primero: '.aviso-acciones .boton' }
        ].filter(d => d.el);

        let previo = null;
        const enfocables = el => $$('[tabindex="0"], a[href], button', el).filter(n => n.offsetParent !== null && getComputedStyle(n).visibility !== 'hidden');

        // Al abrir: foco dentro del diálogo; al cerrar: foco de vuelta a donde estaba
        const sincronizarFoco = () => {
            const abierto = dialogos.find(d => d.abierto());
            if (abierto && !previo) {
                previo = document.activeElement;
                requestAnimationFrame(() => (enfocables(abierto.el).find(n => n.matches(abierto.primero)) || enfocables(abierto.el)[0])?.focus());
            } else if (!abierto && previo) {
                if (previo.isConnected && previo.offsetParent !== null) previo.focus();
                previo = null;
            }
        };
        ['escaner-abierto', 'desconectado', 'chip-ok', 'apagado'].forEach(id => estado(id)?.addEventListener('change', sincronizarFoco));

        // Tab se queda dentro del diálogo
        addEventListener('keydown', e => {
            const abierto = dialogos.find(d => d.abierto());
            if (!abierto || e.key !== 'Tab') return;
            const lista = enfocables(abierto.el);
            if (!lista.length) return;
            const primero = lista[0], ultimo = lista[lista.length - 1];
            if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
            else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
        });

        /* Escáner: Esc o clic fuera lo cierran (al reabrirlo, el análisis empieza de nuevo) */
        const cerrarEscaner = () => poner('escaner-abierto', false);
        addEventListener('keydown', e => { if (e.key === 'Escape' && dialogos[0] && dialogos[0].abierto()) cerrarEscaner(); });
        const escaner = $('.overlay-escaner');
        if (escaner) escaner.addEventListener('click', e => { if (e.target === escaner) cerrarEscaner(); });

        // Sin botón de "Analizar": se abre, analiza solo, deja leer los resultados y se cierra solo
        let temporizador = null;
        estado('escaner-abierto')?.addEventListener('change', () => {
            clearTimeout(temporizador);
            if (!activo('escaner-abierto') || activo('chip-ok')) return;
            temporizador = setTimeout(() => poner('chip-ok', true),
                AJUSTES.ESCANER_INICIO_MS + AJUSTES.ESCANER_MS + AJUSTES.LECTURA_MS);
        });

        estado('chip-ok')?.addEventListener('change', () => {
            if (!activo('chip-ok')) return;
            clearTimeout(temporizador);
            poner('escaner-abierto', false);
            window.scrollTo({ top: 0, behavior: reducirMovimiento ? 'auto' : 'smooth' });
        });
    }


    /* 20. Parallax (solo si el navegador no soporta animation-timeline) */
    function s20_parallax() {
        if (soportaTimeline || reducirMovimiento) return;

        const hero = $('.hero');
        const ondas = $('.capa-ondas');
        const escena = $('.hero-escena');
        const marcos = $$('.articulo-destacado .marco');
        const textos = $$('.articulo-destacado .articulo-texto');
        const anillos = $$('.deco-anillo');
        if (!hero) return;

        // 0 cuando el elemento entra por abajo, 1 cuando sale por arriba
        const progreso = el => {
            const r = el.getBoundingClientRect();
            return limitar((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
        };

        const actualizar = porFrame(() => {
            const r = hero.getBoundingClientRect();
            const p = limitar(-r.top / r.height, 0, 1);
            const angosta = innerWidth <= 1024; // en una columna la imagen taparía el botón
            if (ondas) ondas.style.transform = `translateY(${p * 90}vh) scale(${1 + p * 0.2})`;
            if (escena) {
                escena.style.transform = `translateY(${p * 60}vh)`;
                escena.style.opacity = p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65;
            }
            marcos.forEach(el => { el.style.transform = angosta ? '' : `translateY(${90 - 180 * progreso(el)}px)`; });
            textos.forEach(el => { el.style.transform = angosta ? '' : `translateY(${-30 + 60 * progreso(el)}px)`; });
            anillos.forEach(el => { el.style.transform = `translateY(-50%) rotate(${-40 + 80 * progreso(el)}deg)`; });
        });

        addEventListener('scroll', actualizar, { passive: true });
        addEventListener('resize', actualizar);
        actualizar();
    }


    /* 21. Final */
    function s21_final() {
        const pantallaFinal = $('.pantalla-final');
        if (!pantallaFinal) return;

        // Tocar la pantalla final reinicia de verdad (el enlace a #inicio solo movía el scroll)
        pantallaFinal.addEventListener('click', e => {
            e.preventDefault();
            history.replaceState(null, '', location.pathname + location.search);
            location.reload();
        });

        estado('apagado')?.addEventListener('change', () => {
            if (!activo('apagado')) return;
            document.title = traducir('Chip disconnected · SmartLife');
            requestAnimationFrame(() => pantallaFinal.focus());
        });
    }


    /* 22. Rendimiento y accesibilidad */
    function s22_extras() {
        // Los <label> que hacen de botón también se activan con Enter o Espacio
        const selector = 'label.boton, label.tapa-elegir, label.tapa-voltear, label.cerrar-circulo, .carrusel-puntos label, .menu-hamburguesa, .activar-reinicio';
        $$(selector).forEach(l => {
            if (!l.hasAttribute('tabindex')) l.tabIndex = 0;
            if (!l.hasAttribute('role')) l.setAttribute('role', 'button');
            l.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); l.click(); }
            });
        });

        // Las animaciones de la portada y de la zona de errores se pausan cuando no se ven
        const observador = new IntersectionObserver(entradas => {
            entradas.forEach(en => en.target.classList.toggle('fuera-de-vista', !en.isIntersecting));
        }, { rootMargin: '100px 0px' });
        ['.hero', '.monitoreo'].forEach(sel => { const el = $(sel); if (el) observador.observe(el); });
    }


    /* 23. Arranque */
    const modulos = [
        s4_estados, s8_idioma, s22_extras, s3_cabecera, s16_overlays, s5_ola, s5_bloqueo, s6_ojo,
        s10_carrusel, s13_caos, s14_popups, s15_blackout, s20_parallax, s21_final
    ];

    function iniciar() {
        // Si un módulo falla, los demás siguen funcionando
        modulos.forEach(modulo => {
            try { modulo(); } catch (err) { console.error('[SmartLife] falló', modulo.name, err); }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
