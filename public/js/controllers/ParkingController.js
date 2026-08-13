import { normalizePlate, parseDateInput, refreshIcons, toDateInputValue } from '../shared/utils.js';
import { confirmDialog, promptDialog } from '../shared/dialogs.js';

export class ParkingController {
    constructor({ store, view, billingService, reportService }) {
        this.store = store;
        this.view = view;
        this.billingService = billingService;
        this.reportService = reportService;
        this.currentTab = 'dashboard';
        this.checkoutVehicleId = null;
        this.lastCheckoutQuote = null;
    }

    init() {
        this.store.load();
        this.view.bindEvents({
            handleEntry: event => this.handleEntry(event, 'in'),
            handleInlineEntry: event => this.handleEntry(event, 'inline'),
            handleCashMovement: event => this.handleCashMovement(event),
            importBackup: event => this.importBackup(event),
            updateCheckoutQuote: () => this.updateCheckoutQuote(),
            updateQuickQuote: () => this.view.renderQuickQuote()
        });
        this.view.hydrateSettings();
        this.view.hydrateSelects();
        this.view.setTodayFilters();
        this.view.updateClock();
        setInterval(() => this.view.updateClock(), 1000);
        this.view.renderAll();
        this.view.syncSidebarA11y();
        this.exposeGlobals();
    }

    exposeGlobals() {
        window.toggleSidebar = () => this.view.toggleSidebar();
        window.changeTab = tabId => this.changeTab(tabId);
        window.openEntryModal = slot => this.openEntryModal(slot);
        window.closeModals = () => this.closeModals();
        window.processCheckout = id => this.processCheckout(id);
        window.renderDashboard = () => this.view.renderDashboard();
        window.renderHistory = () => this.view.renderHistory();
        window.renderMap = () => this.view.renderMap();
        window.renderQuickQuote = () => this.view.renderQuickQuote();
        window.updateSettings = () => this.updateSettings();
        window.clearHistory = () => this.clearHistory();
        window.downloadDailyReport = () => this.downloadDailyReport();
        window.exportHistoryCsv = () => this.exportHistoryCsv();
        window.exportBackup = () => this.exportBackup();
        window.clearAllData = () => this.clearAllData();
        window.openShift = () => this.openShift();
        window.closeShift = () => this.closeShift();
        window.downloadTicket = id => this.downloadTicket(id);
        window.showToast = (message, type) => this.view.showToast(message, type);
    }

    changeTab(tabId) {
        if (!this.view.showTab(tabId)) return;
        this.currentTab = tabId;

        if (tabId === 'dashboard') this.view.renderDashboard();
        if (tabId === 'map') this.view.renderMap();
        if (tabId === 'history') this.view.renderHistory();
        if (tabId === 'cash') this.view.renderCash();
        if (tabId === 'operations') this.view.renderOperationHelpers();

        if (window.innerWidth < 768) {
            const sidebar = document.getElementById('main-sidebar');
            if (sidebar && !sidebar.classList.contains('-translate-x-full')) this.view.toggleSidebar();
        }
        refreshIcons();
    }

    openEntryModal(slot = null) {
        if (!this.view.openEntryModal(slot)) {
            this.view.showToast('La cochera está al límite de su capacidad', 'error');
        }
    }

    closeModals() {
        this.view.closeModals();
        this.checkoutVehicleId = null;
        this.lastCheckoutQuote = null;
    }

    handleEntry(event, prefix) {
        event.preventDefault();
        const input = this.view.getEntryFormData(prefix);
        const plate = normalizePlate(input.plate);
        const plateField = prefix === 'in' ? 'in-plate' : 'inline-plate';

        if (!plate) return this.view.setFieldError(plateField, 'Ingrese una placa válida');
        if (!/^[A-Z0-9-]{3,12}$/.test(plate)) {
            return this.view.setFieldError(plateField, 'La placa debe tener 3 a 12 caracteres alfanuméricos');
        }
        if (!input.slot) return this.view.showToast('No hay espacios disponibles', 'error');
        if (this.store.hasActivePlate(plate)) return this.view.setFieldError(plateField, 'Este vehículo ya está en el sistema');
        if (this.store.isSlotOccupied(input.slot)) return this.view.showToast(`El espacio ${input.slot} ya está ocupado`, 'error');

        const vehicle = this.store.addVehicle({
            ...input,
            plate,
            id: Date.now(),
            entryTime: new Date().toISOString()
        });

        this.view.closeModals();
        this.view.clearEntryInputs(prefix);
        this.view.renderAll();
        this.view.showToast(
            `Vehículo ${vehicle.plate} registrado en espacio ${vehicle.slot}`,
            'success',
            'Deshacer',
            () => this.undoEntry(vehicle.id)
        );
    }

    undoEntry(id) {
        const vehicle = this.store.getVehicle(id);
        if (!vehicle) return this.view.showToast('El ingreso ya no se puede deshacer', 'info');
        this.store.removeVehicle(id);
        this.view.renderAll();
        this.view.showToast(`Ingreso de ${vehicle.plate} anulado`);
    }

    processCheckout(id) {
        const vehicle = this.store.getVehicle(id);
        if (!vehicle) return this.view.showToast('No se encontró el vehículo', 'error');

        this.checkoutVehicleId = vehicle.id;
        this.view.resetCheckoutInputs();
        this.updateCheckoutQuote();
        this.view.showCheckoutModal(() => this.completeCheckout());
    }

    updateCheckoutQuote() {
        if (!this.checkoutVehicleId) return;
        const vehicle = this.store.getVehicle(this.checkoutVehicleId);
        if (!vehicle) return;

        const options = this.view.getCheckoutOptions();
        this.lastCheckoutQuote = this.billingService.calculateAmount(vehicle, new Date(), options);
        this.view.renderCheckout(vehicle, this.lastCheckoutQuote);
    }

    completeCheckout() {
        const vehicle = this.store.getVehicle(this.checkoutVehicleId);
        if (!vehicle) return this.view.showToast('No se encontró el vehículo', 'error');

        this.updateCheckoutQuote();
        const quote = this.lastCheckoutQuote;
        const options = this.view.getCheckoutOptions();
        const { shift } = this.store.getState();

        const transaction = this.store.checkoutVehicle(vehicle.id, {
            ...vehicle,
            exitTime: new Date().toISOString(),
            amount: options.paymentMethod === 'courtesy' ? 0 : quote.total,
            baseAmount: quote.baseAmount,
            discount: quote.discount,
            extra: quote.extra,
            lostTicketFee: quote.lostTicketFee,
            duration: quote.duration,
            billableMinutes: quote.billableMinutes,
            paymentMethod: options.paymentMethod,
            cashier: shift.cashier || '',
            shiftOpenedAt: shift.openedAt || null
        });

        this.closeModals();
        this.view.renderAll();
        this.view.showToast(`Pago procesado: ${this.view.money(transaction.amount)}`);
    }

    updateSettings() {
        const nextConfig = this.view.getSettingsForm();
        if (nextConfig.totalSlots < this.store.getState().activeVehicles.length) {
            return this.view.showToast('No puedes reducir la capacidad por debajo de los vehículos actuales', 'error');
        }

        this.store.updateConfig(nextConfig);
        this.view.hydrateSelects();
        this.view.renderAll();
        this.view.showToast('Configuración actualizada');
    }

    async clearHistory() {
        const ok = await confirmDialog({
            title: 'Reiniciar arqueo',
            message: '¿Está seguro de reiniciar el arqueo del día filtrado? Esta acción no se puede deshacer. Se descargará un respaldo automático antes de continuar.',
            confirmLabel: 'Reiniciar día',
            cancelLabel: 'Cancelar',
            destructive: true
        });
        if (!ok) return;

        this.reportService.exportBackup();
        const filters = this.view.getHistoryFilters();
        const from = parseDateInput(filters.from);
        const to = parseDateInput(filters.to, true);
        this.store.clearHistoryBetween(from, to);
        this.view.renderAll();
        this.view.showToast('Arqueo filtrado reiniciado');
    }

    openShift() {
        if (this.store.getState().shift.isOpen) return this.view.showToast('Ya hay un turno abierto', 'info');
        this.store.openShift(this.view.getShiftForm());
        this.view.renderAll();
        this.view.showToast('Turno de caja abierto');
    }

    async closeShift() {
        if (!this.store.getState().shift.isOpen) return this.view.showToast('No hay turno abierto', 'info');
        const expected = this.billingService.calculateExpectedCash();
        const closing = await promptDialog({
            title: 'Cerrar turno',
            message: `Ingrese el efectivo contado al cierre. Caja esperada: ${this.view.money(expected)}.`,
            defaultValue: String(expected),
            confirmLabel: 'Cerrar turno',
            cancelLabel: 'Cancelar'
        });
        if (closing === null) return;
        this.store.closeShift(Math.max(0, Number(closing) || 0));
        this.view.renderAll();
        this.view.showToast('Turno cerrado');
    }

    handleCashMovement(event) {
        event.preventDefault();
        const movement = this.view.getMovementForm();
        if (!movement.concept) return this.view.showToast('Ingrese el concepto del movimiento', 'error');
        if (movement.amount <= 0) return this.view.showToast('Ingrese un monto válido', 'error');

        this.store.addCashMovement(movement);
        this.view.clearMovementForm();
        this.view.renderAll();
        this.view.showToast('Movimiento registrado');
    }

    downloadTicket(id) {
        const vehicle = this.store.getVehicle(id);
        if (!vehicle) return this.view.showToast('No se encontró el vehículo', 'error');

        try {
            this.reportService.downloadTicket(vehicle);
        } catch (error) {
            this.view.showToast(error.message, 'error');
        }
    }

    downloadDailyReport() {
        const history = this.store.getFilteredHistory(this.view.getHistoryFilters());
        if (!history.length) return this.view.showToast('No hay datos para generar reporte', 'error');

        const filters = this.view.getHistoryFilters();
        try {
            this.reportService.downloadDailyReport(history, { from: filters.from, to: filters.to });
            this.view.showToast('Reporte PDF generado');
        } catch (error) {
            this.view.showToast(error.message, 'error');
        }
    }

    exportHistoryCsv() {
        const history = this.store.getFilteredHistory(this.view.getHistoryFilters());
        if (!history.length) return this.view.showToast('No hay datos para exportar', 'error');
        this.reportService.exportHistoryCsv(history);
    }

    exportBackup() {
        this.reportService.exportBackup();
        this.view.showToast('Respaldo exportado');
    }

    async importBackup() {
        const file = this.view.getBackupFile();
        if (!file) return;
        try {
            const text = await file.text();
            const importedState = this.reportService.parseBackup(text);
            const ok = await confirmDialog({
                title: 'Importar respaldo',
                message: '¿Importar este respaldo y reemplazar los datos locales actuales?',
                confirmLabel: 'Importar',
                cancelLabel: 'Cancelar'
            });
            if (!ok) return;
            this.store.replaceState(importedState);
            this.view.hydrateSettings();
            this.view.hydrateSelects();
            this.view.renderAll();
            this.view.showToast('Respaldo importado');
        } catch (error) {
            this.view.showToast(`No se pudo importar: ${error.message}`, 'error');
        } finally {
            this.view.resetBackupInput();
        }
    }

    async clearAllData() {
        const first = await confirmDialog({
            title: 'Borrar todos los datos',
            message: '¿Borrar todos los datos locales de ParkMaster Pro en este navegador? Se descargará un respaldo automático antes de continuar.',
            confirmLabel: 'Continuar',
            cancelLabel: 'Cancelar',
            destructive: true
        });
        if (!first) return;
        const second = await confirmDialog({
            title: 'Confirmación final',
            message: 'Se eliminarán vehículos activos, historial, caja y ajustes. Esta acción no se puede deshacer.',
            confirmLabel: 'Borrar todo',
            cancelLabel: 'Cancelar',
            destructive: true
        });
        if (!second) return;

        this.reportService.exportBackup();
        this.store.reset();
        this.view.hydrateSettings();
        this.view.hydrateSelects();
        this.view.renderAll();
        this.view.showToast('Datos locales reiniciados');
    }

    getTodayForFilename() {
        return toDateInputValue(new Date());
    }
}
