const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// ─── Per-User Identity ────────────────────────────────────
function getUserId() {
    let uid = localStorage.getItem('control_room_user_id');
    if (!uid) {
        uid = crypto.randomUUID();
        localStorage.setItem('control_room_user_id', uid);
    }
    return uid;
}

function userHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-user-id': getUserId(),
    };
}

function userHeadersGet() {
    return { 'x-user-id': getUserId() };
}

// ─── Timelines ────────────────────────────────────────────
export async function fetchTimelines() {
    const res = await fetch(`${API_BASE}/timelines`, { headers: userHeadersGet() });
    return res.json();
}

export async function createTimeline(title, topic = '') {
    const res = await fetch(`${API_BASE}/timelines`, {
        method: 'POST',
        headers: userHeaders(),
        body: JSON.stringify({ title, topic }),
    });
    return res.json();
}

export async function deleteTimeline(id) {
    const res = await fetch(`${API_BASE}/timelines/${id}`, {
        method: 'DELETE',
        headers: userHeadersGet(),
    });
    return res.json();
}

// ─── Events ───────────────────────────────────────────────
export async function fetchEvents(timelineId) {
    const res = await fetch(`${API_BASE}/events/${timelineId}`, { headers: userHeadersGet() });
    return res.json();
}

export async function createEvent(eventData) {
    const res = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: userHeaders(),
        body: JSON.stringify(eventData),
    });
    return res.json();
}

export async function updateEvent(id, data) {
    const res = await fetch(`${API_BASE}/events/${id}`, {
        method: 'PUT',
        headers: userHeaders(),
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function deleteEvent(id) {
    const res = await fetch(`${API_BASE}/events/${id}`, {
        method: 'DELETE',
        headers: userHeadersGet(),
    });
    return res.json();
}

// ─── Relationships ────────────────────────────────────────
export async function fetchRelationships(timelineId) {
    const res = await fetch(`${API_BASE}/relationships/${timelineId}`, { headers: userHeadersGet() });
    return res.json();
}

export async function createRelationship(data) {
    const res = await fetch(`${API_BASE}/relationships`, {
        method: 'POST',
        headers: userHeaders(),
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function deleteRelationship(id) {
    const res = await fetch(`${API_BASE}/relationships/${id}`, {
        method: 'DELETE',
        headers: userHeadersGet(),
    });
    return res.json();
}

// ─── News ─────────────────────────────────────────────────
const decodeHtml = (html) => {
    if (!html) return html;
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.documentElement.textContent;
};

export async function fetchNews(query = 'world news', from = '', to = '') {
    const params = new URLSearchParams({ q: query });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`${API_BASE}/news?${params.toString()}`);
    const data = await res.json();
    if (Array.isArray(data)) {
        return data.map(item => ({
            ...item,
            title: decodeHtml(item.title),
            description: decodeHtml(item.description)
        }));
    }
    return data;
}

export async function scrapeUrl(url) {
    const res = await fetch(`${API_BASE}/news/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to scrape');
    }
    const data = await res.json();
    return {
        ...data,
        title: decodeHtml(data.title),
        description: decodeHtml(data.description)
    };
}

// ─── AI Summarize ─────────────────────────────────────────
export async function summarizeTimeline(events, relationships) {
    const res = await fetch(`${API_BASE}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events, relationships }),
    });
    return res.json();
}

// ─── Event Position ───────────────────────────────────────
export async function updateEventPosition(id, pos_x, pos_y) {
    const res = await fetch(`${API_BASE}/events/${id}/position`, {
        method: 'PATCH',
        headers: userHeaders(),
        body: JSON.stringify({ pos_x, pos_y }),
    });
    return res.json();
}
