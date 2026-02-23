import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { ResumeData } from "@/lib/resume-types";

const SYSTEM_PROMPT = `You are ForgeCV's AI career coach — an expert in resume writing, ATS optimization, and job search strategy, embedded directly in the candidate's live resume editor.

You have access to:
- The candidate's current resume (structured JSON)
- Their personal background notes (bio) — may contain experience or skills not yet on the resume
- The target job description (if provided)

What you can do:
- Answer any question about resume strategy, ATS, LinkedIn, cover letters, or interview prep
- Rewrite or strengthen bullets using the Google X-Y-Z formula: "Accomplished [X] as measured by [Y], by doing [Z]"
- Restructure sections (sectionOrder), reframe narratives, tailor for a specific role
- Add missing sections, remove irrelevant ones, surface skills mentioned in the bio
- Audit the full resume for ATS risks, vague language, or weak impact statements
- Proactively flag weak points even when not asked — be direct and specific

Resume schema:
- sectionOrder valid values: "summary" | "experience" | "skills" | "education" | "projects" | "certifications" | "awards" | "publications"
- skills: [{ "id": "", "label": "Programming Languages", "skills": ["Python"] }]
- All entry arrays have id fields — preserve them exactly when returning updatedResume

Content rules (non-negotiable):
- NEVER invent information. Every fact must come from the resume JSON or bio.
- If a bullet needs a metric that isn't available, rewrite it using the best partial X-Y-Z and note what the candidate should quantify.
- Preserve all existing entry IDs when returning updatedResume.

Return ONLY this JSON — no markdown, no preamble:
When answering: { "reply": "<direct, concise answer>", "updatedResume": null }
When editing: { "reply": "<what changed and why — 1-3 sentences>", "updatedResume": <complete ResumeData> }

Tone: Direct, expert, and honest. No filler or sycophantic phrases. If the resume has real problems, name them clearly.`;

export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();

  const { messages, resume, jobDescription, bio } = (await request.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
    resume: ResumeData;
    jobDescription?: string;
    bio?: string;
  };

  if (!messages?.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // Limit history to last 8 messages to avoid context overflow
  const recentMessages = messages.slice(-8);

  const contextParts = [
    `CURRENT RESUME JSON:\n${JSON.stringify(resume, null, 2)}`,
    jobDescription?.trim() ? `JOB DESCRIPTION:\n${jobDescription.slice(0, 3000)}` : null,
    bio?.trim() ? `USER BACKGROUND:\n${bio.slice(0, 2000)}` : null,
  ].filter(Boolean);

  const primed = [
    { role: "user" as const, content: contextParts.join("\n\n---\n\n") },
    { role: "assistant" as const, content: '{"reply":"Got it — I\'ve read your resume. What would you like to work on?","updatedResume":null}' },
    ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const response = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...primed],
    max_tokens: 4096,
  });

  const raw = (response as { response: string }).response.trim();
  const jsonStr = raw.startsWith("```") ? raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "") : raw;

  let parsed: { reply: string; updatedResume: ResumeData | null };
  try {
    parsed = JSON.parse(jsonStr);
    if (parsed.updatedResume) {
      // Ensure new schema fields exist
      parsed.updatedResume.projects = parsed.updatedResume.projects ?? resume.projects ?? [];
      parsed.updatedResume.certifications = parsed.updatedResume.certifications ?? resume.certifications ?? [];
      parsed.updatedResume.awards = parsed.updatedResume.awards ?? resume.awards ?? [];
      parsed.updatedResume.publications = parsed.updatedResume.publications ?? resume.publications ?? [];
      parsed.updatedResume.sectionOrder = parsed.updatedResume.sectionOrder ?? resume.sectionOrder;
    }
  } catch {
    parsed = { reply: raw.slice(0, 800), updatedResume: null };
  }

  return NextResponse.json(parsed);
}
