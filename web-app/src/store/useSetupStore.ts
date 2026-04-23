import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UploadedDoc {
  name: string;
  content: string;
}

interface SetupStore {
  isCollapsed: boolean;
  worldDoc: UploadedDoc | null;
  lessonDoc: UploadedDoc | null;
  initialPrompt: string | null;
  toggleCollapse: () => void;
  setWorldDoc: (doc: UploadedDoc | null) => void;
  setLessonDoc: (doc: UploadedDoc | null) => void;
  clearDocs: () => void;
  setInitialPrompt: (prompt: string | null) => void;
  clearInitialPrompt: () => void;
}

export const useSetupStore = create<SetupStore>()(
  persist(
    (set) => ({
      isCollapsed: false,
      worldDoc: null,
      lessonDoc: null,
      initialPrompt: null,
      toggleCollapse: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setWorldDoc: (doc) => set({ worldDoc: doc }),
      setLessonDoc: (doc) => set({ lessonDoc: doc }),
      clearDocs: () => set({ worldDoc: null, lessonDoc: null }),
      setInitialPrompt: (prompt) => set({ initialPrompt: prompt }),
      clearInitialPrompt: () => set({ initialPrompt: null }),
    }),
    {
      name: 'agent-designer-setup',
    }
  )
);
