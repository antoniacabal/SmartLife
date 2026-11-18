/* INDICE DE SCRIPTS
   (la numeración coincide con la de style.css para que cada pieza sea fácil de ubicar)

    0. Utilidades y ajustes
    3. Header / Cabecera (menú móvil, enlace activo, ocultar al bajar)
    4. Bloqueo de scroll y estados (reinicio de checkboxes, inert, foco)
    6. Ojo (sigue el cursor)
   10. Carrusel de lujos (flechas, deslizar, autoplay)
   13. Monitoreo / zona de errores (aparece de a poco)
   14. Pop-ups molestos (aparecen al llegar, pasan al frente)
   15. Blackout y reinicio (arranca solo, sin depender del hover)
   16. Overlays (escáner y aviso: foco, Esc, auto-continuar)
   20. Parallax (respaldo para navegadores sin animation-timeline)
   21. Final (pantalla final y reinicio limpio)
   22. Rendimiento y accesibilidad (labels con teclado, pausa fuera de vista)
   23. Arranque

   El sitio sigue funcionando sin JavaScript (los estados viven en checkboxes y CSS).
   Este archivo solo agrega fluidez, teclado y rendimiento por encima.
*/

(() => {
    'use strict';

    /* 0. Utilidades y ajustes */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    const AJUSTES = {
        ESCANER_MS: 2600, // duración del análisis (igual que en el CSS, sección 16)
        AUTO_CONTINUAR_MS: 1800, // pausa tras "Chip verificado" antes de entrar solo (-1 = desactivar)
        AUTOPLAY_MS: 6000, // cambio automático del carrusel (0 = desactivar)
        REINICIO_MS: 900, // tiempo mirando el vacío antes de que arranque el reinicio
        OJO_REPOSO_MS: 3500, // sin mover el mouse, el ojo vuelve a vigilar solo
        HEADER_UMBRAL_PX: 8 // cuánto hay que desplazarse para ocultar/mostrar el header
    };

    const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const soportaTimeline = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()'));

    const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
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
        const cabecera = $('#cabecera-principal');
        const pie = $('#contacto');
        const resto = [$('.transicion-glitch'), $('.monitoreo'), $('.blackout')];

        marcar($('main'), modal);
        marcar(cabecera, modal || !verificado);
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
                my = limitar((e.clientY - cy) / (innerHeight / 2), -0.32, 1);
            }

            hero.classList.add('mirando');
            mirar(mx, my);

            clearTimeout(reposo);
            reposo = setTimeout(() => { hero.classList.remove('mirando'); mirar(0, 0); }, AJUSTES.OJO_REPOSO_MS);
        });

        addEventListener('pointermove', e => { if (e.pointerType !== 'touch') alMover(e); }, { passive: true });
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
            voltear.forEach(v => { v.checked = false; });
            if (!moviendoSolo) { usuarioInteractuo = true; parar(); }
        }));

        // Teclado: flechas, inicio/fin y Enter/Espacio para voltear la tarjeta central
        pila.tabIndex = 0;
        pila.setAttribute('role', 'group');
        pila.setAttribute('aria-label', 'Lujos de la ciudad: use las flechas para cambiar de tarjeta');
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

        new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.4 }).observe(car);
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


    /* 14. Pop-ups molestos */
    function s14_popups() {
        const popups = $$('.popup');
        if (!popups.length) return;

        let capaSuperior = 30;
        const observador = new IntersectionObserver(entradas => {
            entradas.forEach(en => {
                if (!en.isIntersecting) return;
                const popup = en.target;
                setTimeout(() => popup.classList.add('visible'), Math.random() * 450);
                observador.unobserve(popup);
            });
        }, { rootMargin: '0px 0px -10% 0px' });

        popups.forEach(p => {
            observador.observe(p);
            p.addEventListener('pointerdown', () => { p.style.zIndex = String(++capaSuperior); });
        });
    }


    /* 15. Blackout y reinicio */
    function s15_blackout() {
        const pantalla = $('.pantalla-reinicio');
        const activar = $('.activar-reinicio');
        if (!pantalla) return;

        const arrancar = () => poner('reiniciar', true); // una vez iniciado, ya no se detiene

        // Tocar o hacer clic nunca lo apaga (el label alternaría el checkbox)
        if (activar) activar.addEventListener('click', e => { e.preventDefault(); arrancar(); });
        pantalla.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch' && viendoVacio) arrancar(); });

        // Si la persona llega al vacío y se queda mirándolo, el reinicio arranca solo (también en móvil)
        let viendoVacio = false, espera = null;
        new IntersectionObserver(([en]) => {
            viendoVacio = en.intersectionRatio >= 0.9;
            clearTimeout(espera);
            if (viendoVacio && !activo('reiniciar')) espera = setTimeout(() => { if (viendoVacio) arrancar(); }, AJUSTES.REINICIO_MS);
        }, { threshold: [0, 0.5, 0.9, 1] }).observe(pantalla);
    }


    /* 16. Overlays (escáner del chip y aviso final) */
    function s16_overlays() {
        const dialogos = [
            { el: $('.overlay-escaner'), abierto: () => activo('escaner-abierto') && !activo('chip-ok'), primero: '.boton-analizar' },
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

        /* Escáner: Esc o clic fuera lo cierran y el análisis se reinicia */
        const cerrarEscaner = () => { poner('escaner-abierto', false); poner('analizar', false); };
        addEventListener('keydown', e => { if (e.key === 'Escape' && dialogos[0] && dialogos[0].abierto()) cerrarEscaner(); });
        const escaner = $('.overlay-escaner');
        if (escaner) escaner.addEventListener('click', e => { if (e.target === escaner) cerrarEscaner(); });

        // Al terminar el análisis, entra solo (o con el botón) y vuelve al inicio
        let temporizador = null;
        estado('analizar')?.addEventListener('change', () => {
            clearTimeout(temporizador);
            if (!activo('analizar') || AJUSTES.AUTO_CONTINUAR_MS < 0) return;
            temporizador = setTimeout(() => {
                if (activo('analizar') && !activo('chip-ok')) poner('chip-ok', true);
            }, AJUSTES.ESCANER_MS + AJUSTES.AUTO_CONTINUAR_MS);
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
            if (ondas) ondas.style.transform = `translateY(${p * 90}vh) scale(${1 + p * 0.2})`;
            if (escena) {
                escena.style.transform = `translateY(${p * 60}vh)`;
                escena.style.opacity = p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65;
            }
            marcos.forEach(el => { el.style.transform = `translateY(${90 - 180 * progreso(el)}px)`; });
            textos.forEach(el => { el.style.transform = `translateY(${-30 + 60 * progreso(el)}px)`; });
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
            document.title = 'Chip desconectado · SmartLife';
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
        s4_estados, s22_extras, s3_cabecera, s16_overlays, s6_ojo, s10_carrusel,
        s13_caos, s14_popups, s15_blackout, s20_parallax, s21_final
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