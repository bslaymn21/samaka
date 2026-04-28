/**
 * Preloader and Page Transition Logic - Optimized
 */

(function() {
    // 1. Hide Preloader when page is fully loaded
    window.addEventListener('load', () => {
        const loader = document.getElementById('site-preloader');
        if (loader) {
            // Instant feel: nearly zero delay after load
            setTimeout(() => {
                loader.classList.add('fade-out');
                document.body.style.overflow = '';
            }, 50);
        }
    });

    // 2. Handle Page Transitions (Interceptor)
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        
        // Only intercept internal links that don't open in new tab and aren't hashes
        if (href && 
            !href.startsWith('#') && 
            !href.startsWith('mailto:') && 
            !href.startsWith('tel:') && 
            !href.startsWith('http') && 
            !link.hasAttribute('download') &&
            link.target !== '_blank') {
            
            e.preventDefault();
            const loader = document.getElementById('site-preloader');
            if (loader) {
                loader.classList.remove('fade-out');
                const bar = loader.querySelector('.preloader-progress-bar');
                if (bar) {
                    bar.classList.remove('animate-loading');
                    void bar.offsetWidth; 
                    bar.classList.add('animate-loading');
                }
            }
            
            setTimeout(() => {
                window.location.href = href;
            }, 150); // Faster transition
        }
    });
})();
