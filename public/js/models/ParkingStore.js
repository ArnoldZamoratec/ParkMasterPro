import { LEGACY_KEY, STORAGE_KEY } from '../shared/constants.js';
import {
    makeTicketId,
    minutesBetween,
    normalizePlate,
    normalizeSearch,
    parseDateInput,
    roundMoney,
    sameLocalDay,
    startOfDay,
    endOfDay
} from '../shared/utils.js';

export class ParkingStore {
    constructor(storage = window.localStorage) {
        this.storage = storage;
        this.state = this.createDefaultState();
    }

    createDefaultState() {
        return {
            version: 2,
            config: {
                companyName: 'ParkMaster Pro Garaje',
                ruc: '',
                address: '',
                phone: '',
                currency: 'S/',
                totalSlots: 50,
                graceMinutes: 5,
                billingIncrementMinutes: 15,
                minimumBillableMinutes: 60,
                lostTicketFee: 20,
                overnightFee: 0,
                rates: {
                    auto: 2,
                    moto: 1,
                    camioneta: 3.5,
                    autobus: 5,
                    bicicleta: 0.5,
                    carga: 6
                }
            },
            activeVehicles: [],
            history: [],
            cashMovements: [],
            shift: {
                isOpen: false,
                cashier: '',
                openingCash: 0,
                openedAt: null,
                closedAt: null,
                closingCash: null
            }
        };
    }

    load() {
        const raw = this.storage.getItem(STORAGE_KEY);
        if (raw) {
            this.state = this.mergeState(JSON.parse(raw));
            return this.state;
        }

        const legacyRaw = this.storage.getItem(LEGACY_KEY);
        if (legacyRaw) {
            this.state = this.migrateLegacy(JSON.parse(legacyRaw));
            this.save();
            return this.state;
        }

        this.state = this.createDefaultState();
        return this.state;
    }

    save() {
        this.state.version = 2;
        this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    }

    getState() {
        return this.state;
    }

    replaceState(nextState) {
        this.state = this.mergeState(nextState);
        this.save();
        return this.state;
    }

    reset() {
        this.state = this.createDefaultState();
        this.save();
    }

    mergeState(incoming = {}) {
        const defaults = this.createDefaultState();
        return {
            ...defaults,
            ...incoming,
            config: {
                ...defaults.config,
                ...(incoming.config || {}),
                rates: {
                    ...defaults.config.rates,
                    ...((incoming.config && incoming.config.rates) || {})
                }
            },
            activeVehicles: Array.isArray(incoming.activeVehicles)
                ? incoming.activeVehicles.map(vehicle => this.normalizeVehicle(vehicle))
                : [],
            history: Array.isArray(incoming.history)
                ? incoming.history.map(item => this.normalizeHistory(item))
                : [],
            cashMovements: Array.isArray(incoming.cashMovements) ? incoming.cashMovements : [],
            shift: {
                ...defaults.shift,
                ...(incoming.shift || {})
            }
        };
    }

    migrateLegacy(legacy = {}) {
        const defaults = this.createDefaultState();
        const legacyConfig = legacy.config || {};
        return this.mergeState({
            ...defaults,
            config: {
                ...defaults.config,
                totalSlots: Number(legacyConfig.totalSlots) || defaults.config.totalSlots,
                rates: {
                    ...defaults.config.rates,
                    ...(legacyConfig.rates || {})
                }
            },
            activeVehicles: Array.isArray(legacy.activeVehicles) ? legacy.activeVehicles : [],
            history: Array.isArray(legacy.history) ? legacy.history : []
        });
    }

    normalizeVehicle(vehicle = {}) {
        return {
            id: vehicle.id || Date.now() + Math.floor(Math.random() * 1000),
            ticketId: vehicle.ticketId || makeTicketId(),
            plate: normalizePlate(vehicle.plate || ''),
            type: vehicle.type || 'auto',
            slot: Number(vehicle.slot) || 1,
            entryTime: vehicle.entryTime || new Date().toISOString(),
            customerName: vehicle.customerName || '',
            phone: vehicle.phone || '',
            notes: vehicle.notes || ''
        };
    }

    normalizeHistory(item = {}) {
        return {
            ...this.normalizeVehicle(item),
            exitTime: item.exitTime || new Date().toISOString(),
            amount: Number(item.amount) || 0,
            baseAmount: Number(item.baseAmount || item.amount) || 0,
            discount: Number(item.discount) || 0,
            extra: Number(item.extra) || 0,
            duration: Number(item.duration) || minutesBetween(item.entryTime, item.exitTime),
            paymentMethod: item.paymentMethod || 'cash',
            cashier: item.cashier || this.state.shift.cashier || '',
            closedShiftId: item.closedShiftId || null
        };
    }

    updateConfig(config) {
        this.state.config = {
            ...this.state.config,
            ...config,
            rates: {
                ...this.state.config.rates,
                ...(config.rates || {})
            }
        };
        this.save();
    }

    addVehicle(vehicle) {
        const normalized = this.normalizeVehicle(vehicle);
        this.state.activeVehicles.push(normalized);
        this.save();
        return normalized;
    }

    getVehicle(id) {
        return this.state.activeVehicles.find(vehicle => Number(vehicle.id) === Number(id));
    }

    removeVehicle(id) {
        this.state.activeVehicles = this.state.activeVehicles.filter(vehicle => Number(vehicle.id) !== Number(id));
        this.save();
    }

    addTransaction(transaction) {
        const normalized = this.normalizeHistory(transaction);
        this.state.history.push(normalized);
        this.save();
        return normalized;
    }

    checkoutVehicle(id, transaction) {
        const saved = this.addTransaction(transaction);
        this.state.activeVehicles = this.state.activeVehicles.filter(vehicle => Number(vehicle.id) !== Number(id));
        this.save();
        return saved;
    }

    addCashMovement(movement) {
        const saved = {
            id: movement.id || Date.now(),
            type: movement.type === 'expense' ? 'expense' : 'income',
            concept: movement.concept || '',
            amount: roundMoney(movement.amount),
            createdAt: movement.createdAt || new Date().toISOString(),
            cashier: movement.cashier || this.state.shift.cashier || ''
        };
        this.state.cashMovements.push(saved);
        this.save();
        return saved;
    }

    openShift({ cashier, openingCash }) {
        this.state.shift = {
            isOpen: true,
            cashier: cashier || 'Cajero',
            openingCash: roundMoney(openingCash),
            openedAt: new Date().toISOString(),
            closedAt: null,
            closingCash: null
        };
        this.save();
    }

    closeShift(closingCash) {
        this.state.shift.isOpen = false;
        this.state.shift.closedAt = new Date().toISOString();
        this.state.shift.closingCash = roundMoney(closingCash);
        this.save();
    }

    getAvailableSlots(includeSlot = null) {
        const occupied = new Set(this.state.activeVehicles.map(vehicle => Number(vehicle.slot)));
        const slots = [];
        for (let slot = 1; slot <= this.state.config.totalSlots; slot++) {
            if (!occupied.has(slot) || Number(includeSlot) === slot) slots.push(slot);
        }
        return slots;
    }

    getFirstAvailableSlot() {
        return this.getAvailableSlots()[0] || null;
    }

    hasActivePlate(plate) {
        return this.state.activeVehicles.some(vehicle => vehicle.plate === plate);
    }

    isSlotOccupied(slot) {
        return this.state.activeVehicles.some(vehicle => Number(vehicle.slot) === Number(slot));
    }

    getActiveVehicles(query = '') {
        const normalizedQuery = normalizeSearch(query);
        return this.state.activeVehicles
            .filter(vehicle => {
                const haystack = [vehicle.plate, vehicle.customerName, vehicle.phone, vehicle.slot, vehicle.ticketId].join(' ');
                return normalizeSearch(haystack).includes(normalizedQuery);
            })
            .sort((a, b) => Number(a.slot) - Number(b.slot));
    }

    getFilteredHistory({ from, to, payment, query } = {}) {
        const fromDate = from instanceof Date ? from : parseDateInput(from);
        const toDate = to instanceof Date ? to : parseDateInput(to, true);
        const normalizedQuery = normalizeSearch(query);

        return this.state.history.filter(item => {
            const date = new Date(item.exitTime || item.entryTime);
            const paymentOk = !payment || item.paymentMethod === payment;
            const queryOk = !normalizedQuery || normalizeSearch([
                item.ticketId,
                item.plate,
                item.customerName,
                item.phone,
                item.slot,
                item.type
            ].join(' ')).includes(normalizedQuery);
            return date >= fromDate && date <= toDate && paymentOk && queryOk;
        });
    }

    getHistoryByDate(fromDate, toDate) {
        const from = startOfDay(fromDate);
        const to = endOfDay(toDate);
        return this.state.history.filter(item => {
            const date = new Date(item.exitTime || item.entryTime);
            return date >= from && date <= to;
        });
    }

    clearHistoryBetween(fromDate, toDate) {
        this.state.history = this.state.history.filter(item => {
            const date = new Date(item.exitTime || item.entryTime);
            return date < fromDate || date > toDate;
        });
        this.save();
    }

    getTodayMovementTotals(day = new Date()) {
        return this.state.cashMovements
            .filter(item => sameLocalDay(item.createdAt, day))
            .reduce((acc, item) => {
                if (item.type === 'expense') acc.expense += Number(item.amount) || 0;
                else acc.income += Number(item.amount) || 0;
                return acc;
            }, { income: 0, expense: 0 });
    }
}
