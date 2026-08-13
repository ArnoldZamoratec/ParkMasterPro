import { PAYMENT_LABELS } from '../shared/constants.js';
import {
    downloadBlob,
    formatDateTime,
    formatMoney,
    formatTime,
    getTypeLabel,
    sum,
    toCsv,
    toDateInputValue
} from '../shared/utils.js';

export class ReportService {
    constructor(store) {
        this.store = store;
    }

    downloadTicket(vehicle) {
        const { config } = this.store.getState();
        const { jsPDF } = this.requirePdf();
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [80, 140] });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(config.companyName, 40, 12, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        if (config.address) doc.text(config.address, 40, 18, { align: 'center', maxWidth: 70 });
        if (config.phone) doc.text(`Tel: ${config.phone}`, 40, 24, { align: 'center' });
        doc.line(8, 29, 72, 29);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(vehicle.plate, 40, 42, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Ticket ${vehicle.ticketId}`, 40, 50, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(`Tipo: ${getTypeLabel(vehicle.type)}`, 10, 62);
        doc.text(`Espacio: ${vehicle.slot}`, 10, 70);
        doc.text(`Ingreso: ${formatDateTime(vehicle.entryTime)}`, 10, 78);
        if (vehicle.customerName) doc.text(`Cliente: ${vehicle.customerName}`, 10, 86, { maxWidth: 60 });
        doc.line(8, 100, 72, 100);
        doc.setFontSize(7);
        doc.text('Conserve este ticket. La pérdida puede generar penalidad.', 40, 110, { align: 'center', maxWidth: 68 });
        doc.save(`Ticket_${vehicle.plate}_${vehicle.ticketId}.pdf`);
    }

    downloadDailyReport(history, { from, to } = {}) {
        const { config } = this.store.getState();
        const { jsPDF } = this.requirePdf();
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const total = sum(history.map(item => item.amount));
        const dateFrom = from || toDateInputValue(new Date());
        const dateTo = to || dateFrom;

        doc.setFillColor(17, 24, 39);
        doc.rect(0, 0, 210, 32, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(config.companyName, 14, 15);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Reporte de arqueo · ${dateFrom} a ${dateTo}`, 14, 23);

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('Resumen', 14, 46);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Operaciones: ${history.length}`, 14, 56);
        doc.text(`Total: ${formatMoney(total, config.currency)}`, 14, 63);
        doc.text(`Promedio: ${formatMoney(history.length ? total / history.length : 0, config.currency)}`, 14, 70);

        const body = history.slice().reverse().map(item => [
            item.ticketId,
            item.plate,
            getTypeLabel(item.type),
            `${formatTime(item.entryTime)} - ${formatTime(item.exitTime)}`,
            `${item.duration} min`,
            PAYMENT_LABELS[item.paymentMethod] || item.paymentMethod,
            formatMoney(item.amount, config.currency)
        ]);

        doc.autoTable({
            startY: 82,
            head: [['Ticket', 'Placa', 'Tipo', 'Intervalo', 'Duración', 'Pago', 'Monto']],
            body,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { fontSize: 8 },
            columnStyles: { 6: { halign: 'right', fontStyle: 'bold' } },
            margin: { left: 14, right: 14 }
        });

        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generado: ${formatDateTime(new Date())}`, 14, 290);
        doc.text('ParkMaster Pro', 196, 290, { align: 'right' });
        doc.save(`Arqueo_${dateFrom}_${dateTo}.pdf`);
    }

    exportHistoryCsv(history) {
        const rows = [
            ['ticket', 'placa', 'tipo', 'espacio', 'ingreso', 'salida', 'duracion_min', 'pago', 'monto', 'cliente', 'telefono'],
            ...history.map(item => [
                item.ticketId,
                item.plate,
                getTypeLabel(item.type),
                item.slot,
                formatDateTime(item.entryTime),
                formatDateTime(item.exitTime),
                item.duration,
                PAYMENT_LABELS[item.paymentMethod] || item.paymentMethod,
                Number(item.amount).toFixed(2),
                item.customerName || '',
                item.phone || ''
            ])
        ];
        downloadBlob(toCsv(rows), `historial_${toDateInputValue(new Date())}.csv`, 'text/csv;charset=utf-8');
    }

    exportBackup() {
        const payload = {
            exportedAt: new Date().toISOString(),
            app: 'ParkMaster Pro',
            state: this.store.getState()
        };
        downloadBlob(
            JSON.stringify(payload, null, 2),
            `parkmaster_backup_${toDateInputValue(new Date())}.json`,
            'application/json;charset=utf-8'
        );
    }

    parseBackup(text) {
        const parsed = JSON.parse(text);
        const importedState = parsed.state || parsed;
        if (!importedState.config || !Array.isArray(importedState.activeVehicles) || !Array.isArray(importedState.history)) {
            throw new Error('Formato inválido');
        }
        return importedState;
    }

    requirePdf() {
        if (!window.jspdf) {
            throw new Error('No se pudo cargar jsPDF. Revise su conexión.');
        }
        return window.jspdf;
    }
}
