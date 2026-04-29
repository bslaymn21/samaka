// Global Menu Data for Samaka
const menuItems = [];

// Helper to get data correctly
function getMenuData() {
    const saved = localStorage.getItem('samaka_menu');
    let items = saved ? JSON.parse(saved) : [...menuItems];
    return items;
}

// Force update for broken images/stale data (Cleanup)
(function() {
    let saved = localStorage.getItem('samaka_menu');
    if (saved) {
        // Migration logic for old data if needed
    }
})();

function getSiteSettings() {
    const defaultSettings = {
        whatsapp: "",
        address_en: "",
        address_ar: "",
        hours_en: "",
        hours_ar: ""
    };
    const saved = JSON.parse(localStorage.getItem('samaka_settings') || '{}');
    return { ...defaultSettings, ...saved };
}

function getWhatsAppNumber() {
    let num = getSiteSettings().whatsapp || "";
    // Normalize: Remove spaces, dashes, plus sign
    num = num.replace(/[\s\-\+]/g, '');
    // If it starts with 01 (like 010...), it should be 201...
    if (num.startsWith('01')) {
        num = '2' + num;
    }
    // If it starts with 1 (like 10...), and is 10 digits, it should be 201...
    else if (num.startsWith('1') && num.length === 10) {
        num = '20' + num;
    }
    return num;
}

function getWhatsAppLink(message = "") {
    const num = getWhatsAppNumber();
    return `https://wa.me/${num}${message ? '?text=' + encodeURIComponent(message) : ''}`;
}

function openWhatsApp(message = "") {
    const url = getWhatsAppLink(message);
    // iOS Safari Fix: window.open can be blocked after async operations. 
    // window.location.href is more reliable for app deep-linking on mobile.
    window.location.href = url;
}
