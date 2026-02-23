"use client"

import { useState } from "react"
import { ChevronDown, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { useResumeStore } from "@/lib/resume-store"

export function JdPanel() {
  const {
    jobDescription,
    setJobDescription,
    resume,
    setResume,
    setHighlights,
    status,
    setStatus,
    addChatMessage,
    getMaster,
  } = useResumeStore()
  const [isOpen, setIsOpen] = useState(true)

  const handleTailor = async () => {
    if (!jobDescription.trim() || status === "empty") return
    setStatus("tailoring")
    addChatMessage(
      "assistant",
      "Sending your resume and JD to the AI agent on Cloudflare Workers AI. Analyzing gaps and generating targeted rewrites..."
    )

    try {
      const masterProfile = getMaster()
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobDescription, masterProfile }),
      })

      if (!res.ok) throw new Error(await res.text())

      const { tailored, highlights, reasoning } = await res.json() as {
        tailored: import("@/lib/resume-types").ResumeData
        highlights: import("@/lib/resume-types").HighlightedField[]
        reasoning: { section: string; change: string; why: string }[]
      }

      setResume(tailored)
      setHighlights(highlights)
      setStatus("tailored")

      // Build a reasoning summary for the chat
      const reasoningSummary = (
        reasoning as { section: string; change: string; why: string }[]
      )
        .map((r) => `**${r.section}:** ${r.why}`)
        .join("\n")

      addChatMessage(
        "assistant",
        `Done! Made ${highlights.length} targeted changes.\n\n**Agent Reasoning:**\n${reasoningSummary}\n\nAmber highlights show every modified field on the canvas.`
      )
    } catch (err) {
      setStatus("loaded")
      addChatMessage(
        "assistant",
        `Tailoring failed: ${(err as Error).message}`
      )
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-t border-border">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-secondary/30 transition-colors">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Job Description
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-2.5 px-4 pb-4">
          <Textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the target job description here..."
            className="resize-none text-xs bg-secondary/30 border-border h-[130px] overflow-y-auto"
            disabled={status === "tailoring"}
          />
          <Button
            size="sm"
            onClick={handleTailor}
            disabled={
              !jobDescription.trim() ||
              status === "empty" ||
              status === "tailoring"
            }
            className="self-end text-xs gap-1.5"
          >
            {status === "tailoring" ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Tailoring...
              </>
            ) : (
              <>
                <Sparkles className="size-3" />
                Tailor for JD
              </>
            )}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
