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

document.addEventListener('DOMContentLoaded', () => controller.init());
