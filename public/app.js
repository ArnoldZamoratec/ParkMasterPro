/**
 * ParkMaster Pro GARAJE - Application Logic
 * @author Antigravity
 */

// --- STATE MANAGEMENT ---
let config = {
    totalSlots: 50,
    rates: { auto: 2.0, moto: 1.0, camioneta: 3.5, autobus: 5.0 }
};

let activeVehicles = [];
let history = [];
let currentTab = 'dashboard';

// --- INITIALIZATION ---
window.onload = () => {
    loadData();
    renderDashboard();
    updateClock();
    setInterval(updateClock, 1000);
    lucide.createIcons();
    
    // Setup Entry Form
    document.getElementById('form-entry').addEventListener('submit', handleEntry);
};

// --- PERSISTENCE ---
function saveData() {
    const data = { config, activeVehicles, history };
    localStorage.setItem('parkmaster_garaje_db', JSON.stringify(data));
}

function loadData() {
    const raw = localStorage.getItem('parkmaster_garaje_db');
    if (raw) {
        const data = JSON.parse(raw);
        config = data.config || config;
        activeVehicles = data.activeVehicles || [];
        history = data.history || [];
        
        // Sync setting inputs
        document.getElementById('set-slots').value = config.totalSlots;
        document.getElementById('rate-auto').value = config.rates.auto;
        document.getElementById('rate-moto').value = config.rates.moto;
        document.getElementById('rate-truck').value = config.rates.camioneta;
        document.getElementById('rate-bus').value = config.rates.autobus;
    }
}

// --- UTILS ---
function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    // Toggle translation classes
    sidebar.classList.toggle('-translate-x-full');
    
    // Toggle overlay visibility
    if (sidebar.classList.contains('-translate-x-full')) {
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    } else {
        overlay.classList.remove('hidden');
        // Force reflow
        void overlay.offsetWidth;
        overlay.classList.remove('opacity-0');
        overlay.classList.add('opacity-100');
    }
}

function refreshIcons() {
    lucide.createIcons();
}

function updateClock() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('es-ES', options).toUpperCase();
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    
    const dateEl = document.getElementById('current-date');
    const timeEl = document.getElementById('current-time');
    if (dateEl) dateEl.textContent = dateStr;
    if (timeEl) timeEl.textContent = timeStr;
}

function showToast(msg, type = "success") {
    const t = document.getElementById('toast');
    const m = document.getElementById('toast-msg');
    m.textContent = msg;
    
    t.classList.remove('toast-hidden');
    t.classList.add('toast-visible');
    
    setTimeout(() => {
        t.classList.remove('toast-visible');
        t.classList.add('toast-hidden');
    }, 3000);
}

// --- NAVIGATION ---
function changeTab(tabId) {
    if (currentTab === tabId) return;
    
    // Tab transitions
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(el => {
        el.classList.add('hidden', 'opacity-0', 'scale-95');
        el.classList.remove('opacity-100', 'scale-100');
    });

    const activeContent = document.getElementById(`tab-${tabId}`);
    activeContent.classList.remove('hidden');
    
    // Animation Timeout
    setTimeout(() => {
        activeContent.classList.add('opacity-100', 'scale-100');
        activeContent.classList.remove('opacity-0', 'scale-95');
    }, 10);

    // Sidebar Update
    document.querySelectorAll('.sidebar-link').forEach(el => {
        el.classList.remove('active', 'bg-indigo-600', 'text-white');
        el.classList.add('text-slate-500');
    });

    const navBtn = document.getElementById(`nav-${tabId}`);
    navBtn.classList.add('active');
    navBtn.classList.remove('text-slate-500');

    currentTab = tabId;
    const titles = { 
        dashboard: 'Panel de Control', 
        map: 'Mapa de Cochera', 
        history: 'Arqueo de Caja', 
        settings: 'Configuración' 
    };
    document.getElementById('view-title').textContent = titles[tabId];

    // Selective Rendering
    if (tabId === 'dashboard') renderDashboard();
    if (tabId === 'map') renderMap();
    if (tabId === 'history') renderHistory();
    
    // Auto-close sidebar on mobile after clicking
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('main-sidebar');
        if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
            toggleSidebar();
        }
    }
    
    refreshIcons();
}

// --- MODALS ---
function openEntryModal() {
    const slot = getFirstAvailableSlot();
    if (!slot) return showToast("La cochera está al límite de su capacidad", "error");
    
    document.getElementById('in-slot').value = slot;
    document.getElementById('modal-entry').classList.remove('hidden');
    document.getElementById('in-plate').focus();
    refreshIcons();
}

function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
}

function getFirstAvailableSlot() {
    const occupied = activeVehicles.map(v => v.slot);
    for (let i = 1; i <= config.totalSlots; i++) {
        if (!occupied.includes(i)) return i;
    }
    return null;
}

// --- CORE LOGIC: REGISTRATION ---
function handleEntry(e) {
    e.preventDefault();
    const plate = document.getElementById('in-plate').value.toUpperCase().trim();
    
    if (!plate) return showToast("Por favor, ingrese una placa válida", "error");
    if (activeVehicles.find(v => v.plate === plate)) {
        return showToast("Este vehículo ya está en el sistema", "error");
    }

    const type = document.getElementById('in-type').value;
    const vehicle = {
        id: Date.now(),
        plate,
        type,
        slot: parseInt(document.getElementById('in-slot').value),
        entryTime: new Date().toISOString()
    };

    activeVehicles.push(vehicle);
    saveData();
    closeModals();
    document.getElementById('form-entry').reset();
    renderDashboard();
    showToast(`Vehículo ${plate} registrado en slot #${vehicle.slot}`);
}

// --- CORE LOGIC: BILLING ---
function processCheckout(id) {
    const v = activeVehicles.find(veh => veh.id === id);
    const now = new Date();
    const entry = new Date(v.entryTime);
    
    const diffMs = now - entry;
    const diffMins = Math.max(1, Math.ceil(diffMs / 60000));
    const diffHours = diffMs / 3600000;
    
    const rate = config.rates[v.type];
    // Base 1 hour minimum
    const amount = Math.max(rate, diffHours * rate).toFixed(2);

    document.getElementById('out-plate').textContent = v.plate;
    const typeLabel = { auto: 'Auto', moto: 'Moto', camioneta: 'SUV/Pickup', autobus: 'Autobús' };
    document.getElementById('out-details').textContent = `${typeLabel[v.type]} • ${diffMins} min en slot #${v.slot}`;
    document.getElementById('out-amount').textContent = `S/ ${amount}`;
    
    document.getElementById('btn-pay').onclick = () => {
        history.push({ 
            ...v, 
            exitTime: now.toISOString(), 
            amount: parseFloat(amount), 
            duration: diffMins 
        });
        activeVehicles = activeVehicles.filter(veh => veh.id !== id);
        saveData();
        closeModals();
        renderDashboard();
        if (currentTab === 'map') renderMap();
        showToast("Cobro procesado y espacio liberado");
    };

    document.getElementById('modal-checkout').classList.remove('hidden');
    refreshIcons();
}

// --- RENDERING ---
function renderDashboard() {
    const list = document.getElementById('active-list');
    const search = document.getElementById('search-plate').value.toUpperCase();
    const filtered = activeVehicles.filter(v => v.plate.includes(search));

    const noActive = document.getElementById('no-active');
    if (filtered.length === 0) {
        noActive.classList.remove('hidden');
        list.innerHTML = '';
    } else {
        noActive.classList.add('hidden');
        list.innerHTML = filtered.map(v => `
            <div class="flex items-center justify-between p-8 hover:bg-slate-50 transition-all group animate-fade-in">
                <div class="flex items-center gap-6">
                    <div class="w-16 h-16 bg-white border-2 border-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 font-black text-xl shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        ${v.slot}
                    </div>
                    <div>
                        <p class="font-black text-3xl tracking-tighter text-slate-900">${v.plate}</p>
                        <p class="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">
                            ${v.type.toUpperCase()} • Ingreso: ${new Date(v.entryTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        </p>
                    </div>
                </div>
                <button onclick="processCheckout(${v.id})" class="px-8 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all transform group-hover:scale-105 active:scale-95 shadow-lg shadow-slate-100">
                    Liberar y Cobrar
                </button>
            </div>
        `).join('');
    }

    // Update Global Stats
    const occ = activeVehicles.length;
    const perc = Math.min(100, (occ / config.totalSlots) * 100);
    
    document.getElementById('stat-occupancy').textContent = `${occ}/${config.totalSlots}`;
    document.getElementById('occupancy-progress').style.width = `${perc}%`;
    document.getElementById('stat-pending').textContent = occ;
    
    const dailyTotal = history.reduce((acc, curr) => acc + curr.amount, 0);
    document.getElementById('stat-revenue').textContent = `S/ ${dailyTotal.toLocaleString('en-PE', {minimumFractionDigits: 2})}`;
    
    refreshIcons();
}

function renderMap() {
    const grid = document.getElementById('parking-grid');
    grid.innerHTML = '';
    
    for (let i = 1; i <= config.totalSlots; i++) {
        const vehicle = activeVehicles.find(v => v.slot === i);
        const el = document.createElement('div');
        el.className = `aspect-square rounded-[1.5rem] flex flex-col items-center justify-center text-center p-2 transition-all duration-300 animate-fade-in ${vehicle ? 'slot-occupied cursor-pointer' : 'slot-free opacity-60 hover:opacity-100'}`;
        
        if (vehicle) {
            el.innerHTML = `
                <div class="p-1 bg-white/20 rounded-lg mb-1"><i data-lucide="car" class="w-4 h-4"></i></div>
                <span class="block text-[10px] font-black tracking-tight leading-none">${vehicle.plate}</span>
                <span class="block text-[8px] opacity-70 mt-0.5">SLOT ${i}</span>
            `;
            el.onclick = () => processCheckout(vehicle.id);
        } else {
            el.innerHTML = `
                <span class="text-xs font-black opacity-30">${i}</span>
            `;
        }
        
        grid.appendChild(el);
    }
    refreshIcons();
}

function renderHistory() {
    const body = document.getElementById('history-body');
    const noHistory = document.getElementById('no-history');
    
    if (history.length === 0) {
        noHistory.classList.remove('hidden');
        body.innerHTML = '';
    } else {
        noHistory.classList.add('hidden');
        body.innerHTML = history.slice().reverse().map(h => `
            <tr class="group transition-colors">
                <td class="px-10 py-6">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                            <i data-lucide="car"></i>
                        </div>
                        <div>
                            <p class="font-black text-slate-900 text-lg">${h.plate}</p>
                            <p class="text-[9px] text-slate-400 uppercase font-black tracking-widest">${h.type}</p>
                        </div>
                    </div>
                </td>
                <td class="px-10 py-6">
                    <div class="flex items-center gap-2 text-slate-500 font-bold text-sm">
                        <span>${new Date(h.entryTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        <i data-lucide="arrow-right" class="w-3 h-3 opacity-30"></i>
                        <span class="text-indigo-600">${new Date(h.exitTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                </td>
                <td class="px-10 py-6 text-slate-500 font-black text-sm uppercase tracking-tighter">${h.duration} min</td>
                <td class="px-10 py-6 text-right">
                    <span class="px-5 py-2 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-xl tracking-tight border border-emerald-100">
                        S/ ${h.amount.toFixed(2)}
                    </span>
                </td>
            </tr>
        `).join('');
    }
    refreshIcons();
}

// --- SETTINGS ---
function updateSettings() {
    const newSlots = parseInt(document.getElementById('set-slots').value);
    if (newSlots < activeVehicles.length) {
        return showToast("Error: No puedes reducir el espacio por debajo de los vehículos actuales", "error");
    }
    
    config.totalSlots = newSlots;
    config.rates.auto = parseFloat(document.getElementById('rate-auto').value);
    config.rates.moto = parseFloat(document.getElementById('rate-moto').value);
    config.rates.camioneta = parseFloat(document.getElementById('rate-truck').value);
    config.rates.autobus = parseFloat(document.getElementById('rate-bus').value);
    
    saveData();
    showToast("Configuración del garaje actualizada con éxito");
    renderDashboard();
}

function clearHistory() {
    if (confirm("¿Está seguro de reiniciar el arqueo diario? Esta acción no se puede deshacer.")) {
        history = [];
        saveData();
        renderHistory();
        renderDashboard();
        showToast("Se ha reiniciado el arqueo del día");
    }
}

// --- WATERMARK GENERATOR ---
function generateWatermarkBase64() {
    const canvas = document.createElement('canvas');
    canvas.width = 1500;
    canvas.height = 1500;
    const ctx = canvas.getContext('2d');
    
    // Rellenamos de blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1500, 1500);
    
    // Dibujamos un patrón de seguridad (Líneas diagonales corporativas)
    ctx.strokeStyle = '#f8fafc'; // Gris muy muy claro
    ctx.lineWidth = 3;
    for(let i = -1500; i < 3000; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 1500, 1500);
        ctx.stroke();
    }
    
    // Dibujamos el súper escudo / texto central (Marca de agua gigante)
    ctx.translate(750, 750);
    ctx.rotate(-Math.PI / 4);
    
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f1f5f9'; // Gris un poco más visible pero muy tenue
    
    ctx.font = 'bold 180px Helvetica';
    ctx.fillText('PARKMASTER', 0, -50);
    
    ctx.font = 'bold 100px Helvetica';
    ctx.fillText('ING. ARNOLD CODE', 0, 80);
    
    ctx.font = 'bold 60px Helvetica';
    ctx.fillText('REPORTE OFICIAL DEL SISTEMA', 0, 180);
    
    // Exportamos a un JPEG pesando alrededor de 100KB-150KB (Simulando peso de PDF Real)
    return canvas.toDataURL('image/jpeg', 0.95);
}

async function downloadDailyReport() {
    if (!history || history.length === 0) {
        return showToast("No hay datos en el historial para generar un reporte", "error");
    }

    try {
        showToast("Generando reporte PDF profesional...", "info");

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        // --- 0. MARCA DE AGUA (Añade fondo profesional y "peso" al archivo) ---
        const watermarkDetails = generateWatermarkBase64();
        doc.addImage(watermarkDetails, 'JPEG', 0, 40, 210, 257);

        const total = history.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const dateStr = new Date().toLocaleDateString('es-PE', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
        const timeStr = new Date().toLocaleTimeString('es-PE');

        // --- 1. CABECERA (BRANDING) ---
        doc.setFillColor(79, 70, 229); // Indigo-600
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("ParkMaster Pro GARAJE", 15, 20);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("SISTEMA DE GESTIÓN DE ESTACIONAMIENTO INTELIGENTE", 15, 27);
        doc.text("DESARROLLADO POR: ING. ARNOLD CODE", 15, 33);

        doc.setFontSize(12);
        doc.text("REPORTE DE ARQUEO", 150, 20);
        doc.setFontSize(9);
        doc.text(dateStr.toUpperCase(), 150, 27);
        doc.text(`HORA: ${timeStr}`, 150, 33);

        // --- 2. RESUMEN FINANCIERO ---
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("RESUMEN DE CAJA", 15, 55);

        // Caja de Operaciones
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 60, 85, 25, 3, 3, 'FD');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(9);
        doc.text("VEHÍCULOS PROCESADOS", 22, 68);
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(18);
        doc.text(`${history.length} unidades`, 22, 78);

        // Caja de Recaudación
        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(220, 252, 231);
        doc.roundedRect(110, 60, 85, 25, 3, 3, 'FD');
        doc.setTextColor(21, 128, 61);
        doc.setFontSize(9);
        doc.text("RECAUDACIÓN TOTAL", 117, 68);
        doc.setTextColor(22, 101, 52);
        doc.setFontSize(18);
        doc.text(`S/ ${total.toFixed(2)}`, 117, 78);

        // --- 3. TABLA DE DETALLES ---
        const sortedHistory = [...history].sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime));
        const tableBody = sortedHistory.map(h => [
            h.plate,
            h.type.toUpperCase(),
            new Date(h.entryTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            new Date(h.exitTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            `S/ ${h.amount.toFixed(2)}`
        ]);

        doc.autoTable({
            startY: 95,
            head: [['PLACA', 'CATEGORÍA', 'INGRESO', 'SALIDA', 'IMPORTE']],
            body: tableBody,
            theme: 'striped',
            headStyles: {
                fillColor: [79, 70, 229],
                textColor: [255, 255, 255],
                fontSize: 10,
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 9,
                textColor: [51, 65, 85],
                halign: 'center'
            },
            columnStyles: {
                0: { fontStyle: 'bold', halign: 'left' },
                4: { fontStyle: 'bold', halign: 'right', textColor: [22, 101, 52] }
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            margin: { left: 15, right: 15 }
        });

        // --- 4. FOOTER / FIRMAS ---
        const finalY = doc.lastAutoTable.finalY + 30;
        
        doc.setDrawColor(203, 213, 225);
        doc.line(75, finalY, 135, finalY);
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("FIRMA DEL RESPONSABLE", 105, finalY + 7, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("CONTROL DE CAJA GARAJE", 105, finalY + 12, { align: 'center' });

        doc.setTextColor(79, 70, 229);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("ING. ARNOLD CODE © 2026", 105, 285, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(203, 213, 225);
        doc.text("DOCUMENTO DE VERIFICACIÓN OFICIAL GENERADO POR SISTEMA", 105, 290, { align: 'center' });

        // --- 5. GUARDAR ---
        doc.save('Arqueo_Caja_ArnoldCode.pdf');
        showToast("Reporte PDF generado y descargado correctamente");

    } catch (error) {
        console.error("Error PDF:", error);
        showToast("Error crítico al generar PDF. Verifique consola.", "error");
    }
}