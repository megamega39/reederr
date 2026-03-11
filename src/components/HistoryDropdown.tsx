import { Check, Folder, FileArchive, Monitor, File } from 'lucide-react';
import { useViewerStore } from '../stores/viewerStore';
import { useEffect, useRef, useState, useLayoutEffect } from 'react';

interface HistoryDropdownProps {
    onClose: () => void;
    anchorRect: DOMRect | null;
}

export function HistoryDropdown({ onClose, anchorRect }: HistoryDropdownProps) {
    const { history, historyIndex, jumpToHistory } = useViewerStore();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [leftPos, setLeftPos] = useState(0);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    useLayoutEffect(() => {
        if (!anchorRect || !dropdownRef.current) return;
        
        const rect = dropdownRef.current.getBoundingClientRect();
        let targetLeft = anchorRect.left;
        
        // Overflow check
        if (targetLeft + rect.width > window.innerWidth - 10) {
            targetLeft = window.innerWidth - rect.width - 10;
        }
        
        setLeftPos(Math.max(4, targetLeft));
    }, [anchorRect]);

    if (!anchorRect) return null;

    const style: React.CSSProperties = {
        position: 'fixed',
        top: anchorRect.bottom + 4,
        left: leftPos || anchorRect.left, // Fallback to anchor left before measurement
        zIndex: 9999,
        visibility: leftPos ? 'visible' : 'hidden', // Hide until we have a correct position
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'folder': return <Folder size={14} className="history-type-icon" />;
            case 'archive': return <FileArchive size={14} className="history-type-icon" />;
            case 'pc': return <Monitor size={14} className="history-type-icon" />;
            default: return <File size={14} className="history-type-icon" />;
        }
    };

    const getTypeText = (type: string) => {
        switch (type) {
            case 'folder': return '<フォルダ>';
            case 'archive': return '<書庫>';
            case 'pc': return '<PC>';
            default: return '';
        }
    };

    return (
        <div className="history-dropdown" style={style} ref={dropdownRef}>
            <div className="history-list">
                {history.map((entry, idx) => (
                    <div
                        key={`${entry.path}-${idx}`}
                        className={`history-item ${idx === historyIndex ? 'current' : ''}`}
                        onClick={() => {
                            jumpToHistory(idx);
                            onClose();
                        }}
                    >
                        <div className="history-item-check">
                            {idx === historyIndex && <Check size={14} />}
                        </div>
                        <div className="history-item-type">
                            {getIcon(entry.type)}
                            <span className="type-label">{getTypeText(entry.type)}</span>
                        </div>
                        <div className="history-item-name" title={entry.path}>
                            {entry.name}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
