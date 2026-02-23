import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { ResumeData } from "@/lib/resume-types";
import { migrateResumeData } from "@/lib/resume-types";

// Max chars to send to the model — prevents 1031 "input too large" errors
const MAX_INPUT_CHARS = 10_000;

const SYSTEM_PROMPT = `You are an expert resume parser. Convert raw resume text into a structured JSON object.

CRITICAL RULES — violating these is a failure:
1. NEVER invent, guess, or fabricate ANY information not present in the source text.
2. Extract ONLY what is explicitly written. Missing fields → "" or [].
3. Copy bullet points verbatim. Normalize whitespace and bullet punctuation (–, —, •) to a plain hyphen, but change nothing else.
4. Extract ALL experience entries, ALL education, ALL skills — do not truncate.
5. Use sectionOrder to reflect the actual order sections appear in the resume.
6. Add a section to sectionOrder ONLY if it appears in the source text.
7. Generate short (6-char) random alphanumeric IDs for all entries.
8. Copy dates exactly as written — do not normalize or reformat.

SKILLS FORMAT:
- Group skills into focused, granular categories that reflect the source text.
- Prefer specific labels ("Databases", "Cloud & DevOps", "Testing") over large catch-alls ("Tools").
- Only create a category if it has at least one skill. Each category gets a unique id.
- The category labels below are examples only — use whatever grouping best fits the resume:
  "Programming Languages", "Frameworks & Libraries", "Cloud & DevOps", "Databases", "Testing", "Soft Skills"

Return ONLY this JSON — no markdown, no explanation:
{
  "contact": { "name": "", "title": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "" },
  "summary": "",
  "sectionOrder": ["summary", "experience", "skills", "education"],
  "experience": [{ "id": "", "company": "", "role": "", "location": "", "dates": "", "bullets": [] }],
  "skills": [{ "id": "", "label": "Programming Languages", "skills": [] }],
  "education": [{ "id": "", "institution": "", "degree": "", "dates": "", "details": "" }],
  "projects": [{ "id": "", "name": "", "description": "", "dates": "", "bullets": [] }],
  "certifications": [{ "id": "", "name": "", "issuer": "", "date": "", "details": "" }],
  "awards": [{ "id": "", "name": "", "description": "", "date": "" }],
  "publications": [{ "id": "", "title": "", "venue": "", "date": "", "description": "" }]
}

sectionOrder valid values: "summary" | "experience" | "skills" | "education" | "projects" | "certifications" | "awards" | "publications"
contact.title: the professional headline or title as it appears in the resume header only — leave empty if not stated there.`;

export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();

  const { text } = (await request.json()) as { text: string };

  if (!text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  // Truncate to avoid 1031 "input too large" from Workers AI
  const truncated = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

  const response = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Parse this resume text:\n\n${truncated}` },
    ],
    max_tokens: 4096,
  });

  const raw = (response as { response: string }).response.trim();
  const jsonStr = raw.startsWith("```") ? raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "") : raw;

  let resume: ResumeData;
  try {
    // migrateResumeData handles missing fields AND migrates old flat skills string[] → SkillCategory[]
    resume = migrateResumeData(JSON.parse(jsonStr));
  } catch {
    return NextResponse.json({ error: "AI returned malformed JSON", raw }, { status: 500 });
  }

  return NextResponse.json({ resume });
}
