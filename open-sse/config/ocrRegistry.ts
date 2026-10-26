/**
 * OCR Provider Registry
 *
 * Defines providers that support the /v1/ocr endpoint.
 * Supports local models (GLM-OCR, DeepSeek-OCR2, GOT-OCR2) alongside cloud providers.
 * Enforces dynamic routing: best and cheapest model wins.
 */

export interface OcrModel {
  id: string;
  name: string;
  costPerPageUsd: number;
  isLocal: boolean;
  priority: number;
}

export interface OcrProvider {
  id: string;
  baseUrl: string;
  authType: "apikey" | "bearer" | "none";
  authHeader: string;
  models: OcrModel[];
}

export interface ParsedOcrModel {
  provider: string | null;
  model: string | null;
}

export const OCR_PROVIDERS: Record<string, OcrProvider> = {
  local: {
    id: "local",
    baseUrl: process.env.LOCAL_OCR_URL || "http://127.0.0.1:8117/v1/ocr",
    authType: "none",
    authHeader: "none",
    models: [
      { id: "glm-ocr", name: "GLM-OCR (Local)", costPerPageUsd: 0.0, isLocal: true, priority: 1 },
      { id: "deepseek-ocr2", name: "DeepSeek-OCR2 (Local)", costPerPageUsd: 0.0, isLocal: true, priority: 2 },
      { id: "got-ocr2", name: "GOT-OCR2 (Local)", costPerPageUsd: 0.0, isLocal: true, priority: 3 },
    ],
  },
  mistral: {
    id: "mistral",
    baseUrl: "https://api.mistral.ai/v1/ocr",
    authType: "apikey",
    authHeader: "bearer",
    models: [
      { id: "mistral-ocr-latest", name: "Mistral OCR", costPerPageUsd: 0.001, isLocal: false, priority: 10 },
    ],
  },
};

/**
 * Get OCR provider config by ID.
 */
export function getOcrProvider(providerId: string): OcrProvider | null {
  return OCR_PROVIDERS[providerId] || null;
}

/**
 * Dynamic resolution: best and cheapest model wins.
 * Prioritizes local, zero-cost, privacy-first models when available.
 */
export function resolveBestOcrModel(options: { preferLocal?: boolean } = {}): ParsedOcrModel {
  const preferLocal = options.preferLocal !== false;
  const allModels: Array<{ provider: string; model: string; cost: number; isLocal: boolean; priority: number }> = [];

  for (const [providerId, config] of Object.entries(OCR_PROVIDERS)) {
    for (const m of config.models) {
      allModels.push({
        provider: providerId,
        model: m.id,
        cost: m.costPerPageUsd,
        isLocal: m.isLocal,
        priority: m.priority,
      });
    }
  }

  // Sort criteria:
  // 1. preferLocal: local models first if preferLocal is true
  // 2. Lowest cost ($0.00 wins)
  // 3. Model priority rank
  allModels.sort((a, b) => {
    if (preferLocal && a.isLocal !== b.isLocal) {
      return a.isLocal ? -1 : 1;
    }
    if (a.cost !== b.cost) {
      return a.cost - b.cost;
    }
    return a.priority - b.priority;
  });

  const best = allModels[0];
  return {
    provider: best?.provider || "local",
    model: best?.model || "glm-ocr",
  };
}

/**
 * Parse an OCR model string.
 *
 * Accepts either a "provider/model" prefixed string or a bare model id that
 * matches one of the registered OCR models.
 */
export function parseOcrModel(modelStr: string | null | undefined): ParsedOcrModel {
  if (!modelStr || modelStr === "auto" || modelStr === "default") {
    return resolveBestOcrModel();
  }

  for (const providerId of Object.keys(OCR_PROVIDERS)) {
    if (modelStr.startsWith(providerId + "/")) {
      return { provider: providerId, model: modelStr.slice(providerId.length + 1) };
    }
  }

  for (const [providerId, config] of Object.entries(OCR_PROVIDERS)) {
    if (config.models.some((m) => m.id === modelStr)) {
      return { provider: providerId, model: modelStr };
    }
  }

  return { provider: null, model: modelStr };
}

/**
 * Get all OCR models as a flat list.
 */
export function getAllOcrModels(): Array<{ id: string; name: string; provider: string; costPerPageUsd: number; isLocal: boolean }> {
  const models: Array<{ id: string; name: string; provider: string; costPerPageUsd: number; isLocal: boolean }> = [];
  for (const [providerId, config] of Object.entries(OCR_PROVIDERS)) {
    for (const model of config.models) {
      models.push({
        id: `${providerId}/${model.id}`,
        name: model.name,
        provider: providerId,
        costPerPageUsd: model.costPerPageUsd,
        isLocal: model.isLocal,
      });
    }
  }
  return models;
}
