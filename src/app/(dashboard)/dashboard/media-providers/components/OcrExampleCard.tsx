import { useState } from "react";
import { useTranslations } from "next-intl";
import { PlaygroundCard } from "./PlaygroundCard";

const ENDPOINT_PATH = "/v1/ocr";

interface OcrExampleCardProps {
  providerId: string;
  models?: Array<{ id: string; name?: string }>;
}

export function OcrExampleCard({ providerId, models }: OcrExampleCardProps) {
  const t = useTranslations("mediaProviders");
  const modelOptions =
    models && models.length > 0
      ? models
      : [
          { id: "glm-ocr", name: "GLM-OCR (Local)" },
          { id: "deepseek-ocr2", name: "DeepSeek-OCR2 (Local)" },
          { id: "got-ocr2", name: "GOT-OCR2 (Local)" },
          { id: "mistral-ocr-latest", name: "Mistral OCR" },
        ];

  const [selectedModel, setSelectedModel] = useState<string>(
    modelOptions[0].id
  );
  const [docUrl, setDocUrl] = useState<string>(
    "https://raw.githubusercontent.com/madmaze/pytesseract/master/tests/data/test.png"
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestBody = JSON.stringify(
    {
      model: selectedModel,
      document: {
        type: "image_url",
        image_url: docUrl,
      },
    },
    null,
    2
  );

  const curlSnippet = `curl -X POST http://localhost:20128${ENDPOINT_PATH} \\
  -H "Content-Type: application/json" \\
  -d '${requestBody.replace(/\n\s*/g, " ")}'`;

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(ENDPOINT_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || `HTTP ${res.status}`);
      } else {
        setResult(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("requestFailed"));
    } finally {
      setRunning(false);
    }
  };

  return (
    <PlaygroundCard
      kindLabel="OCR"
      apiEndpoint={ENDPOINT_PATH}
      onRun={handleRun}
      curlSnippet={curlSnippet}
      running={running}
      result={result}
      error={error}
    >
      {/* Model select */}
      <div>
        <label className="block text-xs text-text-muted mb-1">{t("model")}</label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full text-xs bg-bg-surface border border-border rounded px-2 py-1 text-text"
        >
          {modelOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.id}
            </option>
          ))}
        </select>
      </div>

      {/* Document URL */}
      <div>
        <label className="block text-xs text-text-muted mb-1">{t("documentUrl")}</label>
        <input
          type="text"
          value={docUrl}
          onChange={(e) => setDocUrl(e.target.value)}
          placeholder="https://example.com/document.pdf or image.png"
          className="w-full text-xs bg-bg-surface border border-border rounded px-2 py-1 text-text font-mono"
        />
      </div>
    </PlaygroundCard>
  );
}
