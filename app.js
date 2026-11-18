/* App de formularios — Solicitud de estudios cardiológicos.
   Esta app solo ENVÍA solicitudes. No tiene forma de leer datos de pacientes. */
(function () {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const $app = document.getElementById('app');
  const MAX_BYTES = 8 * 1024 * 1024;

  const ESTUDIOS = ['Ecocardiograma', 'Monitoreo Holter', 'Interconsulta', 'Evaluación preoperatoria',
    'Prueba de esfuerzo', 'Ecocardiograma transesofágico', 'Resonancia magnética cardiaca'];
  const PRIORIDADES = ['I. Emergencia', 'II. Urgencia', 'III. A demanda'];
  const SEXOS = ['Femenino', 'Masculino'];

  const AREAS = [
    { clave: 'hospitalizacion', nombre: 'Hospitalización', servicios: ['Medicina Mujeres 1', 'Medicina Mujeres 2', 'Medicina Mujeres 3',
      'Medicina Hombres 1', 'Medicina Hombres 2', 'Medicina Hombres 3', 'Servicio de Aislados', 'Cuidados Paliativos'] },
    { clave: 'intermedios', nombre: 'Cuidados intermedios', servicios: ['Cuidados Intermedios Agudos', 'Cuidados Intermedios Crónicos', 'Cuidados Intermedios Aislados'] },
    { clave: 'intensivos', nombre: 'Cuidados intensivos', servicios: ['UNIDAD DE CUIDADOS CORONARIOS Y POSTQUIRÚRGICOS CARDIOVASCULARES',
      'UNIDAD DE CUIDADOS INTENSIVOS GENERAL ADULTO', 'UNIDAD DE CUIDADOS INTENSIVOS CARDIOVASCULAR', 'UNIDAD DE CUIDADOS INTENSIVOS QUIRÚRGICOS',
      'UNIDAD DE CUIDADOS INTENSIVOS EXTRACORPÓREA', 'UNIDAD DE CUIDADOS INTENSIVOS AISLADOS', 'UNIDAD DE CUIDADOS NEUROINTENSIVOS'] },
    { clave: 'cardio_cxcv', nombre: 'Cardiología y cirugía cardiovascular', servicios: ['Cardiología', 'Cirugía Cardiovascular'] },
    { clave: 'hemato_onco', nombre: 'Hematología / Oncología', servicios: ['Hematología', 'Oncología'] },
    { clave: 'cirugia', nombre: 'Cirugía general', servicios: ['Cirugía Mujeres', 'Cirugía Hombres', 'Neurocirugía'] },
    { clave: 'emergencia', nombre: 'Emergencia', servicios: [] }
  ];

  // En Emergencia solo estos campos son obligatorios (debe coincidir con la API).
  const OBLIGATORIOS_EMERGENCIA = ['nombre', 'expediente', 'edad', 'sexo'];
  // Preguntas que NO aparecen en el formulario de cada área (debe coincidir con la API de formularios).
  const CAMPOS_QUITADOS = {
    intensivos: ['fecha_nacimiento', 'historia', 'presion'],
    intermedios: ['fecha_nacimiento', 'historia', 'presion'],
    emergencia: ['servicio']
  };
  const NOMBRES_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

  const CAMPOS = [
    { k: 'estudio', t: 'Estudio solicitado', tipo: 'radio', op: ESTUDIOS, ancho: true },
    { k: 'prioridad', t: 'Prioridad', tipo: 'radio', op: PRIORIDADES, ancho: true },
    { k: 'nombre', t: 'Nombre del paciente', tipo: 'texto', max: 120, ancho: true },
    { k: 'expediente', t: 'Expediente', tipo: 'expediente', ayuda: 'Número y año, por ejemplo 1234 - 26' },
    { k: 'edad', t: 'Edad', tipo: 'numero', max: 3, sufijo: 'años' },
    { k: 'sexo', t: 'Sexo', tipo: 'radio', op: SEXOS },
    { k: 'servicio', t: 'Servicio', tipo: 'select' },
    { k: 'cama', t: '# de cama', tipo: 'texto', max: 20 },
    { k: 'diagnostico', t: 'Diagnóstico', tipo: 'area', ancho: true },
    { k: 'motivo', t: 'Motivo del estudio', tipo: 'area', ancho: true },
    { k: 'historia', t: 'Historia clínica relevante', tipo: 'area', ancho: true },
    { k: 'ekg', t: 'EKG', tipo: 'archivo' },
    { k: 'rx', t: 'Rx de tórax', tipo: 'archivo' },
    { k: 'fecha_nacimiento', t: 'Fecha de nacimiento del paciente', tipo: 'fecha', ayuda: 'Día / mes / año' },
    { k: 'peso', t: 'Peso del paciente', tipo: 'decimal', max: 5, sufijo: 'kg' },
    { k: 'altura', t: 'Altura del paciente', tipo: 'decimal', max: 5, sufijo: 'cm', ayuda: 'En centímetros, por ejemplo 165' },
    { k: 'presion', t: 'Presión arterial del paciente', tipo: 'presion', ayuda: 'Sistólica / diastólica (mmHg)' },
    { k: 'medico', t: 'Médico que solicita el estudio', tipo: 'texto', max: 120 },
    { k: 'contacto', t: 'Número de contacto de quien solicita', tipo: 'telefono', ayuda: '8 dígitos' }
  ];

  const E = { estado: null, errorEstado: '', cargando: false, form: null, temporizador: null, instalar: null };

  /* ---------- utilidades ---------- */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    const a = attrs || {};
    Object.keys(a).forEach(function (k) {
      const v = a[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    for (let i = 2; i < arguments.length; i++) agregar(el, arguments[i]);
    return el;
  }
  function agregar(el, hijo) {
    if (hijo === null || hijo === undefined || hijo === false) return;
    if (Array.isArray(hijo)) hijo.forEach(function (x) { agregar(el, x); });
    else el.appendChild(hijo.nodeType ? hijo : document.createTextNode(String(hijo)));
  }
  function hora12(hhmm) {
    const p = String(hhmm || '').split(':');
    const hNum = Number(p[0]);
    return ((hNum % 12) || 12) + ':' + p[1] + (hNum < 12 ? ' a. m.' : ' p. m.');
  }
  function tamano(bytes) { return bytes < 1048576 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB'; }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }
  function recordar(k, v) {
    try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ }
    return '';
  }

  async function api(action, datos) {
    if (!CFG.API_URL || /PEGAR_AQUI/.test(CFG.API_URL)) {
      const e0 = new Error('La app aún no está conectada. Falta pegar la dirección de la API en el archivo config.js.');
      e0.code = 'CONFIG';
      throw e0;
    }
    let res;
    try {
      res = await fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action: action }, datos || {})) });
    } catch (e) {
      const e1 = new Error('No hay conexión con el servidor. Revise su internet e intente de nuevo.');
      e1.code = 'RED';
      throw e1;
    }
    let j;
    try { j = await res.json(); } catch (e) {
      const e2 = new Error('El servidor respondió de forma inesperada. Intente de nuevo en un momento.');
      e2.code = 'RED';
      throw e2;
    }
    if (!j.ok) { const e3 = new Error(j.error || 'Ocurrió un error.'); e3.code = j.code; throw e3; }
    return j.data;
  }

  /* ---------- estado de los formularios ---------- */
  async function cargarEstado(silencioso) {
    if (E.cargando) return;
    E.cargando = true;
    if (!silencioso) pintar();
    try {
      E.estado = await api('estado');
      E.errorEstado = '';
    } catch (e) {
      E.errorEstado = e.message;
    }
    E.cargando = false;
    if (!E.form || !E.form.sucio) pintar();
  }
  function estadoDe(clave) {
    return E.estado ? E.estado.areas.filter(function (a) { return a.clave === clave; })[0] : null;
  }
  // Por decisión del servicio, la app no muestra cupos disponibles ni hora de cierre: solo la hora de apertura.
  function textoEstado(a) {
    if (!a.abierto) return mensajeCerrado(a);
    if (a.cupo_extra) return 'Cupo extra habilitado por Cardiología';
    return 'Abierto desde las ' + hora12(a.hora_abre);
  }
  /** "mañana", "el lunes"… según los días en que abre el formulario (1 = lunes … 7 = domingo). */
  function proximoDia(a) {
    const p = String((E.estado && E.estado.fecha) || '').split('-');
    if (p.length !== 3 || !a.dias || !a.dias.length) return '';
    const hoy = (new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]))).getUTCDay() + 6) % 7 + 1;
    for (let k = 1; k <= 7; k++) {
      const d = (hoy - 1 + k) % 7 + 1;
      if (a.dias.indexOf(d) >= 0) return k === 1 ? 'mañana' : (k === 7 ? 'el próximo ' : 'el ') + NOMBRES_DIA[d - 1];
    }
    return '';
  }
  function mensajeCerrado(a) {
    const m = String(a.motivo || '');
    const dia = proximoDia(a);
    const reabre = dia ? ', se apertura de nuevo ' + dia + ' a las ' + hora12(a.hora_abre) : '';
    if (/^abre a las/.test(m)) return 'Formulario cerrado, se apertura hoy a las ' + hora12(a.hora_abre);
    if (/^cupos agotados|^cerró a las/.test(m)) return 'Formulario cerrado, se ha alcanzado el límite de cupos o excedido el límite horario' + reabre;
    if (/^cerrado hoy/.test(m)) {
      const porque = /\((.*)\)/.exec(m);
      return 'Formulario cerrado hoy' + (porque ? ' (' + porque[1] + ')' : '') + reabre;
    }
    if (/^hoy no se reciben/.test(m)) return 'Formulario cerrado hoy' + reabre;
    return 'Formulario cerrado temporalmente';
  }

  /* ---------- pantallas ---------- */
  function barra(titulo, sub, volver) {
    return h('header', { class: 'barra' }, h('div', { class: 'barra-int' },
      volver ? h('button', { class: 'btn-barra', onclick: volver, 'aria-label': 'Volver al inicio' }, '‹ Inicio')
        : h('img', { class: 'logo', src: 'icons/icon-192.png', alt: '' }),
      h('h1', null, titulo, sub ? h('small', null, sub) : null),
      E.instalar && !volver ? h('button', { class: 'btn-barra', onclick: instalarApp }, 'Instalar') : null));
  }

  function pintar() {
    const ruta = location.hash.replace(/^#\/?/, '');
    const m = /^a\/([a-z_]+)$/.exec(ruta);
    const area = m ? AREAS.filter(function (a) { return a.clave === m[1]; })[0] : null;
    $app.textContent = '';
    if (area) pintarFormulario(area); else pintarInicio();
  }

  function pintarInicio() {
    E.form = null;
    const lista = h('div', { class: 'modulos' });
    AREAS.forEach(function (area) {
      const a = estadoDe(area.clave);
      if (!a) {
        lista.appendChild(E.errorEstado
          ? h('a', { class: 'modulo', href: '#/a/' + area.clave }, h('div', { class: 'cuerpo' }, h('div', { class: 'nombre' }, area.nombre)), h('span', { class: 'flecha' }, '›'))
          : h('div', { class: 'esqueleto' }));
        return;
      }
      lista.appendChild(h('a', { class: 'modulo' + (a.abierto ? '' : ' cerrado'), href: '#/a/' + area.clave, style: 'text-decoration:none;color:inherit' },
        h('div', { class: 'cuerpo' },
          h('div', { class: 'nombre' }, area.nombre),
          h('div', { class: 'detalle' }, textoEstado(a))),
        h('span', { class: 'pastilla ' + (a.abierto ? (a.cupo_extra ? 'extra' : 'abierto') : 'cerrado') }, a.abierto ? 'Abierto' : 'Cerrado'),
        h('span', { class: 'flecha', 'aria-hidden': 'true' }, '›')));
    });
    $app.appendChild(barra('Cardiología', 'Solicitud de estudios'));
    $app.appendChild(h('main', { class: 'contenido' },
      h('section', { class: 'leyenda' },
        h('h2', null, 'FORMULARIO PARA SOLICITUD DE ESTUDIO CARDIOLOGICO'),
        h('p', null, 'Los estudios pueden ser solicitados de Lunes a Viernes en Horario de 6am a 12pm')),
      E.errorEstado ? h('div', { class: 'aviso error', role: 'alert' }, h('strong', null, 'No se pudo consultar la disponibilidad'), E.errorEstado) : null,
      h('div', { class: 'fila-estado' },
        h('h3', null, 'Seleccione el área que solicita'),
        h('button', { class: 'enlace', onclick: function () { cargarEstado(); } }, E.cargando ? 'Actualizando…' : 'Actualizar')),
      lista,
      h('p', { class: 'pie' }, 'Servicio de Cardiología · Los datos se envían de forma directa al servicio y no se guardan en este dispositivo.')));
  }

  function pintarFormulario(area) {
    const a = estadoDe(area.clave);
    const volver = function () {
      if (E.form && E.form.sucio && !confirm('Se perderán los datos escritos. ¿Volver al inicio?')) return;
      E.form = null;
      location.hash = '#/';
    };
    $app.appendChild(barra(area.nombre, 'Solicitud de estudio cardiológico', volver));
    const main = h('main', { class: 'contenido' });
    $app.appendChild(main);

    if (!a) {
      main.appendChild(E.errorEstado
        ? h('div', { class: 'aviso error', role: 'alert' }, h('strong', null, 'No se pudo consultar la disponibilidad'), E.errorEstado,
          h('div', { class: 'acciones' }, h('button', { class: 'btn', onclick: function () { cargarEstado(); } }, 'Reintentar')))
        : h('div', { class: 'esqueleto' }));
      return;
    }
    // Si esta persona acaba de enviar (aunque con su envío se hayan agotado los cupos), se le sigue mostrando su confirmación.
    if (E.form && E.form.area === area.clave && E.form.enviado) { pintarExito(main, area); return; }
    if (!a.abierto) {
      main.appendChild(h('div', { class: 'tarjeta' },
        h('div', { class: 'encabezado-form' }, h('h2', null, area.nombre), h('span', { class: 'pastilla cerrado' }, 'Cerrado')),
        h('div', { class: 'aviso alerta' }, mensajeCerrado(a).replace(/([^.])$/, '$1.')),
        h('p', { class: 'nota-oblig' }, 'Si el caso no puede esperar, comuníquese con el Servicio de Cardiología para que habiliten un cupo extra.'),
        h('div', { class: 'acciones' },
          h('button', { class: 'btn', onclick: volver }, 'Volver al inicio'),
          h('button', { class: 'btn primario', onclick: function () { cargarEstado(); } }, 'Actualizar'))));
      return;
    }

    if (!E.form || E.form.area !== area.clave) {
      E.form = { area: area.clave, valores: {}, archivos: {}, errores: {}, sucio: false, idCliente: uuid(), codigo: recordar('codigo_' + area.clave), enviado: null };
    }
    if (E.form.enviado) { pintarExito(main, area); return; }
    main.appendChild(construirFormulario(area, a));
  }

  /* ---------- formulario ---------- */
  function obligatorio(area, k) {
    return area.clave !== 'emergencia' || OBLIGATORIOS_EMERGENCIA.indexOf(k) >= 0;
  }

  function construirFormulario(area, a) {
    const F = E.form;
    const quitados = CAMPOS_QUITADOS[area.clave] || [];
    const campos = CAMPOS.filter(function (c) { return quitados.indexOf(c.k) < 0; });
    const rejilla = h('div', { class: 'rejilla' });
    const cajaError = h('div');

    if (a.requiere_codigo) {
      rejilla.appendChild(h('div', { class: 'campo ancho', id: 'campo-codigo' },
        h('label', { for: 'in-codigo' }, 'Código de acceso del área'),
        h('input', { id: 'in-codigo', type: 'text', autocomplete: 'off', maxlength: 20, value: F.codigo,
          oninput: function (ev) { F.codigo = ev.target.value.trim(); } }),
        h('div', { class: 'ayuda' }, 'Lo proporciona el Servicio de Cardiología.')));
    }
    campos.forEach(function (c, i) {
      rejilla.appendChild(construirCampo(c, i + 1, area));
    });

    const btn = h('button', { class: 'btn primario grande', type: 'submit' }, 'Enviar solicitud');
    return h('form', { novalidate: true, autocomplete: 'off', onsubmit: function (ev) { ev.preventDefault(); enviar(area, campos, cajaError, btn); } },
      h('div', { class: 'tarjeta' },
        h('div', { class: 'encabezado-form' }, h('h2', null, area.nombre),
          h('span', { class: 'pastilla ' + (a.cupo_extra ? 'extra' : 'abierto') }, textoEstado(a))),
        h('p', { class: 'nota-oblig' }, area.clave === 'emergencia'
          ? 'En Emergencia solo son obligatorias las preguntas sin la marca "opcional".'
          : 'Todas las preguntas son obligatorias.'),
        rejilla),
      cajaError,
      btn);
  }

  function marcarSucio() { if (E.form) E.form.sucio = true; }

  function soloDigitos(el, max) {
    const v = el.value.replace(/\D/g, '').slice(0, max);
    if (v !== el.value) el.value = v;
    return v;
  }

  function construirCampo(c, n, area) {
    const F = E.form;
    const id = 'in-' + c.k;
    const opcional = !obligatorio(area, c.k);
    const etiqueta = [h('span', { class: 'num' }, n + '.'), c.t, opcional ? h('span', { class: 'opc' }, ' (opcional)') : null];
    const msg = h('div', { class: 'msg', id: 'msg-' + c.k, role: 'alert' });
    const caja = h('div', { class: 'campo' + (c.ancho ? ' ancho' : ''), id: 'campo-' + c.k });
    const poner = function (v) { F.valores[c.k] = v; marcarSucio(); limpiarError(c.k); };
    let control;

    if (c.tipo === 'radio') {
      const clase = c.k === 'prioridad' ? 'tres' : (c.op.length === 2 ? 'dos' : 'varias');
      control = h('div', { class: 'opciones ' + clase, role: 'radiogroup', 'aria-labelledby': 'etq-' + c.k },
        c.op.map(function (o, i) {
          return h('label', { class: 'opcion' + (c.k === 'prioridad' ? ' p' + (i + 1) : '') },
            h('input', { type: 'radio', name: c.k, value: o, checked: F.valores[c.k] === o, onchange: function () { poner(o); } }), o);
        }));
      agregar(caja, [h('div', { class: 'etq', id: 'etq-' + c.k }, etiqueta), control]);
    } else if (c.tipo === 'select') {
      control = h('select', { id: id, onchange: function (ev) { poner(ev.target.value); } },
        h('option', { value: '' }, 'Seleccione…'),
        area.servicios.map(function (s) { return h('option', { value: s, selected: F.valores[c.k] === s }, s); }));
      agregar(caja, [h('label', { for: id }, etiqueta), control]);
    } else if (c.tipo === 'area') {
      control = h('textarea', { id: id, maxlength: 2000, rows: 3, oninput: function (ev) { poner(ev.target.value); } }, F.valores[c.k] || '');
      agregar(caja, [h('label', { for: id }, etiqueta), control]);
    } else if (c.tipo === 'texto') {
      control = h('input', { id: id, type: 'text', maxlength: c.max, value: F.valores[c.k] || '', autocapitalize: c.k === 'cama' ? 'characters' : 'words',
        oninput: function (ev) { poner(ev.target.value); } });
      agregar(caja, [h('label', { for: id }, etiqueta), control]);
    } else if (c.tipo === 'numero' || c.tipo === 'decimal' || c.tipo === 'telefono') {
      // Sin "maxlength": el filtro de abajo recorta, y así se puede pegar un número con espacios o guiones.
      control = h('input', { id: id, type: 'text', inputmode: c.tipo === 'decimal' ? 'decimal' : 'numeric', value: F.valores[c.k] || '',
        placeholder: c.tipo === 'telefono' ? '0000-0000' : '',
        oninput: function (ev) {
          const el = ev.target;
          let v;
          if (c.tipo === 'decimal') {
            v = el.value.replace(',', '.').replace(/[^\d.]/g, '');
            const p = v.split('.');
            v = p[0].slice(0, 3) + (p.length > 1 ? '.' + p[1].slice(0, 1) : '');
          } else if (c.tipo === 'telefono') {
            const d = el.value.replace(/\D/g, '').slice(0, 8);
            v = d.length > 4 ? d.slice(0, 4) + '-' + d.slice(4) : d;
          } else {
            v = el.value.replace(/\D/g, '').slice(0, c.max);
          }
          if (v !== el.value) el.value = v;
          poner(v);
        } });
      agregar(caja, [h('label', { for: id }, etiqueta),
        c.sufijo ? h('div', { class: 'con-sufijo' }, control, h('span', null, c.sufijo)) : control]);
    } else if (c.tipo === 'expediente' || c.tipo === 'fecha' || c.tipo === 'presion') {
      const def = { expediente: { partes: [6, 2], sep: '–', une: '-', ph: ['Número', 'Año'], aria: ['Número de expediente', 'Año del expediente (2 dígitos)'] },
        fecha: { partes: [2, 2, 4], sep: '/', une: '/', ph: ['DD', 'MM', 'AAAA'], aria: ['Día', 'Mes', 'Año'] },
        presion: { partes: [3, 3], sep: '/', une: '/', ph: ['Sist.', 'Diast.'], aria: ['Presión sistólica', 'Presión diastólica'] } }[c.tipo];
      const previo = String(F.valores[c.k] || '').split(def.une);
      const entradas = [];
      const actualizar = function () {
        const partes = entradas.map(function (x) { return x.value; });
        poner(partes.some(Boolean) ? partes.join(def.une) : '');
      };
      def.partes.forEach(function (largo, i) {
        const inp = h('input', { type: 'text', inputmode: 'numeric', maxlength: largo, class: 'seg-' + largo, placeholder: def.ph[i],
          'aria-label': def.aria[i], id: i === 0 ? id : null, value: previo[i] || '',
          oninput: function (ev) {
            const v = soloDigitos(ev.target, largo);
            actualizar();
            const completo = c.tipo === 'expediente' && i === 0 ? false : v.length === largo;
            if (completo && entradas[i + 1]) entradas[i + 1].focus();
          },
          onkeydown: function (ev) {
            if ((ev.key === '/' || ev.key === '-' || ev.key === ' ') && entradas[i + 1]) { ev.preventDefault(); if (ev.target.value) entradas[i + 1].focus(); }
            if (ev.key === 'Backspace' && !ev.target.value && entradas[i - 1]) entradas[i - 1].focus();
          } });
        entradas.push(inp);
      });
      const grupo = h('div', { class: 'segmentos', role: 'group', 'aria-labelledby': 'etq-' + c.k });
      entradas.forEach(function (inp, i) { if (i) grupo.appendChild(h('span', { class: 'sep', 'aria-hidden': 'true' }, def.sep)); grupo.appendChild(inp); });
      agregar(caja, [h('div', { class: 'etq', id: 'etq-' + c.k }, etiqueta), grupo]);
    } else if (c.tipo === 'archivo') {
      const zona = h('div', { class: 'zona' });
      const pintarZona = function () {
        zona.textContent = '';
        const arch = F.archivos[c.k];
        const entrada = h('input', { type: 'file', id: id, accept: '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf',
          onchange: async function (ev) {
            const f = ev.target.files && ev.target.files[0];
            if (!f) return;
            limpiarError(c.k);
            zona.textContent = 'Preparando archivo…';
            try { F.archivos[c.k] = await prepararArchivo(f); marcarSucio(); } catch (e) { delete F.archivos[c.k]; ponerError(c.k, e.message); }
            pintarZona();
          } });
        if (arch) {
          const editar = arch.vista ? h('button', { type: 'button', class: 'btn', onclick: async function () {
            const r = await abrirEditor(arch, c.t);
            if (!r) return;
            Object.assign(arch, r);
            marcarSucio();
            pintarZona();
          } }, 'Editar') : null;
          agregar(zona, [
            arch.vista ? h('img', { class: 'mini', src: arch.vista, alt: 'Vista previa' }) : h('div', { class: 'mini' }, 'PDF'),
            h('div', { class: 'info' }, h('b', null, arch.nombre), h('span', null, tamano(arch.blob.size) + (arch.editada ? ' · editada' : ''))),
            h('div', { class: 'botones-archivo' }, editar, h('label', { class: 'btn', for: id }, 'Cambiar')), entrada]);
        } else {
          agregar(zona, [h('div', { class: 'info' }, h('b', null, 'Ningún archivo seleccionado'), h('span', null, 'JPG, JPEG, PNG o PDF · máximo 8 MB')),
            h('label', { class: 'btn', for: id }, 'Cargar archivo'), entrada]);
        }
      };
      pintarZona();
      agregar(caja, [h('div', { class: 'etq' }, etiqueta), zona]);
    }
    if (c.ayuda) caja.appendChild(h('div', { class: 'ayuda' }, c.ayuda));
    caja.appendChild(msg);
    if (F.errores[c.k]) { caja.classList.add('mal'); msg.textContent = F.errores[c.k]; }
    return caja;
  }

  function ponerError(k, texto) {
    if (E.form) E.form.errores[k] = texto;
    const caja = document.getElementById('campo-' + k), msg = document.getElementById('msg-' + k);
    if (caja) caja.classList.add('mal');
    if (msg) msg.textContent = texto;
  }
  function limpiarError(k) {
    if (E.form) delete E.form.errores[k];
    const caja = document.getElementById('campo-' + k), msg = document.getElementById('msg-' + k);
    if (caja) caja.classList.remove('mal');
    if (msg) msg.textContent = '';
    actualizarResumen();
  }
  /** Mantiene al día el aviso "Faltan N preguntas" mientras la persona corrige. */
  function actualizarResumen() {
    const resumen = document.getElementById('resumen-errores');
    if (!resumen || !E.form) return;
    const n = Object.keys(E.form.errores).length;
    if (!n) { resumen.remove(); return; }
    resumen.firstChild.textContent = n === 1 ? 'Falta 1 pregunta por corregir' : 'Faltan ' + n + ' preguntas por corregir';
  }

  /* ---------- archivos ---------- */
  function leerDataUrl(blob) {
    return new Promise(function (ok, mal) {
      const r = new FileReader();
      r.onload = function () { ok(String(r.result)); };
      r.onerror = function () { mal(new Error('No se pudo leer el archivo.')); };
      r.readAsDataURL(blob);
    });
  }
  function cargarImagen(url) {
    return new Promise(function (ok, mal) {
      const img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { mal(new Error('No se pudo abrir la imagen. Pruebe con otra foto.')); };
      img.src = url;
    });
  }
  /** Valida el tipo y reduce las fotos grandes para que el envío sea rápido con mala conexión. */
  async function prepararArchivo(file) {
    const nombre = file.name || 'archivo';
    const ext = (nombre.split('.').pop() || '').toLowerCase();
    const esPdf = file.type === 'application/pdf' || ext === 'pdf';
    const esImg = /^image\/(jpeg|png)$/.test(file.type) || ['jpg', 'jpeg', 'png'].indexOf(ext) >= 0;
    if (!esPdf && !esImg) throw new Error('Formato no permitido. Use JPG, JPEG, PNG o PDF.');
    if (esPdf) {
      if (file.size > MAX_BYTES) throw new Error('El PDF pesa ' + tamano(file.size) + '. El máximo es 8 MB.');
      return { blob: file, nombre: nombre, vista: '' };
    }
    const url = URL.createObjectURL(file);
    let blob = file;
    try {
      const img = await cargarImagen(url);
      const LADO = 2200;
      const escala = Math.min(1, LADO / Math.max(img.naturalWidth, img.naturalHeight));
      if (escala < 1 || file.size > 700 * 1024) {
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(img.naturalWidth * escala);
        lienzo.height = Math.round(img.naturalHeight * escala);
        const g = lienzo.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, lienzo.width, lienzo.height);
        g.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        const reducido = await new Promise(function (ok) { lienzo.toBlob(ok, 'image/jpeg', 0.85); });
        if (reducido && reducido.size < file.size) blob = reducido;
      }
    } finally {
      URL.revokeObjectURL(url);
    }
    if (blob.size > MAX_BYTES) throw new Error('La imagen pesa ' + tamano(blob.size) + '. El máximo es 8 MB.');
    // "original" se conserva para que cada edición parta de la foto sin pérdidas acumuladas.
    return { blob: blob, nombre: nombre, vista: await leerDataUrl(blob), original: blob, edicion: { giro: 0, recorte: null }, editada: false };
  }

  /* ---------- editor de imagen: girar y recortar ---------- */
  const RECORTE_COMPLETO = { x: 0, y: 0, w: 1, h: 1 };
  const RECORTE_MIN = 0.08; // el recorte no puede ser menor que el 8 % del lado

  /** Gira el rectángulo de recorte (coordenadas de 0 a 1) junto con la imagen. */
  function girarRecorte(r, sentido) {
    return sentido > 0 ? { x: 1 - (r.y + r.h), y: r.x, w: r.h, h: r.w } : { x: r.y, y: 1 - (r.x + r.w), w: r.h, h: r.w };
  }

  /** Dibuja la imagen girada "giro" cuartos de vuelta (horario) en un lienzo de ancho x alto. */
  function dibujarGirada(g, img, giro, ancho, alto) {
    g.save();
    g.fillStyle = '#fff';
    g.fillRect(0, 0, ancho, alto);
    g.translate(ancho / 2, alto / 2);
    g.rotate(giro * Math.PI / 2);
    const impar = giro % 2 === 1;
    const w = impar ? alto : ancho, hh = impar ? ancho : alto;
    g.drawImage(img, -w / 2, -hh / 2, w, hh);
    g.restore();
  }

  /** Abre el editor. Devuelve una promesa con {blob, vista, edicion, editada} o null si se cancela. */
  function abrirEditor(arch, titulo) {
    return new Promise(async function (resolver) {
      const url = URL.createObjectURL(arch.original || arch.blob);
      let img;
      try { img = await cargarImagen(url); } catch (e) { URL.revokeObjectURL(url); alert(e.message); resolver(null); return; }
      let giro = arch.edicion ? arch.edicion.giro : 0;
      let rec = Object.assign({}, (arch.edicion && arch.edicion.recorte) || RECORTE_COMPLETO);

      const lienzo = h('canvas', { class: 'ed-lienzo', 'aria-label': 'Imagen a editar' });
      const caja = h('div', { class: 'ed-recorte', 'data-modo': 'mover', 'aria-label': 'Área de recorte. Arrástrela para moverla.' },
        ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].map(function (m) { return h('span', { class: 'ed-asa ed-' + m, 'data-modo': m }); }));
      const marco = h('div', { class: 'ed-marco' }, lienzo, caja);
      const escenario = h('div', { class: 'ed-escenario' }, marco);
      const capa = h('div', { class: 'capa editor', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Editar ' + titulo });

      const cerrar = function (valor) {
        window.removeEventListener('resize', dibujar);
        document.removeEventListener('keydown', tecla);
        URL.revokeObjectURL(url);
        capa.remove();
        document.body.style.overflow = '';
        resolver(valor);
      };
      const tecla = function (ev) { if (ev.key === 'Escape') cerrar(null); };

      function dibujar() {
        const impar = giro % 2 === 1;
        const rw = impar ? img.naturalHeight : img.naturalWidth, rh = impar ? img.naturalWidth : img.naturalHeight;
        const dispW = Math.max(120, escenario.clientWidth - 24), dispH = Math.max(120, escenario.clientHeight - 24);
        const k = Math.min(dispW / rw, dispH / rh);
        const w = Math.round(rw * k), hh = Math.round(rh * k);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        lienzo.width = Math.round(w * dpr);
        lienzo.height = Math.round(hh * dpr);
        marco.style.width = w + 'px';
        marco.style.height = hh + 'px';
        dibujarGirada(lienzo.getContext('2d'), img, giro, lienzo.width, lienzo.height);
        pintarRecorte();
      }
      function pintarRecorte() {
        caja.style.left = (rec.x * 100) + '%';
        caja.style.top = (rec.y * 100) + '%';
        caja.style.width = (rec.w * 100) + '%';
        caja.style.height = (rec.h * 100) + '%';
      }

      // Arrastre con dedo o ratón: mover el recuadro o estirarlo desde sus bordes y esquinas.
      let arrastre = null;
      caja.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        caja.setPointerCapture(ev.pointerId);
        arrastre = { modo: ev.target.getAttribute('data-modo') || 'mover', x0: ev.clientX, y0: ev.clientY, r0: Object.assign({}, rec),
          W: marco.clientWidth, H: marco.clientHeight };
      });
      caja.addEventListener('pointermove', function (ev) {
        if (!arrastre) return;
        const a = arrastre, dx = (ev.clientX - a.x0) / a.W, dy = (ev.clientY - a.y0) / a.H, r = a.r0;
        const lim = function (v, mn, mx) { return Math.max(mn, Math.min(mx, v)); };
        const n = Object.assign({}, r);
        if (a.modo === 'mover') {
          n.x = lim(r.x + dx, 0, 1 - r.w);
          n.y = lim(r.y + dy, 0, 1 - r.h);
        } else {
          if (a.modo.indexOf('w') >= 0) { n.x = lim(r.x + dx, 0, r.x + r.w - RECORTE_MIN); n.w = r.x + r.w - n.x; }
          if (a.modo.indexOf('e') >= 0) { n.w = lim(r.w + dx, RECORTE_MIN, 1 - r.x); }
          if (a.modo.indexOf('n') >= 0) { n.y = lim(r.y + dy, 0, r.y + r.h - RECORTE_MIN); n.h = r.y + r.h - n.y; }
          if (a.modo.indexOf('s') >= 0) { n.h = lim(r.h + dy, RECORTE_MIN, 1 - r.y); }
        }
        rec = n;
        pintarRecorte();
      });
      const soltar = function () { arrastre = null; };
      caja.addEventListener('pointerup', soltar);
      caja.addEventListener('pointercancel', soltar);

      const girar = function (sentido) {
        giro = (giro + sentido + 4) % 4;
        rec = girarRecorte(rec, sentido);
        dibujar();
      };

      async function aplicar(btn) {
        const completo = rec.x <= 0.001 && rec.y <= 0.001 && rec.w >= 0.999 && rec.h >= 0.999;
        if (giro === 0 && completo) {
          const b0 = arch.original || arch.blob;
          cerrar({ blob: b0, vista: await leerDataUrl(b0), edicion: { giro: 0, recorte: null }, editada: false });
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Guardando…';
        const impar = giro % 2 === 1;
        const rw = impar ? img.naturalHeight : img.naturalWidth, rh = impar ? img.naturalWidth : img.naturalHeight;
        const girada = document.createElement('canvas');
        girada.width = rw;
        girada.height = rh;
        dibujarGirada(girada.getContext('2d'), img, giro, rw, rh);
        const px = Math.round(rec.x * rw), py = Math.round(rec.y * rh);
        const pw = Math.max(1, Math.round(rec.w * rw)), ph = Math.max(1, Math.round(rec.h * rh));
        const salida = document.createElement('canvas');
        salida.width = pw;
        salida.height = ph;
        salida.getContext('2d').drawImage(girada, px, py, pw, ph, 0, 0, pw, ph);
        const blob = await new Promise(function (ok) { salida.toBlob(ok, 'image/jpeg', 0.9); });
        if (!blob) { btn.disabled = false; btn.textContent = 'Aplicar'; alert('No se pudo guardar la imagen editada.'); return; }
        cerrar({ blob: blob, vista: await leerDataUrl(blob), edicion: { giro: giro, recorte: completo ? null : rec }, editada: true });
      }

      const btnAplicar = h('button', { type: 'button', class: 'btn primario', onclick: function (ev) { aplicar(ev.currentTarget); } }, 'Aplicar');
      agregar(capa, h('div', { class: 'ed-caja' },
        h('div', { class: 'ed-cab' }, h('strong', null, 'Editar ' + titulo),
          h('span', null, 'Arrastre el recuadro o sus bordes para recortar.')),
        escenario,
        h('div', { class: 'ed-barra' },
          h('div', { class: 'ed-grupo' },
            h('button', { type: 'button', class: 'btn', onclick: function () { girar(-1); }, 'aria-label': 'Girar a la izquierda' }, '⟲ Girar'),
            h('button', { type: 'button', class: 'btn', onclick: function () { girar(1); }, 'aria-label': 'Girar a la derecha' }, 'Girar ⟳'),
            h('button', { type: 'button', class: 'btn', onclick: function () { giro = 0; rec = Object.assign({}, RECORTE_COMPLETO); dibujar(); } }, 'Restablecer')),
          h('div', { class: 'ed-grupo' },
            h('button', { type: 'button', class: 'btn', onclick: function () { cerrar(null); } }, 'Cancelar'),
            btnAplicar))));
      document.body.appendChild(capa);
      document.body.style.overflow = 'hidden';
      window.addEventListener('resize', dibujar);
      document.addEventListener('keydown', tecla);
      dibujar();
      btnAplicar.focus();
    });
  }

  /* ---------- validación y envío ---------- */
  function fechaValida(s) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!m) return false;
    const d = Number(m[1]), mes = Number(m[2]), a = Number(m[3]);
    if (a < 1900 || mes < 1 || mes > 12 || d < 1) return false;
    if (d > new Date(a, mes, 0).getDate()) return false;
    return new Date(a, mes - 1, d).getTime() <= Date.now();
  }

  function validar(area, campos) {
    const F = E.form, v = F.valores, err = {};
    campos.forEach(function (c) {
      const valor = c.tipo === 'archivo' ? F.archivos[c.k] : String(v[c.k] || '').trim();
      if (!valor) { if (obligatorio(area, c.k)) err[c.k] = c.tipo === 'archivo' ? 'Cargue el archivo.' : 'Esta pregunta es obligatoria.'; return; }
      if (c.k === 'nombre' && valor.length < 3) err[c.k] = 'Escriba el nombre completo.';
      if (c.k === 'medico' && valor.length < 3) err[c.k] = 'Escriba el nombre del médico.';
      if (c.k === 'expediente' && !/^\d{1,6}-\d{2}$/.test(valor)) err[c.k] = 'Complete el número y los 2 dígitos del año.';
      if (c.k === 'edad' && Number(valor) > 120) err[c.k] = 'Revise la edad (0 a 120).';
      if (c.k === 'fecha_nacimiento' && !fechaValida(valor)) err[c.k] = 'Escriba una fecha real y no futura (DD/MM/AAAA).';
      if (c.k === 'peso' && !(Number(valor) >= 2 && Number(valor) <= 400)) err[c.k] = 'Escriba el peso en kg (2 a 400).';
      if (c.k === 'altura' && !(Number(valor) >= 40 && Number(valor) <= 250)) err[c.k] = 'Escriba la altura en centímetros (40 a 250).';
      if (c.k === 'presion' && !/^\d{2,3}\/\d{2,3}$/.test(valor)) err[c.k] = 'Complete sistólica y diastólica.';
      if (c.k === 'contacto' && valor.replace(/\D/g, '').length !== 8) err[c.k] = 'El número debe tener 8 dígitos.';
    });
    return err;
  }

  async function enviar(area, campos, cajaError, btn) {
    const F = E.form;
    cajaError.textContent = '';
    campos.forEach(function (c) { limpiarError(c.k); });
    const err = validar(area, campos);
    const claves = Object.keys(err);
    if (claves.length) {
      claves.forEach(function (k) { ponerError(k, err[k]); });
      cajaError.appendChild(h('div', { class: 'aviso error', role: 'alert', id: 'resumen-errores' },
        h('strong', null, claves.length === 1 ? 'Falta 1 pregunta por corregir' : 'Faltan ' + claves.length + ' preguntas por corregir'),
        'Están marcadas en rojo.'));
      const primero = document.getElementById('campo-' + claves[0]);
      if (primero) { primero.scrollIntoView({ behavior: 'smooth', block: 'center' }); const foco = primero.querySelector('input,select,textarea'); if (foco) foco.focus({ preventScroll: true }); }
      return;
    }
    const capa = h('div', { class: 'capa', role: 'status' }, h('div', { class: 'caja' }, h('div', { class: 'giro' }),
      h('strong', null, 'Enviando solicitud…'), h('p', { style: 'margin:6px 0 0;color:#51606f;font-size:14px' }, 'No cierre esta pantalla.')));
    document.body.appendChild(capa);
    btn.disabled = true;
    try {
      const datos = {};
      campos.forEach(function (c) { if (c.tipo !== 'archivo') datos[c.k] = String(F.valores[c.k] || '').trim(); });
      const cuerpo = { area: area.clave, datos: datos, id_cliente: F.idCliente, codigo: F.codigo || '' };
      for (const k of ['ekg', 'rx']) {
        if (F.archivos[k]) cuerpo[k] = { nombre: F.archivos[k].nombre, b64: (await leerDataUrl(F.archivos[k].blob)).split(',')[1] };
      }
      const r = await api('enviar', cuerpo);
      if (F.codigo) recordar('codigo_' + area.clave, F.codigo);
      F.enviado = { id: r.id, estudio: datos.estudio, prioridad: datos.prioridad, nombre: datos.nombre };
      F.sucio = false;
      capa.remove();
      pintar();
      window.scrollTo(0, 0);
      cargarEstado(true);
    } catch (e) {
      capa.remove();
      btn.disabled = false;
      const cerrado = e.code === 'CERRADO';
      cajaError.appendChild(h('div', { class: 'aviso error', role: 'alert' },
        h('strong', null, cerrado ? 'El formulario se cerró' : 'No se pudo enviar la solicitud'),
        cerrado ? 'Se alcanzó el límite de cupos o el límite horario mientras se llenaba la solicitud.' : e.message,
        e.code === 'RED' ? ' Sus datos siguen en pantalla: puede volver a intentar sin escribir de nuevo.' : ''));
      if (e.code === 'CODIGO') { const c = document.getElementById('in-codigo'); if (c) c.focus(); }
      cajaError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (cerrado) cargarEstado(true);
    }
  }

  function pintarExito(main, area) {
    const x = E.form.enviado;
    main.appendChild(h('div', { class: 'tarjeta exito' },
      h('div', { class: 'check', 'aria-hidden': 'true' }, '✓'),
      h('h2', null, 'Solicitud enviada'),
      h('p', { style: 'margin:0;color:#51606f' }, 'El Servicio de Cardiología ya la tiene en su censo.'),
      h('div', { class: 'folio' }, x.id),
      h('div', { style: 'color:#51606f;font-size:14px' }, 'Número de solicitud'),
      h('dl', null, h('dt', null, 'Área'), h('dd', null, area.nombre), h('dt', null, 'Estudio'), h('dd', null, x.estudio),
        h('dt', null, 'Prioridad'), h('dd', null, x.prioridad), h('dt', null, 'Paciente'), h('dd', null, x.nombre)),
      h('div', { class: 'acciones' },
        h('button', { class: 'btn', onclick: function () { E.form = null; location.hash = '#/'; } }, 'Volver al inicio'),
        h('button', { class: 'btn primario', onclick: function () { E.form = null; pintar(); window.scrollTo(0, 0); } }, 'Nueva solicitud'))));
  }

  /* ---------- instalación como app ---------- */
  function instalarApp() {
    if (!E.instalar) return;
    E.instalar.prompt();
    E.instalar = null;
    pintar();
  }
  window.addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); E.instalar = ev; if (!E.form) pintar(); });
  window.addEventListener('beforeunload', function (ev) { if (E.form && E.form.sucio) { ev.preventDefault(); ev.returnValue = ''; } });
  window.addEventListener('hashchange', function () { pintar(); window.scrollTo(0, 0); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) cargarEstado(true); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* sin modo offline */ }); });
  }

  pintar();
  cargarEstado();
  E.temporizador = setInterval(function () { if (!document.hidden) cargarEstado(true); }, 60000);
})();
