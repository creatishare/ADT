"use client";

import { useState } from "react";
import { ChatArea } from "@/components/chat/ChatArea";
import { ArtifactArea } from "@/components/artifacts/ArtifactArea";
import { SetupSidebar } from "@/components/setup/SetupSidebar";
import { TopBar } from "@/components/workspace/TopBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useArtifactStore } from "@/store/useArtifactStore";
import { useConversationStore } from "@/store/useConversationStore";

type ViewMode = "split" | "chat" | "artifacts";

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const activeSessionId = useConversationStore((s) => s.activeSessionId);
  const artifactCount = useArtifactStore((s) =>
    activeSessionId ? (s.bySession[activeSessionId]?.length ?? 0) : 0
  );

  const handleTabClick = (tab: "chat" | "artifacts") => {
    setViewMode((prev) => (prev === tab ? "split" : tab));
  };

  return (
    <ErrorBoundary label="应用">
      <main className="h-screen w-full bg-[var(--surface-ground)] overflow-hidden text-[var(--fg-primary)] flex flex-col">
        <TopBar
          viewMode={viewMode}
          onTabClick={handleTabClick}
          artifactCount={artifactCount}
        />

        {/* Bento body — tiles with gap revealing ground */}
        <div className="flex-1 min-h-0 flex gap-3 p-3 md:gap-4 md:p-4 md:pt-3">
          {/* Left pane: Setup + Chat tile */}
          <section
            className={`h-full min-w-0 flex-1 ${
              viewMode === "artifacts" ? "hidden" : "flex"
            }`}
          >
            <SetupSidebar />
            <div className="flex-1 min-w-0">
              <ErrorBoundary label="对话区">
                <ChatArea />
              </ErrorBoundary>
            </div>
          </section>

          {/* Right pane: Artifact tile */}
          <section
            className={`h-full min-w-0 flex-1 ${
              viewMode === "artifacts" ? "block" : "hidden"
            } ${viewMode === "chat" ? "md:hidden" : "md:block"}`}
          >
            <ErrorBoundary label="工件区">
              <ArtifactArea />
            </ErrorBoundary>
          </section>
        </div>
      </main>
    </ErrorBoundary>
  );
}
