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
    deleteCategory,
    updateAdminPassword,
    bulkSaveMenuItems
} from '../database/services.js';
import { uploadToCloudinary } from '../js/cloudinary.js';

// AUTH PROTECTION (Custom Firestore Session)
const adminSession = JSON.parse(localStorage.getItem('admin_session') || sessionStorage.getItem('admin_session') || 'null');
if (!adminSession) {
    window.location.href = 'login.html';
}

// Global Exports (Defined at top to be available for HTML onclick handlers immediately)
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.toggleNotifications = toggleNotifications;
window.saveSettings = saveSettings;
window.logout = () => {
    localStorage.removeItem('admin_session');
    sessionStorage.removeItem('admin_session');
    window.location.href = 'login.html';
};
window.editItem = editItem;
window.deleteItem = deleteItem;
window.toggleAvailability = toggleAvailability;
window.generateQRCode = generateQRCode;
window.downloadQRCode = downloadQRCode;
window.handleImageSelection = handleImageSelection;
window.removeImage = removeImage;
window.handleAddCategory = handleAddCategory;
window.handleDeleteCategory = handleDeleteCategory;
window.calculateDiscountPrice = calculateDiscountPrice;
window.calculateDiscountPercentage = calculateDiscountPercentage;
window.addTypeTag = addTypeTag;
window.removeTypeTag = removeTypeTag;
window.addCustomVariant = addCustomVariant;
window.filterMenuItemsByCategory = filterMenuItemsByCategory;
window.toggleFeedbackVisibility = toggleFeedbackVisibility;
window.reorderCategory = reorderCategory;
window.toggleOrderDropdown = toggleOrderDropdown;

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
    // BOOTSTRAP DATA PARALLEL (Fast Load)
    await Promise.all([
        refreshData(),
        updateStats(),
        loadSettings(),
        renderComments()
    ]);
    loadDashboardTables();

    // Sidebar active state fix
    const currentTab = localStorage.getItem('admin_active_tab') || 'dashboard';
    switchTab(currentTab);

    // Form listener
    const itemForm = document.getElementById('item-form');
    if (itemForm) itemForm.addEventListener('submit', handleFormSubmit);

    const catSelect = document.getElementById('item-category');
    if (catSelect) {
        catSelect.addEventListener('change', (e) => {
            updateOrderDropdown(e.target.value);
        });
    }


    // Force Arabic for Admin Dashboard Demo
    localStorage.setItem('preferred_language', 'ar');
    if (typeof applyLanguage === 'function') applyLanguage('ar');

    // Auto-refresh stats every 30 seconds
    setInterval(updateStats, 30000);
});

async function refreshData() {
    [currentData, categories] = await Promise.all([
        getMenuItems(),
        getCategories()
    ]);
    // Essential: Sync with global state for reordering logic
    window.samaka_categories = categories;

    renderMenuGrid();
    renderCategories(categories);
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

    // Update Mobile Nav UI
    document.querySelectorAll('[id^="mobile-tab-"]').forEach(btn => {
        btn.classList.remove('text-primary', 'dark:text-blue-400', 'scale-110');
        btn.classList.add('text-slate-400', 'dark:text-slate-500');
    });

    const mobileBtn = document.getElementById(`mobile-tab-${tabName}`);
    if (mobileBtn) {
        mobileBtn.classList.remove('text-slate-400', 'dark:text-slate-500');
        mobileBtn.classList.add('text-primary', 'dark:text-blue-400', 'scale-110');
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
        updateStats();
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

async function initChart() {
    const ctx = document.getElementById('analyticsChart');
    if (!ctx) return;

    try {
        if (window.myChart) window.myChart.destroy();

        window.myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'],
                datasets: [{
                    label: 'الطلبات',
                    data: [12, 19, 13, 25, 22, 30, 45],
                    borderColor: '#2680FF',
                    backgroundColor: 'rgba(38, 128, 255, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { display: false } },
                    x: { grid: { display: false } }
                }
            }
        });
    } catch (e) { console.error("Chart Error", e); }
}

// Stats & Mock Realism
async function updateStats() {
    // FETCH REAL DATA IN PARALLEL
    const [visitors, whatsappConversions, qrScans] = await Promise.all([
        getTodayVisitors(),
        getWhatsAppConversions(),
        getQRScans()
    ]);

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
            <div class="relative p-4 bg-white dark:bg-white/5 rounded-[1.5rem] border border-slate-100 dark:border-white/10 shadow-sm animate-in">
                <div class="flex gap-3 mb-3">
                    <div class="w-10 h-10 shrink-0 rounded-full bg-blue-50 dark:bg-blue-500/10 text-[#0058bc] dark:text-blue-400 flex items-center justify-center font-black text-sm border border-blue-100 dark:border-blue-500/20">${initial}</div>
                    <div class="flex-grow">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="text-xs font-black text-slate-900 dark:text-white">${f.name || 'عميل مجهول'}</h4>
                                <div class="flex gap-0.5 mt-0.5">
                                    ${Array.from({ length: 5 }).map((_, i) => `
                                        <span class="material-symbols-outlined text-[10px] ${i < (f.rating || 5) ? 'text-amber-500' : 'text-slate-200'}" style="font-variation-settings: 'FILL' 1;">star</span>
                                    `).join('')}
                                </div>
                            </div>
                            <span class="text-[9px] text-slate-400 font-bold bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded-md">${date}</span>
                        </div>
                    </div>
                </div>
                
                <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-4 px-1 italic">"${f.comment || 'بدون تعليق'}"</p>
                
                <div class="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-white/5">
                    ${f.phone ? `<a href="https://wa.me/${f.phone}" target="_blank" class="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-black hover:scale-105 transition-transform bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-lg">
                        <span class="material-symbols-outlined text-[14px]">call</span>
                        ${f.phone}
                    </a>` : '<div></div>'}
                    
                    <button onclick="window.toggleFeedbackVisibility('${f.id}', ${!isShown})" 
                        class="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-black transition-all ${isShown ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30' : 'bg-slate-100 dark:bg-white/10 text-slate-500'}">
                        <span class="material-symbols-outlined text-[18px]">${isShown ? 'visibility' : 'visibility_off'}</span>
                        ${isShown ? 'يظهر بالرئيسية' : 'مخفي حالياً'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function toggleFeedbackVisibility(id, newStatus) {
    try {
        await updateFeedbackStatus(id, newStatus);
        showNotification(newStatus ? 'تم التفعيل: سيظهر التعليق في الصفحة الرئيسية ✨' : 'تم الإخفاء من الصفحة الرئيسية');
        renderComments(); // Refresh list
    } catch (e) {
        console.error("Error updating status", e);
        showNotification('فشل تحديث حالة التعليق', 'error');
    }
}

window.toggleFeedbackVisibility = toggleFeedbackVisibility;

// Load Tables Logic
function loadDashboardTables() {
    renderOrders();
}


async function renderOrders() {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;

    try {
        const logs = await getOrders();
        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-24 text-center opacity-30 text-xs font-bold">لا توجد طلبات مسجلة حالياً</td></tr>`;
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const idShort = (log.id || '0000').toString().slice(-4);
            const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' }) : '';
            const itemsSummary = (log.items || []).map(i => `${i.quantity}x ${i.name}`).join('، ');

            return `
                <div class="flex flex-col md:grid md:grid-cols-5 gap-3 md:gap-0 p-5 md:px-10 md:py-6 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all group relative border-b border-slate-100 dark:border-white/5 last:border-0">
                    <!-- Order ID -->
                    <div class="flex justify-between items-center md:block">
                        <span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم الطلب</span>
                        <span class="font-black text-[#0058bc] dark:text-blue-400 text-xs md:text-sm">#${idShort}</span>
                    </div>
                    
                    <!-- Customer -->
                    <div class="flex justify-between items-start md:block">
                        <span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">الزبون</span>
                        <div class="text-right md:text-start">
                            <div class="font-bold text-slate-900 dark:text-slate-100 text-xs md:text-sm">${log.userName || 'زبون خارجي'}</div>
                            <div class="text-[10px] text-slate-400 font-bold mt-0.5">${log.phone || ''}</div>
                            ${log.address ? `<div class="text-[9px] text-slate-400 mt-0.5 max-w-[150px] leading-tight">${log.address}</div>` : ''}
                        </div>
                    </div>
                    
                    <!-- Items -->
                    <div class="flex flex-col md:block">
                        <span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الوجبات</span>
                        <div class="text-xs font-bold text-slate-600 dark:text-slate-400 line-clamp-2 md:line-clamp-1 leading-relaxed">${itemsSummary}</div>
                        <div class="text-[10px] text-slate-400 font-medium mt-1 italic">${dateStr}</div>
                    </div>
                    
                    <!-- Total -->
                    <div class="flex justify-between items-center md:block">
                        <span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">الإجمالي</span>
                        <span class="font-black text-slate-900 dark:text-white text-xs md:text-sm">${log.total || '0'} جم</span>
                    </div>

                    <!-- Actions -->
                    <div class="flex justify-end items-center gap-2">
                        <button onclick="printOrder('${log.id}')" class="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="طباعة فاتورة">
                            <span class="material-symbols-outlined text-sm md:text-base">print</span>
                        </button>
                        <button onclick="handleDeleteOrder('${log.id}')" class="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm">
                            <span class="material-symbols-outlined text-sm md:text-base">delete</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) { console.error("Orders Error:", e); }
}


async function printOrder(id) {
    try {
        const logs = await getOrders();
        const log = logs.find(l => l.id === id);
        if (!log) return;

        const printWindow = window.open('', '_blank');
        const itemsHtml = (log.items || []).map(i => `
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #eee;">
                <span>${i.name} (x${i.quantity})</span>
                <b>${i.price} جم</b>
            </div>
            <div style="font-size: 10px; color: #666; margin-bottom: 5px;">
                ${i.options.method} | ${i.options.size}
            </div>
        `).join('');

        const date = new Date(log.timestamp).toLocaleString('ar-EG');

        printWindow.document.write(`
            <html dir="rtl">
            <head>
                <title>فاتورة - ${log.id}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 28px; }
                    .info { margin-bottom: 30px; display: grid; grid-cols: 2; gap: 20px; }
                    .section-title { font-weight: bold; margin-bottom: 15px; background: #f9f9f9; padding: 5px 10px; border-right: 4px solid #333; }
                    .items { margin-bottom: 30px; }
                    .total { text-align: left; font-size: 20px; font-weight: bold; margin-top: 30px; border-top: 2px solid #333; padding-top: 15px; }
                    .footer { text-align: center; margin-top: 60px; font-size: 12px; color: #888; border-top: 1px solid #eee; pt: 20px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>مطعم سمكة</h1>
                    <p>فاتورة مبيعات</p>
                </div>
                
                <div class="info">
                    <div>
                        <div class="section-title">بيانات العميل</div>
                        <p>👤 الاسم: ${log.userName || 'غير معروف'}</p>
                        <p>📞 الهاتف: ${log.phone || '-'}</p>
                        <p>🏠 العنوان: ${log.address || '-'}</p>
                    </div>
                    <div>
                        <div class="section-title">بيانات الطلب</div>
                        <p>🆔 رقم الطلب: #${log.id.slice(-6)}</p>
                        <p>📅 التاريخ: ${date}</p>
                    </div>
                </div>

                <div class="items">
                    <div class="section-title">الوجبات</div>
                    ${itemsHtml}
                </div>

                <div class="total">
                    الإجمالي: ${log.total} جم
                </div>

                <div class="footer">
                    شكراً لتعاملك مع سمكة!<br>
                    تم إنشاء الفاتورة إلكترونياً
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                        // window.close();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    } catch (e) { console.error(e); }
}

window.printOrder = printOrder;

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
        card.dataset.category = item.category;
        card.innerHTML = `
            <div class="flex flex-col h-full">
                <!-- Image Container -->
                <div class="aspect-video relative overflow-hidden bg-slate-50 dark:bg-slate-950 shrink-0">
                    <img src="${itemImage}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ${!isAvailable ? 'grayscale opacity-70' : ''}" alt="${item.name_ar}">
                    <div class="absolute top-3 right-3 flex gap-2">
                         <div class="px-3 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-lg text-[9px] font-black uppercase shadow-sm text-[#0058bc] dark:text-blue-400 border border-white/20">${item.category}</div>
                    </div>
                    ${!isAvailable ? `<div class="absolute inset-0 bg-white/40 dark:bg-black/60 flex items-center justify-center backdrop-blur-[2px]"><span class="bg-rose-500 text-white px-4 py-1.5 rounded-lg text-[10px] font-black shadow-xl">غير متوفر</span></div>` : ''}
                    
                    <button onclick="window.toggleAvailability('${item.id}', ${!isAvailable})" 
                        class="absolute bottom-3 right-3 w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md shadow-lg transition-all active:scale-90 ${isAvailable ? 'bg-white/95 dark:bg-slate-900/95 text-emerald-500' : 'bg-rose-500 text-white'}"
                        title="${isAvailable ? 'متوفر' : 'غير متوفر'}">
                        <span class="material-symbols-outlined text-xl font-black">${isAvailable ? 'check_circle' : 'block'}</span>
                    </button>
                </div>
                
                <!-- Content Container -->
                <div class="p-5 md:p-8 flex flex-col flex-grow">
                    <div class="flex justify-between items-start gap-3 mb-3">
                        <h4 class="text-base md:text-2xl font-bold text-slate-900 dark:text-white leading-tight">${item.name_ar}</h4>
                        <span class="text-[#0058bc] dark:text-blue-400 font-black text-lg md:text-2xl whitespace-nowrap">${item.price}<span class="text-[10px] mr-1 opacity-70">جم</span></span>
                    </div>
                    <p class="text-[11px] md:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-6 flex-grow">${item.description_ar || 'لم يتم إضافة وصف لهذه الوجبة بعد'}</p>
                    
                    <div class="flex gap-2.5 mt-auto">
                        <button onclick="window.editItem('${item.id}')" class="flex-grow py-3 md:py-4 bg-slate-50 dark:bg-white/5 rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-400 hover:bg-[#0058bc] hover:text-white transition-all border border-slate-100 dark:border-white/5">تعديل</button>
                        <button onclick="window.deleteItem('${item.id}')" class="w-11 h-11 md:w-14 md:h-14 flex items-center justify-center bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-rose-100 dark:border-rose-500/10">
                            <span class="material-symbols-outlined text-base md:text-xl">delete</span>
                        </button>
                    </div>
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
        'hours_en', 'social_fb', 'social_insta', 'social_tiktok'
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
        'hours_en', 'social_fb', 'social_insta', 'social_tiktok'
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
            const success = await updateAdminPassword(adminSession.username, newPassword);
            if (success) {
                showNotification('تم تغيير كلمة المرور بنجاح ✅');
                document.getElementById('setting-new-password').value = '';
            } else {
                showNotification('فشل تغيير كلمة المرور ❌', 'error');
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

function updateOrderDropdown(category, currentOrder = null) {
    const select = document.getElementById('item-order');
    if (!select) return;

    // Get count of items in this category
    const itemsInCat = currentData.filter(i => i.category === category);
    const count = itemsInCat.length;

    // If adding new, we can place it up to count + 1
    const isEditing = document.getElementById('item-id').value;
    const max = isEditing ? count : count + 1;

    select.innerHTML = '<option value="">تلقائي (في النهاية)</option>';
    for (let i = 1; i <= Math.max(max, 1); i++) {
        const option = document.createElement('option');
        option.value = i;
        option.innerText = `الترتيب رقم ${i}`;
        if (currentOrder == i) option.selected = true;
        select.appendChild(option);
    }
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
    updateOrderDropdown(document.getElementById('item-category').value);

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
            order: parseInt(document.getElementById('item-order').value) || 999,
            updatedAt: new Date().toISOString()
        };

        if (id) itemData.id = id;
        else {
            // Generate new ID if creating
            submitBtn.innerText = 'جاري تهيئة البيانات...';
            itemData.id = await saveMenuItem(itemData);
        }

        // Production-Grade Reordering (Normalization + Batch)
        submitBtn.innerText = 'جاري ترتيب القائمة...';
        const newOrder = parseInt(document.getElementById('item-order').value);
        let categoryItems = currentData.filter(i => i.category === itemData.category && i.id !== itemData.id);

        // Sort existing items to ensure clean sequence
        categoryItems.sort((a, b) => (a.order || 999) - (b.order || 999));

        if (!isNaN(newOrder)) {
            // Insert current item at the target position (1-based index)
            categoryItems.splice(newOrder - 1, 0, itemData);
        } else {
            // Place at the end
            categoryItems.push(itemData);
        }

        // Re-index all items in this category to be perfectly sequential (1, 2, 3...)
        const itemsToUpdate = categoryItems.map((item, index) => ({
            ...item,
            order: index + 1,
            updatedAt: new Date().toISOString()
        }));

        await bulkSaveMenuItems(itemsToUpdate);
        showNotification('تم حفظ البيانات وترتيب القائمة بنجاح ✨');
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
    updateOrderDropdown(item.category, item.order);

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

function renderCategories(categories = []) {
    const list = document.getElementById('categories-list');
    const filterBar = document.getElementById('admin-menu-filters');
    const select = document.getElementById('item-category');

    if (list && Array.isArray(categories)) {
        list.innerHTML = categories.map((cat, index) => `
            <div class="category-chip relative" data-id="${cat.id}">
                <div class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl hover:border-[#0058bc] transition-all shadow-sm group min-w-max">
                    <!-- Order Selector Button -->
                    <button onclick="window.toggleOrderDropdown(event, '${cat.id}')" class="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-white/5 rounded-lg text-[11px] font-black text-[#0058bc] dark:text-blue-400 hover:bg-[#0058bc] hover:text-white transition-all shadow-inner">
                        ${index + 1}
                    </button>
                    
                    <!-- Fixed Overlay Selector (Modal Style) -->
                    <div id="dropdown-${cat.id}" class="order-dropdown hidden fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div class="bg-white dark:bg-slate-900 w-full max-w-[320px] rounded-3xl shadow-2xl border border-white dark:border-white/10 p-6 scale-in-center">
                            <div class="flex justify-between items-center mb-6">
                                <div>
                                    <h4 class="text-sm font-black text-slate-900 dark:text-white">ترتيب القسم</h4>
                                    <p class="text-[10px] text-slate-400 font-bold mt-0.5">اختر المكان الجديد لـ "${cat.name}"</p>
                                </div>
                                <button onclick="window.toggleOrderDropdown(event, '${cat.id}')" class="text-slate-400 hover:text-rose-500 transition-colors">
                                    <span class="material-symbols-outlined text-[24px]">close</span>
                                </button>
                            </div>
                            <div class="grid grid-cols-4 gap-3">
                                ${categories.map((_, i) => `
                                    <button onclick="window.reorderCategory('${cat.id}', ${i})" class="aspect-square flex items-center justify-center rounded-2xl text-xs font-black transition-all ${i === index ? 'bg-[#0058bc] text-white shadow-lg shadow-blue-500/30' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-[#0058bc]/10 hover:text-[#0058bc]'}">
                                        ${i + 1}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <span class="text-[11px] font-bold text-slate-700 dark:text-slate-200">${cat.name}</span>
                    <button onclick="handleDeleteCategory('${cat.id}')" class="text-slate-300 hover:text-rose-500 transition-colors ml-1">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Populate Quick Search / Filter Bar (Bottom List)
    if (filterBar && Array.isArray(categories)) {
        const allBtn = `
            <div class="admin-filter-btn-wrapper flex items-center bg-[#0058bc] rounded-xl shadow-lg shadow-blue-500/20 overflow-hidden min-w-max">
                <button onclick="filterMenuItemsByCategory('all')" class="admin-filter-btn whitespace-nowrap px-6 py-2.5 text-[10px] font-black transition-all text-white" data-category="all">
                    الكل
                </button>
            </div>
        `;

        const categoryBtns = categories.map(cat => `
            <div class="admin-filter-btn-wrapper flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden min-w-max">
                <button onclick="filterMenuItemsByCategory('${cat.name}')" class="admin-filter-btn whitespace-nowrap px-5 py-2.5 text-[10px] font-black transition-all text-slate-600 dark:text-slate-300" data-category="${cat.name}">
                    ${cat.name}
                </button>
            </div>
        `).join('');

        filterBar.innerHTML = allBtn + categoryBtns;
    }

    // Update Modal Select
    if (select && Array.isArray(categories)) {
        select.innerHTML = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }
}

function filterMenuItemsByCategory(category) {
    const grid = document.getElementById('menu-items-grid');
    if (!grid) return;

    const items = grid.querySelectorAll('.premium-card');
    const buttons = document.querySelectorAll('.admin-filter-btn');

    buttons.forEach(btn => {
        if (btn.getAttribute('data-category') === category) {
            btn.classList.add('bg-[#0058bc]', 'text-white', 'border-[#0058bc]', 'shadow-lg', 'shadow-blue-500/20');
            btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
        } else {
            btn.classList.remove('bg-[#0058bc]', 'text-white', 'border-[#0058bc]', 'shadow-lg', 'shadow-blue-500/20');
            btn.classList.add('bg-white', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
        }
    });

    items.forEach(item => {
        const itemCategory = item.getAttribute('data-category');
        if (category === 'all' || itemCategory === category) {
            item.style.display = 'flex';
            item.classList.add('animate-in');
        } else {
            item.style.display = 'none';
        }
    });
}

async function handleAddCategory() {
    const nameInput = document.getElementById('new-category-name');
    const name = nameInput.value.trim();

    if (!name) return;

    try {
        // New categories are added at the end by default
        const nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order || 0)) + 1 : 1;
        await saveCategory({ name, order: nextOrder });
        showNotification('تم إضافة القسم الجديد بنجاح ✅');
        nameInput.value = '';
        await refreshData();
    } catch (e) {
        showNotification('حدث خطأ أثناء إضافة القسم', 'error');
    }
}

function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;

    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;

    modal.classList.remove('hidden');

    const closeModal = () => modal.classList.add('hidden');

    document.getElementById('confirm-cancel').onclick = closeModal;
    document.getElementById('confirm-proceed').onclick = () => {
        onConfirm();
        closeModal();
    };
}

async function handleDeleteCategory(id) {
    showConfirm(
        'حذف القسم؟',
        'حذف هذا القسم قد يؤثر على الوجبات المرتبطة به. هل أنت متأكد؟',
        async () => {
            try {
                await deleteCategory(id);
                showNotification('تم حذف القسم بنجاح 🗑️');
                await refreshData();
            } catch (e) {
                showNotification('حدث خطأ أثناء الحذف', 'error');
            }
        }
    );
}

async function deleteItem(id) {
    showConfirm(
        'حذف الوجبة؟',
        'هل أنت متأكد من حذف هذه الوجبة نهائياً؟ لا يمكن التراجع عن هذا الفعل.',
        async () => {
            try {
                await deleteMenuItem(id);
                showNotification('تم حذف الوجبة نهائياً 🗑️');
                await refreshData();
            } catch (error) {
                console.error(error);
                showNotification('حدث خطأ أثناء الحذف ❌', 'error');
            }
        }
    );
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
    if (val && !currentTypeTags.includes(val)) {
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

// Order Dropdown Logic
function toggleOrderDropdown(event, id) {
    event.preventDefault();
    event.stopPropagation();
    const allDropdowns = document.querySelectorAll('.order-dropdown');
    allDropdowns.forEach(d => {
        if (d.id !== `dropdown-${id}`) d.classList.add('hidden');
    });
    const dropdown = document.getElementById(`dropdown-${id}`);
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

async function reorderCategory(catId, newIndex) {
    let cats = [...(window.samaka_categories || [])];
    const oldIndex = cats.findIndex(c => c.id === catId);
    if (oldIndex === -1 || oldIndex === newIndex) {
        document.querySelectorAll('.order-dropdown').forEach(d => d.classList.add('hidden'));
        return;
    }

    const [movedItem] = cats.splice(oldIndex, 1);
    cats.splice(newIndex, 0, movedItem);
    window.samaka_categories = cats;
    renderCategories(cats);

    document.querySelectorAll('.order-dropdown').forEach(d => d.classList.add('hidden'));
    showNotification('جاري الحفظ... ⏳');

    try {
        const updates = cats.map((cat, index) => saveCategory({ id: cat.id, order: index }));
        await Promise.all(updates);
        showNotification('تم تحديث الترتيب بنجاح ✨');
        const freshCats = await getCategories();
        window.samaka_categories = freshCats;
        renderCategories(freshCats);
    } catch (e) {
        showNotification('فشل الحفظ', 'error');
        refreshData();
    }
}

// Close dropdowns and modals on outside click
document.addEventListener('click', (e) => {
    // 1. Close category order dropdowns
    if (!e.target.closest('.category-chip')) {
        document.querySelectorAll('.order-dropdown').forEach(d => d.classList.add('hidden'));
    }

    // 2. Close Item Modal when clicking background (the darkened area)
    const itemModal = document.getElementById('item-modal');
    if (e.target === itemModal || e.target.closest('.absolute.inset-0.bg-slate-950\\/80')) {
        closeModal();
    }

    // 3. Close Confirmation Modal when clicking background
    const confirmModal = document.getElementById('confirm-modal');
    if (e.target === confirmModal) {
        confirmModal.classList.add('hidden');
    }
});
