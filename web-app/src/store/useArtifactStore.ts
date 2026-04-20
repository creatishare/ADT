import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ArtifactType = 'markdown' | 'image' | 'code' | null;

interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string; // Markdown text or Image URL
  timestamp: number;
}

interface ArtifactStore {
  artifacts: Artifact[];
  activeArtifactId: string | null;
  addArtifact: (artifact: Omit<Artifact, 'timestamp'>) => void;
  setActiveArtifact: (id: string | null) => void;
  updateArtifactContent: (id: string, content: string) => void;
  clearArtifacts: () => void;
}

export const useArtifactStore = create<ArtifactStore>()(
  persist(
    (set) => ({
      artifacts: [],
      activeArtifactId: null,
      addArtifact: (artifact) =>
        set((state) => {
          // Check if it already exists to avoid duplicates during streaming
          const exists = state.artifacts.find((a) => a.id === artifact.id);
          if (exists) return state;

          const newArtifact = { ...artifact, timestamp: Date.now() };
          return {
            artifacts: [...state.artifacts, newArtifact],
            activeArtifactId: artifact.id, // Auto-focus new artifact
          };
        }),
      setActiveArtifact: (id) => set({ activeArtifactId: id }),
      updateArtifactContent: (id, content) =>
        set((state) => ({
          artifacts: state.artifacts.map((a) =>
            a.id === id ? { ...a, content } : a
          ),
        })),
      clearArtifacts: () => set({ artifacts: [], activeArtifactId: null }),
    }),
    {
      name: 'agent-designer-artifacts',
    }
  )
);
