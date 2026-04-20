export interface AirJsonPayload {
  jsonText: string;
  extracted: boolean;
}

function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function extractAirJsonPayload(rawText: string): AirJsonPayload | null {
  const normalized = rawText.replace(/^\uFEFF/, "").trim();
  if (!normalized) {
    return null;
  }

  if (isValidJson(normalized)) {
    return {
      jsonText: normalized,
      extracted: normalized !== rawText,
    };
  }

  const objectStart = normalized.indexOf("{");
  const arrayStart = normalized.indexOf("[");
  const candidates = [objectStart, arrayStart].filter((value) => value >= 0);
  if (candidates.length === 0) {
    return null;
  }

  const startIndex = Math.min(...candidates);
  const opener = normalized[startIndex];
  const closer = opener === "[" ? "]" : "}";
  const endIndex = normalized.lastIndexOf(closer);

  if (endIndex <= startIndex) {
    return null;
  }

  const jsonText = normalized.slice(startIndex, endIndex + 1).trim();
  if (!jsonText || !isValidJson(jsonText)) {
    return null;
  }

  return {
    jsonText,
    extracted: true,
  };
}
