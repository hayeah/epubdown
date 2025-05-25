import TurndownService from "turndown";

export function createTurndownService(): TurndownService {
  const td = new TurndownService({ headingStyle: "atx" });
  td.addRule("pageBreak", {
    filter: (node) =>
      node.nodeName === "SPAN" && node.classList.contains("page-break"),
    replacement: () => "\n\n---\n\n",
  });

  // new rule: inline foot-note reference → <Footnote …/>
  td.addRule("footnoteRef", {
    filter: (node) =>
      node.nodeName === "A" &&
      node.classList.contains("noteref") &&
      node.getAttribute("epub:type") === "noteref",
    replacement: (_content, node) => {
      const id = node.getAttribute("id") ?? "";
      const href = node.getAttribute("href") ?? "";
      const label = (node.textContent || "").trim();
      return `<Footnote id="${id}" href="${href}">${label}</Footnote>`;
    },
  });

  return td;
}
