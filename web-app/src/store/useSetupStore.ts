import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ParsedGroup } from '@/lib/setup/parseLessonGroups';
import type { PlanningMode, UploadedDoc } from '@/lib/setup/buildInitialPrompt';

export type { PlanningMode } from '@/lib/setup/buildInitialPrompt';

interface SetupStore {
  isCollapsed: boolean;
  worldDoc: UploadedDoc | null;
  lessonDoc: UploadedDoc | null;
  initialPrompt: string | null;
  planningMode: PlanningMode;
  parsedGroups: ParsedGroup[];
  selectedGroupIndex: number | null;
  shellDoc: UploadedDoc | null;
  toggleCollapse: () => void;
  setWorldDoc: (doc: UploadedDoc | null) => void;
  setLessonDoc: (doc: UploadedDoc | null) => void;
  clearDocs: () => void;
  setInitialPrompt: (prompt: string | null) => void;
  clearInitialPrompt: () => void;
  setPlanningMode: (mode: PlanningMode) => void;
  setParsedGroups: (groups: ParsedGroup[]) => void;
  setSelectedGroupIndex: (index: number | null) => void;
  setShellDoc: (doc: UploadedDoc | null) => void;
}

export const useSetupStore = create<SetupStore>()(
  persist(
    (set) => ({
      isCollapsed: false,
      worldDoc: null,
      lessonDoc: null,
      initialPrompt: null,
      planningMode: 'standard',
      parsedGroups: [],
      selectedGroupIndex: null,
      shellDoc: null,
      toggleCollapse: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
      setWorldDoc: (doc) => set({ worldDoc: doc }),
      setLessonDoc: (doc) => set({ lessonDoc: doc }),
      clearDocs: () =>
        set({
          worldDoc: null,
          lessonDoc: null,
          shellDoc: null,
          parsedGroups: [],
          selectedGroupIndex: null,
        }),
      setInitialPrompt: (prompt) => set({ initialPrompt: prompt }),
      clearInitialPrompt: () => set({ initialPrompt: null }),
      setPlanningMode: (mode) => set({ planningMode: mode }),
      setParsedGroups: (groups) => set({ parsedGroups: groups }),
      setSelectedGroupIndex: (index) => set({ selectedGroupIndex: index }),
      setShellDoc: (doc) => set({ shellDoc: doc }),
    }),
    {
      name: 'agent-designer-setup',
    }
  )
);
