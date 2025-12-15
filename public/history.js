// history.js
document.addEventListener('DOMContentLoaded', () => {
  // --------------------------
  // Elementos base
  // --------------------------
  const backButton = document.getElementById('back-button');
  const backBottom = document.getElementById('back-bottom');
  const ordersContainer = document.getElementById('orders-container');
  const filterChips = document.querySelectorAll('.filter-chip');
  const emailSearchWrapper = document.getElementById('email-search-wrapper');
  const emailSearchForm = document.getElementById('email-search-form');
  const emailInput = document.getElementById('email-input');
  const loadStatusMessage = document.getElementById('load-status-message');
  const sessionInfo = document.getElementById('session-info');
  const sessionEmailLabel = document.getElementById('session-email-label');

  // --------------------------
  // Parámetros URL
  // --------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const paramCorreo = urlParams.get('correo');
  const paramPedidoId = urlParams.get('pedidoId');

  // --------------------------
  // Sesión local (burgerUser)
  // --------------------------
  let currentEmail = null;
  let hasSession = false;
  let allOrders = [];
  let currentFilter = 'all';

  try {
    const userRaw = localStorage.getItem('burgerUser');
    if (userRaw) {
      const user = JSON.parse(userRaw);
      if (user && user.correo) {
        currentEmail = user.correo;
        hasSession = true;
      }
    }
  } catch (err) {
    console.warn('[history.js] No se pudo leer burgerUser:', err);
  }

  // Si viene ?correo en la URL, tiene prioridad
  if (paramCorreo) {
    currentEmail = paramCorreo;
  }

  if (currentEmail) {
    if (hasSession) {
      // Hay sesión: mostramos la barra de sesión
      sessionInfo.classList.remove('hidden');
      sessionEmailLabel.textContent = `Mostrando pedidos para: ${currentEmail}`;
      // El buscador no hace falta
      emailSearchWrapper.classList.add('hidden');
    } else {
      // Sin sesión pero con correo en la URL
      sessionInfo.classList.add('hidden');
      emailSearchWrapper.classList.remove('hidden');
      if (emailInput) emailInput.value = currentEmail;
    }

    // Cargar pedidos directamente
    loadOrders(currentEmail);
  } else {
    // Sin sesión y sin correo: mostrar buscador vacío
    sessionInfo.classList.add('hidden');
    emailSearchWrapper.classList.remove('hidden');
  }

  // --------------------------
  // Botones de volver -> siempre a la página principal
  // --------------------------
  function goHome() {
    window.location.href = '/';
  }

  if (backButton) {
    backButton.addEventListener('click', goHome);
  }
  if (backBottom) {
    backBottom.addEventListener('click', goHome);
  }

  // --------------------------
  // Formulario de búsqueda por correo (solo si no hay sesión o queremos cambiar correo)
  // --------------------------
  if (emailSearchForm) {
    emailSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      if (!email) {
        alert('Ingresa un correo para buscar tus pedidos.');
        return;
      }
      currentEmail = email;
      loadOrders(email);
    });
  }

  // --------------------------
  // Filtros
  // --------------------------
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const filter = chip.dataset.filter || 'all';
      currentFilter = filter;

      filterChips.forEach((c) => {
        if (c === chip) {
          c.classList.add('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/20');
          c.classList.remove(
            'bg-white',
            'dark:bg-[#392828]',
            'border',
            'border-gray-200',
            'dark:border-transparent'
          );
        } else {
          c.classList.remove('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/20');
          c.classList.add(
            'bg-white',
            'dark:bg-[#392828]',
            'border',
            'border-gray-200',
            'dark:border-transparent'
          );
        }
      });

      renderOrders();
    });
  });

  // --------------------------
  // Helpers básicos
  // --------------------------
  function setLoadingMessage(msg) {
    if (!loadStatusMessage) return;
    if (!msg) {
      loadStatusMessage.classList.add('hidden');
      loadStatusMessage.textContent = '';
    } else {
      loadStatusMessage.textContent = msg;
      loadStatusMessage.classList.remove('hidden');
    }
  }

  function formatTimeFromISO(isoString) {
    if (!isoString) return '--:--';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '--:--';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // Duración legible a partir de ms
  function formatDuration(ms) {
    if (!ms || ms <= 0) return null;
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) return '<1 min';

    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${minutes} min`;
    }
    if (hours < 24) {
      return `${hours} h ${String(minutes).padStart(2, '0')} min`;
    }
    const days = Math.floor(hours / 24);
    const restHours = hours % 24;
    if (days === 1) {
      return `1 día ${restHours} h`;
    }
    return `${days} días ${restHours} h`;
  }

  const STATUS_ORDER = [
    'Recibido',
    'En preparación',
    'Listo',
    'En camino',
    'Entregado',
  ];

  function normalizeStatus(raw) {
    if (!raw) return 'Recibido';
    const val = String(raw).toLowerCase();
    if (val.includes('prepar')) return 'En preparación';
    if (val.includes('listo')) return 'Listo';
    if (val.includes('camino')) return 'En camino';
    if (val.includes('entregado')) return 'Entregado';
    if (val.includes('recib')) return 'Recibido';
    return 'Recibido';
  }

  function statusToIndex(status) {
    const norm = normalizeStatus(status);
    const idx = STATUS_ORDER.findIndex(
      (s) => s.toLowerCase() === norm.toLowerCase()
    );
    return idx === -1 ? 0 : idx;
  }

  function statusBadge(status) {
    const norm = normalizeStatus(status);
    switch (norm) {
      case 'Recibido':
        return {
          text: 'Recibido',
          classes:
            'inline-flex items-center rounded-md bg-slate-500/10 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 ring-1 ring-inset ring-slate-500/20',
          icon: 'markunread_mailbox',
        };
      case 'En preparación':
        return {
          text: 'En preparación',
          classes:
            'inline-flex items-center rounded-md bg-yellow-500/10 px-2.5 py-1 text-xs font-bold text-yellow-600 dark:text-yellow-400 ring-1 ring-inset ring-yellow-500/20',
          icon: 'skillet',
        };
      case 'Listo':
        return {
          text: 'Listo para recoger',
          classes:
            'inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20',
          icon: 'restaurant',
        };
      case 'En camino':
        return {
          text: 'En camino',
          classes:
            'inline-flex items-center rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20',
          icon: 'two_wheeler',
        };
      case 'Entregado':
        return {
          text: 'Entregado',
          classes:
            'inline-flex items-center rounded-md bg-green-500/10 px-2.5 py-1 text-xs font-bold text-green-600 dark:text-green-400 ring-1 ring-inset ring-green-500/20',
          icon: 'check_circle',
        };
      default:
        return {
          text: norm,
          classes:
            'inline-flex items-center rounded-md bg-slate-500/10 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 ring-1 ring-inset ring-slate-500/20',
          icon: 'info',
        };
    }
  }

  function filterOrders(rawOrders) {
    if (currentFilter === 'all') return rawOrders;

    return rawOrders.filter((order) => {
      const norm = normalizeStatus(order.estado);
      switch (currentFilter) {
        case 'en-proceso':
          // Recibido, En preparación, Listo
          return (
            norm === 'Recibido' ||
            norm === 'En preparación' ||
            norm === 'Listo'
          );
        case 'listo':
          return norm === 'Listo';
        case 'camino':
          return norm === 'En camino';
        case 'entregado':
          return norm === 'Entregado';
        default:
          return true;
      }
    });
  }

  // --------------------------
  // Cálculo de duraciones por estado
  // --------------------------
  const STATE_KEYS = ['recibido', 'preparacion', 'listo', 'camino', 'entregado'];

  function computeDurations(times, statusIndex) {
    const now = new Date();
    const results = [];

    for (let i = 0; i < STATE_KEYS.length; i++) {
      const key = STATE_KEYS[i];
      const startIso = times[key];
      if (!startIso) {
        results.push(null);
        continue;
      }
      const start = new Date(startIso);
      if (Number.isNaN(start.getTime())) {
        results.push(null);
        continue;
      }

      let end = null;

      // Si ya hay timestamp del siguiente estado, usamos eso como fin
      const nextKey = STATE_KEYS[i + 1];
      const nextIso = nextKey ? times[nextKey] : null;

      if (nextIso) {
        const nextDate = new Date(nextIso);
        if (!Number.isNaN(nextDate.getTime())) {
          end = nextDate;
        }
      } else if (i === statusIndex) {
        // Estado actual -> hasta ahora
        end = now;
      }

      if (!end) {
        results.push(null);
        continue;
      }

      const diffMs = end.getTime() - start.getTime();
      if (diffMs <= 0) {
        results.push(null);
        continue;
      }

      results.push(formatDuration(diffMs));
    }

    return results;
  }

  // --------------------------
  // Carga de pedidos
  // --------------------------
  async function loadOrders(email) {
    if (!email) {
      setLoadingMessage('Ingresa un correo para ver tus pedidos.');
      ordersContainer.innerHTML = '';
      return;
    }

    setLoadingMessage('Cargando pedidos...');
    ordersContainer.innerHTML = '';

    // Skeleton simple
    const skeleton = document.createElement('div');
    skeleton.className =
      'space-y-3 mt-2 animate-pulse max-w-3xl mx-auto w-full';
    skeleton.innerHTML = `
      <div class="h-24 rounded-xl bg-gray-200/70 dark:bg-[#261a1a]"></div>
      <div class="h-24 rounded-xl bg-gray-200/70 dark:bg-[#261a1a]"></div>
    `;
    ordersContainer.appendChild(skeleton);

    try {
      const res = await fetch(`/api/pedidos?correo=${encodeURIComponent(email)}`);
      if (!res.ok) {
        ordersContainer.innerHTML = '';
        if (res.status === 404) {
          setLoadingMessage('No se encontraron pedidos para este correo.');
        } else {
          setLoadingMessage('Error al obtener los pedidos. Intenta de nuevo.');
        }
        return;
      }

      const data = await res.json();
      allOrders = Array.isArray(data) ? data : [];

      if (allOrders.length === 0) {
        ordersContainer.innerHTML = `
          <div class="mt-4 flex flex-col items-center text-center text-sm text-slate-500 dark:text-gray-400">
            <span class="material-symbols-outlined text-4xl mb-2 text-slate-400 dark:text-gray-500">receipt_long</span>
            <p>No encontramos pedidos recientes para <span class="font-semibold">${email}</span>.</p>
          </div>
        `;
        setLoadingMessage('');
        return;
      }

      // Si viene pedidoId en la URL, intentamos quedarnos solo con ese
      if (paramPedidoId) {
        const idNum = Number(paramPedidoId);
        if (!Number.isNaN(idNum)) {
          const filtered = allOrders.filter((o) => Number(o.id) === idNum);
          if (filtered.length > 0) {
            allOrders = filtered;
            setLoadingMessage(`Mostrando el pedido #${idNum}.`);
          } else {
            setLoadingMessage(
              `No se encontró el pedido #${idNum} para este correo. Mostrando todos los pedidos disponibles (${allOrders.length}).`
            );
          }
        } else {
          setLoadingMessage(
            `Mostrando ${allOrders.length} pedido(s) de los últimos 30 días.`
          );
        }
      } else {
        setLoadingMessage(
          `Mostrando ${allOrders.length} pedido(s) de los últimos 30 días.`
        );
      }

      renderOrders();
    } catch (err) {
      console.error('[history.js] Error cargando pedidos:', err);
      ordersContainer.innerHTML = '';
      setLoadingMessage('Error inesperado al cargar los pedidos.');
    }
  }

  // --------------------------
  // Render de pedidos
  // --------------------------
  function renderOrders() {
    if (!ordersContainer) return;
    ordersContainer.innerHTML = '';

    const visible = filterOrders(allOrders);

    if (visible.length === 0) {
      ordersContainer.innerHTML = `
        <div class="mt-4 flex flex-col items-center text-center text-sm text-slate-500 dark:text-gray-400">
          <span class="material-symbols-outlined text-4xl mb-2 text-slate-400 dark:text-gray-500">filter_alt</span>
          <p>No hay pedidos que coincidan con el filtro seleccionado.</p>
        </div>
      `;
      return;
    }

    visible.forEach((order) => {
      const card = buildOrderCard(order);
      ordersContainer.appendChild(card);
    });
  }

  function buildOrderCard(order) {
    const normStatus = normalizeStatus(order.estado);
    const statusIndex = statusToIndex(order.estado);
    const badge = statusBadge(order.estado);

    const createdAt = order.created_at || order.inserted_at || null;

    const times = {
      recibido: order.recibido_at || createdAt,
      preparacion: order.en_preparacion_at || null,
      listo: order.listo_at || null,
      camino: order.en_camino_at || null,
      entregado: order.entregado_at || null,
    };

    const stepTimes = [
      formatTimeFromISO(times.recibido),
      formatTimeFromISO(times.preparacion),
      formatTimeFromISO(times.listo),
      formatTimeFromISO(times.camino),
      formatTimeFromISO(times.entregado),
    ];

    // Duraciones por estado
    const stepDurations = computeDurations(times, statusIndex);

    const wrapper = document.createElement('article');
    wrapper.className =
      'group relative flex flex-col overflow-hidden rounded-xl bg-white dark:bg-[#261a1a] shadow-md border border-gray-100 dark:border-[#392828] transition-all hover:shadow-lg hover:border-primary/30';

    const idLabel = order.id ? `Pedido #${order.id}` : 'Pedido sin ID';
    const resumen = String(order.resumen_pedido || '').trim() || '(Sin detalle)';

    const isDone = normStatus === 'Entregado';

    const headerSubtitleParts = [];
    if (order.puntoventa) headerSubtitleParts.push(order.puntoventa);
    if (order.direccion_cliente) headerSubtitleParts.push(order.direccion_cliente);
    const headerSubtitle = headerSubtitleParts.join(' • ');

    const progressPercent = ((statusIndex + 1) / STATUS_ORDER.length) * 100;

    wrapper.innerHTML = `
      <!-- Header Status -->
      <div class="flex items-center justify-between p-4 border-b border-gray-100 dark:border-[#392828]">
        <div class="flex items-center gap-2">
          <div class="bg-primary/10 text-primary p-1.5 rounded-lg">
            <span class="material-symbols-outlined text-[20px]">receipt_long</span>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white leading-none">${idLabel}</h3>
            <p class="text-xs text-slate-500 dark:text-[#b99d9d] mt-1">
              ${headerSubtitle || (order.nombre_cliente || '')}
            </p>
          </div>
        </div>
        <span class="${badge.classes}">
          <span class="material-symbols-outlined mr-1 text-[14px]">${badge.icon}</span>
          ${badge.text}
        </span>
      </div>

      <!-- Content Body -->
      <div class="p-4 flex flex-col md:flex-row gap-4 md:gap-6">
        <!-- Texto del pedido -->
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold text-slate-500 dark:text-[#b99d9d] uppercase tracking-wider mb-1">
            Resumen del pedido
          </p>
          <div class="rounded-lg bg-gray-50 dark:bg-[#2a1e1e] border border-gray-100 dark:border-[#392828] px-3 py-3 text-sm text-slate-800 dark:text-gray-100 whitespace-pre-line">
            ${escapeHtml(resumen)}
          </div>
        </div>

        <!-- Seguimiento -->
        <div class="flex-1 min-w-0 md:border-l md:border-gray-100 md:dark:border-[#392828] md:pl-6 flex flex-col justify-center mt-3 md:mt-0">
          <p class="text-xs font-semibold text-slate-500 dark:text-[#b99d9d] uppercase tracking-wider mb-3">
            Seguimiento del estado
          </p>
          <div class="relative">
            <!-- Línea base -->
            <div class="absolute top-2.5 left-0 w-full h-0.5 bg-gray-200 dark:bg-[#392828] -z-10"></div>
            <!-- Progreso -->
            <div
              class="absolute top-2.5 left-0 h-0.5 bg-primary -z-10 transition-all duration-500"
              style="width: ${progressPercent}%;"
            ></div>

            <div class="flex justify-between w-full">
              ${STATUS_ORDER.map((label, idx) => {
                const stateIndex = idx;
                const isCompleted = stateIndex < statusIndex;
                const isCurrent = stateIndex === statusIndex;
                const timeLabel = stepTimes[idx];
                const durationLabel = stepDurations[idx];

                if (isCompleted) {
                  return `
                    <div class="flex flex-col items-center gap-1 group/step">
                      <div class="w-5 h-5 rounded-full bg-primary border-2 border-primary flex items-center justify-center shadow-sm">
                        <span class="material-symbols-outlined text-[10px] text-white font-bold">check</span>
                      </div>
                      <div class="flex flex-col items-center">
                        <span class="text-[10px] font-bold text-primary hidden sm:block">${label}</span>
                        <span class="text-[10px] text-slate-400 dark:text-gray-500 font-medium">${timeLabel}</span>
                        ${
                          durationLabel
                            ? `<span class="text-[9px] text-slate-400 dark:text-gray-500">Duración: ${durationLabel}</span>`
                            : ''
                        }
                      </div>
                    </div>
                  `;
                } else if (isCurrent && !isDone) {
                  return `
                    <div class="flex flex-col items-center gap-1">
                      <div class="w-5 h-5 rounded-full bg-white dark:bg-[#261a1a] border-2 border-primary flex items-center justify-center relative shadow-[0_0_8px_rgba(236,19,19,0.4)] animate-pulse">
                        <div class="w-2 h-2 rounded-full bg-primary"></div>
                      </div>
                      <div class="flex flex-col items-center">
                        <span class="text-[10px] font-bold text-slate-900 dark:text-white hidden sm:block">${label}</span>
                        <span class="text-[10px] text-slate-400 dark:text-gray-500 font-medium">${timeLabel}</span>
                        ${
                          durationLabel
                            ? `<span class="text-[9px] text-slate-400 dark:text-gray-500">En este estado hace ${durationLabel}</span>`
                            : ''
                        }
                      </div>
                    </div>
                  `;
                } else {
                  const isLast = stateIndex === STATUS_ORDER.length - 1 && isDone;
                  const icon =
                    isLast && isDone
                      ? 'done_all'
                      : '';
                  const timeFinal = isLast && isDone ? timeLabel : '--:--';
                  const durationFinal = isLast && isDone ? durationLabel : null;

                  return `
                    <div class="flex flex-col items-center gap-1 ${
                      isDone ? '' : 'opacity-50'
                    }">
                      <div class="w-5 h-5 rounded-full ${
                        isDone ? 'bg-green-500 border-2 border-green-500' : 'bg-gray-200 dark:bg-[#392828] border-2 border-transparent'
                      } flex items-center justify-center">
                        ${
                          isDone && icon
                            ? `<span class="material-symbols-outlined text-[10px] text-white font-bold">${icon}</span>`
                            : ''
                        }
                      </div>
                      <div class="flex flex-col items-center">
                        <span class="text-[10px] ${
                          isDone
                            ? 'text-green-600 dark:text-green-500 font-bold'
                            : 'text-slate-500 dark:text-gray-400'
                        } hidden sm:block">${label}</span>
                        <span class="text-[10px] ${
                          isDone
                            ? 'text-green-600 dark:text-green-500 font-medium'
                            : 'text-slate-400 dark:text-gray-600 font-medium'
                        }">${isDone ? timeFinal : '--:--'}</span>
                        ${
                          isDone && durationFinal
                            ? `<span class="text-[9px] text-green-600 dark:text-green-500">Duración: ${durationFinal}</span>`
                            : ''
                        }
                      </div>
                    </div>
                  `;
                }
              }).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Footer pequeño con fecha -->
      <div class="bg-gray-50 dark:bg-[#2a1e1e] px-4 py-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400">
        <span>
          Creado: ${createdAt ? new Date(createdAt).toLocaleString() : 'Fecha desconocida'}
        </span>
        <span class="flex items-center gap-1">
          <span class="material-symbols-outlined text-[14px]">lock</span>
          Solo lectura
        </span>
      </div>
    `;

    return wrapper;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 🔁 Actualizar duraciones cada minuto (si hay pedidos cargados)
  setInterval(() => {
    if (allOrders && allOrders.length > 0) {
      renderOrders();
    }
  }, 60000);
});
