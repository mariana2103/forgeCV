import type { ResumeData, ExperienceEntry, EducationEntry, ProjectEntry, SkillCategory } from "./resume-types"
import { migrateResumeData, generateId } from "./resume-types"

const MASTER_KEY = "forgecv-master-profile"

export function getMasterProfile(): ResumeData | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(MASTER_KEY)
    if (!raw) return null
    return migrateResumeData(JSON.parse(raw) as Partial<ResumeData>)
  } catch {
    return null
  }
}

export function saveMasterProfile(data: ResumeData): void {
  if (typeof window === "undefined") return
  localStorage.setItem(MASTER_KEY, JSON.stringify(data))
}

export function clearMasterProfile(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(MASTER_KEY)
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "").trim()
}

function mergeById<T>(
  master: T[],
  incoming: T[],
  isSame: (a: T, b: T) => boolean
): T[] {
  const result = [...master]
  for (const entry of incoming) {
    if (!result.some((e) => isSame(e, entry))) result.push(entry)
  }
  return result
}

/**
 * Merge a newly-uploaded resume into the existing master profile.
 * Contact, skills, experience, education, projects, certifications, awards,
 * publications are all merged and deduplicated.
 */
export function mergeIntoMaster(
  master: ResumeData | null,
  incoming: ResumeData
): ResumeData {
  if (!master) return incoming

  const contact = { ...master.contact }
  for (const k of Object.keys(incoming.contact) as (keyof typeof incoming.contact)[]) {
    if (incoming.contact[k]) contact[k] = incoming.contact[k]
  }

  // Keep master section order, append any new sections from incoming
  const mergedOrder = [...master.sectionOrder]
  for (const key of incoming.sectionOrder) {
    if (!mergedOrder.includes(key)) mergedOrder.push(key)
  }

  // Merge skill categories: same label → merge skills within; new label → append
  const mergedSkills: SkillCategory[] = master.skills.map((c) => ({
    ...c, skills: [...c.skills],
  }))
  for (const inCat of incoming.skills) {
    const existing = mergedSkills.find(
      (c) => normalize(c.label) === normalize(inCat.label)
    )
    if (existing) {
      const lower = new Set(existing.skills.map((s) => s.toLowerCase()))
      for (const s of inCat.skills) {
        if (!lower.has(s.toLowerCase())) { existing.skills.push(s); lower.add(s.toLowerCase()) }
      }
    } else {
      mergedSkills.push({ ...inCat, id: inCat.id || generateId() })
    }
  }

  return {
    contact,
    summary: incoming.summary || master.summary,
    sectionOrder: mergedOrder,
    experience: mergeById(master.experience, incoming.experience,
      (a: ExperienceEntry, b: ExperienceEntry) =>
        normalize(a.company) === normalize(b.company) &&
        normalize(a.role) === normalize(b.role)
    ),
    skills: mergedSkills,
    education: mergeById(master.education, incoming.education,
      (a: EducationEntry, b: EducationEntry) =>
        normalize(a.institution) === normalize(b.institution)
    ),
    projects: mergeById(master.projects, incoming.projects,
      (a: ProjectEntry, b: ProjectEntry) =>
        normalize(a.name) === normalize(b.name)
    ),
    certifications: mergeById(master.certifications, incoming.certifications,
      (a, b) => normalize(a.name) === normalize(b.name)
    ),
    awards: mergeById(master.awards, incoming.awards,
      (a, b) => normalize(a.name) === normalize(b.name)
    ),
    publications: mergeById(master.publications, incoming.publications,
      (a, b) => normalize(a.title) === normalize(b.title)
    ),
  }
}
