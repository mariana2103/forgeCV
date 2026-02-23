"use client"

import { useState, useEffect } from "react"
import { ChevronDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

export const BIO_KEY = "forgecv-bio"

export function ProfilePanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [bio, setBio] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setBio(localStorage.getItem(BIO_KEY) ?? "")
  }, [])

  const handleSave = () => {
    localStorage.setItem(BIO_KEY, bio)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border-b border-border"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-secondary/30 transition-colors">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          My Profile
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
          <p className="text-[10px] text-muted-foreground">
            Everything you write here gets sent to the AI. Dump your career history, skills, projects, anything — the more context, the better the tailoring.
          </p>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={`E.g.\n5 years backend engineering, mostly Go and TypeScript.\nBuilt a distributed payments system at Acme Corp processing $2B/year.\nSide project: open-source CLI tool with 3k GitHub stars.\nLooking for senior IC roles at infra/platform companies.\n...keep adding anything relevant`}
            className="resize-none text-xs bg-secondary/30 border-border h-[160px] overflow-y-auto font-mono"
          />
          <Button
            size="sm"
            onClick={handleSave}
            className={cn(
              "self-end text-xs gap-1.5",
              saved && "bg-green-600 hover:bg-green-600"
            )}
          >
            {saved ? (
              <>
                <Check className="size-3" />
                Saved
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
