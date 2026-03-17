import { useState } from 'react';

export default function TimelineSidebar({
    timelines,
    activeTimeline,
    onSelect,
    onCreate,
    onDelete,
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
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-white/[0.06]">
                <h1 className="text-[15px] font-semibold text-white tracking-tight mb-0.5">
                    Boards
                </h1>
                <p className="text-[11px] text-[#86868b]">
                    Your timelines
                </p>
            </div>

            {/* Timeline list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {timelines.map((tl) => (
                    <div
                        key={tl.id}
                        className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 ${activeTimeline?.id === tl.id
                                ? 'bg-[#0a84ff]/10 border border-[#0a84ff]/15'
                                : 'hover:bg-white/[0.03] border border-transparent'
                            }`}
                        onClick={() => onSelect(tl)}
                    >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${activeTimeline?.id === tl.id
                            ? 'bg-[#0a84ff] shadow-[0_0_6px_rgba(10,132,255,0.4)]'
                            : 'bg-[#48484a]'
                            }`} />
                        <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-medium truncate ${activeTimeline?.id === tl.id ? 'text-white' : 'text-[#8e8e93]'
                                }`}>
                                {tl.title}
                            </p>
                            {tl.topic && (
                                <p className="text-[11px] text-[#636366] truncate">{tl.topic}</p>
                            )}
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(tl.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-[#48484a] hover:text-[#ff453a] transition-all text-xs"
                            title="Delete"
                        >
                            ×
                        </button>
                    </div>
                ))}

                {timelines.length === 0 && (
                    <div className="text-center py-8">
                        <p className="text-[13px] text-[#3a3a3c]">No boards yet</p>
                    </div>
                )}
            </div>

            {/* Create new */}
            <div className="p-2 border-t border-white/[0.06]">
                {showForm ? (
                    <div className="space-y-2 animate-in p-1">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Board name…"
                            className="field text-[13px]"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Topic (optional)"
                            className="field text-[13px]"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                        <div className="flex gap-1.5">
                            <button onClick={handleCreate} className="flex-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[#0a84ff] text-white hover:bg-[#0a84ff]/80 transition-colors active:scale-97">
                                Create
                            </button>
                            <button onClick={() => setShowForm(false)} className="btn-subtle text-[11px]">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowForm(true)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-medium text-[#86868b] hover:text-white hover:bg-white/[0.04] border border-dashed border-white/[0.08] hover:border-[#0a84ff]/20 transition-all"
                    >
                        + New Board
                    </button>
                )}
            </div>
        </div>
    );
}
