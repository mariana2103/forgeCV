"use client"

import { useCallback } from "react"
import { Plus, X, GripVertical, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { InlineEdit } from "./inline-edit"
import { useResumeStore } from "@/lib/resume-store"
import { getTemplate } from "@/lib/templates"
import { SECTION_LABELS, type SectionKey } from "@/lib/resume-types"
import { cn } from "@/lib/utils"

interface ResumeCanvasProps {
  previewMode?: boolean
}

function isHighlighted(
  highlights: { path: string; type: string }[],
  path: string
): boolean {
  return highlights.some((h) => h.path === path || path.startsWith(h.path))
}

const ALL_SECTIONS: SectionKey[] = [
  "summary", "experience", "skills", "education",
  "projects", "certifications", "awards", "publications",
]

export function ResumeCanvas({ previewMode = false }: ResumeCanvasProps) {
  const {
    resume, highlights, status, templateId,
    updateField, setResume,
    addSection, removeSection, moveSectionUp, moveSectionDown,
    addExperienceBullet, removeExperienceBullet, addExperience, removeExperience,
    addSkillCategory, removeSkillCategory, addSkillToCategory, removeSkillFromCategory,
    addEducation, removeEducation,
    addProject, removeProject, addProjectBullet, removeProjectBullet,
    addCertification, removeCertification,
    addAward, removeAward,
    addPublication, removePublication,
  } = useResumeStore()

  const template = getTemplate(templateId)

  const updateBullet = useCallback(
    (expId: string, bi: number, value: string) => {
      const updated = structuredClone(resume)
      const exp = updated.experience.find((e) => e.id === expId)
      if (exp) { exp.bullets[bi] = value; setResume(updated) }
    },
    [resume, setResume]
  )

  const updateProjectBullet = useCallback(
    (projId: string, bi: number, value: string) => {
      const updated = structuredClone(resume)
      const proj = updated.projects.find((p) => p.id === projId)
      if (proj) { proj.bullets[bi] = value; setResume(updated) }
    },
    [resume, setResume]
  )

  if (status === "empty") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-8 text-center">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Live Canvas</h2>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            Your resume will appear here as an interactive, editable document.
            Upload a file or paste text in the Command Center to get started.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-muted-foreground/20" />
          <div className="size-2 rounded-full bg-muted-foreground/20" />
          <div className="size-2 rounded-full bg-muted-foreground/20" />
        </div>
      </div>
    )
  }

  const availableToAdd = ALL_SECTIONS.filter((k) => !resume.sectionOrder.includes(k))

  /* ─────────────────────────────────────────────────────────────────────────
     PREVIEW RENDERERS
  ───────────────────────────────────────────────────────────────────────── */

  function previewSection(key: SectionKey) {
    switch (key) {
      case "summary":
        if (!resume.summary) return null
        return (
          <div key="summary" className="mb-4">
            <h2 className={cn("mb-1.5", template.headingClass)}>Summary</h2>
            <p className="text-[10.5px] text-[#333] leading-relaxed">{resume.summary}</p>
          </div>
        )

      case "experience":
        if (!resume.experience.length) return null
        return (
          <div key="experience" className="mb-4">
            <h2 className={cn("mb-2", template.headingClass)}>Experience</h2>
            <div className="flex flex-col gap-3">
              {resume.experience.map((exp) => (
                <div key={exp.id}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold text-[#111]">
                      {exp.role}{exp.company ? ` — ${exp.company}` : ""}
                    </span>
                    <span className="text-[10px] text-[#666] shrink-0 ml-4">{exp.dates}</span>
                  </div>
                  {exp.location && (
                    <p className="text-[10px] text-[#555] mt-px">{exp.location}</p>
                  )}
                  <ul className="mt-0.5 list-disc list-outside pl-4 flex flex-col gap-0.5">
                    {exp.bullets.filter(Boolean).map((b, i) => (
                      <li key={i} className="text-[10px] text-[#333] leading-relaxed">{b}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )

      case "skills": {
        const nonEmpty = resume.skills.filter((c) => c.skills.length > 0)
        if (!nonEmpty.length) return null
        return (
          <div key="skills" className="mb-4">
            <h2 className={cn("mb-1.5", template.headingClass)}>Skills</h2>
            <div className="flex flex-col gap-0.5">
              {nonEmpty.map((cat) => (
                <p key={cat.id} className="text-[10.5px] text-[#333]">
                  <span className="font-semibold">{cat.label}: </span>
                  {cat.skills.join(", ")}
                </p>
              ))}
            </div>
          </div>
        )
      }

      case "education":
        if (!resume.education.length) return null
        return (
          <div key="education" className="mb-4">
            <h2 className={cn("mb-2", template.headingClass)}>Education</h2>
            <div className="flex flex-col gap-2">
              {resume.education.map((edu) => (
                <div key={edu.id}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold text-[#111]">
                      {edu.degree}{edu.institution ? ` — ${edu.institution}` : ""}
                    </span>
                    <span className="text-[10px] text-[#666] shrink-0 ml-4">{edu.dates}</span>
                  </div>
                  {edu.details && (
                    <p className="text-[10px] text-[#444] mt-0.5">{edu.details}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )

      case "projects":
        if (!resume.projects.length) return null
        return (
          <div key="projects" className="mb-4">
            <h2 className={cn("mb-2", template.headingClass)}>Projects</h2>
            <div className="flex flex-col gap-3">
              {resume.projects.map((proj) => (
                <div key={proj.id}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold text-[#111]">{proj.name}</span>
                    {proj.dates && (
                      <span className="text-[10px] text-[#666] shrink-0 ml-4">{proj.dates}</span>
                    )}
                  </div>
                  {proj.description && (
                    <p className="text-[10px] text-[#444] mt-0.5">{proj.description}</p>
                  )}
                  {proj.bullets.filter(Boolean).length > 0 && (
                    <ul className="mt-0.5 list-disc list-outside pl-4 flex flex-col gap-0.5">
                      {proj.bullets.filter(Boolean).map((b, i) => (
                        <li key={i} className="text-[10px] text-[#333] leading-relaxed">{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )

      case "certifications":
        if (!resume.certifications.length) return null
        return (
          <div key="certifications" className="mb-4">
            <h2 className={cn("mb-2", template.headingClass)}>Certifications</h2>
            <div className="flex flex-col gap-1.5">
              {resume.certifications.map((cert) => (
                <div key={cert.id}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold text-[#111]">
                      {cert.name}{cert.issuer ? ` — ${cert.issuer}` : ""}
                    </span>
                    {cert.date && (
                      <span className="text-[10px] text-[#666] shrink-0 ml-4">{cert.date}</span>
                    )}
                  </div>
                  {cert.details && (
                    <p className="text-[10px] text-[#444] mt-0.5">{cert.details}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )

      case "awards":
        if (!resume.awards.length) return null
        return (
          <div key="awards" className="mb-4">
            <h2 className={cn("mb-2", template.headingClass)}>Awards</h2>
            <div className="flex flex-col gap-1.5">
              {resume.awards.map((award) => (
                <div key={award.id}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold text-[#111]">{award.name}</span>
                    {award.date && (
                      <span className="text-[10px] text-[#666] shrink-0 ml-4">{award.date}</span>
                    )}
                  </div>
                  {award.description && (
                    <p className="text-[10px] text-[#444] mt-0.5">{award.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )

      case "publications":
        if (!resume.publications.length) return null
        return (
          <div key="publications" className="mb-4">
            <h2 className={cn("mb-2", template.headingClass)}>Publications</h2>
            <div className="flex flex-col gap-2">
              {resume.publications.map((pub) => (
                <div key={pub.id}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold text-[#111]">{pub.title}</span>
                    {pub.date && (
                      <span className="text-[10px] text-[#666] shrink-0 ml-4">{pub.date}</span>
                    )}
                  </div>
                  {pub.venue && (
                    <p className="text-[10px] text-[#555] italic mt-0.5">{pub.venue}</p>
                  )}
                  {pub.description && (
                    <p className="text-[10px] text-[#444] mt-0.5">{pub.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     EDIT RENDERERS
  ───────────────────────────────────────────────────────────────────────── */

  function SectionControls({ sectionKey, idx }: { sectionKey: SectionKey; idx: number }) {
    const isFirst = idx === 0
    const isLast = idx === resume.sectionOrder.length - 1
    return (
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => moveSectionUp(sectionKey)}
          disabled={isFirst}
          className="p-0.5 text-muted-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors"
          aria-label="Move section up"
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          onClick={() => moveSectionDown(sectionKey)}
          disabled={isLast}
          className="p-0.5 text-muted-foreground/40 hover:text-foreground disabled:opacity-20 transition-colors"
          aria-label="Move section down"
        >
          <ChevronDown className="size-3" />
        </button>
        <button
          onClick={() => removeSection(sectionKey)}
          className="p-0.5 text-muted-foreground/40 hover:text-destructive transition-colors"
          aria-label="Remove section"
        >
          <X className="size-3" />
        </button>
      </div>
    )
  }

  function editSection(key: SectionKey, idx: number) {
    switch (key) {
      case "summary":
        return (
          <section key="summary" className="mb-5 group">
            <div className="flex items-center justify-between mb-2">
              <h3 className={template.headingClass}>Summary</h3>
              <SectionControls sectionKey={key} idx={idx} />
            </div>
            <InlineEdit
              value={resume.summary}
              onChange={(v) => updateField("summary", v)}
              className="text-xs text-muted-foreground leading-relaxed"
              placeholder="Write a professional summary..."
              highlighted={isHighlighted(highlights, "summary")}
              multiline
            />
          </section>
        )

      case "experience":
        return (
          <section key="experience" className="mb-5 group">
            <div className="flex items-center justify-between mb-3">
              <h3 className={template.headingClass}>Experience</h3>
              <div className="flex items-center gap-1">
                <SectionControls sectionKey={key} idx={idx} />
                <Button variant="ghost" size="icon-sm" onClick={addExperience} className="size-6 text-muted-foreground hover:text-primary" aria-label="Add experience">
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-5">
              {resume.experience.map((exp) => (
                <div key={exp.id} className="group/entry relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <InlineEdit value={exp.role} onChange={(v) => updateField(`experience.${exp.id}.role`, v)} className="text-sm font-semibold text-foreground" placeholder="Role Title" />
                        <span className="text-xs text-muted-foreground/40">at</span>
                        <InlineEdit value={exp.company} onChange={(v) => updateField(`experience.${exp.id}.company`, v)} className="text-sm text-foreground" placeholder="Company" />
                      </div>
                      <div className="flex items-center gap-2">
                        <InlineEdit value={exp.dates} onChange={(v) => updateField(`experience.${exp.id}.dates`, v)} className="text-[11px] text-muted-foreground mt-0.5" placeholder="Start - End" />
                        <InlineEdit value={exp.location ?? ""} onChange={(v) => updateField(`experience.${exp.id}.location`, v)} className="text-[11px] text-muted-foreground/70 mt-0.5" placeholder="Location" />
                      </div>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeExperience(exp.id)} className="size-5 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/entry:opacity-100 transition-opacity shrink-0 mt-1" aria-label="Remove experience">
                      <X className="size-3" />
                    </Button>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {exp.bullets.map((bullet, bi) => (
                      <li key={bi} className="flex items-start gap-1 group/bullet">
                        <GripVertical className="size-3 text-muted-foreground/20 mt-0.5 shrink-0 opacity-0 group-hover/bullet:opacity-100 transition-opacity" />
                        <span className="text-muted-foreground/60 text-xs mt-px shrink-0">•</span>
                        <InlineEdit
                          value={bullet}
                          onChange={(v) => updateBullet(exp.id, bi, v)}
                          className="text-xs text-muted-foreground leading-relaxed flex-1"
                          placeholder="Describe your accomplishment..."
                          highlighted={isHighlighted(highlights, `experience.${exp.id}.bullets.${bi}`)}
                          multiline
                        />
                        <Button variant="ghost" size="icon-sm" onClick={() => removeExperienceBullet(exp.id, bi)} className="size-4 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover/bullet:opacity-100 transition-opacity shrink-0 mt-0.5">
                          <X className="size-2.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => addExperienceBullet(exp.id)} className="mt-1.5 ml-6 text-[10px] text-muted-foreground/40 hover:text-primary transition-colors">
                    + add bullet
                  </button>
                </div>
              ))}
            </div>
          </section>
        )

      case "skills":
        return (
          <section key="skills" className="mb-5 group">
            <div className="flex items-center justify-between mb-3">
              <h3 className={template.headingClass}>Skills</h3>
              <div className="flex items-center gap-1">
                <SectionControls sectionKey={key} idx={idx} />
                <Button
                  variant="ghost" size="icon-sm"
                  onClick={() => {
                    const label = prompt("Category name (e.g. Programming Languages):")
                    if (label?.trim()) addSkillCategory(label.trim())
                  }}
                  className="size-6 text-muted-foreground hover:text-primary"
                  aria-label="Add skill category"
                >
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
            <div className={cn("flex flex-col gap-3", isHighlighted(highlights, "skills") && "ring-1 ring-amber-400/30 rounded-md p-2 bg-amber-400/5")}>
              {resume.skills.map((cat) => (
                <div key={cat.id} className="group/cat">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <InlineEdit
                      value={cat.label}
                      onChange={(v) => updateField(`skills.${cat.id}.label`, v)}
                      className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
                      placeholder="Category name"
                    />
                    <button
                      onClick={() => removeSkillCategory(cat.id)}
                      className="opacity-0 group-hover/cat:opacity-100 transition-opacity text-muted-foreground/40 hover:text-destructive"
                      aria-label="Remove category"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.skills.map((skill, i) => (
                      <Badge key={i} variant="secondary" className="group/skill text-[11px] gap-1 pr-1 font-normal">
                        {skill}
                        <button
                          onClick={() => removeSkillFromCategory(cat.id, i)}
                          className="opacity-0 group-hover/skill:opacity-100 transition-opacity"
                          aria-label={`Remove ${skill}`}
                        >
                          <X className="size-2.5" />
                        </button>
                      </Badge>
                    ))}
                    <button
                      onClick={() => { const s = prompt(`Add skill to ${cat.label}:`); if (s?.trim()) addSkillToCategory(cat.id, s.trim()) }}
                      className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                    >
                      <Plus className="size-2.5" />add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )

      case "education":
        return (
          <section key="education" className="mb-5 group">
            <div className="flex items-center justify-between mb-3">
              <h3 className={template.headingClass}>Education</h3>
              <div className="flex items-center gap-1">
                <SectionControls sectionKey={key} idx={idx} />
                <Button variant="ghost" size="icon-sm" onClick={addEducation} className="size-6 text-muted-foreground hover:text-primary" aria-label="Add education">
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {resume.education.map((edu) => (
                <div key={edu.id} className="group/entry relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <InlineEdit value={edu.degree} onChange={(v) => updateField(`education.${edu.id}.degree`, v)} className="text-sm font-semibold text-foreground" placeholder="Degree" />
                        <span className="text-xs text-muted-foreground/40">at</span>
                        <InlineEdit value={edu.institution} onChange={(v) => updateField(`education.${edu.id}.institution`, v)} className="text-sm text-foreground" placeholder="Institution" />
                      </div>
                      <InlineEdit value={edu.dates} onChange={(v) => updateField(`education.${edu.id}.dates`, v)} className="text-[11px] text-muted-foreground mt-0.5" placeholder="Start - End" />
                      <InlineEdit value={edu.details} onChange={(v) => updateField(`education.${edu.id}.details`, v)} className="text-xs text-muted-foreground/70 mt-1" placeholder="Details, GPA, honors..." multiline />
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeEducation(edu.id)} className="size-5 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/entry:opacity-100 transition-opacity shrink-0 mt-1">
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )

      case "projects":
        return (
          <section key="projects" className="mb-5 group">
            <div className="flex items-center justify-between mb-3">
              <h3 className={template.headingClass}>Projects</h3>
              <div className="flex items-center gap-1">
                <SectionControls sectionKey={key} idx={idx} />
                <Button variant="ghost" size="icon-sm" onClick={addProject} className="size-6 text-muted-foreground hover:text-primary" aria-label="Add project">
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-5">
              {resume.projects.map((proj) => (
                <div key={proj.id} className="group/entry relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <InlineEdit value={proj.name} onChange={(v) => updateField(`projects.${proj.id}.name`, v)} className="text-sm font-semibold text-foreground" placeholder="Project Name" />
                      <InlineEdit value={proj.dates} onChange={(v) => updateField(`projects.${proj.id}.dates`, v)} className="text-[11px] text-muted-foreground mt-0.5" placeholder="Dates (optional)" />
                      <InlineEdit value={proj.description} onChange={(v) => updateField(`projects.${proj.id}.description`, v)} className="text-xs text-muted-foreground/80 mt-1" placeholder="Short description..." multiline />
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeProject(proj.id)} className="size-5 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/entry:opacity-100 transition-opacity shrink-0 mt-1">
                      <X className="size-3" />
                    </Button>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {proj.bullets.map((bullet, bi) => (
                      <li key={bi} className="flex items-start gap-1 group/bullet">
                        <GripVertical className="size-3 text-muted-foreground/20 mt-0.5 shrink-0 opacity-0 group-hover/bullet:opacity-100 transition-opacity" />
                        <span className="text-muted-foreground/60 text-xs mt-px shrink-0">•</span>
                        <InlineEdit
                          value={bullet}
                          onChange={(v) => updateProjectBullet(proj.id, bi, v)}
                          className="text-xs text-muted-foreground leading-relaxed flex-1"
                          placeholder="Describe what you built..."
                          highlighted={isHighlighted(highlights, `projects.${proj.id}.bullets.${bi}`)}
                          multiline
                        />
                        <Button variant="ghost" size="icon-sm" onClick={() => removeProjectBullet(proj.id, bi)} className="size-4 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover/bullet:opacity-100 transition-opacity shrink-0 mt-0.5">
                          <X className="size-2.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => addProjectBullet(proj.id)} className="mt-1.5 ml-6 text-[10px] text-muted-foreground/40 hover:text-primary transition-colors">
                    + add bullet
                  </button>
                </div>
              ))}
            </div>
          </section>
        )

      case "certifications":
        return (
          <section key="certifications" className="mb-5 group">
            <div className="flex items-center justify-between mb-3">
              <h3 className={template.headingClass}>Certifications</h3>
              <div className="flex items-center gap-1">
                <SectionControls sectionKey={key} idx={idx} />
                <Button variant="ghost" size="icon-sm" onClick={addCertification} className="size-6 text-muted-foreground hover:text-primary" aria-label="Add certification">
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {resume.certifications.map((cert) => (
                <div key={cert.id} className="group/entry relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <InlineEdit value={cert.name} onChange={(v) => updateField(`certifications.${cert.id}.name`, v)} className="text-sm font-semibold text-foreground" placeholder="Certification Name" />
                        <span className="text-xs text-muted-foreground/40">by</span>
                        <InlineEdit value={cert.issuer} onChange={(v) => updateField(`certifications.${cert.id}.issuer`, v)} className="text-sm text-foreground" placeholder="Issuer" />
                      </div>
                      <InlineEdit value={cert.date} onChange={(v) => updateField(`certifications.${cert.id}.date`, v)} className="text-[11px] text-muted-foreground mt-0.5" placeholder="Date" />
                      <InlineEdit value={cert.details} onChange={(v) => updateField(`certifications.${cert.id}.details`, v)} className="text-xs text-muted-foreground/70 mt-1" placeholder="Details..." multiline />
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeCertification(cert.id)} className="size-5 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/entry:opacity-100 transition-opacity shrink-0 mt-1">
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )

      case "awards":
        return (
          <section key="awards" className="mb-5 group">
            <div className="flex items-center justify-between mb-3">
              <h3 className={template.headingClass}>Awards</h3>
              <div className="flex items-center gap-1">
                <SectionControls sectionKey={key} idx={idx} />
                <Button variant="ghost" size="icon-sm" onClick={addAward} className="size-6 text-muted-foreground hover:text-primary" aria-label="Add award">
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {resume.awards.map((award) => (
                <div key={award.id} className="group/entry relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <InlineEdit value={award.name} onChange={(v) => updateField(`awards.${award.id}.name`, v)} className="text-sm font-semibold text-foreground" placeholder="Award Name" />
                      <InlineEdit value={award.date} onChange={(v) => updateField(`awards.${award.id}.date`, v)} className="text-[11px] text-muted-foreground mt-0.5" placeholder="Date" />
                      <InlineEdit value={award.description} onChange={(v) => updateField(`awards.${award.id}.description`, v)} className="text-xs text-muted-foreground/70 mt-1" placeholder="Description..." multiline />
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeAward(award.id)} className="size-5 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/entry:opacity-100 transition-opacity shrink-0 mt-1">
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )

      case "publications":
        return (
          <section key="publications" className="mb-5 group">
            <div className="flex items-center justify-between mb-3">
              <h3 className={template.headingClass}>Publications</h3>
              <div className="flex items-center gap-1">
                <SectionControls sectionKey={key} idx={idx} />
                <Button variant="ghost" size="icon-sm" onClick={addPublication} className="size-6 text-muted-foreground hover:text-primary" aria-label="Add publication">
                  <Plus className="size-3" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {resume.publications.map((pub) => (
                <div key={pub.id} className="group/entry relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <InlineEdit value={pub.title} onChange={(v) => updateField(`publications.${pub.id}.title`, v)} className="text-sm font-semibold text-foreground" placeholder="Publication Title" />
                      <InlineEdit value={pub.venue} onChange={(v) => updateField(`publications.${pub.id}.venue`, v)} className="text-xs text-muted-foreground/70 italic mt-0.5" placeholder="Journal / Conference" />
                      <InlineEdit value={pub.date} onChange={(v) => updateField(`publications.${pub.id}.date`, v)} className="text-[11px] text-muted-foreground mt-0.5" placeholder="Date" />
                      <InlineEdit value={pub.description} onChange={(v) => updateField(`publications.${pub.id}.description`, v)} className="text-xs text-muted-foreground/70 mt-1" placeholder="Abstract or description..." multiline />
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => removePublication(pub.id)} className="size-5 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/entry:opacity-100 transition-opacity shrink-0 mt-1">
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )

      default:
        return null
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     PREVIEW MODE
  ───────────────────────────────────────────────────────────────────────── */
  if (previewMode) {
    return (
      <div className="flex h-full items-start justify-center bg-muted/40 overflow-auto py-6">
        {/* 0.65 scale makes A4 (794×1123px) fit comfortably in one view */}
        <div style={{ zoom: 0.65 }}>
          <div
            className="bg-white text-[#111] shadow-2xl"
            style={{ fontFamily: template.fontFamily, padding: "56px 64px", width: 794, minHeight: 1123 }}
          >
            {/* Fixed contact header */}
            <h1 className={cn("mb-1", template.nameClass)} style={{ color: "#111" }}>
              {resume.contact.name || "Your Name"}
            </h1>
            {resume.contact.title && (
              <p className="text-sm text-[#444] mb-1">{resume.contact.title}</p>
            )}
            <p className="text-[11px] text-[#666] mb-4">
              {[
                resume.contact.email, resume.contact.phone, resume.contact.location,
                resume.contact.linkedin, resume.contact.github,
              ].filter(Boolean).join("  |  ")}
            </p>
            <hr className="border-[#ddd] mb-4" />
            {/* Dynamic sections in LLM-controlled order */}
            {resume.sectionOrder.map((key) => previewSection(key))}
          </div>
        </div>
      </div>
    )
  }

  /* ─────────────────────────────────────────────────────────────────────────
     EDIT MODE
  ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-full flex-col bg-background" style={{ fontFamily: template.fontFamily }}>
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Live Canvas
        </h2>
        {highlights.length > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-amber-400/30 text-amber-400">
            {highlights.length} changes
          </Badge>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-8 py-6">

          {/* Fixed contact header — never in sectionOrder */}
          <section className="mb-5">
            <InlineEdit
              value={resume.contact.name}
              onChange={(v) => updateField("contact.name", v)}
              className={cn("mb-0.5", template.nameClass)}
              placeholder="Your Name"
            />
            <InlineEdit
              value={resume.contact.title}
              onChange={(v) => updateField("contact.title", v)}
              className="text-sm text-muted-foreground mt-0.5"
              placeholder="Professional Title"
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              <InlineEdit value={resume.contact.email} onChange={(v) => updateField("contact.email", v)} className="text-xs text-muted-foreground w-auto" placeholder="email@example.com" />
              <span className="text-muted-foreground/30 text-xs">|</span>
              <InlineEdit value={resume.contact.phone} onChange={(v) => updateField("contact.phone", v)} className="text-xs text-muted-foreground w-auto" placeholder="Phone" />
              <span className="text-muted-foreground/30 text-xs">|</span>
              <InlineEdit value={resume.contact.location} onChange={(v) => updateField("contact.location", v)} className="text-xs text-muted-foreground w-auto" placeholder="Location" />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <InlineEdit value={resume.contact.linkedin} onChange={(v) => updateField("contact.linkedin", v)} className="text-xs text-primary/70 w-auto" placeholder="LinkedIn URL" />
              <span className="text-muted-foreground/30 text-xs">|</span>
              <InlineEdit value={resume.contact.github} onChange={(v) => updateField("contact.github", v)} className="text-xs text-primary/70 w-auto" placeholder="GitHub URL" />
            </div>
          </section>

          <Separator className="mb-4" />

          {/* Dynamic sections rendered in sectionOrder */}
          {resume.sectionOrder.map((key, idx) => (
            <div key={key}>
              {editSection(key, idx)}
              {idx < resume.sectionOrder.length - 1 && <Separator className="mb-4" />}
            </div>
          ))}

          {/* Add section row — shows sections not yet active */}
          {availableToAdd.length > 0 && (
            <div className="mt-2 mb-8">
              <p className="text-[10px] text-muted-foreground/40 mb-2 uppercase tracking-wider">
                Add section
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableToAdd.map((key) => (
                  <button
                    key={key}
                    onClick={() => addSection(key)}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                  >
                    <Plus className="size-2.5" />
                    {SECTION_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
