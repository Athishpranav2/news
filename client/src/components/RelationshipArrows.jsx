import { useEffect, useState, useRef } from 'react';

export default function RelationshipArrows({ relationships, events, connectingFrom, mousePos, relationType }) {
    const [, forceUpdate] = useState(0);
    const containerRef = useRef(null);

    const dragPosRef = useRef({});
    const cardDimRef = useRef({});

    // Keep dimensions cached to avoid layout thrashing during animation/dragging
    const getCardDimensions = (eventId) => {
        if (!cardDimRef.current[eventId]) {
            const el = document.getElementById(`event-${eventId}`);
            if (el) {
                cardDimRef.current[eventId] = { w: el.offsetWidth, h: el.offsetHeight };
            } else {
                return { w: 260, h: 100 }; // fallback
            }
        }
        return cardDimRef.current[eventId];
    };

    // Re-render when cards move, throttled by rAF
    useEffect(() => {
        let rAF;
        const handleCardMove = (e) => {
            dragPosRef.current[e.detail.id] = { x: e.detail.x, y: e.detail.y };
            if (!rAF) {
                rAF = requestAnimationFrame(() => {
                    forceUpdate((n) => n + 1);
                    rAF = null;
                });
            }
        };
        window.addEventListener('cardmove', handleCardMove);

        const handleMouseUp = () => {
             dragPosRef.current = {};
             if (rAF) cancelAnimationFrame(rAF);
             rAF = null;
             forceUpdate(n => n + 1);
        };
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
             window.removeEventListener('cardmove', handleCardMove);
             window.removeEventListener('mouseup', handleMouseUp);
             if (rAF) cancelAnimationFrame(rAF);
        };
    }, []);

    // Also re-render and clear dimension cache on resize/expand
    useEffect(() => {
        const handleResize = () => {
            cardDimRef.current = {};
            forceUpdate((n) => n + 1);
        };
        window.addEventListener('resize', handleResize);

        const handleCardExpand = (e) => {
            if (e.detail && e.detail.id) {
                delete cardDimRef.current[e.detail.id];
            } else {
                cardDimRef.current = {};
            }
            forceUpdate((n) => n + 1);
        };
        window.addEventListener('cardexpand', handleCardExpand);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('cardexpand', handleCardExpand);
        };
    }, []);

    if (relationships.length === 0 && !connectingFrom) return null;

    const getCardCenter = (eventId) => {
        const ev = events.find(e => e.id === eventId);
        if (!ev) return null;

        const dim = getCardDimensions(eventId);
        let x = ev.pos_x || 0;
        let y = ev.pos_y || 0;

        if (dragPosRef.current[eventId]) {
            x = dragPosRef.current[eventId].x;
            y = dragPosRef.current[eventId].y;
        }

        return {
            x: x + dim.w / 2,
            y: y + dim.h / 2,
        };
    };

    const typeColors = {
        cause: { stroke: '#ff453a', label: '#ff453a', bg: 'rgba(255, 69, 58, 0.1)' },
        reaction: { stroke: '#ff9f0a', label: '#ff9f0a', bg: 'rgba(255, 159, 10, 0.1)' },
        consequence: { stroke: '#30d158', label: '#30d158', bg: 'rgba(48, 209, 88, 0.1)' },
        evidence: { stroke: '#0a84ff', label: '#0a84ff', bg: 'rgba(10, 132, 255, 0.1)' },
        contradiction: { stroke: '#bf5af2', label: '#bf5af2', bg: 'rgba(191, 90, 242, 0.1)' },
        timeline: { stroke: '#8e8e93', label: '#8e8e93', bg: 'rgba(142, 142, 147, 0.1)' },
    };

    return (
        <svg
            ref={containerRef}
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
            <defs>
                {Object.entries(typeColors).map(([type, colors]) => (
                    <marker key={type} id={`arrow-${type}`} markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                        <polygon points="0 0, 6 2, 0 4" fill={colors.stroke} opacity="0.6" />
                    </marker>
                ))}
            </defs>
            
            {/* Live drawing path */}
            {connectingFrom && mousePos && relationType && (
                (() => {
                    const src = getCardCenter(connectingFrom);
                    if (!src) return null;
                    const colors = typeColors[relationType] || typeColors.cause;
                    
                    const dx = mousePos.x - src.x;
                    const dy = mousePos.y - src.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const curvature = Math.min(40, len * 0.15);
                    const nx = -dy / len * curvature;
                    const ny = dx / len * curvature;
                    const midX = (src.x + mousePos.x) / 2;
                    const midY = (src.y + mousePos.y) / 2;
                    
                    const path = `M ${src.x} ${src.y} Q ${midX + nx} ${midY + ny} ${mousePos.x} ${mousePos.y}`;
                    
                    return (
                        <path
                            d={path}
                            fill="none"
                            stroke={colors.stroke}
                            strokeWidth="2"
                            strokeDasharray="4 4"
                            opacity="0.8"
                            markerEnd={`url(#arrow-${relationType})`}
                            className="animate-pulse"
                        />
                    );
                })()
            )}

            {relationships.map((rel) => {
                const src = getCardCenter(rel.event_source);
                const tgt = getCardCenter(rel.event_target);
                if (!src || !tgt) return null;

                const colors = typeColors[rel.relation_type] || typeColors.cause;

                // Calculate curved path (slight arc)
                const dx = tgt.x - src.x;
                const dy = tgt.y - src.y;
                const midX = (src.x + tgt.x) / 2;
                const midY = (src.y + tgt.y) / 2;
                // Perpendicular offset for curve
                const len = Math.sqrt(dx * dx + dy * dy);
                const curvature = Math.min(40, len * 0.15);
                const nx = -dy / len * curvature;
                const ny = dx / len * curvature;

                const path = `M ${src.x} ${src.y} Q ${midX + nx} ${midY + ny} ${tgt.x} ${tgt.y}`;

                // Label position
                const labelX = midX + nx * 0.7;
                const labelY = midY + ny * 0.7;

                return (
                    <g key={rel.id}>
                        {/* Thread line */}
                        <path
                            d={path}
                            fill="none"
                            stroke={colors.stroke}
                            strokeWidth="1.5"
                            strokeDasharray="6 4"
                            opacity="0.4"
                            markerEnd={`url(#arrow-${rel.relation_type})`}
                        />
                        {/* Label background */}
                        <rect
                            x={labelX - 24}
                            y={labelY - 7}
                            width={48}
                            height={14}
                            rx="2"
                            fill={colors.bg}
                            stroke={colors.stroke}
                            strokeWidth="0.5"
                            opacity="0.6"
                        />
                        {/* Label text */}
                        <text
                            x={labelX}
                            y={labelY + 3}
                            textAnchor="middle"
                            fill={colors.label}
                            fontSize="8"
                            fontFamily="-apple-system, system-ui, sans-serif"
                            fontWeight="600"
                            letterSpacing="0.5"
                            opacity="0.8"
                        >
                            {rel.relation_type.toUpperCase()}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
