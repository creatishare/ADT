import { create } from "zustand";
import { persist } from "zustand/middleware";

type ArtifactType = "markdown" | "image" | "code" | null;

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  timestamp: number;
  courseCode?: string;
}

export const LEGACY_SESSION_ID = "legacy";

interface ArtifactStore {
  bySession: Record<string, Artifact[]>;
  activeArtifactIdBySession: Record<string, string | null>;
  addArtifact: (sessionId: string, artifact: Omit<Artifact, "timestamp">) => void;
  setActiveArtifact: (sessionId: string, id: string | null) => void;
  updateArtifactContent: (sessionId: string, id: string, content: string) => void;
  deleteArtifact: (sessionId: string, id: string) => void;
  clearSessionArtifacts: (sessionId: string) => void;
  getSessionArtifacts: (sessionId: string | null) => Artifact[];
  getActiveArtifactId: (sessionId: string | null) => string | null;
}

export const useArtifactStore = create<ArtifactStore>()(
  persist(
    (set, get) => ({
      bySession: {},
      activeArtifactIdBySession: {},

      addArtifact: (sessionId, artifact) =>
        set((state) => {
          const list = state.bySession[sessionId] ?? [];
          if (list.some((a) => a.id === artifact.id)) return state;
          const newArtifact: Artifact = { ...artifact, timestamp: Date.now() };
          return {
            bySession: {
              ...state.bySession,
              [sessionId]: [...list, newArtifact],
            },
            activeArtifactIdBySession: {
              ...state.activeArtifactIdBySession,
              [sessionId]: artifact.id,
            },
          };
        }),

      setActiveArtifact: (sessionId, id) =>
        set((state) => ({
          activeArtifactIdBySession: {
            ...state.activeArtifactIdBySession,
            [sessionId]: id,
          },
        })),

      updateArtifactContent: (sessionId, id, content) =>
        set((state) => {
          const list = state.bySession[sessionId];
          if (!list) return state;
          return {
            bySession: {
              ...state.bySession,
              [sessionId]: list.map((a) =>
                a.id === id ? { ...a, content } : a
              ),
            },
          };
        }),

      deleteArtifact: (sessionId, id) =>
        set((state) => {
          const list = state.bySession[sessionId];
          if (!list) return state;
          const remaining = list.filter((a) => a.id !== id);
          const activeId = state.activeArtifactIdBySession[sessionId];
          const nextActive =
            activeId === id ? remaining[0]?.id ?? null : activeId ?? null;
          return {
            bySession: { ...state.bySession, [sessionId]: remaining },
            activeArtifactIdBySession: {
              ...state.activeArtifactIdBySession,
              [sessionId]: nextActive,
            },
          };
        }),

      clearSessionArtifacts: (sessionId) =>
        set((state) => {
          if (!(sessionId in state.bySession) && !(sessionId in state.activeArtifactIdBySession)) {
            return state;
          }
          const nextBySession = { ...state.bySession };
          delete nextBySession[sessionId];
          const nextActive = { ...state.activeArtifactIdBySession };
          delete nextActive[sessionId];
          return {
            bySession: nextBySession,
            activeArtifactIdBySession: nextActive,
          };
        }),

      getSessionArtifacts: (sessionId) => {
        if (!sessionId) return [];
        return get().bySession[sessionId] ?? [];
      },

      getActiveArtifactId: (sessionId) => {
        if (!sessionId) return null;
        return get().activeArtifactIdBySession[sessionId] ?? null;
      },
    }),
    {
      name: "agent-designer-artifacts",
      version: 1,
      migrate: (persisted, version) => {
        if (version >= 1) return persisted as ArtifactStore;
        const legacy = persisted as
          | {
              artifacts?: Artifact[];
              activeArtifactId?: string | null;
            }
          | undefined;
        const artifacts = legacy?.artifacts ?? [];
        const activeId = legacy?.activeArtifactId ?? null;
        if (artifacts.length === 0) {
          return {
            bySession: {},
            activeArtifactIdBySession: {},
          } as Partial<ArtifactStore> as ArtifactStore;
        }
        return {
          bySession: { [LEGACY_SESSION_ID]: artifacts },
          activeArtifactIdBySession: { [LEGACY_SESSION_ID]: activeId },
        } as Partial<ArtifactStore> as ArtifactStore;
      },
    }
  )
);
