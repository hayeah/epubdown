let parseXml: (xml: string) => Document;

if (typeof window === "undefined") {
  // Node.js environment
  const { DOMParser } = require("linkedom");
  parseXml = (xml: string) =>
    new DOMParser().parseFromString(xml, "text/xml") as any;
} else {
  // Browser environment
  parseXml = (xml: string) =>
    new DOMParser().parseFromString(xml, "text/xml") as any;
}

export { parseXml };
