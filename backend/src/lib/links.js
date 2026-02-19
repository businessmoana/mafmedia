/**
 * Extract URLs from text using regex pattern
 * Returns an array of unique URLs found in the text
 */
export function extractUrls(text) {
  if (!text || typeof text !== 'string') return [];
  
  // URL regex pattern - matches http/https URLs
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex);
  
  if (!matches) return [];
  
  // Remove duplicates and normalize URLs
  const uniqueUrls = [...new Set(matches.map(url => url.trim()))];
  
  return uniqueUrls;
}
