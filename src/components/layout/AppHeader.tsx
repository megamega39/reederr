import { memo } from 'react';
import { NavigationBar } from '../NavigationBar';
import { AddressBar } from '../AddressBar';
import { SettingsModal } from '../SettingsModal';
import { HelpModal } from '../HelpModal';
import styles from '../../App.module.css';

interface AppHeaderProps {
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  showHelp: boolean;
  setShowHelp: (v: boolean) => void;
}

export const AppHeader = memo(({ showSettings, setShowSettings, showHelp, setShowHelp }: AppHeaderProps) => {
  return (
    <div className={styles.appHeaderArea}>
      <NavigationBar />
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <AddressBar />
    </div>
  );
});

AppHeader.displayName = 'AppHeader';
