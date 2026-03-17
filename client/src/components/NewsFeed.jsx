import { useState, useEffect, useCallback } from 'react';
import { fetchNews, scrapeUrl } from '../api';
import NewsCard from './NewsCard';

export default function NewsFeed({ isCollapsed, onToggleCollapse }) {
    const [articles, setArticles] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all');

    // URL paste state
    const [pasteUrl, setPasteUrl] = useState('');
    const [scraping, setScraping] = useState(false);
    const [scrapeError, setScrapeError] = useState('');

    // Date/time filter state
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showDateFilter, setShowDateFilter] = useState(false);
    const [dateFetched, setDateFetched] = useState(false);

    const loadNews = useCallback(async (q = '', from = '', to = '') => {
        setLoading(true);
        try {
            const data = await fetchNews(q, from, to);
            setArticles(Array.isArray(data) ? data : []);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Failed to fetch news:', err);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadNews();
        const interval = setInterval(() => loadNews(query), 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadNews(query, dateFrom, dateTo);
        setRefreshing(false);
    };

    const handleSearch = (value) => {
        setQuery(value);
        if (searchTimeout) clearTimeout(searchTimeout);
        const timeout = setTimeout(() => loadNews(value), 600);
        setSearchTimeout(timeout);
    };

    const handleDateFetch = async () => {
        await loadNews(query, dateFrom, dateTo);
        setDateFetched(true);
    };

    const clearDateFilter = () => {
        setDateFrom('');
        setDateTo('');
        setDateFetched(false);
    };

    // URL scraping handler
    const handleScrapeUrl = async () => {
        const url = pasteUrl.trim();
        if (!url) return;
        setScraping(true);
        setScrapeError('');
        try {
            const article = await scrapeUrl(url);
            setArticles((prev) => [article, ...prev]);
            setPasteUrl('');
        } catch (err) {
            setScrapeError(err.message || 'Failed to fetch');
        }
        setScraping(false);
    };

    const handleUrlKeyDown = (e) => {
        if (e.key === 'Enter') handleScrapeUrl();
    };

    const isValidUrl = (str) => {
        try { new URL(str); return true; } catch { return false; }
    };

    const handleUrlPaste = (e) => {
        const pasted = e.clipboardData?.getData('text') || '';
        if (isValidUrl(pasted)) {
            setPasteUrl(pasted);
            // Auto-fetch on paste
            setTimeout(() => {
                setScraping(true);
                setScrapeError('');
                scrapeUrl(pasted)
                    .then((article) => {
                        setArticles((prev) => [article, ...prev]);
                        setPasteUrl('');
                    })
                    .catch((err) => setScrapeError(err.message || 'Failed to fetch'))
                    .finally(() => setScraping(false));
            }, 100);
        }
    };

    const filters = ['all', 'war', 'conflict', 'diplomacy', 'humanitarian', 'defense'];

    let filteredArticles = activeFilter === 'all'
        ? articles
        : articles.filter((a) => a.category === activeFilter);

    // Collapsed state
    if (isCollapsed) {
        return (
            <div className="flex flex-col items-center h-full py-6 w-full">
                <button
                    onClick={onToggleCollapse}
                    className="flex flex-col items-center gap-3 text-[#86868b] hover:text-white transition-colors group"
                    title="Expand Feed"
                >
                    <svg className="w-4 h-4 rotate-180 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                    </svg>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0a84ff] animate-pulse" />
                    <span className="text-[9px] font-medium tracking-[0.2em] [writing-mode:vertical-lr] rotate-180 uppercase">
                        Feed
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header — frosted glass */}
            <div className="apple-glass border-b border-white/[0.04] flex-shrink-0">
                <div className="p-4 pb-3">
                    {/* Title row */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-[15px] font-semibold text-white tracking-tight">Feed</h2>
                            <div className="w-1.5 h-1.5 rounded-full bg-[#30d158]" />
                        </div>
                        <div className="flex items-center gap-2">
                            {lastUpdate && (
                                <span className="text-[11px] text-[#86868b] tabular-nums">
                                    {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                            {/* Refresh button */}
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="apple-icon-btn"
                                title="Refresh feed"
                            >
                                <svg
                                    className={`w-3.5 h-3.5 transition-transform ${refreshing ? 'animate-spin' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                            {/* Collapse button */}
                            <button
                                onClick={onToggleCollapse}
                                className="apple-icon-btn"
                                title="Collapse panel"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Search input */}
                    <div className="relative mb-3">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Search"
                            className="apple-search-input"
                        />
                    </div>

                    {/* URL Paste Input */}
                    <div className="relative mb-3">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <input
                            type="url"
                            value={pasteUrl}
                            onChange={(e) => setPasteUrl(e.target.value)}
                            onKeyDown={handleUrlKeyDown}
                            onPaste={handleUrlPaste}
                            placeholder="Paste a URL to create a card…"
                            className="apple-search-input"
                        />
                        {pasteUrl && (
                            <button
                                onClick={handleScrapeUrl}
                                disabled={scraping}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 rounded-full text-[11px] font-medium bg-[#0a84ff] text-white hover:bg-[#0a84ff]/80 transition-colors disabled:opacity-50"
                            >
                                {scraping ? '…' : 'Go'}
                            </button>
                        )}
                    </div>
                    {scrapeError && (
                        <p className="text-[11px] text-[#ff453a] mb-2 px-1">{scrapeError}</p>
                    )}
                    {scraping && (
                        <div className="flex items-center gap-2 mb-2 px-1">
                            <div className="w-3 h-3 border-2 border-[#0a84ff] border-t-transparent rounded-full animate-spin" />
                            <span className="text-[11px] text-[#86868b]">Fetching article…</span>
                        </div>
                    )}

                    {/* Category filters — pill style */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {filters.map((f) => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                className={`apple-pill ${activeFilter === f ? 'active' : ''}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>

                    {/* Date Filter Toggle */}
                    <div>
                        <button
                            onClick={() => setShowDateFilter(!showDateFilter)}
                            className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${(dateFrom || dateTo)
                                ? 'text-[#0a84ff]'
                                : 'text-[#86868b] hover:text-white'
                                }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {dateFrom || dateTo ? 'Date filter active' : 'Filter by date'}
                            <svg className={`w-2.5 h-2.5 transition-transform ${showDateFilter ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {showDateFilter && (
                            <div className="mt-2 p-3 rounded-xl bg-[#1c1c1e] border border-white/[0.06] animate-in space-y-2">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-medium text-[#86868b] uppercase tracking-wider block mb-1">From</label>
                                        <input
                                            type="date"
                                            value={dateFrom}
                                            onChange={(e) => { setDateFrom(e.target.value); setDateFetched(false); }}
                                            className="apple-date-input"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] font-medium text-[#86868b] uppercase tracking-wider block mb-1">To</label>
                                        <input
                                            type="date"
                                            value={dateTo}
                                            onChange={(e) => { setDateTo(e.target.value); setDateFetched(false); }}
                                            className="apple-date-input"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleDateFetch}
                                        disabled={!dateFrom && !dateTo}
                                        className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${!dateFrom && !dateTo
                                            ? 'bg-[#2c2c2e] text-[#48484a] cursor-not-allowed'
                                            : 'bg-[#0a84ff] text-white hover:bg-[#0a84ff]/80'
                                            }`}
                                    >
                                        {loading ? 'Fetching…' : 'Fetch'}
                                    </button>
                                    {(dateFrom || dateTo) && (
                                        <button
                                            onClick={clearDateFilter}
                                            className="text-[11px] text-[#ff453a]/70 hover:text-[#ff453a] transition-colors"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Articles */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading && !refreshing ? (
                    <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="apple-card p-4 animate-pulse">
                                <div className="h-3 bg-[#2c2c2e] rounded-full w-4/5 mb-3" />
                                <div className="h-2.5 bg-[#2c2c2e] rounded-full w-1/3 mb-3" />
                                <div className="h-2.5 bg-[#2c2c2e] rounded-full w-full" />
                            </div>
                        ))}
                    </div>
                ) : filteredArticles.length === 0 ? (
                    <div className="text-center py-16">
                        {dateFetched && (dateFrom || dateTo) ? (
                            <>
                                <p className="text-[13px] text-[#86868b] mb-1">No results found</p>
                                <p className="text-[11px] text-[#48484a]">
                                    No articles for{dateFrom ? ` from ${dateFrom}` : ''}{dateTo ? ` to ${dateTo}` : ''}
                                </p>
                                <button
                                    onClick={clearDateFilter}
                                    className="text-[11px] text-[#0a84ff] hover:text-[#0a84ff]/80 mt-3 transition-colors"
                                >
                                    Clear date filter
                                </button>
                            </>
                        ) : (
                            <p className="text-[13px] text-[#48484a]">No articles found</p>
                        )}
                    </div>
                ) : (
                    filteredArticles.map((article, idx) => (
                        <NewsCard key={`${article.title}-${idx}`} article={article} />
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/[0.04] flex-shrink-0">
                <p className="text-[11px] text-[#48484a] text-center">
                    {filteredArticles.length} articles · drag to board →
                </p>
            </div>
        </div>
    );
}
