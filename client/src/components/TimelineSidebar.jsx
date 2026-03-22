import { useState } from 'react';

export default function TimelineSidebar({
    timelines,
    activeTimeline,
    onSelect,
    onCreate,
    onDelete,
    isMobile,
}) {
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [topic, setTopic] = useState('');

    const handleCreate = () => {
        if (!title.trim()) return;
        onCreate(title.trim(), topic.trim());
        setTitle('');
        setTopic('');
        setShowForm(false);
    };

    return (
        <div className={`flex flex-col h-full ${isMobile ? 'mobile-panel' : ''}`}>
            {/* Header */}
            <div className={`border-b border-white/[0.06] ${isMobile ? 'p-5 pt-6' : 'p-4'}`}>
                <h1 className={`font-semibold text-white tracking-tight mb-0.5 ${isMobile ? 'text-[20px]' : 'text-[15px]'}`}>
                    Boards
                </h1>
                <p className={`text-[#86868b] ${isMobile ? 'text-[13px]' : 'text-[11px]'}`}>
                    Your timelines
                </p>
            </div>

            {/* Timeline list */}
            <div className={`flex-1 overflow-y-auto space-y-0.5 ${isMobile ? 'p-3' : 'p-2'}`}>
                {timelines.map((tl) => (
                    <div
                        key={tl.id}
                        className={`group flex items-center gap-2.5 rounded-xl cursor-pointer transition-all duration-200
                            ${isMobile ? 'px-4 py-3.5 min-h-[48px]' : 'px-3 py-2'}
                            ${activeTimeline?.id === tl.id
                                ? 'bg-[#0a84ff]/10 border border-[#0a84ff]/15'
                                : 'hover:bg-white/[0.03] border border-transparent'
                            }`}
                        onClick={() => onSelect(tl)}
                    >
                        <div className={`rounded-full flex-shrink-0 transition-colors ${activeTimeline?.id === tl.id
                            ? 'bg-[#0a84ff] shadow-[0_0_6px_rgba(10,132,255,0.4)]'
                            : 'bg-[#48484a]'
                            } ${isMobile ? 'w-2.5 h-2.5' : 'w-2 h-2'}`} />
                        <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${activeTimeline?.id === tl.id ? 'text-white' : 'text-[#8e8e93]'
                                } ${isMobile ? 'text-[15px]' : 'text-[13px]'}`}>
                                {tl.title}
                            </p>
                            {tl.topic && (
                                <p className={`text-[#636366] truncate ${isMobile ? 'text-[13px]' : 'text-[11px]'}`}>{tl.topic}</p>
                            )}
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(tl.id);
                            }}
                            className={`text-[#48484a] hover:text-[#ff453a] transition-all ${isMobile ? 'opacity-100 p-1 text-lg' : 'opacity-0 group-hover:opacity-100 p-0.5 text-xs'}`}
                            title="Delete"
                        >
                            ×
                        </button>
                    </div>
                ))}

                {timelines.length === 0 && (
                    <div className="text-center py-8">
                        <p className={`text-[#3a3a3c] ${isMobile ? 'text-[15px]' : 'text-[13px]'}`}>No boards yet</p>
                    </div>
                )}
            </div>

            {/* Create new */}
            <div className={`border-t border-white/[0.06] ${isMobile ? 'p-3' : 'p-2'}`}>
                {showForm ? (
                    <div className={`space-y-2 animate-in ${isMobile ? 'p-2' : 'p-1'}`}>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Board name…"
                            className={`field ${isMobile ? 'text-[15px] py-3' : 'text-[13px]'}`}
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Topic (optional)"
                            className={`field ${isMobile ? 'text-[15px] py-3' : 'text-[13px]'}`}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                        <div className="flex gap-1.5">
                            <button onClick={handleCreate} className={`flex-1 rounded-lg font-medium bg-[#0a84ff] text-white hover:bg-[#0a84ff]/80 transition-colors active:scale-97 ${isMobile ? 'px-4 py-3 text-[14px]' : 'px-3 py-1.5 text-[11px]'}`}>
                                Create
                            </button>
                            <button onClick={() => setShowForm(false)} className={`btn-subtle ${isMobile ? 'text-[14px] py-3 px-4' : 'text-[11px]'}`}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowForm(true)}
                        className={`w-full flex items-center justify-center gap-1.5 rounded-xl font-medium text-[#86868b] hover:text-white hover:bg-white/[0.04] border border-dashed border-white/[0.08] hover:border-[#0a84ff]/20 transition-all ${isMobile ? 'py-3.5 text-[14px]' : 'py-2 text-[11px]'}`}
                    >
                        + New Board
                    </button>
                )}
            </div>
        </div>
    );
}
