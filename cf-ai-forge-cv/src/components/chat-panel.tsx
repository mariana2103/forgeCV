"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useResumeStore } from "@/lib/resume-store"
import type { ResumeData } from "@/lib/resume-types"

const BIO_KEY = "forgecv-bio"

function getBio(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(BIO_KEY) ?? ""
}

export function ChatPanel() {
  const {
    chatMessages,
    addChatMessage,
    resume,
    jobDescription,
    setResume,
    setHighlights,
    status,
  } = useResumeStore()
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages, isTyping])

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || isTyping) return
    setInput("")
    addChatMessage("user", msg)
    setIsTyping(true)

    try {
      // Build the message history to send (user/assistant turns only, no system injections)
      const history = chatMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      // Append the new user message
      history.push({ role: "user", content: msg })

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          resume,
          jobDescription: jobDescription || undefined,
          bio: getBio() || undefined,
        }),
      })

      if (!res.ok) throw new Error(`Chat API error: ${res.status}`)

      const { reply, updatedResume } = (await res.json()) as {
        reply: string
        updatedResume: ResumeData | null
      }

      addChatMessage("assistant", reply)

      if (updatedResume) {
        setResume(updatedResume)
        setHighlights([]) // clear stale highlights from previous tailor run
      }
    } catch (err) {
      addChatMessage(
        "assistant",
        `Error: ${(err as Error).message}. Please try again.`
      )
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center px-4 py-2.5 border-t border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Chat
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollRef}>
        <div className="flex flex-col gap-3 px-4 py-2">
          {chatMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Bot className="size-6 text-muted-foreground/40" />
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed max-w-[200px]">
                Upload a resume then ask me anything — reorder experience, improve bullets, tailor for a role.
              </p>
            </div>
          )}
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2.5 text-xs leading-relaxed",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full mt-0.5",
                  msg.role === "user"
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {msg.role === "user" ? (
                  <User className="size-2.5" />
                ) : (
                  <Bot className="size-2.5" />
                )}
              </div>
              <div
                className={cn(
                  "rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-2.5">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground mt-0.5">
                <Bot className="size-2.5" />
              </div>
              <div className="rounded-lg bg-secondary px-3 py-2">
                <div className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                  <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
                  <span className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder={
            status === "empty"
              ? "Upload a resume first..."
              : "Improve bullets, reorder experience, ask anything..."
          }
          disabled={status === "empty" || isTyping}
          className="text-xs h-8 bg-secondary/30 border-border"
        />
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleSend}
          disabled={!input.trim() || isTyping || status === "empty"}
          className="text-muted-foreground hover:text-primary shrink-0"
          aria-label="Send message"
        >
          <Send className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
