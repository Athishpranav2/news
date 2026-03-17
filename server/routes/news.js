const express = require('express');
const RSSParser = require('rss-parser');
const router = express.Router();
const parser = new RSSParser();

// Live RSS feeds for latest news
const RSS_FEEDS = [
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'NY Times' },
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World' },
    { url: 'https://rss.app/feeds/v1.1/t1eWJfvSbqUMjOhq.xml', name: 'Reuters World' },
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera' },
    { url: 'https://feeds.washingtonpost.com/rss/world', name: 'Washington Post' },
    { url: 'https://www.theguardian.com/world/rss', name: 'The Guardian' },
];

// Cache for latest feed
let cachedArticles = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

function categorize(text) {
    const t = text.toLowerCase();
    if (/war|military|troops|soldiers|airstrike|bombing|frontline|battle|strike|weapon/.test(t)) return 'war';
    if (/conflict|tension|clash|fighting|rebel|militia/.test(t)) return 'conflict';
    if (/ceasefire|peace|negotiat|diplomatic|talks|summit/.test(t)) return 'diplomacy';
    if (/humanitarian|refugee|displaced|aid|crisis|flood|earthquake/.test(t)) return 'humanitarian';
    if (/sanction|embargo|trade|economic/.test(t)) return 'sanctions';
    if (/nato|defense|defence|arms|weapon|nuclear/.test(t)) return 'defense';
    if (/cyber|hack|digital|infrastructure/.test(t)) return 'cyber';
    return 'world';
}

function mapRSSItem(item, sourceName) {
    return {
        title: item.title || '',
        source: { name: sourceName },
        publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
        description: (item.contentSnippet || item.content || '').slice(0, 300),
        url: item.link || '',
        category: categorize(item.title + ' ' + (item.contentSnippet || '')),
    };
}

// Fetch from standard RSS feeds (latest news)
async function fetchLiveFeeds() {
    const articles = [];
    const feedPromises = RSS_FEEDS.map(async (feed) => {
        try {
            const parsed = await parser.parseURL(feed.url);
            return (parsed.items || []).slice(0, 10).map((item) => mapRSSItem(item, feed.name));
        } catch (err) {
            console.error(`Failed to fetch ${feed.name}: ${err.message}`);
            return [];
        }
    });

    const results = await Promise.allSettled(feedPromises);
    results.forEach((r) => { if (r.status === 'fulfilled') articles.push(...r.value); });
    return articles;
}

// Fetch from Google News RSS with date range
async function fetchGoogleNewsForDateRange(from, to, query) {
    const articles = [];
    const searchTerms = query || 'world news war conflict';

    // Build Google News RSS search URL with date params
    // Format: after:YYYY-MM-DD before:YYYY-MM-DD
    let dateQuery = searchTerms;
    if (from) dateQuery += ` after:${from}`;
    if (to) dateQuery += ` before:${to}`;

    const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(dateQuery)}&hl=en&gl=US&ceid=US:en`;

    try {
        const parsed = await parser.parseURL(googleNewsUrl);
        const items = (parsed.items || []).slice(0, 30);
        items.forEach((item) => {
            articles.push({
                title: (item.title || '').replace(/ - .*$/, ''), // Remove source suffix
                source: { name: item.source?.name || item.title?.match(/- ([^-]+)$/)?.[1]?.trim() || 'Google News' },
                publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
                description: (item.contentSnippet || item.content || '').replace(/<[^>]*>/g, '').slice(0, 300),
                url: item.link || '',
                category: categorize(item.title + ' ' + (item.contentSnippet || '')),
            });
        });
    } catch (err) {
        console.error('Google News RSS failed:', err.message);
    }

    return articles;
}

// GET /api/news?q=...&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req, res) => {
    const query = req.query.q || '';
    const from = req.query.from || '';
    const to = req.query.to || '';
    const now = Date.now();

    let articles = [];

    // If date range is specified, use Google News RSS date search
    if (from || to) {
        articles = await fetchGoogleNewsForDateRange(from, to, query);

        // Also filter by actual date range on the results
        if (from) {
            const fromDate = new Date(from);
            fromDate.setHours(0, 0, 0, 0);
            articles = articles.filter((a) => new Date(a.publishedAt) >= fromDate);
        }
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            articles = articles.filter((a) => new Date(a.publishedAt) <= toDate);
        }
    } else {
        // Regular fetch: use cached RSS feeds
        if (now - lastFetchTime > CACHE_DURATION || cachedArticles.length === 0) {
            try {
                const live = await fetchLiveFeeds();
                if (live.length > 0) {
                    cachedArticles = live;
                    lastFetchTime = now;
                }
            } catch (err) {
                console.error('RSS fetch failed:', err.message);
            }
        }
        articles = cachedArticles.length > 0 ? cachedArticles : [];

        // Text search filter
        if (query && query !== 'world news') {
            const q = query.toLowerCase();
            articles = articles.filter(
                (a) =>
                    a.title.toLowerCase().includes(q) ||
                    a.description.toLowerCase().includes(q) ||
                    (a.category && a.category.toLowerCase().includes(q))
            );
        }
    }

    // Sort by date (latest first) and deduplicate
    articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const seen = new Set();
    articles = articles.filter((a) => {
        const key = a.title.toLowerCase().trim().slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    res.json(articles.slice(0, 30));
});

// POST /api/news/scrape — Scrape a URL and return card data
router.post('/scrape', async (req, res) => {
    const { url } = req.body;
    if (!url || !url.startsWith('http')) {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return res.status(502).json({ error: `Failed to fetch URL (${response.status})` });
        }

        const html = await response.text();

        // Extract Open Graph & standard meta tags
        const getOG = (prop) => {
            const m = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
                || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'));
            return m ? m[1] : '';
        };

        const getMeta = (name) => {
            const m = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
                || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'));
            return m ? m[1] : '';
        };

        const getTitle = () => {
            const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            return m ? m[1].trim() : '';
        };

        const title = getOG('title') || getMeta('title') || getTitle() || 'Untitled';
        const description = getOG('description') || getMeta('description') || '';
        const image_url = getOG('image') || '';
        const siteName = getOG('site_name') || new URL(url).hostname.replace('www.', '');

        const article = {
            title,
            source: { name: siteName },
            publishedAt: new Date().toISOString(),
            description: description.slice(0, 300),
            url,
            image_url,
            category: categorize(title + ' ' + description),
            scraped: true,
        };

        res.json(article);
    } catch (err) {
        console.error('Scrape failed:', err.message);
        res.status(500).json({ error: 'Failed to scrape URL' });
    }
});

module.exports = router;
