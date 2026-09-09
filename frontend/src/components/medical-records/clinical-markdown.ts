import { createElement } from "react";
import ReactMarkdown from "react-markdown";

export const CLINICAL_MARKDOWN_ALLOWED_ELEMENTS = [
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
] as const;

type ClinicalMarkdownProps = {
  content: string;
  contentFormat?: string | null;
  contentFormatVersion?: number | null;
};

export function isClinicalMarkdownV1({
  contentFormat,
  contentFormatVersion,
}: Pick<
  ClinicalMarkdownProps,
  "contentFormat" | "contentFormatVersion"
>) {
  return contentFormat === "markdown" && contentFormatVersion === 1;
}

export function ClinicalMarkdown({
  content,
  contentFormat,
  contentFormatVersion,
}: ClinicalMarkdownProps) {
  if (!isClinicalMarkdownV1({ contentFormat, contentFormatVersion })) {
    return createElement(
      "p",
      { className: "whitespace-pre-wrap text-sm leading-6" },
      content,
    );
  }

  return createElement(
    "div",
    {
      className:
        "space-y-3 text-sm leading-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:whitespace-pre-wrap [&_ul]:list-disc",
    },
    createElement(ReactMarkdown, {
      allowedElements: [...CLINICAL_MARKDOWN_ALLOWED_ELEMENTS],
      skipHtml: true,
      unwrapDisallowed: true,
    }, content),
  );
}
