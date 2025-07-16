let getDOMParser: () => typeof DOMParser;
let parseXml: (xml: string) => Document;
let parseHtml: (html: string) => Document;

if (typeof window === "undefined") {
  // Node.js environment
  const { DOMParser } = require("linkedom");
  getDOMParser = () => DOMParser;
  parseXml = (xml: string) =>
    new DOMParser().parseFromString(xml, "text/xml") as any;
  parseHtml = (html: string) =>
    new DOMParser().parseFromString(html, "text/html") as any;
} else {
  // Browser environment
  getDOMParser = () => DOMParser;
  parseXml = (xml: string) =>
    new DOMParser().parseFromString(xml, "text/xml") as any;
  parseHtml = (html: string) =>
    new DOMParser().parseFromString(html, "text/html") as any;
}

export { getDOMParser, parseXml, parseHtml };
