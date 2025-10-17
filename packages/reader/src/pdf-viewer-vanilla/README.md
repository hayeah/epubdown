=== Performance Comparison Results ===

Initialization Time:
  PDF.js:  847.90ms
  PDFium:  1710.60ms
  Winner:  PDF.js (862.70ms faster)

First Page Render Time:
  PDF.js:  0.10ms
  PDFium:  0.10ms
  Winner:  PDFium (0.00ms faster)

Scroll to Page 10 Time:
  PDF.js:  0.40ms
  PDFium:  0.40ms
  Winner:  PDFium (0.00ms faster)

Scroll to Last Page Time:
  PDF.js:  0.00ms
  PDFium:  0.20ms
  Winner:  PDF.js (0.20ms faster)

Memory Usage:
  PDF.js:  23.48MB
  PDFium:  166.91MB
  Winner:  PDF.js (143.43MB less)

=== Overall Winner ===
PDFium (Won 2 out of 4 metrics)
 ✓  chromium  src/pdf-viewer-vanilla/pdf-perf-comparison.test.browser.ts (1 test) 5637ms
   ✓ PDF Viewer Performance Comparison > compares PDF.js vs PDFium performance  5637ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  10:43:13
   Duration  8.91s (transform 0ms, setup 0ms, collect 16ms, tests 5.64s, environment 0ms, prepare 44ms)