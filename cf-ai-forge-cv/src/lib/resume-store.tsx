"use client"

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react"
import useSWR, { mutate as globalMutate } from "swr"
import type {
  ResumeData,
  ChatMessage,
  HighlightedField,
  SectionKey,
} from "./resume-types"
import {
  createEmptyResume,
  createSampleResume,
  generateId,
  migrateResumeData,
} from "./resume-types"
import { DEFAULT_TEMPLATE_ID } from "./templates"
import {
  getMasterProfile,
  saveMasterProfile,
  mergeIntoMaster,
  clearMasterProfile,
} from "./master-profile"

const RESUME_KEY = "forge-resume"
const CHAT_KEY = "forge-chat"
const JD_KEY = "forge-jd"
const HIGHLIGHTS_KEY = "forge-highlights"
const STATUS_KEY = "forge-status"
const TEMPLATE_KEY = "forge-template"
const ACCENT_KEY = "forge-accent"

/** localStorage key + 7-day TTL for cross-refresh persistence */
const SESSION_KEY = "forgecv-session-v2"
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000

type WorkspaceStatus = "empty" | "loaded" | "tailoring" | "tailored"

interface SessionSnapshot {
  resume: ResumeData
  status: WorkspaceStatus
  chatMessages: ChatMessage[]
  jobDescription: string
  templateId: string
  accentColor: string
  ts: number
}

function loadSession(): SessionSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const snap = JSON.parse(raw) as SessionSnapshot
    if (Date.now() - snap.ts > SESSION_TTL) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    snap.resume = migrateResumeData(snap.resume)
    return snap
  } catch {
    return null
  }
}

interface ResumeStoreContextValue {
  resume: ResumeData
  chatMessages: ChatMessage[]
  jobDescription: string
  highlights: HighlightedField[]
  status: WorkspaceStatus
  templateId: string
  accentColor: string
  setResume: (data: ResumeData, saveToMaster?: boolean) => void
  updateField: (path: string, value: string) => void
  addSection: (key: SectionKey) => void
  removeSection: (key: SectionKey) => void
  moveSectionUp: (key: SectionKey) => void
  moveSectionDown: (key: SectionKey) => void
  addExperienceBullet: (expId: string) => void
  removeExperienceBullet: (expId: string, bulletIndex: number) => void
  addExperience: () => void
  removeExperience: (expId: string) => void
  addSkillCategory: (label?: string) => void
  removeSkillCategory: (id: string) => void
  addSkillToCategory: (categoryId: string, skill: string) => void
  removeSkillFromCategory: (categoryId: string, index: number) => void
  addEducation: () => void
  removeEducation: (eduId: string) => void
  addProject: () => void
  removeProject: (id: string) => void
  addProjectBullet: (projectId: string) => void
  removeProjectBullet: (projectId: string, bulletIndex: number) => void
  addCertification: () => void
  removeCertification: (id: string) => void
  addAward: () => void
  removeAward: (id: string) => void
  addPublication: () => void
  removePublication: (id: string) => void
  setJobDescription: (jd: string) => void
  addChatMessage: (role: "user" | "assistant", content: string) => void
  setHighlights: (h: HighlightedField[]) => void
  clearHighlights: () => void
  setStatus: (s: WorkspaceStatus) => void
  setTemplateId: (id: string) => void
  setAccentColor: (color: string) => void
  getMaster: () => ResumeData | null
  loadSample: () => void
  resetAll: () => void
}

const ResumeStoreContext = createContext<ResumeStoreContextValue | null>(null)

export function ResumeStoreProvider({ children }: { children: ReactNode }) {
  const session = useMemo(() => loadSession(), [])

  const { data: resume } = useSWR<ResumeData>(RESUME_KEY, null, {
    fallbackData: session?.resume ?? createEmptyResume(),
  })
  const { data: chatMessages } = useSWR<ChatMessage[]>(CHAT_KEY, null, {
    fallbackData: session?.chatMessages ?? [],
  })
  const { data: jobDescription } = useSWR<string>(JD_KEY, null, {
    fallbackData: session?.jobDescription ?? "",
  })
  const { data: highlights } = useSWR<HighlightedField[]>(HIGHLIGHTS_KEY, null, {
    fallbackData: [],
  })
  const { data: status } = useSWR<WorkspaceStatus>(STATUS_KEY, null, {
    fallbackData: session?.status ?? "empty",
  })
  const { data: templateId } = useSWR<string>(TEMPLATE_KEY, null, {
    fallbackData: session?.templateId ?? DEFAULT_TEMPLATE_ID,
  })
  const { data: accentColor } = useSWR<string>(ACCENT_KEY, null, {
    fallbackData: session?.accentColor ?? "#5B6FA6",
  })

  // Persist session to localStorage on every meaningful change (7-day TTL)
  useEffect(() => {
    if (!resume || !status || status === "empty") return
    const snap: SessionSnapshot = {
      resume: resume!,
      status: status!,
      chatMessages: chatMessages ?? [],
      jobDescription: jobDescription ?? "",
      templateId: templateId ?? DEFAULT_TEMPLATE_ID,
      accentColor: accentColor ?? "#5B6FA6",
      ts: Date.now(),
    }
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(snap))
    } catch {
      // Storage quota exceeded — not critical
    }
  }, [resume, status, chatMessages, jobDescription, templateId, accentColor])

  const setResume = useCallback((data: ResumeData, saveToMaster = false) => {
    globalMutate(RESUME_KEY, data, false)
    if (saveToMaster) {
      const master = getMasterProfile()
      saveMasterProfile(mergeIntoMaster(master, data))
    }
  }, [])

  const setTemplateId = useCallback((id: string) => {
    globalMutate(TEMPLATE_KEY, id, false)
  }, [])

  const setAccentColor = useCallback((color: string) => {
    globalMutate(ACCENT_KEY, color, false)
  }, [])

  const getMaster = useCallback(() => getMasterProfile(), [])

  const updateField = useCallback(
    (path: string, value: string) => {
      if (!resume) return
      const updated = structuredClone(resume)
      const parts = path.split(".")
      let target: Record<string, unknown> = updated as unknown as Record<string, unknown>
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i]
        if (Array.isArray(target[key])) {
          const arr = target[key] as Record<string, unknown>[]
          const nextKey = parts[i + 1]
          const idx = arr.findIndex((item) => item.id === nextKey)
          if (idx !== -1) {
            target = arr[idx]
            i++
            continue
          }
        }
        target = target[key] as Record<string, unknown>
      }
      const lastKey = parts[parts.length - 1]
      target[lastKey] = value
      globalMutate(RESUME_KEY, updated, false)
    },
    [resume]
  )

  // ── Section ordering ──────────────────────────────────────────
  const addSection = useCallback(
    (key: SectionKey) => {
      if (!resume) return
      if (resume.sectionOrder.includes(key)) return
      const updated = structuredClone(resume)
      updated.sectionOrder.push(key)
      globalMutate(RESUME_KEY, updated, false)
    },
    [resume]
  )

  const removeSection = useCallback(
    (key: SectionKey) => {
      if (!resume) return
      const updated = structuredClone(resume)
      updated.sectionOrder = updated.sectionOrder.filter((k) => k !== key)
      globalMutate(RESUME_KEY, updated, false)
    },
    [resume]
  )

  const moveSectionUp = useCallback(
    (key: SectionKey) => {
      if (!resume) return
      const updated = structuredClone(resume)
      const idx = updated.sectionOrder.indexOf(key)
      if (idx <= 0) return
      ;[updated.sectionOrder[idx - 1], updated.sectionOrder[idx]] = [
        updated.sectionOrder[idx],
        updated.sectionOrder[idx - 1],
      ]
      globalMutate(RESUME_KEY, updated, false)
    },
    [resume]
  )

  const moveSectionDown = useCallback(
    (key: SectionKey) => {
      if (!resume) return
      const updated = structuredClone(resume)
      const idx = updated.sectionOrder.indexOf(key)
      if (idx < 0 || idx >= updated.sectionOrder.length - 1) return
      ;[updated.sectionOrder[idx], updated.sectionOrder[idx + 1]] = [
        updated.sectionOrder[idx + 1],
        updated.sectionOrder[idx],
      ]
      globalMutate(RESUME_KEY, updated, false)
    },
    [resume]
  )

  // ── Experience ────────────────────────────────────────────────
  const addExperienceBullet = useCallback(
    (expId: string) => {
      if (!resume) return
      const updated = structuredClone(resume)
      const exp = updated.experience.find((e) => e.id === expId)
      if (exp) { exp.bullets.push(""); globalMutate(RESUME_KEY, updated, false) }
    },
    [resume]
  )

  const removeExperienceBullet = useCallback(
    (expId: string, bulletIndex: number) => {
      if (!resume) return
      const updated = structuredClone(resume)
      const exp = updated.experience.find((e) => e.id === expId)
      if (exp) { exp.bullets.splice(bulletIndex, 1); globalMutate(RESUME_KEY, updated, false) }
    },
    [resume]
  )

  const addExperience = useCallback(() => {
    if (!resume) return
    const updated = structuredClone(resume)
    updated.experience.push({ id: generateId(), company: "Company", role: "Role", dates: "Start - End", bullets: [""] })
    if (!updated.sectionOrder.includes("experience")) updated.sectionOrder.push("experience")
    globalMutate(RESUME_KEY, updated, false)
  }, [resume])

  const removeExperience = useCallback(
    (expId: string) => {
      if (!resume) return
      const updated = structuredClone(resume)
      updated.experience = updated.experience.filter((e) => e.id !== expId)
      globalMutate(RESUME_KEY, updated, false)
    },
    [resume]
  )

  // ── Skills (categorized) ──────────────────────────────────────
  const addSkillCategory = useCallback(
    (label = "Skills") => {
      if (!resume) return
      const updated = structuredClone(resume)
      updated.skills.push({ id: generateId(), label, skills: [] })
      if (!updated.sectionOrder.includes("skills")) updated.sectionOrder.push("skills")
      globalMutate(RESUME_KEY, updated, false)
    },
    [resume]
  )

  const removeSkillCategory = useCallback(
    (id: string) => {
      if (!resume) return
      const updated = structuredClone(resume)
      updated.skills = updated.skills.filter((c) => c.id !== id)
      globalMutate(RESUME_KEY, updated, false)
    },
    [resume]
  )

  const addSkillToCategory = useCallback(
    (categoryId: string, skill: string) => {
      if (!resume) return
      const updated = structuredClone(resume)
      const cat = updated.skills.find((c) => c.id === categoryId)
      if (cat) { cat.skills.push(skill); globalMutate(RESUME_KEY, updated, false) }
    },
    [resume]
  )

  const removeSkillFromCategory = useCallback(
    (categoryId: string, index: number) => {
      if (!resume) return
      const updated = structuredClone(resume)
      const cat = updated.skills.find((c) => c.id === categoryId)
      if (cat) { cat.skills.splice(index, 1); globalMutate(RESUME_KEY, updated, false) }
    },
    [resume]
  )

  // ── Education ─────────────────────────────────────────────────
  const addEducation = useCallback(() => {
    if (!resume) return
    const updated = structuredClone(resume)
    updated.education.push({ id: generateId(), institution: "University", degree: "Degree", dates: "Start - End", details: "" })
    if (!updated.sectionOrder.includes("education")) updated.sectionOrder.push("education")
    globalMutate(RESUME_KEY, updated, false)
  }, [resume])

  const removeEducation = useCallback(
    (eduId: string) => {
      if (!resume) return
      const updated = structuredClone(resume)
      updated.education = updated.education.filter((e) => e.id !== eduId)
      globalMutate(RESUME_KEY, updated, false)
    },
    [resume]
  )

  // ── Projects ──────────────────────────────────────────────────
  const addProject = useCallback(() => {
    if (!resume) return
    const updated = structuredClone(resume)
    updated.projects.push({ id: generateId(), name: "Project Name", description: "", dates: "", bullets: [""] })
    if (!updated.sectionOrder.includes("projects")) updated.sectionOrder.push("projects")
    globalMutate(RESUME_KEY, updated, false)
  }, [resume])

  const removeProject = useCallback(
    (id: string) => {
      if (!resume) return
      const updated = structuredClone(resume)
      updated.projects = updated.projects.filter((p) => p.id !== id)
      globalMutate(RESUME_KEY, updated, false)
    },
    [resume]
  )

  const addProjectBullet = useCallback(
    (projectId: string) => {
      if (!resume) return
      const updated = structuredClone(resume)
      const proj = updated.projects.find((p) => p.id === projectId)
      if (proj) { proj.bullets.push(""); globalMutate(RESUME_KEY, updated, false) }
    },
    [resume]
  )

  const removeProjectBullet = useCallback(
    (projectId: string, bulletIndex: number) => {
      if (!resume) return
      const updated = structuredClone(resume)
      const proj = updated.projects.find((p) => p.id === projectId)
      if (proj) { proj.bullets.splice(bulletIndex, 1); globalMutate(RESUME_KEY, updated, false) }
    },
    [resume]
  )

  // ── Certifications ────────────────────────────────────────────
  const addCertification = useCallback(() => {
    if (!resume) return
    const updated = structuredClone(resume)
    updated.certifications.push({ id: generateId(), name: "Certification", issuer: "Issuer", date: "", details: "" })
    if (!updated.sectionOrder.includes("certifications")) updated.sectionOrder.push("certifications")
    globalMutate(RESUME_KEY, updated, false)
  }, [resume])

  const removeCertification = useCallback(
    (id: string) => {
      if (!resume) return
      const updated = structuredClone(resume)
      updated.certifications = updated.certifications.filter((c) => c.id !== id)
      globalMutate(RESUME_KEY, updated, false)
    },
    [resume]
  )

  // ── Awards ────────────────────────────────────────────────────
  const addAward = useCallback(() => {
    if (!resume) return
    const updated = structuredClone(resume)
    updated.awards.push({ id: generateId(), name: "Award Name", description: "", date: "" })
    if (!updated.sectionOrder.includes("awards")) updated.sectionOrder.push("awards")
    globalMutate(RESUME_KEY, updated, false)
  }, [resume])

  const removeAward = useCallback(
    (id: string) => {
      if (!resume) return
      const updated = structuredClone(resume)
      updated.awards = updated.awards.filter((a) => a.id !== id)
      globalMutate(RESUME_KEY, updated, false)
    },
    [resume]
  )

  // ── Publications ──────────────────────────────────────────────
  const addPublication = useCallback(() => {
    if (!resume) return
    const updated = structuredClone(resume)
    updated.publications.push({ id: generateId(), title: "Publication Title", venue: "Journal / Conference", date: "", description: "" })
    if (!updated.sectionOrder.includes("publications")) updated.sectionOrder.push("publications")
    globalMutate(RESUME_KEY, updated, false)
  }, [resume])

  const removePublication = useCallback(
    (id: string) => {
      if (!resume) return
      const updated = structuredClone(resume)
      updated.publications = updated.publications.filter((p) => p.id !== id)
      globalMutate(RESUME_KEY, updated, false)
    },
    [resume]
  )

  // ── Chat / JD / Highlights ────────────────────────────────────
  const setJobDescription = useCallback((jd: string) => {
    globalMutate(JD_KEY, jd, false)
  }, [])

  const addChatMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      const msg: ChatMessage = { id: generateId(), role, content, timestamp: Date.now() }
      globalMutate(CHAT_KEY, (prev: ChatMessage[] | undefined) => [...(prev || []), msg], false)
    },
    []
  )

  const setHighlights = useCallback((h: HighlightedField[]) => {
    globalMutate(HIGHLIGHTS_KEY, h, false)
  }, [])

  const clearHighlights = useCallback(() => {
    globalMutate(HIGHLIGHTS_KEY, [], false)
  }, [])

  const setStatus = useCallback((s: WorkspaceStatus) => {
    globalMutate(STATUS_KEY, s, false)
  }, [])

  const loadSample = useCallback(() => {
    const sample = createSampleResume()
    globalMutate(RESUME_KEY, sample, false)
    globalMutate(STATUS_KEY, "loaded" as WorkspaceStatus, false)
    globalMutate(
      CHAT_KEY,
      (prev: ChatMessage[] | undefined) => [
        ...(prev || []),
        { id: generateId(), role: "assistant" as const, content: "I've loaded a sample resume. Edit any field directly, or paste a Job Description and ask me to tailor it.", timestamp: Date.now() },
      ],
      false
    )
  }, [])

  const resetAll = useCallback(() => {
    globalMutate(RESUME_KEY, createEmptyResume(), false)
    globalMutate(CHAT_KEY, [], false)
    globalMutate(JD_KEY, "", false)
    globalMutate(HIGHLIGHTS_KEY, [], false)
    globalMutate(STATUS_KEY, "empty" as WorkspaceStatus, false)
    clearMasterProfile()
    if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY)
  }, [])

  const value = useMemo<ResumeStoreContextValue>(
    () => ({
      resume: resume!, chatMessages: chatMessages!, jobDescription: jobDescription!,
      highlights: highlights!, status: status!, templateId: templateId!, accentColor: accentColor!,
      setResume, updateField, addSection, removeSection, moveSectionUp, moveSectionDown,
      addExperienceBullet, removeExperienceBullet, addExperience, removeExperience,
      addSkillCategory, removeSkillCategory, addSkillToCategory, removeSkillFromCategory,
      addEducation, removeEducation,
      addProject, removeProject, addProjectBullet, removeProjectBullet,
      addCertification, removeCertification, addAward, removeAward,
      addPublication, removePublication,
      setJobDescription, addChatMessage, setHighlights, clearHighlights,
      setTemplateId, setAccentColor, getMaster, setStatus, loadSample, resetAll,
    }),
    [
      resume, chatMessages, jobDescription, highlights, status, templateId, accentColor,
      setResume, updateField, addSection, removeSection, moveSectionUp, moveSectionDown,
      addExperienceBullet, removeExperienceBullet, addExperience, removeExperience,
      addSkillCategory, removeSkillCategory, addSkillToCategory, removeSkillFromCategory,
      addEducation, removeEducation,
      addProject, removeProject, addProjectBullet, removeProjectBullet,
      addCertification, removeCertification, addAward, removeAward,
      addPublication, removePublication,
      setJobDescription, addChatMessage, setHighlights, clearHighlights,
      setTemplateId, setAccentColor, getMaster, setStatus, loadSample, resetAll,
    ]
  )

  return (
    <ResumeStoreContext.Provider value={value}>
      {children}
    </ResumeStoreContext.Provider>
  )
}

export function useResumeStore() {
  const ctx = useContext(ResumeStoreContext)
  if (!ctx) throw new Error("useResumeStore must be used within ResumeStoreProvider")
  return ctx
}
