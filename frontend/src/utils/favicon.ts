/**
 * Get favicon URL for a given website using Google's favicon service
 * @param websiteUrl - The full website URL (e.g., "https://www.usps.com")
 * @param size - Size in pixels (default: 16)
 * @returns Favicon URL
 */
export const getFaviconUrl = (websiteUrl: string, size: number = 16): string => {
  try {
    const url = new URL(websiteUrl);
    const domain = url.hostname;

    // Use Google's favicon service - reliable and fast
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
  } catch (error) {
    // If URL parsing fails, return empty string
    return '';
  }
};

/**
 * Alternative: Get favicon directly from domain
 * Less reliable but doesn't depend on Google
 */
export const getDirectFaviconUrl = (websiteUrl: string): string => {
  try {
    const url = new URL(websiteUrl);
    return `${url.protocol}//${url.hostname}/favicon.ico`;
  } catch (error) {
    return '';
  }
};
