// State variables
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.0;
const canvas = document.getElementById("pdf-canvas");
const ctx = canvas.getContext("2d");

// PDF file path - relative to the HTML file
const url = "calculus.pdf";

// UI Elements
const prevButton = document.getElementById("prev-page");
const nextButton = document.getElementById("next-page");
const pageNumSpan = document.getElementById("page-num");
const pageCountSpan = document.getElementById("page-count");
const zoomInButton = document.getElementById("zoom-in");
const zoomOutButton = document.getElementById("zoom-out");
const zoomFitButton = document.getElementById("zoom-fit");
const zoomLevelSpan = document.getElementById("zoom-level");
const loadingDiv = document.getElementById("loading");
const errorDiv = document.getElementById("error");

// Render the page
function renderPage(num) {
  pageRendering = true;

  // Get page
  pdfDoc.getPage(num).then((page) => {
    const viewport = page.getViewport({ scale: scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Render PDF page into canvas context
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    const renderTask = page.render(renderContext);

    // Wait for rendering to finish
    renderTask.promise.then(() => {
      pageRendering = false;

      // If there's a page rendering pending, render it
      if (pageNumPending !== null) {
        renderPage(pageNumPending);
        pageNumPending = null;
      }
    });
  });

  // Update page counter
  pageNumSpan.textContent = num;
}

// Queue rendering of a page
function queueRenderPage(num) {
  if (pageRendering) {
    pageNumPending = num;
  } else {
    renderPage(num);
  }
}

// Display previous page
function onPrevPage() {
  if (pageNum <= 1) {
    return;
  }
  pageNum--;
  queueRenderPage(pageNum);
  updateButtons();
}

// Display next page
function onNextPage() {
  if (pageNum >= pdfDoc.numPages) {
    return;
  }
  pageNum++;
  queueRenderPage(pageNum);
  updateButtons();
}

// Update navigation buttons
function updateButtons() {
  prevButton.disabled = pageNum <= 1;
  nextButton.disabled = pageNum >= pdfDoc.numPages;
}

// Zoom functions
function zoomIn() {
  scale += 0.25;
  if (scale > 3) scale = 3;
  updateZoomLevel();
  queueRenderPage(pageNum);
}

function zoomOut() {
  scale -= 0.25;
  if (scale < 0.5) scale = 0.5;
  updateZoomLevel();
  queueRenderPage(pageNum);
}

function fitWidth() {
  pdfDoc.getPage(pageNum).then((page) => {
    const viewport = page.getViewport({ scale: 1 });
    const containerWidth =
      document.querySelector(".pdf-viewer").clientWidth - 64; // Subtract padding
    scale = containerWidth / viewport.width;
    updateZoomLevel();
    queueRenderPage(pageNum);
  });
}

function updateZoomLevel() {
  zoomLevelSpan.textContent = Math.round(scale * 100) + "%";
}

// Event listeners
prevButton.addEventListener("click", onPrevPage);
nextButton.addEventListener("click", onNextPage);
zoomInButton.addEventListener("click", zoomIn);
zoomOutButton.addEventListener("click", zoomOut);
zoomFitButton.addEventListener("click", fitWidth);

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowLeft":
      onPrevPage();
      break;
    case "ArrowRight":
      onNextPage();
      break;
    case "+":
    case "=":
      zoomIn();
      break;
    case "-":
    case "_":
      zoomOut();
      break;
  }
});

// Load the PDF document
pdfjsLib
  .getDocument(url)
  .promise.then((pdfDoc_) => {
    pdfDoc = pdfDoc_;
    loadingDiv.style.display = "none";

    // Display total pages
    pageCountSpan.textContent = pdfDoc.numPages;

    // Initial page render
    renderPage(pageNum);
    updateButtons();
    updateZoomLevel();
  })
  .catch((error) => {
    // Handle errors
    loadingDiv.style.display = "none";
    errorDiv.style.display = "block";
    errorDiv.innerHTML = `
        <h3>Error loading PDF</h3>
        <p>${error.message}</p>
        <p>Please ensure that 'calculus.pdf' is in the parent directory.</p>
    `;
    console.error("Error loading PDF:", error);
  });
