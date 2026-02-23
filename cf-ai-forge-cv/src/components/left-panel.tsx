"use client"

import { CommandDropzone } from "./command-dropzone"
import { ProfilePanel } from "./profile-panel"
import { JdPanel } from "./jd-panel"
import { ChatPanel } from "./chat-panel"

export function LeftPanel() {
  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center px-4 py-2.5 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Command Center
        </h2>
      </div>
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <ProfilePanel />
        <CommandDropzone />
        <JdPanel />
        <ChatPanel />
      </div>
    </div>
  )
}
