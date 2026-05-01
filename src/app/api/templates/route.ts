import { NextResponse } from "next/server";
import { getDefaultTemplateStore } from "@/lib/template-store";
import type { TemplateBundle } from "@/lib/templates";

// GET /api/templates → { templates }
//   Returns built-in templates + all user-saved templates in a single list,
//   in display order (built-ins first; user-saved newest first).
export async function GET() {
  const store = getDefaultTemplateStore();
  return NextResponse.json({ templates: store.list() });
}

interface SaveBody {
  name?: unknown;
  bundle?: unknown;
}

// POST /api/templates → { template }
//   Persists a user template captured via "Save as template". Built-in
//   templates live in code; this endpoint only ever creates user templates.
export async function POST(req: Request) {
  const body = (await req.json()) as SaveBody;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }
  const bundle = body.bundle as TemplateBundle | undefined;
  if (!bundle || !bundle.spec || !Array.isArray(bundle.outline) || !Array.isArray(bundle.checks)) {
    return NextResponse.json(
      { error: "bundle must include spec, outline[], and checks[]" },
      { status: 400 }
    );
  }
  const store = getDefaultTemplateStore();
  const template = store.saveUser(name, bundle);
  return NextResponse.json({ template }, { status: 201 });
}
