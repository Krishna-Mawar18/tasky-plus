'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Markdown rendering for comments.
 *
 * ## Why this is safe
 *
 * `react-markdown` builds React elements; it never assigns an HTML string, so
 * this component contains no `dangerouslySetInnerHTML` anywhere. Three further
 * choices close the remaining routes:
 *
 * 1. **No `rehype-raw`.** Without it, raw HTML in a comment is not parsed into
 *    the output at all, so `<script>`, `<iframe>` and `<img onerror=…>` cannot
 *    become live nodes.
 * 2. **`skipHtml`.** Belt and braces: the raw-HTML nodes are dropped even if a
 *    plugin were added later that tried to enable them.
 * 3. **An explicit URL scheme allowlist.** Only `http`, `https` and `mailto`
 *    survive for links. `javascript:`, `data:` and `vbscript:` render as plain
 *    text instead of a clickable target.
 *
 * Images are not rendered either. A comment is text, and an image tag would be a
 * third-party request (and a tracking pixel) opened by whoever reads the thread.
 * An image reference degrades to a labelled link.
 */

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/** Reject anything that is not an absolute `http(s)`/`mailto` URL. */
export function isSafeLinkUrl(href: string | undefined | null): boolean {
  if (!href) return false;
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(href, 'https://tasky.invalid').protocol);
  } catch {
    return false;
  }
}

const components: Components = {
  a({ href, children, ...props }) {
    if (!isSafeLinkUrl(href)) {
      // Drop the anchor, keep the words. A refused scheme must not become an
      // error message in the middle of somebody's comment.
      return <span className="text-gray-700 underline decoration-dotted">{children}</span>;
    }
    return (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-blue-700 underline underline-offset-2 hover:text-blue-900 break-words"
      >
        {children}
      </a>
    );
  },

  img({ alt, src }) {
    /**
     * `src` arrives as `string | Blob`. A Blob is a data URL of some kind and is
     * never a link worth offering, so only an actual string is considered.
     *
     * The same scheme allowlist used for anchors is applied here: the fallback
     * renders the address as a clickable link, and that link must not be a way to
     * smuggle a `javascript:` or `data:` target past the refusal to load the
     * image itself.
     */
    const href = typeof src === 'string' && isSafeLinkUrl(src) ? src : null;

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 border border-gray-200 font-mono text-xs text-gray-600">
        image not shown
        {alt ? `: ${alt}` : ''}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline text-blue-700"
          >
            open source
          </a>
        ) : null}
      </span>
    );
  },

  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,

  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-1">{children}</ol>,

  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  h1: ({ children }) => <h3 className="font-bold text-base mb-1 mt-3 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h4 className="font-bold text-sm mb-1 mt-3 first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="font-bold text-sm mb-1 mt-2 first:mt-0">{children}</h5>,
  h4: ({ children }) => <h6 className="font-bold text-sm mb-1 mt-2 first:mt-0">{children}</h6>,

  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-gray-300 pl-3 text-gray-600 my-2">{children}</blockquote>
  ),

  hr: () => <hr className="border-gray-200 my-3" />,

  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-') ?? false;
    if (isBlock) {
      return (
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto my-2 text-xs leading-relaxed">
          <code {...props}>{children}</code>
        </pre>
      );
    }
    return (
      <code
        {...props}
        className="bg-gray-100 text-gray-800 rounded px-1 py-0.5 font-mono text-[0.85em]"
      >
        {children}
      </code>
    );
  },

  pre: ({ children }) => <>{children}</>,

  strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="line-through text-gray-500">{children}</del>,

  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 bg-gray-50 px-2 py-1 text-left font-bold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-gray-300 px-2 py-1">{children}</td>,

  input: () => null,
};

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className = '' }: MarkdownProps) {
  return (
    <div className={`text-sm text-gray-800 font-mono break-words ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {content}
      </ReactMarkdown>
    </div>
  );
}