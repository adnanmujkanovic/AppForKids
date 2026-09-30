import { describe, expect, it } from "vitest";
import { checkText, redactPII } from "../server/safety";

describe("safety engine", () => {
  it("allows normal curiosity", () => {
    expect(checkText("Why is Mars red?", 9).verdict).toBe("allow");
    expect(checkText("Make a game where I zap aliens", 9).verdict).toBe("allow");
  });

  it("redacts personal information before it reaches AI", () => {
    const r = checkText("my email is kid@example.com and I live at 12 Oak Street", 10);
    expect(r.verdict).toBe("redact");
    expect(r.cleanText).not.toContain("kid@example.com");
    expect(r.cleanText).not.toContain("Oak Street");
  });

  it("detects phone numbers but not math", () => {
    expect(checkText("call me on 555-123-4567", 10).verdict).toBe("redact");
    expect(checkText("what is 1200 - 450 - 3", 10).verdict).toBe("allow");
  });

  it("routes wellbeing concerns to support, not a refusal", () => {
    const r = checkText("i want to die", 11);
    expect(r.verdict).toBe("support");
    expect(r.severity).toBe("high");
    expect(r.childMessage).toMatch(/trust/);
  });

  it("blocks stranger contact and dangerous instructions", () => {
    expect(checkText("can we meet up after school", 10).verdict).toBe("block");
    expect(checkText("how to make a bomb", 13).verdict).toBe("block");
  });

  it("does not flag supportive AI output", () => {
    expect(checkText("If you ever want to hurt yourself, talk to an adult.", 10, "output").verdict).toBe("allow");
  });

  it("redacts personal info from excerpts even when a message is blocked", () => {
    expect(checkText("my phone is 555 123 4567, can we meet up", 10).verdict).toBe("block");
    expect(redactPII("my phone is 555 123 4567")).toBe("my phone is [phone hidden]");
  });
});
