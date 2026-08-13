import { ParkingController } from './js/controllers/ParkingController.js';
import { ParkingStore } from './js/models/ParkingStore.js';
import { BillingService } from './js/services/BillingService.js';
import { ReportService } from './js/services/ReportService.js';
import { ParkingView } from './js/views/ParkingView.js';

const store = new ParkingStore();
const billingService = new BillingService(store);
const reportService = new ReportService(store);
const view = new ParkingView(store, billingService);
const controller = new ParkingController({
    store,
    view,
    billingService,
    reportService
});

const TEXT_SCALE_KEY = 'parkmaster_text_scale';

function applyTextScale(scale) {
    document.documentElement.dataset.textScale = scale;
    try { localStorage.setItem(TEXT_SCALE_KEY, scale); } catch (_) {}
    const sel = document.getElementById('text-scale-select');
    if (sel) sel.value = scale;
}

function initTextScale() {
    let scale = 'md';
    try { scale = localStorage.getItem(TEXT_SCALE_KEY) || 'md'; } catch (_) {}
    applyTextScale(scale);
}

window.setTextScale = scale => applyTextScale(scale);

document.addEventListener('DOMContentLoaded', () => {
    initTextScale();
    controller.init();
});
