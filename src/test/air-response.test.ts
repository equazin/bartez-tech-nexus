import { describe, expect, it } from "vitest";

import { extractAirJsonPayload } from "@/lib/suppliers/air/response";

describe("extractAirJsonPayload", () => {
  it("returns valid JSON unchanged", () => {
    const result = extractAirJsonPayload('{"ok":true}');

    expect(result).toEqual({
      jsonText: '{"ok":true}',
      extracted: false,
    });
  });

  it("strips leading PHP notices before a JSON array", () => {
    const raw = [
      "<br />",
      "<b>Notice</b>: Undefined property",
      '[{"codigo":"ABC","precio":10}]',
    ].join("\n");

    const result = extractAirJsonPayload(raw);

    expect(result).toEqual({
      jsonText: '[{"codigo":"ABC","precio":10}]',
      extracted: true,
    });
  });

  it("returns null when there is no JSON payload", () => {
    expect(extractAirJsonPayload("Redirecting...")).toBeNull();
  });
});
