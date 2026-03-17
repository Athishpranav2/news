import { useState, useRef, useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import TimelineEvent from './TimelineEvent';
import RelationshipArrows from './RelationshipArrows';
import { summarizeTimeline } from '../api';

export default function TimelineView({
    timeline,
    events,
    relationships,
    onDropArticle,
    onUpdateNotes,
    onDeleteEvent,
    onCreateRelationship,
    onDeleteRelationship,
    onAddNote,
    onUpdatePosition,
}) {
    const [connectingFrom, setConnectingFrom] = useState(null);
    const [relationType, setRelationType] = useState('cause');
    const [mousePos, setMousePos] = useState(null);
    const [showNoteForm, setShowNoteForm] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [noteTitle, setNoteTitle] = useState('');

    // Summarize state
    const [editingNotes, setEditingNotes] = useState(false);
    const [summary, setSummary] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [isDrawMode, setIsDrawMode] = useState(false);

    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);

    const [{ isOver, canDrop }, dropRef] = useDrop(() => ({
        accept: 'NEWS_ARTICLE',
        drop: (item, monitor) => {
            // Get drop position relative to canvas
            const offset = monitor.getClientOffset();
            if (offset && canvasRef.current) {
                const canvas = canvasRef.current;
                const canvasRect = canvas.getBoundingClientRect();
                
                // Try to find the transform component inside to get scale/translation
                const transformInner = canvas.querySelector('.react-transform-component') || canvas;
                const transformState = transformInner.style.transform;
                
                let scale = 1;
                let tx = 0, ty = 0;
                
                if (transformState) {
                    const sMatch = transformState.match(/scale\(([^)]+)\)/);
                    if (sMatch) scale = parseFloat(sMatch[1]);

                    const tMatch = transformState.match(/translate(?:3d)?\(([^p,]+)px,\s*([^p,]+)px/);
                    if (tMatch) {
                        tx = parseFloat(tMatch[1]) / scale;
                        ty = parseFloat(tMatch[2]) / scale;
                    }
                }

                // 10000x10000 physical board, distance from scaled bounds is all we need
                const pos_x = (offset.x - canvasRect.left) / scale - tx - 130;
                const pos_y = (offset.y - canvasRect.top) / scale - ty - 30;
                
                onDropArticle({ ...item, pos_x, pos_y });
            } else {
                onDropArticle(item);
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    }), [onDropArticle]);

    // Merge refs
    const setRefs = useCallback((node) => {
        canvasRef.current = node;
        dropRef(node);
    }, [dropRef]);

    const handleStartConnect = (eventId) => {
        setConnectingFrom(eventId);
        setMousePos(null);
        
        // Listen to global mousemoves while in connect mode
        const handleMouseMove = (e) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const canvasRect = canvas.getBoundingClientRect();
            const transformInner = canvas.querySelector('.react-transform-component') || canvas;
            const transformState = transformInner.style.transform;
            
            let scale = 1;
            let tx = 0, ty = 0;
            if (transformState) {
                const sMatch = transformState.match(/scale\(([^)]+)\)/);
                if (sMatch) scale = parseFloat(sMatch[1]);

                const tMatch = transformState.match(/translate(?:3d)?\(([^p,]+)px,\s*([^p,]+)px/);
                if (tMatch) {
                    tx = parseFloat(tMatch[1]) / scale;
                    ty = parseFloat(tMatch[2]) / scale;
                }
            }

            const x = (e.clientX - canvasRect.left) / scale - tx;
            const y = (e.clientY - canvasRect.top) / scale - ty;
            
            setMousePos({ x, y });
        };
        
        // We add this to window so it fires anywhere
        window.addEventListener('mousemove', handleMouseMove);
        
        // When we stop connecting, remove the listener
        window._connectMouseMoveListener = handleMouseMove;
    };

    const handleCompleteConnect = (targetId) => {
        if (connectingFrom && connectingFrom !== targetId) {
            onCreateRelationship(connectingFrom, targetId, relationType);
        }
        cleanupConnect();
    };

    const handleCancelConnect = () => cleanupConnect();

    const cleanupConnect = () => {
        setConnectingFrom(null);
        setMousePos(null);
        if (window._connectMouseMoveListener) {
            window.removeEventListener('mousemove', window._connectMouseMoveListener);
            delete window._connectMouseMoveListener;
        }
    };

    const handleAddNote = () => {
        if (!noteTitle.trim()) return;

        let pos_x = -4500, pos_y = -4500;
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            const canvasRect = canvas.getBoundingClientRect();
            const transformInner = canvas.querySelector('.react-transform-component') || canvas;
            const transformState = transformInner.style.transform;
            
            let scale = 1, tx = 0, ty = 0;
            if (transformState) {
                const sMatch = transformState.match(/scale\(([^)]+)\)/);
                if (sMatch) scale = parseFloat(sMatch[1]);

                const tMatch = transformState.match(/translate(?:3d)?\(([^p,]+)px,\s*([^p,]+)px/);
                if (tMatch) {
                    tx = parseFloat(tMatch[1]) / scale;
                    ty = parseFloat(tMatch[2]) / scale;
                }
            }
            pos_x = (canvasRect.width / 2) / scale - tx - 130;
            pos_y = (canvasRect.height / 2) / scale - ty - 30;
        }

        onAddNote({
            title: noteTitle.trim(),
            description: noteText.trim(),
            date: new Date().toISOString().split('T')[0],
            pos_x: Math.round(pos_x),
            pos_y: Math.round(pos_y)
        });
        setNoteTitle('');
        setNoteText('');
        setShowNoteForm(false);
    };

    const handleSummarize = async () => {
        setSummaryLoading(true);
        setShowSummary(true);
        try {
            const result = await summarizeTimeline(events, relationships);
            setSummary(result);
        } catch (err) {
            setSummary({ summary: 'Failed to generate summary. Please try again.', ai: false });
        }
        setSummaryLoading(false);
    };

    const handlePositionChange = (eventId, x, y) => {
        if (onUpdatePosition) onUpdatePosition(eventId, x, y);
    };

    const handleImageImport = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result;
            
            let pos_x = -4500, pos_y = -4500;
            if (canvasRef.current) {
                const canvas = canvasRef.current;
                const canvasRect = canvas.getBoundingClientRect();
                const transformInner = canvas.querySelector('.react-transform-component') || canvas;
                const transformState = transformInner.style.transform;
                
                let scale = 1, tx = 0, ty = 0;
                if (transformState) {
                    const sMatch = transformState.match(/scale\(([^)]+)\)/);
                    if (sMatch) scale = parseFloat(sMatch[1]);
    
                    const tMatch = transformState.match(/translate(?:3d)?\(([^p,]+)px,\s*([^p,]+)px/);
                    if (tMatch) {
                        tx = parseFloat(tMatch[1]) / scale;
                        ty = parseFloat(tMatch[2]) / scale;
                    }
                }
                pos_x = (canvasRect.width / 2) / scale - tx - 130;
                pos_y = (canvasRect.height / 2) / scale - ty - 30;
            }

            // Treat as dropped article but with image_url payload
            const syntheticItem = {
                title: file.name,
                image_url: base64String,
                description: 'Imported Image',
                date: new Date().toISOString(),
                pos_x: Math.round(pos_x),
                pos_y: Math.round(pos_y)
            };
            
            // Auto position cascades
            onDropArticle(syntheticItem);
        };
        reader.readAsDataURL(file);
        // Reset input so the same file can be picked again if deleted
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Rich markdown rendering for Gemini output
    const renderSummary = (text) => {
        if (!text) return null;
        const lines = text.split('\n');
        const elements = [];
        let listBuffer = [];
        let listType = null; // 'ul' or 'ol'

        const flushList = () => {
            if (listBuffer.length === 0) return;
            const key = `list-${elements.length}`;
            if (listType === 'ol') {
                elements.push(
                    <ol key={key} className="summary-list summary-ol">
                        {listBuffer.map((item, j) => (
                            <li key={j} className="summary-list-item" dangerouslySetInnerHTML={{ __html: item }} />
                        ))}
                    </ol>
                );
            } else {
                elements.push(
                    <ul key={key} className="summary-list summary-ul">
                        {listBuffer.map((item, j) => (
                            <li key={j} className="summary-list-item" dangerouslySetInnerHTML={{ __html: item }} />
                        ))}
                    </ul>
                );
            }
            listBuffer = [];
            listType = null;
        };

        const formatInline = (str) => {
            return str
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code>$1</code>');
        };

        lines.forEach((line, i) => {
            const trimmed = line.trim();

            // Empty line
            if (trimmed === '') {
                flushList();
                elements.push(<div key={i} className="h-2" />);
                return;
            }

            // Horizontal rule
            if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
                flushList();
                elements.push(<hr key={i} className="summary-divider" />);
                return;
            }

            // Headings: ## or **HEADING**
            const h2Match = trimmed.match(/^##\s+(.+)/);
            const h3Match = trimmed.match(/^###\s+(.+)/);
            const boldHeading = trimmed.match(/^\*\*([A-Z][A-Z\s:]+?)\*\*:?\s*$/);

            if (h3Match) {
                flushList();
                elements.push(<h4 key={i} className="summary-h3">{formatInline(h3Match[1].replace(/\*\*/g, ''))}</h4>);
                return;
            }
            if (h2Match) {
                flushList();
                elements.push(<h3 key={i} className="summary-h2" dangerouslySetInnerHTML={{ __html: formatInline(h2Match[1]) }} />);
                return;
            }
            if (boldHeading) {
                flushList();
                elements.push(<h3 key={i} className="summary-h2">{boldHeading[1]}</h3>);
                return;
            }

            // Numbered list
            const olMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
            if (olMatch) {
                if (listType !== 'ol') flushList();
                listType = 'ol';
                listBuffer.push(formatInline(olMatch[2]));
                return;
            }

            // Bullet list
            if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
                if (listType !== 'ul') flushList();
                listType = 'ul';
                listBuffer.push(formatInline(trimmed.replace(/^[-•*]\s+/, '')));
                return;
            }

            // Regular paragraph
            flushList();
            elements.push(
                <p key={i} className="summary-paragraph" dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
            );
        });

        flushList();
        return elements;
    };

    // Calculate canvas bounds from event positions
    const canvasWidth = Math.max(1200, ...events.map(e => (e.pos_x || 0) + 320));
    const canvasHeight = Math.max(800, ...events.map(e => (e.pos_y || 0) + 280));

    if (!timeline) {
        return (
            <div className="flex items-center justify-center h-full" style={{ background: '#000' }}>
                <div className="text-center">
                    <p className="text-lg font-semibold text-[#48484a] mb-2">No Active Board</p>
                    <p className="text-[13px] text-[#3a3a3c]">Select a board or create a new one</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full h-full min-w-0 min-h-0" style={{ background: '#000' }}>
            {/* Header toolbar */}
            <div className="p-3 border-b border-white/[0.06] flex-shrink-0 apple-glass z-20">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                        <div>
                            <h2 className="text-[15px] font-semibold text-white tracking-tight">{timeline.title}</h2>
                            {timeline.topic && (
                                <span className="text-[11px] text-[#86868b] font-medium">
                                    {timeline.topic}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-[#48484a] px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                            Scroll to zoom · Drag to pan · Drag cards to arrange
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#86868b] font-medium tabular-nums">
                            {events.length} item{events.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                {/* Summary panel */}
                {showSummary && (
                    <div className="summary-panel animate-in">
                        {/* Header */}
                        <div className="summary-panel-header">
                            <div className="flex items-center gap-2.5">
                                <div className="summary-icon">✦</div>
                                <span className="text-[12px] text-[#0a84ff] font-semibold tracking-wide">Analysis</span>
                                {summary?.ai && (
                                    <span className="summary-ai-badge">GEMINI AI</span>
                                )}
                            </div>
                            <button onClick={() => setShowSummary(false)} className="summary-close-btn">✕</button>
                        </div>

                        {/* Body */}
                        {summaryLoading ? (
                            <div className="summary-loading">
                                <div className="summary-loading-dots">
                                    <span /><span /><span />
                                </div>
                                <p className="text-[12px] text-[#86868b]">Analyzing {events.length} events…</p>
                            </div>
                        ) : (
                            <div className="summary-body">
                                {renderSummary(summary?.summary)}
                            </div>
                        )}
                    </div>
                )}

                {/* Connection mode */}
                {connectingFrom && (
                    <div className="mt-2 flex items-center gap-2 p-2.5 rounded-xl bg-[#0a84ff]/[0.06] border border-[#0a84ff]/[0.12] animate-in">
                        <span className="text-[11px] font-medium text-[#0a84ff]">Connecting… click a target card</span>
                        <select
                            value={relationType}
                            onChange={(e) => setRelationType(e.target.value)}
                            className="field text-[11px] w-auto py-1 px-2 cursor-pointer bg-[#1c1c1e]"
                        >
                            <option value="cause">Cause</option>
                            <option value="reaction">Reaction</option>
                            <option value="consequence">Consequence</option>
                            <option value="evidence">Evidence</option>
                            <option value="contradiction">Contradiction</option>
                            <option value="timeline">Timeline</option>
                        </select>
                        <button onClick={handleCancelConnect} className="btn-subtle text-[11px] text-[#ff453a]/70 hover:text-[#ff453a]">Cancel</button>
                    </div>
                )}

                {/* Add note form */}
                {showNoteForm && (
                    <div className="mt-2 space-y-2 p-2 rounded-sm bg-[#111115] border border-[#252530] animate-in">
                        <input
                            type="text"
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            placeholder="Note title..."
                            className="field text-xs typewriter"
                            autoFocus
                        />
                        <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Your analysis, observations, theories..."
                            className="field text-xs typewriter resize-none h-16"
                        />
                        <div className="flex gap-2">
                            <button onClick={handleAddNote} className="btn-action text-[10px]">Pin note</button>
                            <button onClick={() => setShowNoteForm(false)} className="btn-subtle text-[10px]">Cancel</button>
                        </div>
                    </div>
                )}

                {/* Relationships legend */}
                {relationships.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {relationships.map((rel) => {
                            const src = events.find(e => e.id === rel.event_source);
                            const tgt = events.find(e => e.id === rel.event_target);
                            return (
                                <div key={rel.id} className="flex items-center gap-1 text-[9px] group">
                                    <span className="text-[#555] truncate max-w-[60px]">{src?.title?.slice(0, 12)}…</span>
                                    <span className={`rel-badge rel-${rel.relation_type}`}>{rel.relation_type}</span>
                                    <span className="text-[#555] truncate max-w-[60px]">{tgt?.title?.slice(0, 12)}…</span>
                                    <button
                                        onClick={() => onDeleteRelationship(rel.id)}
                                        className="opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 transition-opacity text-xs"
                                    >×</button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div
                ref={setRefs}
                className={`flex-1 w-full min-w-0 min-h-0 overflow-hidden relative transition-colors duration-200 ${isOver && canDrop ? 'bg-[#c8a064]/[0.02]' : ''
                    }`}
            >
                {/* Floating Board Actions */}
                <div className="absolute top-4 right-4 z-[90] flex flex-col items-end gap-2 draw-tools pointer-events-none">
                    <div className="flex items-center gap-2 pointer-events-auto">
                        {events.length >= 2 && (
                            <button
                                onClick={handleSummarize}
                                disabled={summaryLoading}
                                className="px-3 py-1.5 rounded-full text-[11px] font-medium backdrop-blur-xl shadow-lg transition-all duration-200 bg-[#0a84ff]/10 border border-[#0a84ff]/20 text-[#0a84ff] hover:bg-[#0a84ff]/20 active:scale-95"
                            >
                                {summaryLoading ? '↻ Analyzing…' : '✦ Summarize'}
                            </button>
                        )}
                        <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleImageImport}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-full text-[11px] font-medium backdrop-blur-xl shadow-lg transition-all duration-200 bg-white/[0.06] border border-white/[0.08] text-[#f5f5f7] hover:bg-white/[0.1] active:scale-95"
                        >
                            + Image
                        </button>
                        <button
                            onClick={() => setShowNoteForm(!showNoteForm)}
                            className="px-3 py-1.5 rounded-full text-[11px] font-medium backdrop-blur-xl shadow-lg transition-all duration-200 bg-white/[0.06] border border-white/[0.08] text-[#f5f5f7] hover:bg-white/[0.1] active:scale-95"
                        >
                            + Note
                        </button>
                    </div>
                </div>

                {isOver && canDrop && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-[#0a84ff]/10 border border-[#0a84ff]/20 backdrop-blur-xl pointer-events-none">
                        <p className="text-[12px] font-medium text-[#0a84ff]">Drop to pin on board</p>
                    </div>
                )}

                <TransformWrapper
                    initialScale={1}
                    initialPositionX={typeof window !== 'undefined' ? -(5000 - window.innerWidth / 2) : -4500}
                    initialPositionY={typeof window !== 'undefined' ? -(5000 - window.innerHeight / 2) : -4500}
                    minScale={0.1}
                    maxScale={4}
                    centerOnInit={false}
                    limitToBounds={false}
                    wheel={{ step: 0.1, smoothStep: 0.005 }}
                    doubleClick={{ disabled: true }}
                    panning={{ 
                        velocityDisabled: false, 
                        excluded: ['board-card', 'btn-action', 'btn-subtle', 'field', 'sticky-note', 'draw-tools'] 
                    }}
                >
                    {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
                        <>
                            {/* Zoom Controls */}
                            <div className="absolute top-4 left-4 z-40 flex flex-col gap-1.5 draw-tools">
                                <button className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] backdrop-blur-xl text-[#f5f5f7] text-sm flex items-center justify-center hover:bg-white/[0.1] active:scale-90 transition-all" onClick={() => zoomIn()}>+</button>
                                <button className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] backdrop-blur-xl text-[#f5f5f7] text-sm flex items-center justify-center hover:bg-white/[0.1] active:scale-90 transition-all" onClick={() => zoomOut()}>−</button>
                                <button className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] backdrop-blur-xl text-[#86868b] text-[8px] font-semibold flex items-center justify-center hover:bg-white/[0.1] active:scale-90 transition-all" onClick={() => resetTransform()}>RST</button>
                            </div>

                            {/* Draw Mode Toolbar */}
                            <div className="absolute top-1/2 -translate-y-1/2 left-4 z-40 flex flex-col items-center gap-1.5 draw-tools bg-black/60 p-2 rounded-2xl border border-white/[0.08] backdrop-blur-xl">
                                <button 
                                    className={`p-2 rounded-xl transition-all w-8 h-8 flex items-center justify-center ${!isDrawMode ? 'bg-[#0a84ff] text-white' : 'text-[#86868b] hover:text-white hover:bg-white/[0.06]'}`}
                                    onClick={() => setIsDrawMode(false)}
                                    title="Pointer tool"
                                >
                                    ↗
                                </button>
                                <div className="w-5 h-px bg-white/[0.08]" />
                                <button 
                                    className={`p-2 rounded-xl transition-all w-8 h-8 flex items-center justify-center font-mono ${isDrawMode ? 'bg-[#0a84ff] text-white' : 'text-[#86868b] hover:text-white hover:bg-white/[0.06]'}`}
                                    onClick={() => setIsDrawMode(true)}
                                    title="Pen tool"
                                >
                                    ✎
                                </button>
                            </div>

                            <TransformComponent
                                wrapperStyle={{ width: '100%', height: '100%' }}
                                contentStyle={{ width: '10000px', height: '10000px' }}
                            >
                                {/* Canvas inner */}
                                <div
                                    className="relative w-[10000px] h-[10000px] transform-gpu"
                                    style={{
                                        backgroundImage: `
                                            radial-gradient(circle at 1px 1px, rgba(200,160,100,0.08) 1px, transparent 0)
                                        `,
                                        backgroundSize: '40px 40px',
                                        backgroundPosition: '0 0',
                                        willChange: 'transform',
                                        backfaceVisibility: 'hidden',
                                    }}
                                >
                                    {/* Relationship arrows (SVG layer) */}
                                    <RelationshipArrows 
                                        relationships={relationships} 
                                        events={events} 
                                        connectingFrom={connectingFrom}
                                        mousePos={mousePos}
                                        relationType={relationType}
                                    />

                                    {/* Event cards */}
                                    {events.map((event) => (
                                        <TimelineEvent
                                            key={event.id}
                                            event={event}
                                            onUpdateNotes={onUpdateNotes}
                                            onDelete={onDeleteEvent}
                                            onStartConnect={handleStartConnect}
                                            connectingFrom={connectingFrom}
                                            onCompleteConnect={handleCompleteConnect}
                                            onPositionChange={handlePositionChange}
                                            isDrawMode={isDrawMode}
                                        />
                                    ))}

                                    {/* Empty state */}
                                    {events.length === 0 && (
                                        <div className="absolute left-[5000px] top-[5000px] -translate-x-1/2 -translate-y-1/2">
                                            <div className="text-center p-8 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/[0.08]">
                                                <p className="text-[15px] font-semibold text-[#48484a] mb-2">Empty Board</p>
                                                <p className="text-[12px] text-[#3a3a3c]">
                                                    Drag articles from the feed or add a note to get started
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </TransformComponent>
                        </>
                    )}
                </TransformWrapper>
            </div>
        </div>
    );
}
