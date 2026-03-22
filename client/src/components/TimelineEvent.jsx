import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function TimelineEvent({
    event,
    onUpdateNotes,
    onDelete,
    onStartConnect,
    connectingFrom,
    onCompleteConnect,
    onPositionChange,
    isDrawMode
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [notes, setNotes] = useState(event.notes || '');
    const [editingNotes, setEditingNotes] = useState(false);
    const [showLightbox, setShowLightbox] = useState(false);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const date = d.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
        });
        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        if (dateStr.length <= 10) return date;
        return `${date} · ${time}`;
    };

    const handleSaveNotes = () => {
        onUpdateNotes(event.id, notes);
        setEditingNotes(false);
    };

    // Drag handling for free-form positioning
    const cardRef = useRef(null);
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'SELECT') return;
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('textarea') || e.target.closest('input')) return;

        e.preventDefault();
        e.stopPropagation(); // Prevent board from panning when dragging card
        isDraggingRef.current = true;

        const card = cardRef.current;
        const canvas = card.parentElement;
        const canvasRect = canvas.getBoundingClientRect();

        const transformState = canvas.closest('.react-transform-component').style.transform;
        let scale = 1;
        let tx = 0, ty = 0;
        if (transformState) {
            const sMatch = transformState.match(/scale\(([^)]+)\)/);
            if (sMatch) scale = parseFloat(sMatch[1]);
            const tMatch = transformState.match(/translate3d\(([^p]+)px,\s*([^p]+)px/);
            if (tMatch) {
                tx = parseFloat(tMatch[1]) / scale;
                ty = parseFloat(tMatch[2]) / scale;
            }
        }

        dragOffsetRef.current = {
            x: (e.clientX - canvasRect.left) / scale - tx - event.pos_x,
            y: (e.clientY - canvasRect.top) / scale - ty - event.pos_y,
        };

        let rAF = null;
        const handleMouseMove = (moveE) => {
            if (!isDraggingRef.current) return;
            if (rAF) cancelAnimationFrame(rAF);

            rAF = requestAnimationFrame(() => {
                const canvas = cardRef.current.parentElement;
                const canvasRect = canvas.getBoundingClientRect();
                
                // Get current scale from parent TransformComponent
                const transformState = canvas.closest('.react-transform-component').style.transform;
                let scale = 1;
                let tx = 0, ty = 0;
                if (transformState) {
                    const sMatch = transformState.match(/scale\(([^)]+)\)/);
                    if (sMatch) scale = parseFloat(sMatch[1]);
                    const tMatch = transformState.match(/translate3d\(([^p]+)px,\s*([^p]+)px/);
                    if (tMatch) {
                        tx = parseFloat(tMatch[1]) / scale;
                        ty = parseFloat(tMatch[2]) / scale;
                    }
                }

                const newX = (moveE.clientX - canvasRect.left) / scale - tx - dragOffsetRef.current.x;
                const newY = (moveE.clientY - canvasRect.top) / scale - ty - dragOffsetRef.current.y;

                // GPU accelerated drag offset relative to original pos_x, pos_y
                const deltaX = newX - (event.pos_x || 0);
                const deltaY = newY - (event.pos_y || 0);

                cardRef.current.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
                cardRef.current.style.zIndex = '50';
                cardRef.current.style.transition = 'none';

                // Dispatch custom event for live arrow updates
                window.dispatchEvent(new CustomEvent('cardmove', { detail: { id: event.id, x: newX, y: newY } }));
                rAF = null;
            });
        };

        const handleMouseUp = (upE) => {
            isDraggingRef.current = false;
            if (rAF) cancelAnimationFrame(rAF);
            cardRef.current.style.zIndex = '';
            cardRef.current.style.transition = '';
            cardRef.current.style.transform = '';

            const canvas = cardRef.current.parentElement;
            const canvasRect = canvas.getBoundingClientRect();
            
            const transformState = canvas.closest('.react-transform-component').style.transform;
            let scale = 1;
            let tx = 0, ty = 0;
            if (transformState) {
                const sMatch = transformState.match(/scale\(([^)]+)\)/);
                if (sMatch) scale = parseFloat(sMatch[1]);
                const tMatch = transformState.match(/translate3d\(([^p]+)px,\s*([^p]+)px/);
                if (tMatch) {
                    tx = parseFloat(tMatch[1]) / scale;
                    ty = parseFloat(tMatch[2]) / scale;
                }
            }

            const finalX = (upE.clientX - canvasRect.left) / scale - tx - dragOffsetRef.current.x;
            const finalY = (upE.clientY - canvasRect.top) / scale - ty - dragOffsetRef.current.y;

            cardRef.current.style.left = `${finalX}px`;
            cardRef.current.style.top = `${finalY}px`;
            
            // Dispatch one last move to sync arrows
            window.dispatchEvent(new CustomEvent('cardmove', { detail: { id: event.id, x: finalX, y: finalY } }));

            onPositionChange(event.id, finalX, finalY);

            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Touch drag handling for mobile
    const handleTouchStart = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'SELECT') return;
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('textarea') || e.target.closest('input')) return;
        if (e.touches.length !== 1) return;

        e.stopPropagation();
        isDraggingRef.current = true;

        const touch = e.touches[0];
        const card = cardRef.current;
        const canvas = card.parentElement;
        const canvasRect = canvas.getBoundingClientRect();

        const transformEl = canvas.closest('.react-transform-component');
        const transformState = transformEl ? transformEl.style.transform : '';
        let scale = 1, tx = 0, ty = 0;
        if (transformState) {
            const sMatch = transformState.match(/scale\(([^)]+)\)/);
            if (sMatch) scale = parseFloat(sMatch[1]);
            const tMatch = transformState.match(/translate3d\(([^p]+)px,\s*([^p]+)px/);
            if (tMatch) {
                tx = parseFloat(tMatch[1]) / scale;
                ty = parseFloat(tMatch[2]) / scale;
            }
        }

        dragOffsetRef.current = {
            x: (touch.clientX - canvasRect.left) / scale - tx - event.pos_x,
            y: (touch.clientY - canvasRect.top) / scale - ty - event.pos_y,
        };
    };

    const handleTouchMove = (e) => {
        if (!isDraggingRef.current || e.touches.length !== 1) return;
        e.preventDefault();
        e.stopPropagation();

        const touch = e.touches[0];
        const card = cardRef.current;
        const canvas = card.parentElement;
        const canvasRect = canvas.getBoundingClientRect();

        const transformEl = canvas.closest('.react-transform-component');
        const transformState = transformEl ? transformEl.style.transform : '';
        let scale = 1, tx = 0, ty = 0;
        if (transformState) {
            const sMatch = transformState.match(/scale\(([^)]+)\)/);
            if (sMatch) scale = parseFloat(sMatch[1]);
            const tMatch = transformState.match(/translate3d\(([^p]+)px,\s*([^p]+)px/);
            if (tMatch) {
                tx = parseFloat(tMatch[1]) / scale;
                ty = parseFloat(tMatch[2]) / scale;
            }
        }

        const newX = (touch.clientX - canvasRect.left) / scale - tx - dragOffsetRef.current.x;
        const newY = (touch.clientY - canvasRect.top) / scale - ty - dragOffsetRef.current.y;

        const deltaX = newX - (event.pos_x || 0);
        const deltaY = newY - (event.pos_y || 0);

        card.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
        card.style.zIndex = '50';
        card.style.transition = 'none';

        window.dispatchEvent(new CustomEvent('cardmove', { detail: { id: event.id, x: newX, y: newY } }));
    };

    const handleTouchEnd = (e) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;

        const touch = e.changedTouches[0];
        const card = cardRef.current;
        card.style.zIndex = '';
        card.style.transition = '';
        card.style.transform = '';

        const canvas = card.parentElement;
        const canvasRect = canvas.getBoundingClientRect();

        const transformEl = canvas.closest('.react-transform-component');
        const transformState = transformEl ? transformEl.style.transform : '';
        let scale = 1, tx = 0, ty = 0;
        if (transformState) {
            const sMatch = transformState.match(/scale\(([^)]+)\)/);
            if (sMatch) scale = parseFloat(sMatch[1]);
            const tMatch = transformState.match(/translate3d\(([^p]+)px,\s*([^p]+)px/);
            if (tMatch) {
                tx = parseFloat(tMatch[1]) / scale;
                ty = parseFloat(tMatch[2]) / scale;
            }
        }

        const finalX = (touch.clientX - canvasRect.left) / scale - tx - dragOffsetRef.current.x;
        const finalY = (touch.clientY - canvasRect.top) / scale - ty - dragOffsetRef.current.y;

        card.style.left = `${finalX}px`;
        card.style.top = `${finalY}px`;

        window.dispatchEvent(new CustomEvent('cardmove', { detail: { id: event.id, x: finalX, y: finalY } }));
        onPositionChange(event.id, finalX, finalY);
    };

    return (
        <div
            ref={cardRef}
            className={`board-card group ${isDrawMode ? 'cursor-crosshair hover:border-[#0a84ff]/50' : ''}`}
            style={{
                position: 'absolute',
                left: `${event.pos_x || 0}px`,
                top: `${event.pos_y || 0}px`,
                width: window.innerWidth <= 768 ? '200px' : '260px',
                touchAction: 'none',
            }}
            id={`event-${event.id}`}
            onClick={(e) => {
                if (isDrawMode) {
                    e.stopPropagation();
                    if (!connectingFrom) {
                        onStartConnect(event.id);
                    } else if (connectingFrom === event.id) {
                        // Clicking same card again cancels the connection
                        onStartConnect(null);
                    } else {
                        onCompleteConnect(event.id);
                    }
                }
            }}
        >
            {/* Pin */}
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10">
                <div className="pin-dot" />
            </div>

            <div
                className={`px-3 pt-3 pb-2 select-none ${!isDrawMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div className="text-[11px] font-medium text-[#86868b] mb-1 flex items-center justify-between">
                    <span>{formatDate(event.date)}</span>
                    <span className="text-[10px] text-[#48484a]">#{event.position_order || 0}</span>
                </div>
                <h4 className="text-[13px] font-semibold text-[#f5f5f7] leading-snug">
                    {event.title}
                </h4>
            </div>

            {event.image_url && (
                <div 
                    className={`px-3 pb-2 relative group/img ${!isDrawMode ? 'cursor-pointer' : ''}`}
                    onClick={(e) => {
                        if (isDrawMode) return; // Allow drawing click to bubble
                        e.stopPropagation();
                        setShowLightbox(true);
                    }}
                >
                    <img 
                        src={event.image_url} 
                        alt={event.title}
                        className="w-full h-32 object-cover rounded-lg border border-white/[0.06] opacity-90 group-hover/img:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none">
                        <span className="bg-black/60 text-[#f5f5f7] text-[11px] font-medium px-2.5 py-1 rounded-lg backdrop-blur-md">Expand</span>
                    </div>
                </div>
            )}

            <div
                className={`px-3 pb-1 ${!isDrawMode ? 'cursor-pointer' : 'opacity-50 pointer-events-none'}`}
                onMouseDown={(e) => !isDrawMode && e.stopPropagation()}
                onClick={() => {
                    if (isDrawMode) return;
                    setIsExpanded(!isExpanded);
                    setTimeout(() => window.dispatchEvent(new CustomEvent('cardexpand', { detail: { id: event.id } })), 50);
                }}
            >
                <span className="text-[10px] text-[#636366] font-medium uppercase tracking-wider">
                    {isExpanded ? 'Collapse ↑' : 'Expand ↓'}
                </span>
            </div>

            {/* Expanded content */}
            {isExpanded && (
                <div className="animate-in border-t border-white/[0.06]">
                    {event.description && (
                        <div className="px-3 pt-2">
                            <p className="text-[12px] text-[#8e8e93] leading-relaxed">
                                {event.description}
                            </p>
                        </div>
                    )}

                    {event.source_url && (
                        <div className="px-3 pt-1.5">
                            <a
                                href={event.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-medium text-[#0a84ff] hover:text-[#0a84ff]/70 transition-colors"
                            >
                                Source ↗
                            </a>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="mx-3 mt-2 mb-1">
                        {editingNotes ? (
                            <div className="space-y-1.5">
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add your analysis..."
                                    className="field text-[10px] resize-none h-14 typewriter"
                                    autoFocus
                                />
                                <div className="flex gap-1.5">
                                    <button onClick={handleSaveNotes} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#0a84ff] text-white hover:bg-[#0a84ff]/80 transition-colors">Save</button>
                                    <button onClick={() => setEditingNotes(false)} className="btn-subtle text-[11px]">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className="sticky-note cursor-text"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => setEditingNotes(true)}
                            >
                                <p className="text-[11px] text-[#86868b] leading-relaxed min-h-[14px]">
                                    {notes || 'Click to add notes…'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 px-3 py-2 mt-1 border-t border-white/[0.06]">
                        {connectingFrom && connectingFrom !== event.id ? (
                            <button
                                onClick={() => onCompleteConnect(event.id)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#0a84ff]/10 text-[#0a84ff] hover:bg-[#0a84ff]/20 transition-colors"
                            >
                                ⊕ Connect here
                            </button>
                        ) : (
                            <button
                                onClick={() => onStartConnect(event.id)}
                                className="btn-subtle text-[11px]"
                            >
                                ⟜ Connect
                            </button>
                        )}
                        <button
                            onClick={() => onDelete(event.id)}
                            className="btn-subtle text-[11px] text-[#ff453a]/70 hover:text-[#ff453a] ml-auto"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            )}

            {/* Lightbox Overlay via Portal */}
            {showLightbox && createPortal(
                <div 
                    className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-200"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowLightbox(false);
                    }}
                >
                    <div className="absolute top-6 right-8 text-[#86868b] text-4xl font-light cursor-pointer hover:text-white transition-colors">
                        ×
                    </div>
                    <img 
                        src={event.image_url} 
                        alt={event.title}
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-md shadow-2xl"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
                    />
                </div>,
                document.body
            )}
        </div>
    );
}
