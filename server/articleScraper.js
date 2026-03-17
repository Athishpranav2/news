/**
 * articleScraper.js — Lightweight article content extractor
 * Fetches article HTML from source URLs and extracts readable text.
 * No external dependencies — uses Node's built-in fetch.
 */

const FETCH_TIMEOUT = 8000; // 8 second timeout per article
const MAX_CONTENT_LENGTH = 2500; // chars per article for Gemini

/**
 * Extract readable text from raw HTML.
 * Prioritises <article>, <main>, and <p> tags.
 */
function extractText(html) {
    // Remove scripts, styles, nav, header, footer, aside, forms
    let cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<aside[\s\S]*?<\/aside>/gi, '')
        .replace(/<form[\s\S]*?<\/form>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');

    // Try to find <article> or <main> content first
    let contentBlock = '';
    const articleMatch = cleaned.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);
    const mainMatch = cleaned.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);

    if (articleMatch) {
        contentBlock = articleMatch[1];
    } else if (mainMatch) {
        contentBlock = mainMatch[1];
    } else {
        contentBlock = cleaned;
    }

    // Extract text from <p> tags (most article body content)
    const paragraphs = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = pRegex.exec(contentBlock)) !== null) {
        const text = match[1]
            .replace(/<[^>]+>/g, '')       // strip remaining HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&rsquo;/g, "'")
            .replace(/&lsquo;/g, "'")
            .replace(/&rdquo;/g, '"')
            .replace(/&ldquo;/g, '"')
            .replace(/&mdash;/g, '—')
            .replace(/&ndash;/g, '–')
            .replace(/\s+/g, ' ')
            .trim();

        // Skip very short paragraphs (likely captions, labels)
        if (text.length > 40) {
            paragraphs.push(text);
        }
    }

    const fullText = paragraphs.join('\n\n');

    // Truncate to max length
    if (fullText.length > MAX_CONTENT_LENGTH) {
        return fullText.slice(0, MAX_CONTENT_LENGTH) + '…';
    }

    return fullText;
}

/**
 * Fetch and extract article content from a URL.
 * Returns extracted text or empty string on failure.
 */
async function fetchArticleContent(url) {
    // Skip invalid URLs, base64 images, etc.
    if (!url || !url.startsWith('http')) {
        return '';
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        clearTimeout(timeout);

        if (!response.ok) {
            return '';
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
            return '';
        }

        const html = await response.text();
        return extractText(html);
    } catch (err) {
        // Timeout, network error, etc. — fail silently
        return '';
    }
}

/**
 * Fetch article content for multiple events in parallel.
 * Returns a Map of eventId → articleText.
 */
async function fetchAllArticleContent(events) {
    const results = new Map();

    const promises = events.map(async (event) => {
        const content = await fetchArticleContent(event.source_url);
        results.set(event.id, content);
    });

    await Promise.allSettled(promises);
    return results;
}

module.exports = { fetchArticleContent, fetchAllArticleContent, extractText };
