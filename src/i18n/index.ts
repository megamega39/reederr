import { useViewerStore } from '../stores/viewerStore';
import { ja, Translation } from './ja';
import { en } from './en';

export function useTranslation() {
  const language = useViewerStore((s) => s.language);
  
  const translations: Record<'ja' | 'en', Translation> = { ja, en };
  const t_data = translations[language] || ja;

  /**
   * Simple translation helper.
   * Usage: t('settings.title')
   * With data: t('contextMenu.openWith', { name: 'App' })
   */
  const t = (path: string, data?: any): string => {
    const keys = path.split('.');
    let current: any = t_data;
    
    for (const key of keys) {
      if (current[key] === undefined) {
        // Fallback to Japanese if key missing in current language
        let fb: any = ja;
        for (const fbKey of keys) {
          if (fb[fbKey] === undefined) return path;
          fb = fb[fbKey];
        }
        current = fb;
        break;
      }
      current = current[key];
    }
    
    if (typeof current === 'string') {
      let res = current;
      if (data) {
        Object.keys(data).forEach((k) => {
          res = res.replace(`{${k}}`, String(data[k]));
        });
      }
      return res;
    }
    
    return path;
  };

  return { t, language };
}
