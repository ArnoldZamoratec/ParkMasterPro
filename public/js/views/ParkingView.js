import { PAYMENT_LABELS, TYPE_META } from '../shared/constants.js';
import {
    cycleFocus,
    escapeAttr,
    escapeHtml,
    formatDate,
    formatMoney,
    formatTime,
    getFocusable,
    getTypeIcon,
    getTypeLabel,
    getValue,
    minutesBetween,
    readMoneyInput,
    readPositiveIntegerInput,
    refreshIcons,
    setText,
    setValue,
    sum,
    toDateInputValue
} from '../shared/utils.js';

export class ParkingView {
    constructor(store, billingService) {
        this.store = store;
        this.billingService = billingService;
        this.toastTimeoutId = null;
        this.modalKeyHandler = null;
        this.lastFocused = null;
    }

    bindEvents(handlers) {
        this.on('form-entry', 'submit', handlers.handleEntry);
        this.on('inline-entry-form', 'submit', handlers.handleInlineEntry);
        this.on('cash-movement-form', 'submit', handlers.handleCashMovement);
        this.on('backup-file', 'change', handlers.importBackup);

        ['in-plate', 'inline-plate'].forEach(id => {
            this.on(id, 'input', () => this.setFieldError(id, ''));
        });
        this.on('quote-minutes', 'input', handlers.updateQuickQuote);
        this.on('quote-type', 'change', handlers.updateQuickQuote);

        ['out-discount', 'out-extra', 'out-lost-ticket', 'out-payment-method'].forEach(id => {
            this.on(id, 'input', handlers.updateCheckoutQuote);
            this.on(id, 'change', handlers.updateCheckoutQuote);
        });
    }

    on(id, eventName, handler) {
        const el = document.getElementById(id);
        if (el && handler) el.addEventListener(eventName, handler);
    }

    hydrateSettings() {
        const { config, shift } = this.store.getState();
        setValue('set-company', config.companyName);
        setValue('set-ruc', config.ruc);
        setValue('set-address', config.address);
        setValue('set-phone', config.phone);
        setValue('set-currency', config.currency);
        setValue('set-slots', config.totalSlots);
        setValue('set-grace', config.graceMinutes);
        setValue('set-increment', config.billingIncrementMinutes);
        setValue('set-minimum', config.minimumBillableMinutes);
        setValue('set-lost', config.lostTicketFee);
        setValue('set-overnight', config.overnightFee);
        setValue('rate-auto', config.rates.auto);
        setValue('rate-moto', config.rates.moto);
        setValue('rate-truck', config.rates.camioneta);
        setValue('rate-bus', config.rates.autobus);
        setValue('rate-bicycle', config.rates.bicicleta);
        setValue('rate-cargo', config.rates.carga);
        setValue('cash-cashier', shift.cashier);
        setValue('cash-opening', shift.openingCash || 0);
    }

    hydrateSelects() {
        const typeOptions = Object.entries(TYPE_META)
            .map(([value, meta]) => `<option value="${value}">${escapeHtml(meta.label)}</option>`)
            .join('');
        ['in-type', 'inline-type', 'quote-type'].forEach(id => {
            const select = document.getElementById(id);
            if (select) select.innerHTML = typeOptions;
        });
        this.renderSlotSelects();
    }

    renderSlotSelects(preferredSlot = null) {
        const available = this.store.getAvailableSlots(preferredSlot);
        const options = available.map(slot => `<option value="${slot}">Espacio ${slot}</option>`).join('');
        ['in-slot', 'inline-slot'].forEach(id => {
            const select = document.getElementById(id);
            if (select) select.innerHTML = options || '<option value="">Sin espacios</option>';
        });
    }

    setTodayFilters() {
        const today = toDateInputValue(new Date());
        if (!getValue('filter-date-from')) setValue('filter-date-from', today);
        if (!getValue('filter-date-to')) setValue('filter-date-to', today);
    }

    renderAll() {
        this.renderDashboard();
        this.renderMap();
        this.renderHistory();
        this.renderCash();
        this.renderOperationHelpers();
        refreshIcons();
    }

    renderDashboard() {
        const { config } = this.store.getState();
        const active = this.store.getActiveVehicles(getValue('search-plate'));
        const activeBody = document.getElementById('active-list');
        const noActive = document.getElementById('no-active');

        if (activeBody) {
            activeBody.innerHTML = active.map(vehicle => `
                <tr>
                    <td>
                        <div class="font-black text-slate-900">${escapeHtml(vehicle.plate)}</div>
                        <div class="text-xs text-slate-500 font-black uppercase">${escapeHtml(vehicle.ticketId)}</div>
                    </td>
                    <td>${escapeHtml(getTypeLabel(vehicle.type))}</td>
                    <td><span class="font-black text-indigo-700">#${Number(vehicle.slot)}</span></td>
                    <td>
                        <div>${formatTime(vehicle.entryTime)}</div>
                        <div class="text-xs text-slate-500">${minutesBetween(vehicle.entryTime, new Date())} min</div>
                    </td>
                    <td>
                        <div>${escapeHtml(vehicle.customerName || 'Sin cliente')}</div>
                        <div class="text-xs text-slate-500">${escapeHtml(vehicle.phone || '')}</div>
                    </td>
                    <td class="text-right">
                        <div class="toolbar justify-end">
                            <button onclick="downloadTicket(${Number(vehicle.id)})" class="btn btn-secondary"><i data-lucide="receipt" class="w-4 h-4"></i>Ticket</button>
                            <button onclick="processCheckout(${Number(vehicle.id)})" class="btn btn-primary"><i data-lucide="credit-card" class="w-4 h-4"></i>Cobrar</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
        if (noActive) noActive.classList.toggle('hidden', active.length > 0);

        const occ = this.store.getState().activeVehicles.length;
        const perc = config.totalSlots > 0 ? Math.min(100, (occ / config.totalSlots) * 100) : 0;
        setText('stat-occupancy', `${occ}/${config.totalSlots}`);
        const progress = document.getElementById('occupancy-progress');
        if (progress) progress.style.width = `${perc}%`;
        setText('stat-pending', String(occ));

        const todayHistory = this.store.getHistoryByDate(new Date(), new Date());
        const total = sum(todayHistory.map(item => item.amount));
        setText('stat-revenue', this.money(total));
        setText('stat-payment-mix', this.paymentMixText(todayHistory));
        const avgStay = todayHistory.length ? Math.round(sum(todayHistory.map(item => item.duration)) / todayHistory.length) : 0;
        setText('stat-avg-stay', `${avgStay} min`);

        const { shift } = this.store.getState();
        setText('stat-shift', shift.isOpen ? 'Caja abierta' : 'Sin turno');
        setText('stat-shift-detail', shift.isOpen ? `${shift.cashier || 'Cajero'} · ${formatTime(shift.openedAt)}` : 'Abra caja para auditoría');
        setText('sidebar-company', config.companyName || 'Cochera');
        refreshIcons();
    }

    renderMap() {
        const { config, activeVehicles } = this.store.getState();
        const grid = document.getElementById('parking-grid');
        if (!grid) return;

        const bySlot = new Map(activeVehicles.map(vehicle => [Number(vehicle.slot), vehicle]));
        const html = [];
        for (let slot = 1; slot <= config.totalSlots; slot++) {
            const vehicle = bySlot.get(slot);
            if (vehicle) {
                html.push(`
                    <button class="slot slot-occupied" onclick="processCheckout(${Number(vehicle.id)})" title="Cobrar ${escapeAttr(vehicle.plate)}" aria-label="Espacio ${slot} ocupado por ${escapeAttr(vehicle.plate)}, cobrar">
                        <i data-lucide="${escapeAttr(getTypeIcon(vehicle.type))}" class="w-5 h-5"></i>
                        <span class="slot-plate">${escapeHtml(vehicle.plate)}</span>
                        <span class="slot-number">Espacio ${slot}</span>
                    </button>
                `);
            } else {
                html.push(`
                    <button class="slot slot-free" onclick="openEntryModal(${slot})" title="Registrar en espacio ${slot}" aria-label="Espacio ${slot} libre, registrar ingreso">
                        <span class="slot-number">Libre</span>
                        <span class="slot-plate">#${slot}</span>
                    </button>
                `);
            }
        }
        grid.innerHTML = html.join('');
        refreshIcons();
    }

    renderHistory() {
        const filtered = this.store.getFilteredHistory(this.getHistoryFilters());
        const body = document.getElementById('history-body');
        const noHistory = document.getElementById('no-history');

        if (body) {
            body.innerHTML = filtered.slice().reverse().map(item => `
                <tr>
                    <td>
                        <div class="font-black text-slate-900">${escapeHtml(item.ticketId)}</div>
                        <div class="text-xs text-slate-500">${formatDate(item.exitTime)}</div>
                    </td>
                    <td>
                        <div class="font-black text-slate-900">${escapeHtml(item.plate)}</div>
                        <div class="text-xs text-slate-500">${escapeHtml(getTypeLabel(item.type))} · Espacio ${Number(item.slot)}</div>
                    </td>
                    <td>
                        <div>${formatTime(item.entryTime)} → ${formatTime(item.exitTime)}</div>
                        <div class="text-xs text-slate-500">${escapeHtml(item.customerName || 'Sin cliente')}</div>
                    </td>
                    <td>${Number(item.duration) || 0} min</td>
                    <td>${escapeHtml(PAYMENT_LABELS[item.paymentMethod] || item.paymentMethod || 'Efectivo')}</td>
                    <td class="text-right font-black text-emerald-700">${this.money(item.amount)}</td>
                </tr>
            `).join('');
        }
        if (noHistory) noHistory.classList.toggle('hidden', filtered.length > 0);

        const total = sum(filtered.map(item => item.amount));
        setText('history-total', this.money(total));
        setText('history-count', String(filtered.length));
        setText('history-average', this.money(filtered.length ? total / filtered.length : 0));
        refreshIcons();
    }

    renderCash() {
        const { shift } = this.store.getState();
        const status = document.getElementById('cash-status-card');
        const todayHistory = this.store.getHistoryByDate(new Date(), new Date());
        const parkingTotal = sum(todayHistory.map(item => item.amount));
        const movementTotals = this.store.getTodayMovementTotals();
        const expected = (Number(shift.openingCash) || 0) + parkingTotal + movementTotals.income - movementTotals.expense;

        if (status) {
            status.innerHTML = `
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <div class="text-sm font-black text-slate-900">${shift.isOpen ? 'Turno abierto' : 'Turno cerrado'}</div>
                        <div class="text-xs text-slate-500 mt-1">${shift.isOpen ? `Desde ${formatTime(shift.openedAt)}` : 'Abra caja antes de operar caja física'}</div>
                    </div>
                    <span class="text-xs font-black uppercase ${shift.isOpen ? 'text-emerald-700' : 'text-slate-500'}">${shift.isOpen ? 'Activo' : 'Inactivo'}</span>
                </div>
                <div class="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <div><span class="block text-slate-500 font-black text-[11px] uppercase">Fondo</span><strong>${this.money(shift.openingCash || 0)}</strong></div>
                    <div><span class="block text-slate-500 font-black text-[11px] uppercase">Parking</span><strong>${this.money(parkingTotal)}</strong></div>
                    <div><span class="block text-slate-500 font-black text-[11px] uppercase">Ingresos</span><strong>${this.money(movementTotals.income)}</strong></div>
                    <div><span class="block text-slate-500 font-black text-[11px] uppercase">Gastos</span><strong>${this.money(movementTotals.expense)}</strong></div>
                    <div class="col-span-2"><span class="block text-slate-500 font-black text-[11px] uppercase">Caja esperada</span><strong class="text-lg">${this.money(expected)}</strong></div>
                </div>
            `;
        }

        const movementList = document.getElementById('movement-list');
        if (movementList) {
            const today = this.store.getState().cashMovements.filter(item => toDateInputValue(item.createdAt) === toDateInputValue(new Date()));
            movementList.innerHTML = today.slice().reverse().map(item => `
                <tr>
                    <td>${formatTime(item.createdAt)}</td>
                    <td>${item.type === 'expense' ? 'Gasto' : 'Ingreso'}</td>
                    <td>${escapeHtml(item.concept)}</td>
                    <td class="text-right font-black ${item.type === 'expense' ? 'text-red-600' : 'text-emerald-700'}">${item.type === 'expense' ? '-' : '+'}${this.money(item.amount)}</td>
                </tr>
            `).join('') || '<tr><td colspan="4" class="text-center text-slate-500 py-8">Sin movimientos manuales hoy.</td></tr>';
        }
        refreshIcons();
    }

    renderOperationHelpers() {
        this.renderSlotSelects();
        this.renderQuickQuote();
        refreshIcons();
    }

    renderQuickQuote() {
        const { type, minutes } = this.getQuickQuoteInput();
        const fakeVehicle = {
            type,
            entryTime: new Date(Date.now() - minutes * 60000).toISOString()
        };
        const quote = this.billingService.calculateAmount(fakeVehicle, new Date());
        setText('quote-amount', this.money(quote.total));
    }

    renderCheckout(vehicle, quote) {
        setText('modal-checkout-title', vehicle.plate);
        setText('out-details', `${getTypeLabel(vehicle.type)} · ${quote.duration} min · Espacio ${vehicle.slot} · Ticket ${vehicle.ticketId}`);
        setText('out-amount', this.money(quote.total));
        setText('time-badge', `${quote.billableMinutes} min facturados · base ${this.money(quote.baseAmount)}`);
    }

    openModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        this.lastFocused = document.activeElement;
        el.classList.remove('hidden');
        document.addEventListener('keydown', this.modalKeyHandler = event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeModals();
            } else if (event.key === 'Tab') {
                cycleFocus(el, event);
            }
        }, true);
    }

    openEntryModal(slot = null) {
        this.renderSlotSelects(slot);
        const firstSlot = slot || this.store.getFirstAvailableSlot();
        if (!firstSlot) return false;

        setValue('in-slot', firstSlot);
        ['in-plate', 'in-customer', 'in-phone', 'in-notes'].forEach(id => setValue(id, ''));
        this.openModal('modal-entry');
        const plate = document.getElementById('in-plate');
        if (plate) plate.focus();
        refreshIcons();
        return true;
    }

    closeModals() {
        document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
        if (this.modalKeyHandler) {
            document.removeEventListener('keydown', this.modalKeyHandler, true);
            this.modalKeyHandler = null;
        }
        const target = this.lastFocused;
        this.lastFocused = null;
        if (target && document.contains(target)) target.focus();
    }

    showCheckoutModal(onPay) {
        const payBtn = document.getElementById('btn-pay');
        if (payBtn) payBtn.onclick = onPay;
        this.openModal('modal-checkout');
        const method = document.getElementById('out-payment-method');
        if (method) method.focus();
        refreshIcons();
    }

    resetCheckoutInputs() {
        setValue('out-discount', 0);
        setValue('out-extra', 0);
        setValue('out-payment-method', 'cash');
        const lostTicket = document.getElementById('out-lost-ticket');
        if (lostTicket) lostTicket.checked = false;
    }

    toggleSidebar() {
        const sidebar = document.getElementById('main-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (!sidebar || !overlay) return;

        sidebar.classList.toggle('-translate-x-full');
        if (sidebar.classList.contains('-translate-x-full')) {
            overlay.classList.remove('opacity-100');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 180);
        } else {
            overlay.classList.remove('hidden');
            void overlay.offsetWidth;
            overlay.classList.remove('opacity-0');
            overlay.classList.add('opacity-100');
        }
        this.syncSidebarA11y();
    }

    syncSidebarA11y() {
        const sidebar = document.getElementById('main-sidebar');
        if (!sidebar) return;
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        const isClosed = sidebar.classList.contains('-translate-x-full');
        const open = !(isMobile && isClosed);
        const closeBtn = document.getElementById('btn-sidebar-close');
        const openBtn = document.getElementById('btn-sidebar-open');
        if (closeBtn) closeBtn.setAttribute('aria-expanded', String(open));
        if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
        sidebar.inert = !open;
    }

    showTab(tabId) {
        const target = document.getElementById(`tab-${tabId}`);
        if (!target) return false;

        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        target.classList.remove('hidden');

        document.querySelectorAll('.sidebar-link').forEach(el => {
            el.classList.remove('active');
            el.removeAttribute('aria-current');
        });
        const nav = document.getElementById(`nav-${tabId}`);
        if (nav) {
            nav.classList.add('active');
            nav.setAttribute('aria-current', 'page');
        }

        const titles = {
            dashboard: 'Dashboard',
            operations: 'Operación',
            map: 'Mapa de espacios',
            history: 'Historial y arqueo',
            cash: 'Caja',
            settings: 'Ajustes',
            superadmin: 'Panel SaaS'
        };
        setText('view-title', titles[tabId] || 'ParkMaster Pro');
        return true;
    }

    updateClock() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-PE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).toUpperCase();
        const timeStr = now.toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        setText('current-date', dateStr);
        setText('current-time', timeStr);
    }

    showToast(message, type = 'success', actionLabel = null, onAction = null) {
        const toast = document.getElementById('toast');
        const text = document.getElementById('toast-msg');
        const icon = toast ? toast.querySelector('.toast-icon') : null;
        const actionBtn = document.getElementById('toast-action');
        if (!toast || !text) return;

        text.textContent = message;
        if (icon) {
            icon.classList.toggle('text-red-300', type === 'error');
            icon.classList.toggle('text-amber-300', type === 'info');
        }
        if (actionBtn) {
            if (actionLabel && onAction) {
                actionBtn.textContent = actionLabel;
                actionBtn.classList.remove('hidden');
                actionBtn.onclick = () => {
                    this.hideToast();
                    onAction();
                };
            } else {
                actionBtn.classList.add('hidden');
                actionBtn.onclick = null;
            }
        }

        toast.classList.remove('toast-hidden');
        toast.classList.add('toast-visible');
        clearTimeout(this.toastTimeoutId);
        this.toastTimeoutId = setTimeout(() => this.hideToast(), actionLabel ? 10000 : 3200);
    }

    hideToast() {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.classList.remove('toast-visible');
        toast.classList.add('toast-hidden');
    }

    setFieldError(inputId, message) {
        const errorEl = document.getElementById(`${inputId}-error`);
        const inputEl = document.getElementById(inputId);
        if (errorEl) {
            if (message) {
                errorEl.textContent = message;
                errorEl.classList.remove('hidden');
            } else {
                errorEl.textContent = '';
                errorEl.classList.add('hidden');
            }
        }
        if (inputEl && message) inputEl.focus();
    }

    getEntryFormData(prefix) {
        return {
            plate: getValue(`${prefix}-plate`),
            type: getValue(`${prefix}-type`) || 'auto',
            slot: Number(getValue(`${prefix}-slot`)),
            customerName: getValue(`${prefix}-customer`).trim(),
            phone: getValue(`${prefix}-phone`).trim(),
            notes: getValue(`${prefix}-notes`).trim()
        };
    }

    clearEntryInputs(prefix) {
        [`${prefix}-plate`, `${prefix}-customer`, `${prefix}-phone`, `${prefix}-notes`].forEach(id => setValue(id, ''));
    }

    getCheckoutOptions() {
        return {
            discount: readMoneyInput('out-discount'),
            extra: readMoneyInput('out-extra'),
            lostTicket: Boolean(document.getElementById('out-lost-ticket')?.checked),
            paymentMethod: getValue('out-payment-method') || 'cash'
        };
    }

    getSettingsForm() {
        return {
            companyName: getValue('set-company').trim() || 'ParkMaster Pro Garaje',
            ruc: getValue('set-ruc').trim(),
            address: getValue('set-address').trim(),
            phone: getValue('set-phone').trim(),
            currency: getValue('set-currency').trim() || 'S/',
            totalSlots: readPositiveIntegerInput('set-slots', 1),
            graceMinutes: readPositiveIntegerInput('set-grace', 0),
            billingIncrementMinutes: readPositiveIntegerInput('set-increment', 1),
            minimumBillableMinutes: readPositiveIntegerInput('set-minimum', 1),
            lostTicketFee: readMoneyInput('set-lost'),
            overnightFee: readMoneyInput('set-overnight'),
            rates: {
                auto: readMoneyInput('rate-auto'),
                moto: readMoneyInput('rate-moto'),
                camioneta: readMoneyInput('rate-truck'),
                autobus: readMoneyInput('rate-bus'),
                bicicleta: readMoneyInput('rate-bicycle'),
                carga: readMoneyInput('rate-cargo')
            }
        };
    }

    getShiftForm() {
        return {
            cashier: getValue('cash-cashier').trim() || 'Cajero',
            openingCash: readMoneyInput('cash-opening')
        };
    }

    getMovementForm() {
        return {
            type: getValue('movement-type') === 'expense' ? 'expense' : 'income',
            concept: getValue('movement-concept').trim(),
            amount: readMoneyInput('movement-amount')
        };
    }

    clearMovementForm() {
        setValue('movement-concept', '');
        setValue('movement-amount', '');
    }

    getQuickQuoteInput() {
        return {
            type: getValue('quote-type') || 'auto',
            minutes: readPositiveIntegerInput('quote-minutes', 1)
        };
    }

    getHistoryFilters() {
        return {
            from: getValue('filter-date-from'),
            to: getValue('filter-date-to'),
            payment: getValue('filter-payment'),
            query: getValue('filter-query')
        };
    }

    getBackupFile() {
        const input = document.getElementById('backup-file');
        return input?.files?.[0] || null;
    }

    resetBackupInput() {
        const input = document.getElementById('backup-file');
        if (input) input.value = '';
    }

    money(value) {
        return formatMoney(value, this.store.getState().config.currency);
    }

    paymentMixText(items) {
        if (!items.length) return 'Sin cobros';
        const counts = items.reduce((acc, item) => {
            acc[item.paymentMethod] = (acc[item.paymentMethod] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts)
            .map(([method, count]) => `${PAYMENT_LABELS[method] || method}: ${count}`)
            .join(' · ');
    }
}
