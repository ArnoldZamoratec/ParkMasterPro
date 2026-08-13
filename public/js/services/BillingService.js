import { crossesDate, readOptionMoney, roundMoney, sum } from '../shared/utils.js';

export class BillingService {
    constructor(store) {
        this.store = store;
    }

    calculateAmount(vehicle, exitDate = new Date(), options = {}) {
        const { config } = this.store.getState();
        const entry = new Date(vehicle.entryTime);
        const duration = Math.max(1, Math.ceil((exitDate - entry) / 60000));
        const grace = Number(config.graceMinutes) || 0;
        const increment = Math.max(1, Number(config.billingIncrementMinutes) || 1);
        const minimum = Math.max(1, Number(config.minimumBillableMinutes) || 1);
        const hourlyRate = Number(config.rates[vehicle.type]) || 0;

        let billableMinutes = 0;
        if (duration > grace) {
            billableMinutes = Math.max(minimum, Math.ceil((duration - grace) / increment) * increment);
        }

        let baseAmount = roundMoney((hourlyRate * billableMinutes) / 60);
        if (crossesDate(entry, exitDate)) baseAmount += this.readConfigMoney('overnightFee');

        const discount = Math.min(readOptionMoney(options.discount), baseAmount);
        const extra = readOptionMoney(options.extra);
        const lostTicketFee = options.lostTicket ? this.readConfigMoney('lostTicketFee') : 0;
        const total = Math.max(0, roundMoney(baseAmount - discount + extra + lostTicketFee));

        return { duration, billableMinutes, baseAmount, discount, extra, lostTicketFee, total };
    }

    calculateExpectedCash(day = new Date()) {
        const { shift } = this.store.getState();
        const todayHistory = this.store.getHistoryByDate(day, day);
        const cashParking = sum(todayHistory.filter(item => item.paymentMethod === 'cash').map(item => item.amount));
        const movements = this.store.getTodayMovementTotals(day);
        return roundMoney((Number(shift.openingCash) || 0) + cashParking + movements.income - movements.expense);
    }

    readConfigMoney(key) {
        const { config } = this.store.getState();
        return Math.max(0, roundMoney(Number(config[key]) || 0));
    }
}
