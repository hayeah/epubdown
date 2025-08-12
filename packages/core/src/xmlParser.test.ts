import { describe } from "vitest";
import { DOMParser } from "./xmlParser";
import { createXmlParserTests } from "./xmlParser.test.shared";

describe("xmlParser - jsdom", createXmlParserTests(DOMParser));
