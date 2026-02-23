export interface ResumeTemplate {
  id: string
  name: string
  /** Short description shown in picker */
  description: string
  /** Font stack applied to the resume container in the live canvas */
  fontFamily: string
  /** Tailwind classes for the candidate name */
  nameClass: string
  /** Tailwind classes for section headings */
  headingClass: string
  /** Primary text color used for the name (hex) */
  textColor: string
  /** Whether this template supports a user-chosen accent color */
  supportsAccent?: boolean
  /** Default accent hex (used when supportsAccent is true) */
  defaultAccent?: string
  /**
   * CSS injected into the <style> block of the print/export HTML.
   * Use {{ACCENT}} as a placeholder — it will be replaced with the live accent color.
   */
  printCss: string
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  /* ─── 1. Harvard ─── Calibri, centered header, hairline rules ─── */
  {
    id: "harvard",
    name: "Harvard",
    description: "Calibri, centered header with hairline rules — the classic academic standard.",
    fontFamily: "Calibri, 'Gill Sans MT', 'Trebuchet MS', sans-serif",
    nameClass: "text-[24px] font-bold tracking-tight text-center w-full",
    headingClass:
      "text-[9px] font-bold uppercase tracking-[2px] border-t border-black/30 pt-1 w-full",
    textColor: "#111111",
    printCss: `
      body { font-family: Calibri, 'Gill Sans MT', sans-serif; font-size: 10.5pt; line-height: 1.45; color: #111; }
      .header { text-align: center; margin-bottom: 8pt; }
      h1 { font-size: 20pt; font-weight: 700; }
      .contact-line { font-size: 9pt; color: #444; margin-top: 2pt; }
      h2 { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5pt;
           border-top: 0.75pt solid #111; padding-top: 3pt; margin: 12pt 0 5pt; }
      .job-header { display: flex; justify-content: space-between; align-items: baseline; }
      h3 { font-size: 10.5pt; font-weight: 600; }
      .dates { font-size: 9.5pt; color: #444; }
      ul { padding-left: 16pt; margin: 3pt 0; }
      li { margin-bottom: 2pt; }
      .skills-line { margin-bottom: 3pt; font-size: 10pt; }
      .skills-label { font-weight: 600; }
    `,
  },

  /* ─── 2. Rezi Classic ─── Georgia, dark navy, ALL CAPS rules, · bullets ─── */
  {
    id: "rezi",
    name: "Rezi",
    description: "Georgia serif, dark navy headings, ATS-optimized — great for corporate roles.",
    fontFamily: "Georgia, 'Times New Roman', serif",
    nameClass: "text-[22px] font-bold tracking-tight",
    headingClass:
      "text-[9px] font-bold uppercase tracking-[2px] border-b border-[#c8c8c8] pb-0.5 w-full",
    textColor: "#1a1a2e",
    printCss: `
      body { font-family: Georgia, 'Times New Roman', serif; font-size: 10.5pt; line-height: 1.45; color: #111; }
      h1 { font-size: 20pt; font-weight: 700; color: #1a1a2e; margin-bottom: 2pt; }
      .contact-line { font-size: 9pt; color: #444; margin-bottom: 8pt; }
      h2 { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5pt;
           color: #1a1a2e; border-bottom: 0.75pt solid #c8c8c8; padding-bottom: 2pt; margin: 13pt 0 5pt; }
      .job-meta { font-size: 10pt; margin-bottom: 3pt; }
      .job-role { font-weight: 600; }
      ul { list-style: none; padding-left: 12pt; margin: 3pt 0; }
      li { margin-bottom: 2pt; }
      li::before { content: '·'; margin-right: 5pt; font-size: 13pt; line-height: 0; vertical-align: middle; }
      .skills-line { margin-bottom: 3pt; font-size: 10pt; }
      .skills-label { font-weight: 700; }
      .dates-meta { font-size: 9.5pt; color: #555; }
    `,
  },

  /* ─── 3. Rezi+ ─── Same as Rezi but with user-customizable accent color ─── */
  {
    id: "rezi-colored",
    name: "Rezi+",
    description: "Rezi with an accent color on the name and role titles. Pick your color.",
    fontFamily: "Georgia, 'Times New Roman', serif",
    nameClass: "text-[22px] font-bold tracking-tight",
    headingClass:
      "text-[9px] font-bold uppercase tracking-[2px] border-b border-[#c8c8c8] pb-0.5 w-full",
    textColor: "#5B6FA6",
    supportsAccent: true,
    defaultAccent: "#5B6FA6",
    printCss: `
      body { font-family: Georgia, 'Times New Roman', serif; font-size: 10.5pt; line-height: 1.45; color: #111; }
      h1 { font-size: 20pt; font-weight: 700; color: {{ACCENT}}; margin-bottom: 2pt; }
      .contact-line { font-size: 9pt; color: #444; margin-bottom: 8pt; }
      h2 { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5pt;
           color: #1a1a2e; border-bottom: 0.75pt solid #c8c8c8; padding-bottom: 2pt; margin: 13pt 0 5pt; }
      .job-meta { font-size: 10pt; margin-bottom: 3pt; }
      .job-role { font-weight: 600; color: {{ACCENT}}; }
      ul { list-style: none; padding-left: 12pt; margin: 3pt 0; }
      li { margin-bottom: 2pt; }
      li::before { content: '·'; margin-right: 5pt; font-size: 13pt; line-height: 0; vertical-align: middle; }
      .skills-line { margin-bottom: 3pt; font-size: 10pt; }
      .skills-label { font-weight: 700; }
      .dates-meta { font-size: 9.5pt; color: #555; }
    `,
  },
]

export const DEFAULT_TEMPLATE_ID = "harvard"

export function getTemplate(id: string): ResumeTemplate {
  return RESUME_TEMPLATES.find((t) => t.id === id) ?? RESUME_TEMPLATES[0]
}
