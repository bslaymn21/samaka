// Global Menu Data for Samaka
const menuItems = [];

// Helper to get data correctly (with proactive image patching for broken links)
function getMenuData() {
    const saved = localStorage.getItem('samaka_menu');
    let items = saved ? JSON.parse(saved) : [...menuItems];
    
    // Proactive Patching: Fix broken/stale images for specific IDs
    items.forEach(item => {
        if (!item.images) return;
        
        if (item.id === 2 && (item.images[0].includes('lh3') || item.images[0].length < 10)) {
            item.images[0] = "https://images.unsplash.com/photo-1533622597524-a1215e26c0a2?q=80&w=2070&auto=format&fit=crop";
        }
        if (item.id === 5 && item.images[0].includes('lh3')) {
            item.images[0] = "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=2070&auto=format&fit=crop";
        }
        if (item.id === 6 && item.images[0].includes('lh3')) {
            item.images[0] = "https://images.unsplash.com/photo-1551248429-40975aa4de74?q=80&w=2070&auto=format&fit=crop";
        }
    });

    return items;
}

// Force update for broken images/stale data
(function() {
    let saved = localStorage.getItem('samaka_menu');
    if (saved) {
        let items = JSON.parse(saved);
        let updated = false;
        items.forEach(item => {
            if (!item.images) return;
            
            // Check first image for legacy broken links
            if (item.id === 2 && (item.images[0].includes('lh3.googleusercontent.com') || item.images[0] === '')) {
                item.images[0] = "https://images.unsplash.com/photo-1544024838-8314115e5108?q=80&w=2070&auto=format&fit=crop";
                updated = true;
            }
            if (item.id === 5 && item.images[0].includes('lh3.googleusercontent.com')) {
                item.images[0] = "https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?q=80&w=2070&auto=format&fit=crop";
                updated = true;
            }
            if (item.id === 6 && item.images[0].includes('lh3.googleusercontent.com')) {
                item.images[0] = "https://images.unsplash.com/photo-1551248429-40975aa4de74?q=80&w=2070&auto=format&fit=crop";
                updated = true;
            }
        });
        if (updated) {
            localStorage.setItem('samaka_menu', JSON.stringify(items));
        }
    }
})();

// Initial Visitor Count Simulator
if (!localStorage.getItem('samaka_visitors')) {
    localStorage.setItem('samaka_visitors', 0);
}

const siteStats = {
    getVisitors: () => parseInt(localStorage.getItem('samaka_visitors')),
    incrementVisitors: () => {
        let count = parseInt(localStorage.getItem('samaka_visitors'));
        localStorage.setItem('samaka_visitors', count + 1);
        return count + 1;
    }
};

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
    window.open(getWhatsAppLink(message), '_blank');
}
