import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { escapeHtml } from './js/shared/utils.js';
import { alertDialog, confirmDialog } from './js/shared/dialogs.js';

const firebaseConfig = {
  apiKey: "AIzaSyBA4qsYmtbklKbayD0ELgsTILunuYBSujo",
  authDomain: "garaje-26c50.firebaseapp.com",
  projectId: "garaje-26c50",
  storageBucket: "garaje-26c50.firebasestorage.app",
  messagingSenderId: "857003189374",
  appId: "1:857003189374:web:8187f196254a7968fba42f",
  measurementId: "G-ZGFHKG0E26"
};

// Initialize
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

const SUPER_ADMIN = "huamanzamoraarnold@gmail.com";

function escapeJsString(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

// Expose globals for HTML inline onclick attributes
window.fbLogout = () => signOut(auth);

// UI Elements
const authScreen = document.getElementById('auth-screen');
const authForm = document.getElementById('auth-form');
const authError = document.getElementById('auth-error');
const appShell = document.getElementById('app-shell');
const paymentBlock = document.getElementById('payment-block');
const adminNavGroup = document.getElementById('admin-nav-group');
const btnLogin = document.getElementById('btn-login');

// Core Authentication & SaaS Logic
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User logged in! Hide auth screen
        authScreen.classList.add('hidden');
        
        // Update Sidebar Profile Display
        const sidebarEmail = document.getElementById('sidebar-user-email');
        const sidebarAvatar = document.getElementById('sidebar-user-avatar');
        if (sidebarEmail) sidebarEmail.textContent = user.email;
        if (sidebarAvatar) sidebarAvatar.textContent = user.email.charAt(0).toUpperCase();
        
        try {
            // Check SaaS License
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            
            let userData;
            if (!userDoc.exists()) {
                // Auto-provision 30 day trial for new users
                userData = {
                    email: user.email,
                    role: user.email === SUPER_ADMIN ? 'admin' : 'user',
                    trialStart: new Date().toISOString(),
                    isPaid: false
                };
                await setDoc(userRef, userData);
            } else {
                userData = userDoc.data();
            }
            
            // SUPER ADMIN FLOW
            const isSuperAdmin = userData.role === 'admin' || userData.email === SUPER_ADMIN;
            if (isSuperAdmin) {
                adminNavGroup.classList.remove('hidden');
                appShell.classList.remove('hidden');
                
                const statusEl = document.getElementById('sidebar-trial-status');
                if (statusEl) {
                    statusEl.textContent = "ADMINISTRADOR DEL SISTEMA";
                    statusEl.className = "text-[11px] font-black tracking-widest uppercase text-indigo-600";
                }
                
                // Allow them to start in the dashboard, but they can now see the SaaS tab
                if(window.changeTab) window.changeTab('dashboard');
                window.loadSaaSUsers();
            } 
            // REGULAR SAAS USER FLOW
            else {
                adminNavGroup.classList.add('hidden'); // Ensure hidden
                
                const trialStart = new Date(userData.trialStart);
                const now = new Date();
                const daysPassed = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
                
                // 30 day hard block
                if (daysPassed > 30 && !userData.isPaid) {
                    appShell.classList.add('hidden');
                    paymentBlock.classList.remove('hidden');
                    paymentBlock.classList.add('flex');
                } else {
                    appShell.classList.remove('hidden');
                    if(window.changeTab) window.changeTab('dashboard');
                    
                    const statusEl = document.getElementById('sidebar-trial-status');
                    if (statusEl) {
                        if (userData.isPaid) {
                            statusEl.innerHTML = '<span aria-hidden="true">👑 </span>LICENCIA PRO ACTIVA';
                            statusEl.className = "text-[11px] font-black tracking-widest uppercase text-emerald-700";
                        } else {
                            const daysLeft = Math.max(0, 30 - daysPassed);
                            statusEl.innerHTML = `<span aria-hidden="true">⏳ </span>PRUEBA: QUEDAN ${daysLeft} DÍAS`;
                            statusEl.className = "text-[11px] font-black tracking-widest uppercase " + (daysLeft <= 5 ? "text-red-600" : "text-amber-700");
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error accessing Firestore:", error);
            await alertDialog({
                title: 'No se pudo verificar su licencia',
                message: 'No se pudo conectar con el servicio de licencias. Verifique su conexión a internet o contacte a Soporte.'
            });
            authScreen.classList.remove('hidden');
            appShell.classList.add('hidden');
            signOut(auth);
        }
    } else {
        // Logged out state
        authScreen.classList.remove('hidden');
        appShell.classList.add('hidden');
        paymentBlock.classList.add('hidden');
        paymentBlock.classList.remove('flex');
        
        if (btnLogin) {
            btnLogin.innerHTML = 'Iniciar Sesión';
            btnLogin.disabled = false;
        }
    }
});

// Login / Registration Form Handler
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const pwd = document.getElementById('auth-password').value;
    
    authError.classList.add('hidden');
    btnLogin.innerHTML = 'Verificando...';
    btnLogin.disabled = true;
    
    try {
        // Attempt login
        await signInWithEmailAndPassword(auth, email, pwd);
    } catch (err) {
        // ONLY allow auto-registration for the SUPER ADMIN'S first time.
        if (email === SUPER_ADMIN) {
            try {
                await createUserWithEmailAndPassword(auth, email, pwd);
                return; // success
            } catch (regErr) {
                console.error("Admin Auth Error:", regErr);
            }
        }
        
        console.error("Auth Error:", err);
        authError.textContent = "Credenciales incorrectas o cuenta no autorizada. Contacte a Soporte.";
        authError.classList.remove('hidden');
        btnLogin.innerHTML = 'Iniciar Sesión';
        btnLogin.disabled = false;
    }
});

// SUPER ADMIN: Manual Client Creation
window.createSaaSClient = async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('new-client-email');
    const pwdInput = document.getElementById('new-client-pwd');
    const btn = document.getElementById('btn-create-client');
    
    const email = emailInput.value.trim();
    const pwd = pwdInput.value;
    
    const ok = await confirmDialog({
        title: 'Registrar cliente',
        message: `¿Desea registrar de forma oficial a ${email} y darle 30 días de prueba?`,
        confirmLabel: 'Registrar',
        cancelLabel: 'Cancelar'
    });
    if (!ok) return;
    
    btn.innerHTML = 'Creando...';
    btn.disabled = true;
    
    let secondaryApp;
    try {
        // Create a secondary Firebase App instance just to register the user
        // This prevents the Super Admin from being logged out!
        secondaryApp = initializeApp(firebaseConfig, `SecondaryApp-${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);
        
        // Create the user
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, pwd);
        
        // Immediately sign out the secondary app
        await signOut(secondaryAuth);
        
        // Record them in the primary Firestore DB to provision their 30-day trial
        const userRef = doc(db, 'users', userCred.user.uid);
        await setDoc(userRef, {
            email: email,
            role: 'user',
            trialStart: new Date().toISOString(),
            isPaid: false
        });
        
        await alertDialog({
            title: 'Cliente creado',
            message: `La cuenta ${email} fue creada. Entregue la clave temporal por un canal seguro.`
        });
        
        emailInput.value = '';
        pwdInput.value = '';
        
        // Refresh the table
        window.loadSaaSUsers();
        
    } catch (error) {
        await alertDialog({
            title: 'Error al crear cuenta',
            message: error.message || String(error)
        });
    } finally {
        if (secondaryApp) {
            try { await deleteApp(secondaryApp); } catch (_) {}
        }
        btn.innerHTML = 'Registrar';
        btn.disabled = false;
    }
};

// SUPER ADMIN LOGIC: Load all users
window.loadSaaSUsers = async () => {
    const listBody = document.getElementById('admin-users-list');
    if (!listBody) return;
    
    listBody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-slate-500 font-bold"><i class="animate-pulse">Sincronizando con Firestore...</i></td></tr>';
    
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        listBody.innerHTML = '';
        
        if (snapshot.empty) {
            listBody.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-slate-500">No hay clientes aún.</td></tr>';
            return;
        }
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            const emailText = String(data.email || '');
            const safeEmail = escapeHtml(emailText);
            const emailForJs = escapeJsString(emailText);
            const idForJs = escapeJsString(id);
            
            if (emailText === SUPER_ADMIN) return; // Hide admin from billing list
            
            const trialStart = new Date(data.trialStart);
            const now = new Date();
            const daysPassed = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
            const daysLeft = Math.max(0, 30 - daysPassed);
            const isBlocked = daysPassed > 30 && !data.isPaid;
            
            let statusBadge = '';
            if (data.isPaid) {
                statusBadge = `<span class="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border border-emerald-300"><span aria-hidden="true">💎 </span>Pago Recibido</span>`;
            } else if (isBlocked) {
                statusBadge = `<span class="bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border border-red-300"><span aria-hidden="true">❌ </span>Bloqueado</span>`;
            } else {
                statusBadge = `<span class="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border border-amber-300"><span aria-hidden="true">⏳ </span>30 Días (Faltan ${daysLeft})</span>`;
            }
                    
            let actionBtn = '';
            if (!data.isPaid) {
                actionBtn = `<button onclick="window.approvePayment('${idForJs}', '${emailForJs}')" class="btn btn-primary">Cobrado</button>`;
            } else {
                actionBtn = `<button onclick="window.revokePayment('${idForJs}', '${emailForJs}')" class="btn btn-danger-soft">Revocar</button>`;
            }
            
            const dateStr = trialStart.toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
            
            listBody.innerHTML += `
                <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                    <td class="py-5 pl-4 flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">${escapeHtml((emailText.charAt(0) || '?').toUpperCase())}</div>
                        <span class="font-bold text-slate-700">${safeEmail}</span>
                    </td>
                    <td class="py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">${dateStr}</td>
                    <td class="py-5">${statusBadge}</td>
                    <td class="py-5 text-right pr-4">${actionBtn}</td>
                </tr>
            `;
        });
    } catch(err) {
        listBody.innerHTML = `<tr><td colspan="4" class="py-10 text-center text-red-500 font-bold">Error cargando usuarios: ${escapeHtml(err.message)}. Compruebe permisos en Firestore.</td></tr>`;
    }
};

window.approvePayment = async (userId, email) => {
    const ok = await confirmDialog({
        title: 'Confirmar cobro',
        message: `¿Confirma que ${email} ha pagado? Al aceptar, su sistema se desbloqueará de forma permanente.`,
        confirmLabel: 'Sí, cobrado',
        cancelLabel: 'Cancelar'
    });
    if (!ok) return;
    try {
        await updateDoc(doc(db, 'users', userId), { isPaid: true });
        if (window.showToast) window.showToast(`Licencia otorgada a ${email}`, 'success');
        window.loadSaaSUsers();
    } catch (err) {
        await alertDialog({ title: 'Error de Firestore', message: err.message || String(err) });
    }
};

window.revokePayment = async (userId, email) => {
    const ok = await confirmDialog({
        title: 'Revocar licencia',
        message: `¿Está seguro de revocar la licencia de ${email}? Si tiene más de 30 días, su pantalla se bloqueará inmediatamente.`,
        confirmLabel: 'Revocar',
        cancelLabel: 'Cancelar',
        destructive: true
    });
    if (!ok) return;
    try {
        await updateDoc(doc(db, 'users', userId), { isPaid: false });
        if (window.showToast) window.showToast(`Licencia revocada a ${email}`, 'info');
        window.loadSaaSUsers();
    } catch (err) {
        await alertDialog({ title: 'Error de Firestore', message: err.message || String(err) });
    }
};
