import { useDrag } from 'react-dnd';

const TAG_CLASSES = {
    war: 'apple-tag-red',
    conflict: 'apple-tag-orange',
    diplomacy: 'apple-tag-blue',
    humanitarian: 'apple-tag-green',
    sanctions: 'apple-tag-yellow',
    defense: 'apple-tag-purple',
    cyber: 'apple-tag-cyan',
    world: 'apple-tag-gray',
};

export default function NewsCard({ article, isMobile, onAddToBoard }) {
    const [{ isDragging }, dragRef] = useDrag(() => ({
        type: 'NEWS_ARTICLE',
        item: {
            title: article.title,
            source: article.source?.name || 'Unknown',
            date: article.publishedAt,
            description: article.description || '',
            url: article.url || '',
            image_url: article.image_url || '',
        },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    }), [article]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${date} · ${time}`;
    };

    const tagClass = TAG_CLASSES[article.category] || 'apple-tag-gray';

    const handleAddToBoard = (e) => {
        e.stopPropagation();
        if (onAddToBoard) {
            onAddToBoard({
                title: article.title,
                source: article.source?.name || 'Unknown',
                date: article.publishedAt,
                description: article.description || '',
                url: article.url || '',
                image_url: article.image_url || '',
            });
        }
    };

    return (
        <div
            ref={isMobile ? null : dragRef}
            className={`apple-card group transition-all duration-300 ${
                !isMobile 
                    ? `cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40 scale-[0.97]' : 'hover:scale-[1.01]'}`
                    : ''
            }`}
        >
            {/* Image thumbnail */}
            {article.image_url && (
                <div className="relative -mx-px -mt-px mb-3 rounded-t-[13px] overflow-hidden">
                    <img
                        src={article.image_url}
                        alt=""
                        className="w-full h-32 object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c1e] via-transparent to-transparent" />
                </div>
            )}

            <div className={isMobile ? 'p-4' : 'p-3.5'}>
                {/* Headline */}
                <h3 className={`font-semibold text-[#f5f5f7] leading-[1.4] mb-2 line-clamp-2 ${isMobile ? 'text-[15px]' : 'text-[13px]'}`}>
                    {article.title}
                </h3>

                {/* Meta row */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`font-medium text-[#86868b] ${isMobile ? 'text-[13px]' : 'text-[11px]'}`}>
                        {article.source?.name || 'Unknown'}
                    </span>
                    <span className={`text-[#48484a] ${isMobile ? 'text-[13px]' : 'text-[11px]'}`}>·</span>
                    <span className={`text-[#636366] tabular-nums ${isMobile ? 'text-[13px]' : 'text-[11px]'}`}>
                        {formatDate(article.publishedAt)}
                    </span>
                    {article.category && (
                        <span className={`apple-tag ${tagClass}`}>
                            {article.category}
                        </span>
                    )}
                </div>

                {/* Description */}
                {article.description && (
                    <p className={`text-[#8e8e93] leading-[1.5] line-clamp-2 mb-2.5 ${isMobile ? 'text-[13px]' : 'text-[12px]'}`}>
                        {article.description}
                    </p>
                )}

                {/* Footer */}
                <div className={`flex items-center justify-between pt-2 border-t border-white/[0.04] ${isMobile ? 'gap-3' : ''}`}>
                    {article.url && (
                        <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`font-medium text-[#0a84ff] hover:text-[#0a84ff]/70 transition-colors flex items-center gap-1 ${isMobile ? 'text-[13px]' : 'text-[11px]'}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            Read
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    )}
                    {isMobile && onAddToBoard ? (
                        <button
                            onClick={handleAddToBoard}
                            className="mobile-add-btn"
                        >
                            + Board
                        </button>
                    ) : (
                        <span className="text-[10px] text-[#3a3a3c] uppercase tracking-wider font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            drag → board
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
