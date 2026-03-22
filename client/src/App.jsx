import { useState, useEffect, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import TimelineSidebar from './components/TimelineSidebar';
import NewsFeed from './components/NewsFeed';
import TimelineView from './components/TimelineView';
import MobileTabBar from './components/MobileTabBar';
import {
  fetchTimelines,
  createTimeline,
  deleteTimeline,
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  fetchRelationships,
  createRelationship,
  deleteRelationship,
  updateEventPosition,
} from './api';

function App() {
  const [timelines, setTimelines] = useState([]);
  const [activeTimeline, setActiveTimeline] = useState(null);
  const [events, setEvents] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [newsFeedCollapsed, setNewsFeedCollapsed] = useState(false);

  // Mobile state
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('boards');
  const [showMobileBanner, setShowMobileBanner] = useState(false);

  // Show mobile banner once
  useEffect(() => {
    if (isMobile && !localStorage.getItem('mobile_banner_dismissed')) {
      setShowMobileBanner(true);
    }
  }, [isMobile]);

  const dismissMobileBanner = () => {
    setShowMobileBanner(false);
    localStorage.setItem('mobile_banner_dismissed', '1');
  };

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handleChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    loadTimelines();
  }, []);

  const loadTimelines = async () => {
    const data = await fetchTimelines();
    setTimelines(data);
    if (data.length > 0 && !activeTimeline) {
      selectTimeline(data[0]);
    }
  };

  const selectTimeline = async (timeline) => {
    setActiveTimeline(timeline);
    const [evts, rels] = await Promise.all([
      fetchEvents(timeline.id),
      fetchRelationships(timeline.id),
    ]);
    setEvents(evts);
    setRelationships(rels);
    // On mobile, switch to board tab after selecting a timeline
    if (isMobile) setActiveTab('board');
  };

  const handleCreateTimeline = async (title, topic) => {
    const tl = await createTimeline(title, topic);
    setTimelines((prev) => [tl, ...prev]);
    selectTimeline(tl);
  };

  const handleDeleteTimeline = async (id) => {
    await deleteTimeline(id);
    setTimelines((prev) => prev.filter((t) => t.id !== id));
    if (activeTimeline?.id === id) {
      setActiveTimeline(null);
      setEvents([]);
      setRelationships([]);
    }
  };

  const handleDropArticle = useCallback(async (article) => {
    if (!activeTimeline) return;
    const eventData = {
      timeline_id: activeTimeline.id,
      title: article.title,
      date: article.date
        ? new Date(article.date).toISOString()
        : new Date().toISOString(),
      description: article.description || '',
      source_url: article.url || '',
      notes: `Source: ${article.source || 'Unknown'}`,
      image_url: article.image_url || '',
      pos_x: article.pos_x,
      pos_y: article.pos_y,
    };
    const newEvent = await createEvent(eventData);
    
    // Auto-connect to closest chronological event
    let closestEvent = null;
    let minDiff = Infinity;
    const newDate = new Date(newEvent.date).getTime();

    events.forEach(e => {
        const d = new Date(e.date).getTime();
        const diff = Math.abs(d - newDate);
        if (diff < minDiff) {
            minDiff = diff;
            closestEvent = e;
        }
    });

    setEvents((prev) => [...prev, newEvent]);

    if (closestEvent) {
        // Source is the older event, target is the newer
        const isNewer = newDate >= new Date(closestEvent.date).getTime();
        const sourceId = isNewer ? closestEvent.id : newEvent.id;
        const targetId = isNewer ? newEvent.id : closestEvent.id;
        
        const rel = await createRelationship({
            event_source: sourceId,
            event_target: targetId,
            relation_type: 'timeline',
            timeline_id: activeTimeline.id,
        });
        setRelationships(prev => [...prev, rel]);
    }
  }, [activeTimeline, events]);

  // Mobile: add article to board without drag-and-drop
  const handleAddArticleToBoard = useCallback(async (article) => {
    if (!activeTimeline) return;
    // Auto-position roughly center of the board
    const pos_x = 4800 + Math.random() * 400;
    const pos_y = 4800 + Math.random() * 400;
    await handleDropArticle({ ...article, pos_x, pos_y });
    // Switch to board tab
    if (isMobile) setActiveTab('board');
  }, [activeTimeline, handleDropArticle, isMobile]);

  const handleAddNote = useCallback(async (noteData) => {
    if (!activeTimeline) return;
    const eventData = {
      timeline_id: activeTimeline.id,
      title: noteData.title,
      date: noteData.date || new Date().toISOString().split('T')[0],
      description: noteData.description || '',
      source_url: '',
      notes: '📌 Manual note',
      pos_x: noteData.pos_x,
      pos_y: noteData.pos_y,
    };
    const newEvent = await createEvent(eventData);
    setEvents((prev) => [...prev, newEvent]);
  }, [activeTimeline]);

  const handleUpdateNotes = async (eventId, notes) => {
    await updateEvent(eventId, { notes });
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, notes } : e)));
  };

  const handleUpdatePosition = async (eventId, pos_x, pos_y) => {
    // Update local state immediately for smoothness
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, pos_x, pos_y } : e)));
    // Persist to backend
    await updateEventPosition(eventId, pos_x, pos_y);
  };

  const handleDeleteEvent = async (eventId) => {
    await deleteEvent(eventId);
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    setRelationships((prev) =>
      prev.filter((r) => r.event_source !== eventId && r.event_target !== eventId)
    );
  };

  const handleCreateRelationship = async (sourceId, targetId, type) => {
    if (!activeTimeline) return;
    const rel = await createRelationship({
      event_source: sourceId,
      event_target: targetId,
      relation_type: type,
      timeline_id: activeTimeline.id,
    });
    setRelationships((prev) => [...prev, rel]);
  };

  const handleDeleteRelationship = async (id) => {
    await deleteRelationship(id);
    setRelationships((prev) => prev.filter((r) => r.id !== id));
  };

  const dndBackend = isMobile ? TouchBackend : HTML5Backend;
  const dndOptions = isMobile ? { enableMouseEvents: true } : undefined;

  // ─── Mobile Layout ─────────────────────────
  if (isMobile) {
    return (
      <DndProvider backend={dndBackend} options={dndOptions}>
        <div className="flex flex-col h-screen" style={{ background: '#000' }}>
          {/* Mobile banner popup */}
          {showMobileBanner && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={dismissMobileBanner}>
              <div className="mx-6 p-6 rounded-2xl bg-[#1c1c1e] border border-white/[0.08] shadow-2xl text-center max-w-sm" onClick={(e) => e.stopPropagation()}>
                <div className="text-3xl mb-3">💻</div>
                <h3 className="text-[17px] font-semibold text-white mb-2">Best on Desktop</h3>
                <p className="text-[14px] text-[#8e8e93] leading-relaxed mb-5">
                  This app is designed for desktop use. For the full experience — drag-and-drop, the detective board, and more — switch to a laptop or desktop.
                </p>
                <button
                  onClick={dismissMobileBanner}
                  className="w-full py-3 rounded-xl text-[15px] font-semibold bg-[#0a84ff] text-white active:scale-95 transition-transform"
                >
                  Got it
                </button>
              </div>
            </div>
          )}

          {/* Active panel content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === 'boards' && (
              <div className="h-full overflow-y-auto">
                <TimelineSidebar
                  timelines={timelines}
                  activeTimeline={activeTimeline}
                  onSelect={selectTimeline}
                  onCreate={handleCreateTimeline}
                  onDelete={handleDeleteTimeline}
                  isMobile={true}
                />
              </div>
            )}
            {activeTab === 'feed' && (
              <div className="h-full">
                <NewsFeed
                  isCollapsed={false}
                  onToggleCollapse={() => {}}
                  isMobile={true}
                  onAddToBoard={handleAddArticleToBoard}
                />
              </div>
            )}
            {activeTab === 'board' && (
              <div className="h-full relative">
                <TimelineView
                  timeline={activeTimeline}
                  events={events}
                  relationships={relationships}
                  onDropArticle={handleDropArticle}
                  onUpdateNotes={handleUpdateNotes}
                  onDeleteEvent={handleDeleteEvent}
                  onCreateRelationship={handleCreateRelationship}
                  onDeleteRelationship={handleDeleteRelationship}
                  onAddNote={handleAddNote}
                  onUpdatePosition={handleUpdatePosition}
                  isMobile={true}
                />
              </div>
            )}
          </div>

          {/* Bottom Tab Bar */}
          <MobileTabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={{
              boards: timelines.length,
              articles: 0,
              events: events.length,
            }}
          />
        </div>
      </DndProvider>
    );
  }

  // ─── Desktop Layout ────────────────────────
  return (
    <DndProvider backend={dndBackend} options={dndOptions}>
      <div className="flex h-screen" style={{ background: '#000' }}>
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-white/[0.06] bg-[#000000]">
          <TimelineSidebar
            timelines={timelines}
            activeTimeline={activeTimeline}
            onSelect={selectTimeline}
            onCreate={handleCreateTimeline}
            onDelete={handleDeleteTimeline}
          />
        </div>

        {/* News Feed — collapsible */}
        <div
          className={`flex-shrink-0 border-r border-white/[0.06] bg-[#000000] transition-all duration-300 ease-in-out ${newsFeedCollapsed ? 'w-10' : 'w-[340px]'
            }`}
        >
          <NewsFeed
            isCollapsed={newsFeedCollapsed}
            onToggleCollapse={() => setNewsFeedCollapsed(!newsFeedCollapsed)}
          />
        </div>

        {/* Detective Board */}
        <div className="flex-1 min-w-0 flex flex-col relative" style={{ background: '#000' }}>
          <TimelineView
            timeline={activeTimeline}
            events={events}
            relationships={relationships}
            onDropArticle={handleDropArticle}
            onUpdateNotes={handleUpdateNotes}
            onDeleteEvent={handleDeleteEvent}
            onCreateRelationship={handleCreateRelationship}
            onDeleteRelationship={handleDeleteRelationship}
            onAddNote={handleAddNote}
            onUpdatePosition={handleUpdatePosition}
          />
        </div>
      </div>
    </DndProvider>
  );
}

export default App;
