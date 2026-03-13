import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ExternalTool {
  id: string;
  name: string;
  appPath: string;
}

interface ExternalToolState {
  tools: ExternalTool[];
  addTool: (tool: Omit<ExternalTool, 'id'>) => void;
  removeTool: (id: string) => void;
  updateTool: (id: string, tool: Partial<Omit<ExternalTool, 'id'>>) => void;
}

export const useExternalToolStore = create<ExternalToolState>()(
  persist(
    (set) => ({
      tools: [],
      addTool: (tool) =>
        set((state) => ({
          tools: [
            ...state.tools,
            { ...tool, id: Math.random().toString(36).substring(2, 9) },
          ],
        })),
      removeTool: (id) =>
        set((state) => ({
          tools: state.tools.filter((t) => t.id !== id),
        })),
      updateTool: (id, updatedTool) =>
        set((state) => ({
          tools: state.tools.map((t) =>
            t.id === id ? { ...t, ...updatedTool } : t
          ),
        })),
    }),
    {
      name: 'reederr-external-tools',
    }
  )
);
