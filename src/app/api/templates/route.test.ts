import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTemplateStore,
  setDefaultTemplateStoreForTesting,
} from "@/lib/template-store";
import { GET, POST } from "./route";
import { BUILT_IN_TEMPLATES, type Template } from "@/lib/templates";

describe("/api/templates route handlers", () => {
  beforeEach(() => {
    setDefaultTemplateStoreForTesting(
      createTemplateStore({ filename: ":memory:" })
    );
  });

  afterEach(() => {
    setDefaultTemplateStoreForTesting(null);
  });

  it("GET returns the built-in templates when no user templates exist", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const { templates } = (await res.json()) as { templates: Template[] };
    expect(templates.map((t) => t.id)).toEqual(
      BUILT_IN_TEMPLATES.map((t) => t.id)
    );
    expect(templates.every((t) => t.builtIn)).toBe(true);
  });

  it("POST persists a user template and GET returns it after the built-ins", async () => {
    const create = await POST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({
          name: "Standup notes",
          bundle: {
            spec: {
              goal: "Daily standup",
              tone: "concise",
              audience: "team",
              mustInclude: ["yesterday"],
              mustAvoid: [],
            },
            outline: [
              {
                id: "y",
                heading: "Yesterday",
                description: "",
                required: true,
              },
            ],
            checks: [{ id: "c1", question: "What did you do yesterday?" }],
          },
        }),
      })
    );
    expect(create.status).toBe(201);
    const { template } = (await create.json()) as { template: Template };
    expect(template.id).toMatch(/^user-/);
    expect(template.name).toBe("Standup notes");
    expect(template.builtIn).toBe(false);

    const list = await GET();
    const { templates } = (await list.json()) as { templates: Template[] };
    // All built-ins, then the one we just saved.
    expect(templates).toHaveLength(BUILT_IN_TEMPLATES.length + 1);
    expect(templates[BUILT_IN_TEMPLATES.length].id).toBe(template.id);
  });

  it("POST round-trips spec/outline/checks bit-for-bit", async () => {
    // Acceptance criterion: "User-saved templates round-trip — saving and
    // re-loading produces the original Spec/Outline/Checks bit-for-bit."
    const bundle = {
      spec: {
        goal: "g",
        tone: "t",
        audience: "a",
        mustInclude: ["m1", "m2"],
        mustAvoid: ["x"],
      },
      outline: [
        { id: "s1", heading: "S1", description: "d1", required: true },
        { id: "s2", heading: "S2", description: "d2", required: false },
      ],
      checks: [
        { id: "c1", question: "Q1" },
        { id: "c2", question: "Q2" },
      ],
    };

    const create = await POST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ name: "RT", bundle }),
      })
    );
    const { template } = (await create.json()) as { template: Template };

    const list = await GET();
    const { templates } = (await list.json()) as { templates: Template[] };
    const fetched = templates.find((t) => t.id === template.id)!;
    expect(fetched.bundle).toEqual(bundle);
  });

  it("POST 400s when name is missing or blank", async () => {
    const noName = await POST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({
          bundle: {
            spec: {
              goal: "",
              tone: "",
              audience: "",
              mustInclude: [],
              mustAvoid: [],
            },
            outline: [],
            checks: [],
          },
        }),
      })
    );
    expect(noName.status).toBe(400);

    const blankName = await POST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({
          name: "   ",
          bundle: {
            spec: {
              goal: "",
              tone: "",
              audience: "",
              mustInclude: [],
              mustAvoid: [],
            },
            outline: [],
            checks: [],
          },
        }),
      })
    );
    expect(blankName.status).toBe(400);
  });

  it("POST 400s when bundle is missing or malformed", async () => {
    const noBundle = await POST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({ name: "x" }),
      })
    );
    expect(noBundle.status).toBe(400);

    const malformed = await POST(
      new Request("http://t/", {
        method: "POST",
        body: JSON.stringify({
          name: "x",
          bundle: { spec: {}, outline: "not-an-array", checks: [] },
        }),
      })
    );
    expect(malformed.status).toBe(400);
  });
});
