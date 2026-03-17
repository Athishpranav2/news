const { v4: uuidv4 } = require('uuid');

module.exports = function seed(db) {
  const existing = db.prepare('SELECT COUNT(*) as count FROM timelines').get();
  if (existing.count > 0) return;

  const timelineId = uuidv4();

  db.prepare(`
    INSERT INTO timelines (id, title, topic) VALUES (?, ?, ?)
  `).run(timelineId, 'US-Iran Conflict Timeline', 'Geopolitics');

  const events = [
    {
      id: uuidv4(),
      title: 'US Airstrike on Iranian General',
      date: '2020-01-03',
      description: 'The United States carried out a targeted drone strike near Baghdad International Airport, killing Iranian Major General Qasem Soleimani, the commander of the Quds Force.',
      source_url: 'https://www.bbc.com/news/world-middle-east-50979463',
      notes: 'This was a major escalation in US-Iran tensions.',
      pos_x: 100, pos_y: 80,
    },
    {
      id: uuidv4(),
      title: 'Oil Market Impact & Price Surge',
      date: '2020-01-06',
      description: 'Following the strike, oil prices surged as markets feared wider conflict disrupting supply lines in the Middle East.',
      source_url: 'https://www.reuters.com/article/us-oil-prices',
      notes: 'Brent crude rose above $70, highest since September 2019.',
      pos_x: 480, pos_y: 60,
    },
    {
      id: uuidv4(),
      title: 'Iranian Retaliatory Missile Strike',
      date: '2020-01-08',
      description: 'Iran launched over a dozen ballistic missiles at US military bases in Iraq in retaliation for the killing of Soleimani.',
      source_url: 'https://www.bbc.com/news/world-middle-east-51028954',
      notes: '',
      pos_x: 300, pos_y: 320,
    },
    {
      id: uuidv4(),
      title: 'Gulf Region Security Escalation',
      date: '2020-01-09',
      description: 'NATO and allied nations increased military readiness in the Gulf region. Additional troops were deployed to protect key installations.',
      source_url: 'https://www.nato.int',
      notes: 'Multiple nations evacuated embassy staff from Iraq.',
      pos_x: 680, pos_y: 300,
    },
  ];

  const insertEvent = db.prepare(`
    INSERT INTO events (id, timeline_id, title, date, description, source_url, notes, pos_x, pos_y, position_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  events.forEach((e, i) => {
    insertEvent.run(e.id, timelineId, e.title, e.date, e.description, e.source_url, e.notes, e.pos_x, e.pos_y, i);
  });

  // Create relationships
  const relationships = [
    { source: 0, target: 2, type: 'cause' },
    { source: 2, target: 3, type: 'reaction' },
    { source: 0, target: 1, type: 'consequence' },
  ];

  const insertRel = db.prepare(`
    INSERT INTO relationships (id, event_source, event_target, relation_type, timeline_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  relationships.forEach((r) => {
    insertRel.run(uuidv4(), events[r.source].id, events[r.target].id, r.type, timelineId);
  });

  console.log(`✓ Seeded "${events.length}" events with board positions and ${relationships.length} relationships`);
};
