import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_MODEL_ID,
  isKnownModelId,
  type ModelId,
} from "@/lib/llm/providers";

interface ModelStore {
  modelId: ModelId;
  setModelId: (id: ModelId) => void;
}

export const useModelStore = create<ModelStore>()(
  persist(
    (set) => ({
      modelId: DEFAULT_MODEL_ID,
      setModelId: (id) => set({ modelId: id }),
    }),
    {
      name: "agent-designer-model",
      // Guard against stale/invalid IDs after provider list changes.
      merge: (persisted, current) => {
        const state = persisted as Partial<ModelStore> | undefined;
        if (state && isKnownModelId(state.modelId)) {
          return { ...current, ...state } as ModelStore;
        }
        return current;
      },
    }
  )
);
