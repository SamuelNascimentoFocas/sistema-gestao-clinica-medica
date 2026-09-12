import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CLINICAL_MARKDOWN_ALLOWED_ELEMENTS,
  ClinicalMarkdown,
} from "../src/components/medical-records/clinical-markdown.ts";

function render(content, contentFormat = "markdown", contentFormatVersion = 1) {
  return renderToStaticMarkup(
    ClinicalMarkdown({ content, contentFormat, contentFormatVersion }),
  );
}

test("clinical Markdown v1 renders only the approved formatting subset", () => {
  assert.deepEqual(CLINICAL_MARKDOWN_ALLOWED_ELEMENTS, [
    "p",
    "br",
    "strong",
    "em",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
  ]);

  const output = render(
    [
      "# Evolução",
      "",
      "Texto **importante** e *observação*.",
      "Linha um  ",
      "Linha dois",
      "",
      "- Item A",
      "- Item B",
      "",
      "1. Primeiro",
      "2. Segundo",
    ].join("\n"),
  );

  assert.match(output, /<h1>\s*Evolução\s*<\/h1>/);
  assert.match(output, /<strong>importante<\/strong>/);
  assert.match(output, /<em>observação<\/em>/);
  assert.match(output, /Linha um\s*<br\/>\s*Linha dois/);
  assert.match(output, /<ul>/);
  assert.match(output, /<ol>/);
  assert.match(output, /<li>Item A<\/li>/);
  assert.match(output, /<li>Primeiro<\/li>/);
});

test("clinical Markdown v1 never creates active raw HTML, links or images", () => {
  const output = render(
    [
      "Texto simples",
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<iframe src="https://example.test"></iframe>',
      '<a href="javascript:alert(1)">texto cru</a>',
      "[texto javascript](javascript:alert(1))",
      "[texto externo](https://example.test)",
      "![alt](https://example.test/x.png)",
    ].join("\n\n"),
  );

  assert.match(output, /Texto simples/);
  assert.match(output, /texto javascript/);
  assert.match(output, /texto externo/);
  assert.doesNotMatch(output, /<script|<img|<iframe|<a\b/i);
  assert.doesNotMatch(output, /onerror|javascript:|https:\/\/example\.test/i);
});

test("plain text and unknown contracts use React-escaped text fallback", () => {
  const content = '<script>alert(1)</script>\n**não interpretar**';

  for (const [format, version] of [
    ["plain", 1],
    ["markdown", 2],
    ["future-format", 99],
  ]) {
    const output = render(content, format, version);

    assert.match(output, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(output, /\*\*não interpretar\*\*/);
    assert.doesNotMatch(output, /<script|<strong>/i);
  }
});
