import { memo } from 'react';
import styles from './ViewerToolbar.module.css';
import { ToolbarNavigation } from './ToolbarNavigation';
import { ToolbarPlayback } from './ToolbarPlayback';
import { ToolbarLayout } from './ToolbarLayout';

export const ViewerToolbar = memo(() => {
    return (
        <div className={styles.toolbar}>
            <div className={styles.left}>
                <ToolbarNavigation />
                <ToolbarPlayback />
            </div>

            <div className={styles.right}>
                <ToolbarLayout />
            </div>
        </div>
    );
});
