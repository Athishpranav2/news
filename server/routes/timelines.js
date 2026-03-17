const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// GET all timelines
router.get('/', (req, res) => {
    const timelines = db.prepare('SELECT * FROM timelines ORDER BY created_at DESC').all();
    res.json(timelines);
});

// GET single timeline
router.get('/:id', (req, res) => {
    const timeline = db.prepare('SELECT * FROM timelines WHERE id = ?').get(req.params.id);
    if (!timeline) return res.status(404).json({ error: 'Timeline not found' });
    res.json(timeline);
});

// POST create timeline
router.post('/', (req, res) => {
    const { title, topic } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const id = uuidv4();
    db.prepare('INSERT INTO timelines (id, title, topic) VALUES (?, ?, ?)').run(id, title, topic || '');

    const timeline = db.prepare('SELECT * FROM timelines WHERE id = ?').get(id);
    res.status(201).json(timeline);
});

// PUT update timeline
router.put('/:id', (req, res) => {
    const { title, topic } = req.body;
    db.prepare('UPDATE timelines SET title = COALESCE(?, title), topic = COALESCE(?, topic) WHERE id = ?')
        .run(title, topic, req.params.id);

    const timeline = db.prepare('SELECT * FROM timelines WHERE id = ?').get(req.params.id);
    if (!timeline) return res.status(404).json({ error: 'Timeline not found' });
    res.json(timeline);
});

// DELETE timeline
router.delete('/:id', (req, res) => {
    const result = db.prepare('DELETE FROM timelines WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Timeline not found' });
    res.json({ success: true });
});

module.exports = router;
