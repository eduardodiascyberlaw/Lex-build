"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface EditorialMarkdownProps {
  children: string;
  className?: string;
}

/**
 * Render markdown using the Editorial Forense type system. Used for both
 * agent-streamed phase content and the recovery preview. The lawyer never
 * sees raw `**bold**` or `## Heading` again — they read prose.
 */
export function EditorialMarkdown({ children, className = "" }: EditorialMarkdownProps) {
  return (
    <div className={`editorial-prose ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              className="mt-10 mb-4"
              style={{
                fontFamily: "var(--font-serif), Fraunces, serif",
                fontWeight: 600,
                fontSize: "1.6rem",
                lineHeight: 1.2,
                letterSpacing: "-0.015em",
                color: "var(--ink)",
              }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className="mt-8 mb-3"
              style={{
                fontFamily: "var(--font-serif), Fraunces, serif",
                fontWeight: 600,
                fontSize: "1.25rem",
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
                color: "var(--ink)",
              }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className="mt-6 mb-2"
              style={{
                fontFamily: "var(--font-ui), Inter Tight, system-ui, sans-serif",
                fontWeight: 600,
                fontSize: "0.78rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink-soft)",
              }}
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p
              className="my-3"
              style={{
                fontFamily: "var(--font-serif), Fraunces, serif",
                fontSize: "1.0625rem",
                lineHeight: 1.72,
                color: "var(--ink)",
              }}
            >
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong style={{ fontWeight: 600, color: "var(--ink)" }}>{children}</strong>
          ),
          em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
          ul: ({ children }) => (
            <ul className="my-3 ml-5 list-disc space-y-1" style={{ color: "var(--ink)" }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 ml-5 list-decimal space-y-1" style={{ color: "var(--ink)" }}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li
              style={{
                fontFamily: "var(--font-serif), Fraunces, serif",
                fontSize: "1.0625rem",
                lineHeight: 1.72,
              }}
            >
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className="my-4 border-l-2 pl-4 italic"
              style={{
                borderColor: "var(--toga)",
                color: "var(--ink-soft)",
                fontFamily: "var(--font-serif), Fraunces, serif",
              }}
            >
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr
              className="my-6 border-0 border-t"
              style={{ borderColor: "var(--rule)" }}
            />
          ),
          code: ({ children, ...props }) => {
            const inline = !("inline" in props) || props.inline;
            if (inline) {
              return (
                <code
                  className="rounded-sm px-1 py-0.5 text-[0.95em]"
                  style={{
                    background: "var(--paper-deep)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre
                className="my-4 overflow-x-auto rounded-sm p-3 text-xs"
                style={{
                  background: "var(--paper-deep)",
                  color: "var(--ink)",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                <code>{children}</code>
              </pre>
            );
          },
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                color: "var(--toga)",
                textDecoration: "underline",
                textUnderlineOffset: "0.18em",
              }}
            >
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
