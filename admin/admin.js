import {
    getMenuItems,
    saveMenuItem,
    deleteMenuItem,
    getGlobalSettings,
    updateGlobalSettings,
    getTodayVisitors,
    getWhatsAppConversions,
    getQRScans,
    getAllFeedback,
    updateFeedbackStatus,
    getOrders,
    updateOrderStatus,
    deleteOrder,
    getCategories,
    saveCategory,
    deleteCategory
} from '../database/services.js';
import { uploadToCloudinary } from '../js/cloudinary.js';
import { auth } from '../database/config.js';
import { updatePassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentData = [];
let categories = [];
let selectedFiles = [];
let existingUrls = [];
let performanceChart = null;
let statsMainChart = null;

async function applyWatermark(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;

                ctx.drawImage(img, 0, 0);

                // Subtle Watermark
                const fontSize = Math.max(20, img.width * 0.035);
                ctx.font = `bold ${fontSize}px 'Epilogue', sans-serif`;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 10;

                // Bottom Left as requested ("علي شمال الصوره")
                ctx.fillText('SAMAKA', 30, img.height - 30);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.85);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initial Setup
    await refreshData();
    await updateStats();
    loadDashboardTables();
    await loadSettings();
    await renderComments();

    // Sidebar active state fix
    const currentTab = localStorage.getItem('admin_active_tab') || 'dashboard';
    switchTab(currentTab);

    // Form listener
    const itemForm = document.getElementById('item-form');
    if (itemForm) itemForm.addEventListener('submit', handleFormSubmit);

    // Force Arabic for Admin Dashboard Demo
    localStorage.setItem('preferred_language', 'ar');
    if (typeof applyLanguage === 'function') applyLanguage('ar');
});

async function refreshData() {
    [currentData, categories] = await Promise.all([
        getMenuItems(),
        getCategories()
    ]);
    renderMenuGrid();
    renderCategories();
}

// Sidebar & Mobile Toggle
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) {
        sidebar.classList.toggle('translate-x-full');
        if (overlay) {
            overlay.classList.toggle('hidden');
            setTimeout(() => overlay.classList.toggle('opacity-0'), 10);
        }
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.add('translate-x-full');
    if (overlay) {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

// Notifications Toggle
function toggleNotifications() {
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

// Tab Switching (Corporate Light)
function switchTab(tabName) {
    localStorage.setItem('admin_active_tab', tabName);

    // Update Nav UI
    document.querySelectorAll('.sidebar-item').forEach(btn => {
        btn.classList.remove('active');
    });

    const clickedBtn = document.getElementById(`tab-${tabName}`);
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    }

    // UI: Content Sections
    const tabs = ['dashboard', 'menu', 'orders', 'settings', 'qrcode'];
    tabs.forEach(t => {
        const el = document.getElementById(`content-${t}`);
        if (el) el.classList.add('hidden');
    });

    const targetContent = document.getElementById(`content-${tabName}`);
    if (targetContent) {
        targetContent.classList.remove('hidden');
    }

    // Dynamic Header
    const titleKeys = {
        dashboard: "لوحة التحكم الرئيسية",
        orders: "إدارة الطلبات",
        menu: "قائمة الطعام",
        qrcode: "رمز QR الذكي",
        settings: "إعدادات المصنع"
    };

    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.innerText = titleKeys[tabName] || tabName;

    // Trigger Tab Specific Actions
    if (tabName === 'dashboard') {
        setTimeout(initChart, 300);
    }
    if (tabName === 'qrcode') {
        if (typeof generateQRCode === 'function') generateQRCode();
    }

    // Auto-close sidebar on mobile
    if (window.innerWidth < 1024) {
        closeSidebar();
    }
}

// Stats & Mock Realism
async function updateStats() {
    const ordersLogs = JSON.parse(localStorage.getItem('matamkom_orders_logs') || '[]');

    // FETCH REAL DATA
    const visitors = await getTodayVisitors();
    const whatsappConversions = await getWhatsAppConversions();

    const qrScans = await getQRScans();

    const elements = {
        'stat-visitors': visitors.toLocaleString(),
        'stat-items': currentData.length,
        'stat-whatsapp-main': whatsappConversions.toLocaleString(),
        'stat-qr-scans': qrScans.toLocaleString()
    };

    Object.entries(elements).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    });
}

async function renderComments() {
    const commentsList = document.getElementById('comments-list');
    if (!commentsList) return;

    const feedback = await getAllFeedback();

    if (feedback.length === 0) {
        commentsList.innerHTML = `
            <div class="text-center py-10 opacity-30">
                <span class="material-symbols-outlined text-4xl">rate_review</span>
                <p class="text-xs font-bold mt-2">لا توجد تعليقات بعد</p>
            </div>
        `;
        return;
    }

    commentsList.innerHTML = feedback.slice(0, 30).map(f => {
        const date = new Date(f.createdAt).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const initial = (f.name || 'ع').charAt(0);
        const isShown = f.showOnHome === true;
        
        return `
            <div class="flex gap-4 items-start p-4 bg-slate-50 dark:bg-white/5 rounded-2xl animate-in group">
                <div class="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">${initial}</div>
                <div class="flex-grow">
                    <div class="flex justify-between mb-1">
                        <div class="flex items-center gap-2">
                            <h4 class="text-sm font-bold text-slate-700 dark:text-white">${f.name || 'عميل مجهول'}</h4>
                            ${f.phone ? `<a href="https://wa.me/${f.phone}" target="_blank" class="flex items-center gap-1 text-[10px] text-emerald-500 font-bold hover:underline bg-emerald-500/5 px-2 py-0.5 rounded-full">
                                <span class="material-symbols-outlined text-[12px]">call</span>
                                ${f.phone}
                            </a>` : ''}
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-[10px] text-slate-400">${date}</span>
                            <button onclick="toggleFeedbackVisibility('${f.id}', ${!isShown})" 
                                class="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${isShown ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-200 dark:bg-white/10 text-slate-500'}">
                                <span class="material-symbols-outlined text-[14px]">${isShown ? 'visibility' : 'visibility_off'}</span>
                                ${isShown ? 'يظهر بالرئيسية' : 'مخفي'}
                            </button>
                        </div>
                    </div>
                    <div class="flex gap-0.5 mb-2">
                        ${Array.from({ length: 5 }).map((_, i) => `
                            <span class="material-symbols-outlined text-[10px] ${i < (f.rating || 5) ? 'text-amber-500' : 'text-slate-200'}" style="font-variation-settings: 'FILL' 1;">star</span>
                        `).join('')}
                    </div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${f.comment || 'بدون تعليق'}</p>
                </div>
            </div>
        `;
    }).join('');
}

async function toggleFeedbackVisibility(id, newStatus) {
    try {
        await updateFeedbackStatus(id, newStatus);
        renderComments(); // Refresh list
    } catch (e) {
        console.error("Error updating status", e);
    }
}

window.toggleFeedbackVisibility = toggleFeedbackVisibility;

// Load Tables Logic
function loadDashboardTables() {
    renderOrders();
}

function getStatusBadge(status) {
    const configs = {
        pending: { label: 'قيد الانتظار', class: 'bg-amber-50 text-amber-600 ring-1 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20' },
        confirmed: { label: 'مؤكد', class: 'bg-blue-50 text-[#0058bc] ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20' },
        delivered: { label: 'تم التوصيل', class: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20' },
        cancelled: { label: 'ملغي', class: 'bg-rose-50 text-rose-600 ring-1 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20' }
    };
    const config = configs[status] || configs.pending;
    return `<span class="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${config.class}">${config.label}</span>`;
}

async function renderOrders() {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;

    try {
        const logs = await getOrders();
        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-24 text-center opacity-30 text-xs font-bold">لا توجد طلبات مسجلة حالياً</td></tr>`;
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const idShort = (log.id || '0000').toString().slice(-4);
            const dateStr = log.createdAt ? new Date(log.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';
            return `
                <tr class="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group border-b border-transparent last:border-0">
                    <td class="px-10 py-6"><span class="font-black text-[#0058bc] dark:text-blue-400 text-xs">#${idShort}</span></td>
                    <td class="px-10 py-6">
                        <div class="font-bold text-slate-900 dark:text-slate-100">${log.userName || 'زبون خارجي'}</div>
                        <div class="text-[10px] text-slate-400 font-bold mt-0.5">${log.phone || ''}</div>
                    </td>
                    <td class="px-10 py-6">
                        <div class="text-xs font-bold text-slate-600 dark:text-slate-400 line-clamp-1">${log.items.map(i => `${i.quantity}x ${i.name}`).join('، ')}</div>
                        <div class="text-[10px] text-slate-400 font-medium mt-1 italic">${dateStr}</div>
                    </td>
                    <td class="px-10 py-6 font-black text-slate-900 dark:text-white">${log.total} جم</td>
                    <td class="px-10 py-6">${getStatusBadge(log.status || 'pending')}</td>
                    <td class="px-10 py-6 text-left">
                        <div class="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                            <button onclick="handleStatusUpdate('${log.id}', 'confirmed')" class="w-9 h-9 bg-blue-50 dark:bg-blue-500/10 text-[#0058bc] dark:text-blue-400 rounded-xl flex items-center justify-center hover:bg-[#0058bc] hover:text-white transition-all shadow-sm"><span class="material-symbols-outlined text-lg">check_circle</span></button>
                            <button onclick="handleDeleteOrder('${log.id}')" class="w-9 h-9 bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"><span class="material-symbols-outlined text-lg">delete</span></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) { console.error("Orders Error:", e); }
}

async function handleStatusUpdate(id, newStatus) {
    if (await updateOrderStatus(id, newStatus)) {
        await renderOrders();
    }
}

async function handleDeleteOrder(id) {
    // We can keep the confirm for destructive actions, or use a custom modal later.
    // For now, let's keep native confirm but use custom toast for result.
    if (!confirm('هل أنت متأكد من الحفظ؟')) return;
    if (await deleteOrder(id)) {
        showNotification('تم حذف الطلب بنجاح');
        await renderOrders();
    }
}

// Custom Notification System
function showNotification(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        info: 'bg-sky-500'
    };

    toast.className = `${colors[type] || colors.success} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in-up pointer-events-auto`;
    toast.innerHTML = `
        <span class="material-symbols-outlined text-xl">${type === 'error' ? 'error' : 'check_circle'}</span>
        <span class="text-sm font-black">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('animate-out-down');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

window.showNotification = showNotification;

function updateLogStatus(type, id, newStatus) {
    const key = 'matamkom_orders_logs';
    let logs = JSON.parse(localStorage.getItem(key) || '[]');
    logs = logs.map(l => l.id == id ? { ...l, status: newStatus } : l);
    localStorage.setItem(key, JSON.stringify(logs));
    window.location.reload();
}

function deleteLog(type, id) {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    const key = 'matamkom_orders_logs';
    let logs = JSON.parse(localStorage.getItem(key) || '[]');
    logs = logs.filter(l => l.id != id);
    localStorage.setItem(key, JSON.stringify(logs));
    window.location.reload();
}

// Render Menu Cards (Modern Grid)
function renderMenuGrid(filter = "") {
    const grid = document.getElementById('menu-items-grid');
    if (!grid) return;
    grid.innerHTML = '';

    let data = currentData;
    if (filter) {
        data = data.filter(item =>
            (item.name_ar || '').includes(filter) ||
            (item.category || '').includes(filter)
        );
    }

    if (data.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-32 text-center opacity-20"><span class="material-symbols-outlined text-6xl">inventory_2</span><p class="font-bold mt-4 uppercase tracking-widest text-xs">لا توجد أطباق مطابقة</p></div>`;
        return;
    }

    data.forEach(item => {
        const itemImage = (item.images && item.images.length > 0) ? item.images[0] : (item.image || '../assets/only logo.png');
        const isAvailable = item.isAvailable !== false;
        
        const card = document.createElement('div');
        card.className = "premium-card group overflow-hidden animate-in ring-1 ring-slate-100 dark:ring-white/5";
        card.innerHTML = `
            <div class="aspect-video relative overflow-hidden bg-slate-50 dark:bg-slate-950">
                <img src="${itemImage}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ${!isAvailable ? 'grayscale opacity-70' : ''}" alt="${item.name_ar}">
                <div class="absolute top-4 right-4 flex gap-2">
                     <div class="px-4 py-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl text-[10px] font-black uppercase shadow-lg text-[#0058bc] dark:text-blue-400 border border-white/50 dark:border-white/10">${item.category}</div>
                </div>
                ${!isAvailable ? `<div class="absolute inset-0 bg-white/40 dark:bg-black/60 flex items-center justify-center backdrop-blur-[2px]"><span class="bg-rose-500 text-white px-5 py-2 rounded-xl text-[11px] font-black shadow-xl">غير متوفر</span></div>` : ''}
                
                <button onclick="toggleAvailability('${item.id}', ${!isAvailable})" 
                    class="absolute bottom-4 right-4 w-11 h-11 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-xl transition-all active:scale-90 ${isAvailable ? 'bg-white/95 dark:bg-slate-900/95 text-emerald-500' : 'bg-rose-500 text-white'}"
                    title="${isAvailable ? 'متوفر' : 'غير متوفر'}">
                    <span class="material-symbols-outlined text-2xl font-black">${isAvailable ? 'check_circle' : 'block'}</span>
                </button>
            </div>
            <div class="p-6 md:p-8">
                <div class="flex justify-between items-start gap-4 mb-4">
                    <h4 class="text-lg md:text-2xl font-bold text-slate-900 dark:text-white leading-tight">${item.name_ar}</h4>
                    <span class="text-[#0058bc] dark:text-blue-400 font-black text-xl md:text-2xl whitespace-nowrap">${item.price}<span class="text-xs mr-1 opacity-70">جم</span></span>
                </div>
                <p class="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-6 md:mb-8">${item.description_ar || 'لم يتم إضافة وصف لهذه الوجبة بعد'}</p>
                <div class="flex gap-3">
                    <button onclick="editItem('${item.id}')" class="flex-grow py-3 md:py-4 bg-slate-50 dark:bg-white/5 rounded-2xl text-[11px] font-black text-slate-600 dark:text-slate-400 hover:bg-[#0058bc] hover:text-white transition-all shadow-sm">تعديل</button>
                    <button onclick="deleteItem('${item.id}')" class="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                        <span class="material-symbols-outlined text-lg md:text-xl">delete</span>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function showEmptyState(container, message) {
    const template = document.getElementById('empty-state-template');
    if (!template) return;
    const clone = template.content.cloneNode(true);
    clone.querySelector('h3').innerText = message;
    container.appendChild(clone);
}



// Standard CRUD & Logic...
async function loadSettings() {
    const settings = await getGlobalSettings();
    if (!settings) return;

    const fields = [
        'whatsapp', 'phone', 'address_ar', 'menuHeroTitleEn',
        'mapLink', 'hours_ar',
        'hours_en', 'social_fb', 'social_insta'
    ];

    fields.forEach(id => {
        const el = document.getElementById(`setting-${id}`);
        if (el) el.value = settings[id] || '';
    });

    // Try to parse existing hours if time pickers are empty
    if (settings.hours_en) {
        const parts = settings.hours_en.split(' - ');
        if (parts.length === 2) {
            const startStr = parts[0];
            const endStr = parts[1];
            const startVal = parseTimeToHHMM(startStr);
            const endVal = parseTimeToHHMM(endStr);
            if (startVal) document.getElementById('setting-startTime').value = startVal;
            if (endVal) document.getElementById('setting-endTime').value = endVal;
        }
    }
}

function formatTime(timeStr, lang) {
    let [h, m] = timeStr.split(':');
    h = parseInt(h);
    const ampmEn = h >= 12 ? 'PM' : 'AM';
    const ampmAr = h >= 12 ? 'مساءً' : 'صباحاً';
    let h12 = h % 12 || 12;
    
    return lang === 'ar' ? `${h12}:${m} ${ampmAr}` : `${h12}:${m} ${ampmEn}`;
}

function parseTimeToHHMM(timeStr) {
    // Simple parser for "12:00 PM" -> "12:00" or "6:00 PM" -> "18:00"
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM|صباحاً|مساءً)/i);
    if (!match) return null;
    let h = parseInt(match[1]);
    const m = match[2];
    const ampm = match[3].toLowerCase();
    
    if ((ampm === 'pm' || ampm === 'مساءً') && h < 12) h += 12;
    if ((ampm === 'am' || ampm === 'صباحاً') && h === 12) h = 0;
    
    return `${h.toString().padStart(2, '0')}:${m}`;
}

async function saveSettings(e) {
    e.preventDefault();
    const fields = [
        'whatsapp', 'phone', 'address_ar', 'menuHeroTitleEn',
        'mapLink', 'hours_ar',
        'hours_en', 'social_fb', 'social_insta'
    ];

    const settings = {
        updatedAt: new Date().toISOString()
    };

    // Handle working hours formatting
    const start = document.getElementById('setting-startTime')?.value;
    const end = document.getElementById('setting-endTime')?.value;
    
    if (start && end) {
        settings.hours_ar = `${formatTime(start, 'ar')} - ${formatTime(end, 'ar')}`;
        settings.hours_en = `${formatTime(start, 'en')} - ${formatTime(end, 'en')}`;
    }

    fields.forEach(id => {
        const el = document.getElementById(`setting-${id}`);
        if (el) settings[id] = el.value || settings[id] || '';
    });

    const newPassword = document.getElementById('setting-new-password')?.value;

    try {
        await updateGlobalSettings(settings);
        
        if (newPassword && newPassword.trim().length >= 6) {
            const user = auth.currentUser;
            if (user) {
                await updatePassword(user, newPassword);
                document.getElementById('setting-new-password').value = '';
            } else {
                showNotification('يرجى تسجيل الدخول لتغيير كلمة المرور', 'error');
            }
        } else if (newPassword && newPassword.trim().length > 0) {
            showNotification('كلمة المرور يجب أن تكون 6 أحرف على الأقل ⚠️', 'warning');
            return;
        }

        showNotification('تم تحديث إعدادات الموقع بنجاح ✅');
        localStorage.setItem('samaka_settings', JSON.stringify(settings));
    } catch (error) {
        console.error("Settings update error:", error);
        showNotification('فشل تحديث الإعدادات ❌', 'error');
    }
}

function generateQRCode() {
    const container = document.getElementById('qrcode-container');
    if (!container) return;
    container.innerHTML = "";
    
    const menuUrl = window.location.origin + "/index.html?ref=qr";

    // Use higher resolution and error correction Level H
    const qr = new QRCode(document.createElement('div'), {
        text: menuUrl,
        width: 1024,
        height: 1024,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    setTimeout(() => {
        const qrCanvas = qr._el.querySelector('canvas');
        if (!qrCanvas) return;

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 1024;
        finalCanvas.height = 1024;
        const ctx = finalCanvas.getContext('2d');
        const size = finalCanvas.width;

        // Draw Premium Dot Pattern
        const modules = qr._oQRCode.modules;
        const moduleCount = modules.length;
        const moduleSize = size / moduleCount;

        ctx.fillStyle = "#0f172a"; // Deep Navy Theme
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "#0f172a";

        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (modules[row][col]) {
                    // Check if is corner (eye)
                    const isEye = (row < 7 && col < 7) || (row < 7 && col > moduleCount - 8) || (row > moduleCount - 8 && col < 7);
                    
                    if (isEye) {
                        // Custom rounded eye drawing
                        // Only draw on first cell of eye to avoid overlap
                        if ((row === 0 && col === 0) || (row === 0 && col === moduleCount - 7) || (row === moduleCount - 7 && col === 0)) {
                            drawCornerEye(ctx, col * moduleSize, row * moduleSize, moduleSize * 7);
                        }
                    } else {
                        // Premium Dot / Rounded Module
                        const x = col * moduleSize + moduleSize / 2;
                        const y = row * moduleSize + moduleSize / 2;
                        const radius = moduleSize * 0.4;
                        
                        ctx.beginPath();
                        ctx.arc(x, y, radius, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }

        // Draw Logo and update
        const logo = new Image();
        logo.crossOrigin = "anonymous";
        logo.src = "../assets/only logo.png";
        logo.onload = () => {
            const logoSize = size * 0.25; // Shrunk back to 25% for a more compact look
            const x = (size - logoSize) / 2;
            const y = (size - logoSize) / 2;

            // Drawing with ZERO padding - perfectly tight
            const padding = 0; 
            
            // Clear the area first to ensure clean background
            ctx.fillStyle = "white";
            drawRoundedRect(ctx, x, y, logoSize, logoSize, 20);
            
            ctx.drawImage(logo, x, y, logoSize, logoSize);
            
            const img = document.createElement('img');
            img.src = finalCanvas.toDataURL("image/png");
            img.style.width = "100%";
            container.appendChild(img);
            container.dataset.finalQr = img.src;
        };
    }, 100);
}

function drawCornerEye(ctx, x, y, size) {
    const thickness = size / 7;
    ctx.fillStyle = "#0f172a";
    
    // Outer Rounded Square
    drawRoundedRect(ctx, x, y, size, size, size * 0.25);
    
    // Inner white space
    ctx.fillStyle = "white";
    drawRoundedRect(ctx, x + thickness, y + thickness, size - thickness * 2, size - thickness * 2, size * 0.15);
    
    // Core Rounded Square
    ctx.fillStyle = "#0f172a";
    drawRoundedRect(ctx, x + thickness * 2, y + thickness * 2, size - thickness * 4, size - thickness * 4, size * 0.1);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.fill();
}

function downloadQRCode() {
    const container = document.getElementById('qrcode-container');
    const finalData = container.dataset.finalQr;
    if (!finalData) return;
    
    const link = document.createElement('a');
    link.download = 'samaka-qr.png';
    link.href = finalData;
    link.click();
}

function openModal() {
    selectedFiles = [];
    existingUrls = [];
    document.getElementById('item-id').value = '';
    document.getElementById('item-form').reset();
    document.getElementById('modal-title').innerText = 'إضافة وجبة جديدة';
    document.getElementById('image-previews').innerHTML = '';
    document.getElementById('item-show-home').checked = true;
    document.getElementById('item-discount-pct').value = '';
    
    // Reset Checkboxes, Tags & Price Inputs
    document.querySelectorAll('.custom-variant-label').forEach(el => el.remove());
    
    document.querySelectorAll('#options-sizes-container input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        cb.parentElement.querySelector('.variant-price').value = '';
    });
    document.querySelectorAll('#options-methods-container input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        cb.parentElement.querySelector('.variant-price').value = '';
    });
    currentTypeTags = [];
    renderTypeTags();
    
    document.getElementById('item-modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('item-modal').classList.add('hidden'); }

async function handleFormSubmit(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;

    try {
        submitBtn.disabled = true;
        submitBtn.innerText = 'جاري رفع الصور...';

        let finalUrls = [...existingUrls];

        // Upload new files (with watermarking)
        for (const file of selectedFiles) {
            submitBtn.innerText = `جاري معالجة الصور...`;
            const watermarkedFile = await applyWatermark(file);
            submitBtn.innerText = `جاري رفع الصور...`;
            const url = await uploadToCloudinary(watermarkedFile);
            finalUrls.push(url);
        }

        const id = document.getElementById('item-id').value;
        
        // Extract Checked Box Arrays with Prices
        const selectedSizes = Array.from(document.querySelectorAll('#options-sizes-container input[type="checkbox"]:checked')).map(cb => {
            const val = cb.parentElement.querySelector('.variant-price').value;
            return { name: cb.value, price: val ? parseFloat(val) : null };
        });
        const selectedMethods = Array.from(document.querySelectorAll('#options-methods-container input[type="checkbox"]:checked')).map(cb => {
            const val = cb.parentElement.querySelector('.variant-price').value;
            return { name: cb.value, price: val ? parseFloat(val) : null };
        });

        const itemData = {
            name_ar: document.getElementById('item-name-ar').value,
            name: document.getElementById('item-name-en').value,
            category: document.getElementById('item-category').value,
            price: parseFloat(document.getElementById('item-price').value),
            oldPrice: document.getElementById('item-old-price').value ? parseFloat(document.getElementById('item-old-price').value) : null,
            images: finalUrls,
            description_ar: document.getElementById('item-desc-ar').value,
            showOnHome: document.getElementById('item-show-home').checked,
            options: {
                sizes: selectedSizes,
                methods: selectedMethods,
                types: document.getElementById('item-options-types').value.split(',').map(s => s.trim()).filter(s => s)
            },
            updatedAt: new Date().toISOString()
        };

        if (id) itemData.id = id;

        submitBtn.innerText = 'جاري حفظ البيانات...';
        await saveMenuItem(itemData);
        showNotification('تم حفظ بيانات الوجبة بنجاح ✨');
        closeModal();
        await refreshData();
    } catch (error) {
        console.error(error);
        showNotification('حدث خطأ أثناء الرفع أو الحفظ ❌', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
    }
}

function handleImageSelection(event) {
    const files = Array.from(event.target.files);
    selectedFiles = [...selectedFiles, ...files];
    updatePreviews();
}

function removeImage(index, isExisting = false) {
    if (isExisting) {
        existingUrls.splice(index, 1);
    } else {
        selectedFiles.splice(index, 1);
    }
    updatePreviews();
}

function updatePreviews() {
    const container = document.getElementById('image-previews');
    if (!container) return;
    container.innerHTML = '';

    // Show existing URLs (from database)
    existingUrls.forEach((url, i) => {
        const div = document.createElement('div');
        div.className = "relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 shadow-sm";
        div.innerHTML = `
            <img src="${url}" class="w-full h-full object-cover">
            <button onclick="removeImage(${i}, true)" class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                <span class="material-symbols-outlined text-xs">close</span>
            </button>
        `;
        container.appendChild(div);
    });

    // Show newly selected files (from computer)
    selectedFiles.forEach((file, i) => {
        const url = URL.createObjectURL(file);
        const div = document.createElement('div');
        div.className = "relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-sky-400 shadow-sm animate-pulse-slow";
        div.innerHTML = `
            <img src="${url}" class="w-full h-full object-cover">
            <button onclick="removeImage(${i}, false)" class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                <span class="material-symbols-outlined text-xs">close</span>
            </button>
            <div class="absolute inset-0 bg-sky-500/10 pointer-events-none"></div>
            <div class="absolute bottom-1 left-1 px-1.5 py-0.5 bg-sky-500 text-white text-[8px] font-black rounded uppercase shadow-sm">جديد</div>
        `;
        container.appendChild(div);
    });
}

function editItem(id) {
    const item = currentData.find(i => i.id === id);
    if (!item) return;

    openModal(); // Reset first

    document.getElementById('modal-title').innerText = 'تعديل الوجبة';
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-name-ar').value = item.name_ar || '';
    document.getElementById('item-name-en').value = item.name || '';
    document.getElementById('item-category').value = item.category || '';
    document.getElementById('item-price').value = item.price || 0;
    document.getElementById('item-old-price').value = item.oldPrice || '';
    
    // Auto-calculate percentage if prices exist
    if (item.oldPrice && item.price && item.oldPrice > item.price) {
        const pct = Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100);
        document.getElementById('item-discount-pct').value = pct;
    } else {
        document.getElementById('item-discount-pct').value = '';
    }

    document.getElementById('item-desc-ar').value = item.description_ar || '';
    document.getElementById('item-show-home').checked = item.showOnHome || false;

    // Load options
    if (item.options) {
        if (item.options.sizes) {
            item.options.sizes.forEach(sizeObj => {
                // Support legacy format (strings) or new format (objects)
                const sizeName = typeof sizeObj === 'string' ? sizeObj : sizeObj.name;
                const sizePrice = typeof sizeObj === 'object' ? sizeObj.price : null;
                
                let cb = document.querySelector(`#options-sizes-container input[value="${sizeName}"]`);
                if (!cb) {
                    injectVariantDOM('sizes', sizeName, sizePrice);
                } else {
                    cb.checked = true;
                    if (sizePrice !== null) {
                        cb.parentElement.querySelector('.variant-price').value = sizePrice;
                    }
                }
            });
        }
        if (item.options.methods) {
            item.options.methods.forEach(methodObj => {
                const methodName = typeof methodObj === 'string' ? methodObj : methodObj.name;
                const methodPrice = typeof methodObj === 'object' ? methodObj.price : null;
                
                let cb = document.querySelector(`#options-methods-container input[value="${methodName}"]`);
                if (!cb) {
                    injectVariantDOM('methods', methodName, methodPrice);
                } else {
                    cb.checked = true;
                    if (methodPrice !== null) {
                        cb.parentElement.querySelector('.variant-price').value = methodPrice;
                    }
                }
            });
        }
        currentTypeTags = item.options.types ? [...item.options.types] : [];
    } else {
        currentTypeTags = [];
    }
    renderTypeTags();

    existingUrls = [...(item.images || [])];
    updatePreviews();
}

/**
 * --- CATEGORY MANAGEMENT ---
 */

function renderCategories() {
    const list = document.getElementById('categories-list');
    const select = document.getElementById('item-category');
    if (!list || !select) return;

    if (categories.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-400 italic">لا توجد أقسام مضافة بعد، أضف أول قسم للأعلى.</p>';
        select.innerHTML = '<option value="" disabled selected>يجب إضافة أقسام أولاً</option>';
        return;
    }

    // Render Tags in Management Section
    list.innerHTML = categories.map(c => `
        <div class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-full text-xs font-bold shadow-sm">
            <span>${c.name}</span>
            <button onclick="handleDeleteCategory('${c.id}')" class="text-red-400 hover:text-red-500 transition-colors">
                <span class="material-symbols-outlined text-[14px]">close</span>
            </button>
        </div>
    `).join('');

    // Render Options in Item Modal
    select.innerHTML = categories.map(c => `
        <option value="${c.name}">${c.name}</option>
    `).join('');
}

async function handleAddCategory() {
    const input = document.getElementById('new-category-name');
    const name = input.value.trim();
    if (!name) return;

    try {
        await saveCategory({ name });
        showNotification('تم إضافة القسم الجديد بنجاح ✅');
        input.value = '';
        await refreshData();
    } catch (e) {
        showNotification('حدث خطأ أثناء إضافة القسم', 'error');
    }
}

async function handleDeleteCategory(id) {
    if (!confirm('حذف هذا القسم قد يؤثر على الوجبات المرتبطة به. هل أنت متأكد؟')) return;
    try {
        await deleteCategory(id);
        showNotification('تم حذف القسم بنجاح 🗑️');
        await refreshData();
    } catch (e) {
        showNotification('حدث خطأ أثناء الحذف', 'error');
    }
}

async function deleteItem(id) {
    if (!confirm('هل أنت متأكد من حذف هذه الوجبة نهائياً؟')) return;
    try {
        await deleteMenuItem(id);
        showNotification('تم حذف الوجبة نهائياً 🗑️');
        await refreshData();
    } catch (error) {
        console.error(error);
        showNotification('حدث خطأ أثناء الحذف ❌', 'error');
    }
}

function calculateDiscountPrice() {
    const oldPrice = parseFloat(document.getElementById('item-old-price').value) || 0;
    const discountPct = parseFloat(document.getElementById('item-discount-pct').value) || 0;
    const priceInput = document.getElementById('item-price');

    if (oldPrice > 0) {
        if (discountPct > 0) {
            const finalPrice = oldPrice - (oldPrice * (discountPct / 100));
            priceInput.value = Math.round(finalPrice);
        } else {
            priceInput.value = oldPrice;
        }
    }
}

function calculateDiscountPercentage() {
    const oldPrice = parseFloat(document.getElementById('item-old-price').value) || 0;
    const finalPrice = parseFloat(document.getElementById('item-price').value) || 0;
    const pctInput = document.getElementById('item-discount-pct');

    if (oldPrice > 0 && finalPrice > 0 && oldPrice > finalPrice) {
        const pct = ((oldPrice - finalPrice) / oldPrice) * 100;
        pctInput.value = Math.round(pct);
    } else if (oldPrice === finalPrice) {
        pctInput.value = 0;
    }
}

async function toggleAvailability(id, status) {
    try {
        await saveMenuItem({ id, isAvailable: status });
        showNotification(status ? 'الوجبة متاحة الآن ✨' : 'الوجبة غير متاحة حالياً 🛑');
        // Update local state and re-render
        const idx = currentData.findIndex(i => i.id === id);
        if (idx !== -1) {
            currentData[idx].isAvailable = status;
            renderMenuGrid(); 
        }
    } catch (e) {
        showNotification('فشل تحديث الحالة', 'error');
        refreshData();
    }
}

// Tags Logic for Additions
let currentTypeTags = [];
function renderTypeTags() {
    const container = document.getElementById('types-tags-container');
    if (!container) return;
    container.innerHTML = '';
    currentTypeTags.forEach((tag, index) => {
        container.innerHTML += `
            <div class="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm">
                ${tag}
                <button type="button" onclick="removeTypeTag(${index})" class="hover:bg-amber-200 dark:hover:bg-amber-500/30 rounded-full w-4 h-4 flex justify-center items-center transition-colors">
                    <span class="material-symbols-outlined text-[12px]">close</span>
                </button>
            </div>
        `;
    });
    document.getElementById('item-options-types').value = currentTypeTags.join(',');
}
function addTypeTag() {
    const input = document.getElementById('type-input');
    const val = input.value.trim();
    if(val && !currentTypeTags.includes(val)) {
        currentTypeTags.push(val);
        input.value = '';
        renderTypeTags();
    }
}
function removeTypeTag(index) {
    currentTypeTags.splice(index, 1);
    renderTypeTags();
}

function addCustomVariant(type) {
    const nameInput = document.getElementById(type === 'sizes' ? 'custom-size-name' : 'custom-method-name');
    const priceInput = document.getElementById(type === 'sizes' ? 'custom-size-price' : 'custom-method-price');
    const name = nameInput.value.trim();
    const price = priceInput.value;
    
    if (!name) return;
    
    injectVariantDOM(type, name, price);
    
    nameInput.value = '';
    priceInput.value = '';
    nameInput.focus();
}

function injectVariantDOM(type, name, price) {
    const container = document.getElementById(type === 'sizes' ? 'options-sizes-container' : 'options-methods-container');
    const color = type === 'sizes' ? 'sky' : 'purple';
    
    if (document.querySelector(`#${container.id} input[value="${name}"]`)) return; // Prevent dupes
    
    const label = document.createElement('label');
    label.className = `custom-variant-label relative flex items-stretch bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden has-[:checked]:border-${color}-500 has-[:checked]:ring-1 has-[:checked]:ring-${color}-500 transition-all shadow-sm`;
    label.innerHTML = `
        <input type="checkbox" value="${name}" class="peer sr-only" checked>
        <span class="cursor-pointer px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 peer-checked:text-white peer-checked:bg-${color}-500 transition-colors flex items-center gap-1">
           ${name}
           <span onclick="this.parentElement.parentElement.remove()" class="material-symbols-outlined text-[16px] hover:text-red-300 ml-1 transition-colors relative top-px">close</span>
        </span>
        <input type="number" placeholder="${type === 'sizes' ? 'السعر' : '+ ج.م'}" value="${price !== null ? price : ''}" onclick="event.stopPropagation()" class="variant-price hidden peer-checked:block w-20 px-2 text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border-none outline-none dark:text-white text-center border-r border-slate-200 dark:border-white/10">
    `;
    
    container.appendChild(label);
}

// Global Exports
window.switchTab = switchTab;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.toggleNotifications = toggleNotifications;
window.openModal = openModal;
window.closeModal = closeModal;
window.editItem = editItem;
window.deleteItem = deleteItem;
window.saveSettings = saveSettings;
window.generateQRCode = generateQRCode;
window.downloadQRCode = downloadQRCode;
window.handleImageSelection = handleImageSelection;
window.removeImage = removeImage;
window.handleAddCategory = handleAddCategory;
window.handleDeleteCategory = handleDeleteCategory;
window.calculateDiscountPrice = calculateDiscountPrice;
window.calculateDiscountPercentage = calculateDiscountPercentage;
window.toggleAvailability = toggleAvailability;
window.addTypeTag = addTypeTag;
window.removeTypeTag = removeTypeTag;
window.addCustomVariant = addCustomVariant;
window.toggleFeedbackVisibility = (id, status) => {
    updateFeedbackStatus(id, status).then(() => {
        showNotification(status ? 'سيظهر في الرئيسية ✨' : 'تم الإخفاء من الرئيسية');
        refreshData();
    });
};
