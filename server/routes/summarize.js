const express = require('express');
const router = express.Router();
const { fetchAllArticleContent } = require('../articleScraper');

// ─── Gemini Setup ─────────────────────────────────────────
let genAI = null;
try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
        genAI = new GoogleGenerativeAI(apiKey);
    }
} catch (err) {
    console.log('Gemini SDK not available');
}

// Gemini models to try in order
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];

// ─── Groq Setup (free fallback, 14400 req/day) ───────────
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ─── Build the intelligence-briefing prompt ───────────────
function buildPrompt(events, relationships, articleContents) {
    const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

    let prompt = `You are a senior intelligence analyst. You have been given a set of news articles that the investigator has pinned to their board. Your job is to **read through the full content of each article** and produce a deep analytical briefing that finds REAL, SPECIFIC connections between them.\n\n`;
    prompt += `Do NOT just summarize headlines. You must reference specific facts, names, places, quotes, and details FROM THE ARTICLE CONTENT to support your analysis.\n\n`;
    prompt += `═══════════════════════════════════════\n`;
    prompt += `PINNED ARTICLES (${sorted.length} total, chronological order)\n`;
    prompt += `═══════════════════════════════════════\n\n`;

    sorted.forEach((e, i) => {
        const content = articleContents.get(e.id) || '';
        prompt += `━━━ ARTICLE ${i + 1} ━━━\n`;
        prompt += `Title: ${e.title}\n`;
        prompt += `Date: ${e.date}\n`;
        if (e.description) prompt += `Summary: ${e.description}\n`;
        if (e.source_url) prompt += `Source: ${e.source_url}\n`;
        if (e.notes && e.notes !== 'Source: Unknown') prompt += `Investigator Notes: ${e.notes}\n`;

        if (content) {
            prompt += `\n--- FULL ARTICLE CONTENT ---\n${content}\n--- END ARTICLE ---\n`;
        } else {
            prompt += `[Full article content could not be retrieved — analyze based on available information]\n`;
        }
        prompt += `\n`;
    });

    if (relationships.length > 0) {
        prompt += `═══════════════════════════════════════\nINVESTIGATOR'S MARKED CONNECTIONS\n═══════════════════════════════════════\n\n`;
        relationships.forEach((r) => {
            const src = events.find((e) => e.id === r.event_source);
            const tgt = events.find((e) => e.id === r.event_target);
            if (src && tgt) {
                prompt += `• "${src.title}" →[${r.relation_type.toUpperCase()}]→ "${tgt.title}"\n`;
            }
        });
        prompt += `\n`;
    }

    prompt += `═══════════════════════════════════════\nYOUR ANALYSIS INSTRUCTIONS\n═══════════════════════════════════════\n\n`;
    prompt += `Produce an intelligence briefing in this EXACT format. Be specific — cite article details.\n\n`;
    prompt += `**OVERVIEW**\n2-3 sentences summarizing the big picture.\n\n`;
    prompt += `**KEY ACTORS & ENTITIES**\nBullet points listing people, organizations, countries that appear across MULTIPLE articles.\n\n`;
    prompt += `**CROSS-ARTICLE CONNECTIONS**\nThis is the MOST IMPORTANT section. For each connection:\n`;
    prompt += `• State which articles are connected\n• Explain the SPECIFIC factual link\n• Reference specific details from article content as evidence\n\n`;
    prompt += `**NARRATIVE THREAD**\nDescribe the underlying story connecting these articles.\n\n`;
    prompt += `**INTELLIGENCE ASSESSMENT**\n• What patterns or trends are emerging?\n• What might happen next?\n• What gaps should the investigator look into?\n\n`;
    prompt += `RULES: Reference articles by title in quotes. Cite specific facts. Use bullet points. Be analytical and concise.`;

    return prompt;
}

// ─── Try Gemini AI ────────────────────────────────────────
async function tryGemini(prompt) {
    if (!genAI) return null;

    for (const modelName of GEMINI_MODELS) {
        try {
            console.log(`  🔄 Trying Gemini ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            console.log(`  ✅ Gemini ${modelName} succeeded`);
            return { text: result.response.text(), model: `gemini:${modelName}` };
        } catch (err) {
            console.log(`  ❌ Gemini ${modelName}: ${err.message?.slice(0, 80)}`);
        }
    }
    return null;
}

// ─── Try Groq (free, no package needed) ───────────────────
async function tryGroq(prompt) {
    if (!GROQ_API_KEY) return null;

    try {
        console.log(`  🔄 Trying Groq ${GROQ_MODEL}...`);
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: 'system', content: 'You are a senior intelligence analyst producing analytical briefings from news articles.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.3,
                max_tokens: 2048,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Groq ${response.status}: ${errText.slice(0, 100)}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('Empty Groq response');

        console.log(`  ✅ Groq ${GROQ_MODEL} succeeded`);
        return { text, model: `groq:${GROQ_MODEL}` };
    } catch (err) {
        console.log(`  ❌ Groq: ${err.message?.slice(0, 100)}`);
        return null;
    }
}

// ─── Smart local fallback (no AI needed) ──────────────────
function generateSmartFallback(events, relationships, articleContents) {
    const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sorted.length === 0) {
        return 'No events to analyze. Drop news articles onto the timeline to begin your investigation.';
    }

    // Gather all text per article
    const allTexts = sorted.map(e => {
        const content = articleContents.get(e.id) || '';
        return `${e.title}. ${e.description || ''}. ${content}`;
    });

    // Extract proper nouns (capitalized multi-word phrases)
    const skipWords = new Set(['The', 'This', 'That', 'With', 'From', 'After', 'Before', 'About', 'Also', 'More', 'Some', 'Their', 'These', 'Those', 'They', 'When', 'Where', 'Which', 'While', 'Under', 'Over', 'Into', 'Source', 'Unknown', 'Live', 'Updates', 'Says', 'Here', 'What', 'Read', 'Full', 'Share', 'Sign']);
    const entityCounts = new Map(); // entity → [articleIndices]

    allTexts.forEach((text, artIdx) => {
        const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
        const seen = new Set();
        matches.forEach(m => {
            if (m.length > 3 && !skipWords.has(m) && !seen.has(m)) {
                seen.add(m);
                if (!entityCounts.has(m)) entityCounts.set(m, new Set());
                entityCounts.get(m).add(artIdx);
            }
        });
    });

    // Shared entities (appear in 2+ articles)
    const sharedEntities = [...entityCounts.entries()]
        .filter(([, indices]) => indices.size >= 2)
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 10);

    // Shared significant words
    const wordSets = allTexts.map(text => {
        return new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 5));
    });
    const sharedWords = [];
    if (wordSets.length >= 2) {
        for (const word of wordSets[0]) {
            if (wordSets.slice(1).some(s => s.has(word))) {
                sharedWords.push(word);
            }
        }
    }

    // ── Build summary ──
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const daySpan = Math.ceil((new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24));
    const hasContent = [...articleContents.values()].some(c => c.length > 0);

    let s = `**OVERVIEW**\n`;
    s += `Board contains ${sorted.length} article${sorted.length > 1 ? 's' : ''} spanning ${daySpan > 0 ? `${daySpan} day${daySpan > 1 ? 's' : ''}` : 'the same day'}. `;
    if (sharedEntities.length > 0) {
        s += `Shared entities detected across articles: **${sharedEntities.slice(0, 4).map(([e]) => e).join('**, **')}**.`;
    }

    if (sharedEntities.length > 0) {
        s += `\n\n**KEY ACTORS & ENTITIES**\n`;
        sharedEntities.forEach(([entity, indices]) => {
            const arts = [...indices].map(i => `"${sorted[i].title.slice(0, 45)}…"`).join(', ');
            s += `- **${entity}** — appears in: ${arts}\n`;
        });
    }

    s += `\n**CROSS-ARTICLE CONNECTIONS**\n`;
    if (sorted.length >= 2) {
        for (let i = 0; i < sorted.length; i++) {
            for (let j = i + 1; j < sorted.length; j++) {
                const common = sharedEntities.filter(([, idx]) => idx.has(i) && idx.has(j)).map(([e]) => e);
                if (common.length > 0) {
                    s += `- **"${sorted[i].title.slice(0, 50)}…"** ↔ **"${sorted[j].title.slice(0, 50)}…"**\n`;
                    s += `  Shared references: ${common.join(', ')}\n`;
                }
            }
        }
        if (sharedEntities.length === 0) {
            s += `- No shared entities detected between articles — they may cover distinct events.\n`;
        }
    }

    if (relationships.length > 0) {
        s += `\n**INVESTIGATOR-MARKED LINKS**\n`;
        relationships.forEach((r) => {
            const src = events.find((e) => e.id === r.event_source);
            const tgt = events.find((e) => e.id === r.event_target);
            if (src && tgt) {
                s += `- "${src.title.slice(0, 50)}…" →[${r.relation_type}]→ "${tgt.title.slice(0, 50)}…"\n`;
            }
        });
    }

    s += `\n**ARTICLE DETAILS**\n`;
    sorted.forEach((e, i) => {
        const content = articleContents.get(e.id) || '';
        s += `\n*Article ${i + 1}: "${e.title}"*\n`;
        if (e.description) s += `${e.description}\n`;
        if (content) {
            s += `Content extract: ${content.slice(0, 400).replace(/\n+/g, ' ').trim()}…\n`;
        }
    });

    s += `\n---\n*⚠️ AI analysis unavailable (quota exceeded). This is automated text analysis. For deeper intelligence briefings, add a free Groq API key (get one at console.groq.com) to server/.env as GROQ_API_KEY.*`;

    return s;
}

// ─── POST /api/summarize ──────────────────────────────────
router.post('/', async (req, res) => {
    const { events, relationships } = req.body;

    if (!events || events.length === 0) {
        return res.json({
            summary: 'No events to analyze. Drop news articles onto the timeline to begin your investigation.',
        });
    }

    // Fetch article content from source URLs
    console.log(`📰 Fetching content from ${events.filter(e => e.source_url).length} article URLs...`);
    const articleContents = await fetchAllArticleContent(events);
    const fetched = [...articleContents.values()].filter(c => c.length > 0).length;
    console.log(`✅ Extracted content from ${fetched}/${events.length} articles`);

    const prompt = buildPrompt(events, relationships || [], articleContents);
    console.log(`🧠 Prompt: ${prompt.length} chars`);

    // Try AI providers in order: Gemini → Groq
    const geminiResult = await tryGemini(prompt);
    if (geminiResult) {
        return res.json({ summary: geminiResult.text, ai: true, model: geminiResult.model, articlesScraped: fetched });
    }

    const groqResult = await tryGroq(prompt);
    if (groqResult) {
        return res.json({ summary: groqResult.text, ai: true, model: groqResult.model, articlesScraped: fetched });
    }

    // Smart local fallback
    console.log('  ⚠️ All AI providers failed, using smart local analysis');
    const summary = generateSmartFallback(events, relationships || [], articleContents);
    res.json({ summary, ai: false, articlesScraped: fetched });
});

module.exports = router;
