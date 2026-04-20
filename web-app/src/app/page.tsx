"use client";

import { useState } from "react";
import { ChatArea } from "@/components/chat/ChatArea";
import { ArtifactArea } from "@/components/artifacts/ArtifactArea";
import { SetupSidebar } from "@/components/setup/SetupSidebar";
import { useArtifactStore } from "@/store/useArtifactStore";

type MobileTab = "chat" | "artifacts";

export default function Home() {
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const { artifacts } = useArtifactStore();

  return (
    <main className="h-screen w-full bg-white overflow-hidden text-gray-900 flex flex-col">
      {/* Mobile tab bar – visible only below md */}
      <div className="md:hidden flex border-b border-gray-200 bg-white shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab("chat")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            mobileTab === "chat"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500"
          }`}
        >
          对话
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("artifacts")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
            mobileTab === "artifacts"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500"
          }`}
        >
          设计文档
          {artifacts.length > 0 && (
            <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
              {artifacts.length}
            </span>
          )}
        </button>
      </div>

      {/* Main grid */}
      <div className="flex-1 min-h-0 grid grid-rows-1 grid-cols-1 md:grid-cols-[1fr_1fr]">
        {/* Left Pane: SetupSidebar + ChatArea */}
        <section
          className={`h-full flex border-r border-gray-200 shadow-sm z-10 relative ${
            mobileTab === "artifacts" ? "hidden md:flex" : "flex"
          }`}
        >
          <SetupSidebar />
          <div className="flex-1 min-w-0">
            <ChatArea />
          </div>
        </section>

        {/* Right Pane: Artifact Area */}
        <section
          className={`h-full relative bg-gray-50/30 ${
            mobileTab === "chat" ? "hidden md:block" : "block"
          }`}
        >
          <ArtifactArea />
        </section>
      </div>
    </main>
  );
}
