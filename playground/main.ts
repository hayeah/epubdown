import { createPdfjsEngine } from "../packages/pdf-render-test/src/engines/pdfjs";
import { createPdfiumEngine } from "../packages/pdf-render-test/src/engines/pdfium";
import { runBatch } from "../packages/pdf-render-test/src/harness/runBatch";
import { formatBatchReport } from "../packages/pdf-render-test/src/utils/format";

const q = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const engineSel = q<HTMLSelectElement>("engine");
const pagesInput = q<HTMLInputElement>("pages");
const renderBtn = q<HTMLButtonElement>("render");
const clearBtn = q<HTMLButtonElement>("clear");
const fileInput = q<HTMLInputElement>("file");
const metricsPre = q<HTMLPreElement>("metrics");
const canvasesDiv = q<HTMLDivElement>("canvases");

function canvasFactory() {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  return c;
}

async function getPdfBytes(): Promise<Uint8Array> {
  if (fileInput.files && fileInput.files[0]) {
    return new Uint8Array(await fileInput.files[0].arrayBuffer());
  }
  const res = await fetch("/sample.pdf");
  if (!res.ok) throw new Error("Failed to fetch /sample.pdf");
  return new Uint8Array(await res.arrayBuffer());
}

renderBtn.onclick = async () => {
  try {
    metricsPre.textContent = "Running…";
    canvasesDiv.innerHTML = ""; // Clear previous canvases
    const pages = Math.max(1, Number(pagesInput.value) || 25);
    const data = await getPdfBytes();
    const engine =
      engineSel.value === "PDFium"
        ? createPdfiumEngine("/pdfium.wasm")
        : createPdfjsEngine();
    const report = await runBatch({
      engine,
      data,
      pages,
      canvasFactory: () => {
        const c = canvasFactory();
        canvasesDiv.appendChild(c);
        return c;
      },
    });
    // Display formatted metrics
    metricsPre.textContent = formatBatchReport(report);
  } catch (error) {
    console.error("Render error:", error);
    const message = error instanceof Error ? error.message : String(error);
    metricsPre.textContent = `Error: ${message}\n\nSee console for details.`;
  }
};

clearBtn.onclick = () => {
  canvasesDiv.innerHTML = "";
};
