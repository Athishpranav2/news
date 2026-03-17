const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// GET events for a timeline
router.get('/:timelineId', (req, res) => {
    const events = db.prepare(
        'SELECT * FROM events WHERE timeline_id = ? ORDER BY date ASC, position_order ASC'
    ).all(req.params.timelineId);
    res.json(events);
});

// GET single event
router.get('/single/:id', (req, res) => {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
});

// POST create event
router.post('/', (req, res) => {
    const { timeline_id, title, date, description, source_url, notes, image_url, pos_x, pos_y } = req.body;
    if (!timeline_id || !title || !date) {
        return res.status(400).json({ error: 'timeline_id, title, and date are required' });
    }

    const id = uuidv4();

    // Get next position order
    const maxPos = db.prepare(
        'SELECT COALESCE(MAX(position_order), 0) + 1 as next FROM events WHERE timeline_id = ?'
    ).get(timeline_id);

    // Auto-position if not specified: cascade new cards
    const eventCount = db.prepare('SELECT COUNT(*) as cnt FROM events WHERE timeline_id = ?').get(timeline_id).cnt;
    const finalX = pos_x != null ? pos_x : 80 + (eventCount % 4) * 280;
    const finalY = pos_y != null ? pos_y : 80 + Math.floor(eventCount / 4) * 220;

    db.prepare(`
    INSERT INTO events (id, timeline_id, title, date, description, source_url, notes, image_url, pos_x, pos_y, position_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, timeline_id, title, date, description || '', source_url || '', notes || '', image_url || '', finalX, finalY, maxPos.next);

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    res.status(201).json(event);
});

// PUT update event
router.put('/:id', (req, res) => {
    const { title, date, description, source_url, notes, image_url } = req.body;

    db.prepare(`
    UPDATE events SET 
      title = COALESCE(?, title),
      date = COALESCE(?, date),
      description = COALESCE(?, description),
      source_url = COALESCE(?, source_url),
      notes = COALESCE(?, notes),
      image_url = COALESCE(?, image_url)
    WHERE id = ?
  `).run(title, date, description, source_url, notes, image_url, req.params.id);

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
});

// PATCH update position only (called on drag-end)
router.patch('/:id/position', (req, res) => {
    const { pos_x, pos_y } = req.body;
    if (pos_x == null || pos_y == null) {
        return res.status(400).json({ error: 'pos_x and pos_y are required' });
    }

    db.prepare('UPDATE events SET pos_x = ?, pos_y = ? WHERE id = ?')
        .run(pos_x, pos_y, req.params.id);

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
});

// DELETE event
router.delete('/:id', (req, res) => {
    const result = db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true });
});

module.exports = router;
