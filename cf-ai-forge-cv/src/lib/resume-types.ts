export interface ResumeContact {
  name: string
  title: string
  email: string
  phone: string
  location: string
  linkedin: string
  github: string
}

export interface SkillCategory {
  id: string
  label: string   // e.g. "Programming Languages", "Frameworks & Tools"
  skills: string[]
}

export interface ExperienceEntry {
  id: string
  company: string
  role: string
  location?: string  // e.g. "London, UK" or "Remote"
  dates: string
  bullets: string[]
}

export interface EducationEntry {
  id: string
  institution: string
  degree: string
  dates: string
  details: string
}

export interface ProjectEntry {
  id: string
  name: string
  description: string
  dates: string
  bullets: string[]
}

export interface CertificationEntry {
  id: string
  name: string
  issuer: string
  date: string
  details: string
}

export interface AwardEntry {
  id: string
  name: string
  description: string
  date: string
}

export interface PublicationEntry {
  id: string
  title: string
  venue: string
  date: string
  description: string
}

/** Controls which sections are present and in what order */
export type SectionKey =
  | "summary"
  | "experience"
  | "skills"
  | "education"
  | "projects"
  | "certifications"
  | "awards"
  | "publications"

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  projects: "Projects",
  certifications: "Certifications",
  awards: "Awards",
  publications: "Publications",
}

export interface ResumeData {
  contact: ResumeContact
  summary: string
  /** Ordered list of section keys — controls rendering order */
  sectionOrder: SectionKey[]
  experience: ExperienceEntry[]
  /** Categorized skills — each category has a label and a list of skill strings */
  skills: SkillCategory[]
  education: EducationEntry[]
  projects: ProjectEntry[]
  certifications: CertificationEntry[]
  awards: AwardEntry[]
  publications: PublicationEntry[]
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
}

export interface HighlightedField {
  path: string
  type: "changed" | "added" | "removed"
}

/** Convert old flat string[] skills to SkillCategory[], or validate new format */
function migrateSkills(raw: unknown): SkillCategory[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  // Old format: string[]
  if (typeof raw[0] === "string") {
    return [{ id: "skills-general", label: "Skills", skills: raw as string[] }]
  }
  // New format: SkillCategory[]
  return (raw as SkillCategory[]).map((cat) => ({
    id: cat.id || generateId(),
    label: cat.label || "Skills",
    skills: Array.isArray(cat.skills) ? cat.skills.filter(Boolean) : [],
  }))
}

export function migrateResumeData(raw: Partial<ResumeData>): ResumeData {
  return {
    contact: raw.contact ?? {
      name: "", title: "", email: "", phone: "", location: "", linkedin: "", github: "",
    },
    summary: raw.summary ?? "",
    sectionOrder: (raw.sectionOrder as SectionKey[] | undefined) ??
      ["summary", "experience", "skills", "education"],
    experience: raw.experience ?? [],
    skills: migrateSkills(raw.skills),
    education: raw.education ?? [],
    projects: raw.projects ?? [],
    certifications: raw.certifications ?? [],
    awards: raw.awards ?? [],
    publications: raw.publications ?? [],
  }
}

export function createEmptyResume(): ResumeData {
  return {
    contact: { name: "", title: "", email: "", phone: "", location: "", linkedin: "", github: "" },
    summary: "",
    sectionOrder: ["summary", "experience", "skills", "education"],
    experience: [],
    skills: [],
    education: [],
    projects: [],
    certifications: [],
    awards: [],
    publications: [],
  }
}

export function createSampleResume(): ResumeData {
  return {
    contact: {
      name: "Alex Chen",
      title: "Senior Software Engineer",
      email: "alex.chen@email.com",
      phone: "(555) 123-4567",
      location: "San Francisco, CA",
      linkedin: "linkedin.com/in/alexchen",
      github: "github.com/alexchen",
    },
    summary:
      "Software engineer with 6+ years of experience building scalable distributed systems and cloud-native applications. Proven track record designing high-throughput microservices handling 10M+ daily requests.",
    sectionOrder: ["summary", "experience", "skills", "education"],
    experience: [
      {
        id: "exp-1",
        company: "Acme Corp",
        role: "Senior Software Engineer",
        dates: "2022 - Present",
        bullets: [
          "Architected event-driven microservices processing 10M+ events/day using Kafka and Redis Streams, reducing end-to-end latency by 40%",
          "Led migration from monolith to Kubernetes-based architecture, improving deployment frequency from bi-weekly to multiple daily releases",
          "Designed distributed caching layer with Redis Cluster, achieving 99.95% cache hit rate and reducing database load by 60%",
          "Mentored team of 4 junior engineers through structured code reviews and weekly architecture sessions",
        ],
      },
      {
        id: "exp-2",
        company: "StartupXYZ",
        role: "Software Engineer",
        dates: "2019 - 2022",
        bullets: [
          "Built real-time data pipeline processing 2TB+ daily using Apache Flink and AWS Kinesis for analytics platform serving 500K users",
          "Implemented automated canary deployment pipeline reducing rollback incidents by 75% across 12 production services",
          "Developed internal CLI tooling in Go adopted by 30+ engineers, reducing average onboarding time by 40%",
        ],
      },
    ],
    skills: [
      { id: "skills-lang",  label: "Programming Languages", skills: ["Go", "TypeScript", "Python"] },
      { id: "skills-infra", label: "Cloud & Infrastructure",  skills: ["Kubernetes", "Docker", "Terraform", "AWS"] },
      { id: "skills-data",  label: "Databases & Messaging",  skills: ["PostgreSQL", "Redis", "Kafka"] },
      { id: "skills-tools", label: "Tools & Practices",      skills: ["CI/CD"] },
    ],
    education: [
      {
        id: "edu-1",
        institution: "MIT",
        degree: "B.S. Computer Science",
        dates: "2014 - 2018",
        details: "Dean's List, Teaching Assistant for Distributed Systems",
      },
    ],
    projects: [],
    certifications: [],
    awards: [],
    publications: [],
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}
