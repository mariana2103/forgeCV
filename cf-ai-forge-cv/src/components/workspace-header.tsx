"use client"

import { Eye, EyeOff, Anvil, RotateCcw, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useResumeStore } from "@/lib/resume-store"
import { RESUME_TEMPLATES, getTemplate } from "@/lib/templates"
import type { ResumeTemplate } from "@/lib/templates"
import { cn } from "@/lib/utils"

interface WorkspaceHeaderProps {
  previewMode: boolean
  onTogglePreview: () => void
}

export function WorkspaceHeader({
  previewMode,
  onTogglePreview,
}: WorkspaceHeaderProps) {
  const { status, resetAll, resume, templateId, setTemplateId } =
    useResumeStore()

  const handleExportPdf = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    const template = getTemplate(templateId)
    const html = buildPrintHtml(resume, template)
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  return (
    <header className="flex h-12 items-center justify-between border-b border-border px-4 gap-4">
      {/* Left: logo + status */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Anvil className="size-5 text-primary" />
          <span className="text-sm font-semibold text-foreground tracking-tight">
            ForgeCV
          </span>
        </div>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-xs text-muted-foreground font-mono">
          workspace
        </span>
        {status !== "empty" && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-5 border-border text-muted-foreground"
          >
            {status === "loaded" && "resume loaded"}
            {status === "tailoring" && "tailoring..."}
            {status === "tailored" && "tailored"}
          </Badge>
        )}
      </div>

      {/* Centre: template picker */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {RESUME_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTemplateId(t.id)}
            title={t.description}
            className={cn(
              "rounded px-2.5 py-1 text-[10px] font-medium transition-colors whitespace-nowrap",
              templateId === t.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Right: preview toggle + reset + export */}
      <div className="flex items-center gap-1.5 shrink-0">
        {status !== "empty" && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onTogglePreview}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              previewMode && "text-primary bg-primary/10"
            )}
            aria-label={previewMode ? "Exit preview" : "Preview resume"}
          >
            {previewMode ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={resetAll}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Reset workspace"
        >
          <RotateCcw className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExportPdf}
          disabled={status === "empty"}
          className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
        >
          <Download className="size-3.5" />
          Export PDF
        </Button>
      </div>
    </header>
  )
}

function buildPrintHtml(
  resume: import("@/lib/resume-types").ResumeData,
  template: ResumeTemplate
): string {
  const { contact, summary, experience, skills, education } = resume
  return `<!DOCTYPE html>
<html><head><title>${contact.name} - Resume</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-size:11pt;line-height:1.4;color:#111;max-width:8.5in;margin:0 auto;padding:0.6in 0.7in}
  h3{font-size:11pt;font-weight:600}
  .contact{font-size:9pt;color:#444;margin-bottom:4pt}
  .title{font-size:11pt;color:#333;margin-bottom:2pt}
  .summary{font-size:10pt;color:#333;margin-bottom:6pt;line-height:1.5}
  .job{margin-bottom:10pt}
  .job-header{display:flex;justify-content:space-between;margin-bottom:3pt}
  .dates{font-size:9pt;color:#666}
  ul{padding-left:18pt;margin:3pt 0}
  li{font-size:10pt;margin-bottom:2pt;line-height:1.45}
  .skills{font-size:10pt}
  .edu{margin-bottom:6pt}
  .edu-header{display:flex;justify-content:space-between}
  @media print{body{padding:0.5in 0.6in}}
  ${template.printCss}
</style></head><body>
<h1>${contact.name}</h1>
${contact.title ? `<div class="title">${contact.title}</div>` : ""}
<div class="contact">${[contact.email, contact.phone, contact.location, contact.linkedin, contact.github].filter(Boolean).join(" | ")}</div>
${summary ? `<h2>Summary</h2><div class="summary">${summary}</div>` : ""}
${
  experience.length
    ? `<h2>Experience</h2>${experience
        .map(
          (e) => `<div class="job">
  <div class="job-header"><h3>${e.role} — ${e.company}</h3><span class="dates">${e.dates}</span></div>
  <ul>${e.bullets.filter(Boolean).map((b) => `<li>${b}</li>`).join("")}</ul>
</div>`
        )
        .join("")}`
    : ""
}
${skills.length ? `<h2>Skills</h2><div class="skills">${skills.join(", ")}</div>` : ""}
${
  education.length
    ? `<h2>Education</h2>${education
        .map(
          (e) => `<div class="edu">
  <div class="edu-header"><h3>${e.degree} — ${e.institution}</h3><span class="dates">${e.dates}</span></div>
  ${e.details ? `<div style="font-size:10pt;color:#444">${e.details}</div>` : ""}
</div>`
        )
        .join("")}`
    : ""
}
</body></html>`
}
