import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { ResumeData, HighlightedField } from "@/lib/resume-types";

const SYSTEM_PROMPT = `You are an expert resume tailoring agent and ATS optimization specialist. Rewrite the candidate's resume to closely match the job description while maximizing ATS pass-through rates and recruiter impact.

You have full control over:
- sectionOrder: reorder, add, or remove sections as needed for this role
- Content within each section
- Which experience entries, projects, certifications, awards, or publications to include

The resume schema supports these section types in sectionOrder:
"summary" | "experience" | "skills" | "education" | "projects" | "certifications" | "awards" | "publications"

You may also receive a masterProfile with the candidate's full career history. Select and adapt the most relevant entries.

---

STRICT CONTENT RULES — NON-NEGOTIABLE:
- Header (contact info) never changes.
- NEVER invent any information — no metrics, tools, outcomes, team sizes, dates, or responsibilities not explicitly present in the resume or masterProfile.
- You MAY reword and improve clarity, but every fact must be traceable to the source material.
- If a bullet would benefit from a metric that isn't in the source, do NOT guess. Instead, add a coachingNote in reasoning telling the candidate exactly what to find or quantify.
- Preserve all existing entry IDs when returning the tailored resume (the highlights system depends on them).

---

WRITING STANDARDS:

Google X-Y-Z Formula — write every bullet as:
  "Accomplished [X] as measured by [Y], by doing [Z]"
Use the best partial version when full data isn't available, and flag the gap via coachingNote.

ATS Optimization:
- Mirror exact keywords and phrases from the JD — don't paraphrase when the candidate's experience matches.
- Use standard section titles, spell out acronyms on first use, and avoid any formatting ATS parsers break on.

Prime Real Estate & Specificity:
- Lead with the strongest, most JD-relevant achievements. The top of the resume is the highest-value space.
- The summary must be specific and data-driven. Never use vague phrases like "passionate engineer with a love for great products." Answer: how many years? In what domain specifically? What have they built or achieved?
- If a statement could apply to any candidate in the field, rewrite it until it couldn't.

Skills (categorized arrays):
  skills = [{ "id": "", "label": "Programming Languages", "skills": ["Python"] }, ...]
- Reorder both the categories and the skills within each category so the most JD-relevant appear first.
- Keep categories focused and granular — prefer "Cloud & DevOps", "Databases", "Testing" over one giant "Tools" bucket.
- Only include skills relevant to this role.

Section Order: Only include sections relevant to the role. Lead with the most impactful.
Strong default for technical roles: Summary → Skills → Experience → Projects → Education → Certifications.

Page Length: The final resume must fit a single A4 page. Cut older or weaker entries ruthlessly — quality over quantity.

---

Return ONLY this JSON — no markdown, no commentary:
{
  "tailored": <full updated ResumeData>,
  "highlights": [{ "path": "<dot-notation path>", "type": "changed" }],
  "reasoning": [{ "section": "<section>", "change": "<what changed>", "why": "<why it helps>", "coachingNote": "<only include this key when source data is missing — tell the candidate exactly what metric or detail to find>" }]
}`;

export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();

  const { resume, jobDescription, masterProfile } = (await request.json()) as {
    resume: ResumeData;
    jobDescription: string;
    masterProfile?: ResumeData | null;
  };

  if (!resume || !jobDescription?.trim()) {
    return NextResponse.json({ error: "resume and jobDescription are required" }, { status: 400 });
  }

  const masterSection = masterProfile
    ? `\n\nMASTER PROFILE (full career history — select the most relevant entries):\n${JSON.stringify(masterProfile, null, 2)}`
    : "";

  // Truncate JD to avoid input overflow
  const jd = jobDescription.length > 5000 ? jobDescription.slice(0, 5000) : jobDescription;
  const userMessage = `RESUME:\n${JSON.stringify(resume, null, 2)}\n\nJOB DESCRIPTION:\n${jd}${masterSection}`;

  const response = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    max_tokens: 4096,
  });

  const raw = (response as { response: string }).response.trim();
  const jsonStr = raw.startsWith("```") ? raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "") : raw;

  let parsed: { tailored: ResumeData; highlights: HighlightedField[]; reasoning: { section: string; change: string; why: string }[] };
  try {
    parsed = JSON.parse(jsonStr);
    // Ensure required arrays exist on tailored resume
    parsed.tailored.projects = parsed.tailored.projects ?? resume.projects ?? [];
    parsed.tailored.certifications = parsed.tailored.certifications ?? resume.certifications ?? [];
    parsed.tailored.awards = parsed.tailored.awards ?? resume.awards ?? [];
    parsed.tailored.publications = parsed.tailored.publications ?? resume.publications ?? [];
    parsed.tailored.sectionOrder = parsed.tailored.sectionOrder ?? resume.sectionOrder;
  } catch {
    return NextResponse.json({ error: "AI returned malformed JSON", raw }, { status: 500 });
  }

  return NextResponse.json(parsed);
}
