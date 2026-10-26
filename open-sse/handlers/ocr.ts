import { CORS_HEADERS } from "../utils/cors.ts";
/**
 * OCR Handler
 *
 * Handles POST /v1/ocr (Mistral OCR API format).
 * Routes dynamically to best and cheapest provider (Local GLM-OCR or Cloud).
 */

import { getOcrProvider, parseOcrModel, OCR_PROVIDERS } from "../config/ocrRegistry.ts";
import { errorResponse } from "../utils/error.ts";
import { attachOmniRouteMetaHeaders } from "@/domain/omnirouteResponseMeta";
import { generateRequestId } from "@/shared/utils/requestId";

/**
 * Handle OCR request
 *
 * @param {Object} options
 * @param {Object} options.body - JSON body { model, document }
 * @param {Object} options.credentials - Provider credentials { apiKey }
 * @returns {Response}
 */
/** @returns {Promise<unknown>} */
export async function handleOcr({ body, credentials }) {
  const startTime = Date.now();
  if (!body.document) {
    return errorResponse(400, "document is required");
  }

  // Dynamic resolution: best and cheapest model wins
  const { provider: providerId, model: modelId } = parseOcrModel(body.model);
  const providerConfig = providerId ? getOcrProvider(providerId) : null;

  if (!providerConfig) {
    const available = Object.keys(OCR_PROVIDERS).join(", ");
    return errorResponse(400, `No OCR provider found for model "${body.model}". Available: ${available}`);
  }

  const isLocalNoAuth = providerConfig.authType === "none";
  const token = credentials?.apiKey || credentials?.accessToken || (isLocalNoAuth ? "local" : null);
  if (!token && !isLocalNoAuth) {
    return errorResponse(401, `No credentials for OCR provider: ${providerId}`);
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token && !isLocalNoAuth) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(providerConfig.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...body,
        model: modelId,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(errText, {
        status: res.status,
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        },
      });
    }

    const data = await res.json();
    const responseHeaders = new Headers({ ...CORS_HEADERS, "Content-Type": "application/json" });
    attachOmniRouteMetaHeaders(responseHeaders, {
      provider: providerId,
      model: modelId,
      costUsd: 0,
      latencyMs: Date.now() - startTime,
      requestId: generateRequestId(),
    });
    return new Response(JSON.stringify(data), { status: 200, headers: responseHeaders });
  } catch (err: any) {
    return errorResponse(500, `OCR request failed: ${err.message}`);
  }
}
