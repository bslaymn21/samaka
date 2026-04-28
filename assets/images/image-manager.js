/**
 * Image Manager for Matamkom
 * This file handles external image fetching and provides paths for static assets.
 */

const STATIC_IMAGE_PATH = './assets/images/static/';

/**
 * Static Images used throughout the site
 */
export const StaticImages = {
    LOGO: `${STATIC_IMAGE_PATH}logo.png`,
    HERO_BG: `${STATIC_IMAGE_PATH}hero-bg.jpg`,
    ABOUT_RESTAURANT: `${STATIC_IMAGE_PATH}about.jpg`,
    PLACEHOLDER: `${STATIC_IMAGE_PATH}placeholder.jpg`
};

/**
 * Fetch external images (e.g. from Unsplash or specialized API)
 * @param {string} category - e.g. 'fish', 'meat', 'salad'
 * @returns {string} URL of the image
 */
export function getExternalImageUrl(category) {
    const unsplashMap = {
        'fish': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&q=80&w=800',
        'meat': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800',
        'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800',
        'default': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800'
    };
    
    return unsplashMap[category] || unsplashMap['default'];
}

/**
 * Returns a high-quality food image URL for a given keyword
 */
export function getFoodImage(keyword) {
    return `https://source.unsplash.com/800x600/?food,${keyword}`;
}
