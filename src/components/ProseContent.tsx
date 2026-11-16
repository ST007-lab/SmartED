import React from 'react';

interface ProseContentProps {
  content: string;
  className?: string;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  // Parse **bold**, *italic*, and `code` cleanly without unsafe HTML injection
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-100">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return (
        <em key={idx} className="italic text-slate-200">
          {token.slice(1, -1)}
        </em>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-slate-800/90 px-1.5 py-0.5 font-mono text-[0.875em] text-cyan-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

export const ProseContent: React.FC<ProseContentProps> = ({ content, className = '' }) => {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  const flushLists = (keyPrefix: string) => {
    if (listItems.length > 0) {
      blocks.push(
        <ul
          key={`${keyPrefix}-ul`}
          className="my-3 space-y-1.5 pl-5 list-disc marker:text-sky-400 text-slate-200"
        >
          {listItems.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
    if (orderedItems.length > 0) {
      blocks.push(
        <ol
          key={`${keyPrefix}-ol`}
          className="my-3 space-y-1.5 pl-5 list-decimal marker:text-sky-400 text-slate-200"
        >
          {orderedItems.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ol>
      );
      orderedItems = [];
    }
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith('```')) {
      flushLists(`code-${idx}`);
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLines = [];
      } else {
        inCodeBlock = false;
        blocks.push(
          <pre
            key={`pre-${idx}`}
            className="my-3 overflow-x-auto rounded-lg border border-slate-800 bg-[#060913] p-3.5 font-mono text-xs leading-relaxed text-cyan-200"
          >
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushLists(`empty-${idx}`);
      return;
    }

    if (trimmed.startsWith('### ')) {
      flushLists(`h3-${idx}`);
      blocks.push(
        <h4
          key={`h3-${idx}`}
          className="mt-4 mb-1.5 font-display text-base font-semibold text-slate-100"
        >
          {renderInlineFormatting(trimmed.slice(4))}
        </h4>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      flushLists(`h2-${idx}`);
      blocks.push(
        <h3
          key={`h2-${idx}`}
          className="mt-4 mb-2 font-display text-lg font-semibold text-white"
        >
          {renderInlineFormatting(trimmed.slice(3))}
        </h3>
      );
      return;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      if (orderedItems.length > 0) flushLists(`switch-${idx}`);
      listItems.push(trimmed.replace(/^[-*•]\s+/, ''));
      return;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      if (listItems.length > 0) flushLists(`switch-ol-${idx}`);
      orderedItems.push(trimmed.replace(/^\d+\.\s+/, ''));
      return;
    }

    flushLists(`p-${idx}`);
    blocks.push(
      <p key={`p-${idx}`} className="my-2 leading-relaxed text-slate-200">
        {renderInlineFormatting(trimmed)}
      </p>
    );
  });

  flushLists('end');
  if (inCodeBlock && codeLines.length > 0) {
    blocks.push(
      <pre
        key="pre-end"
        className="my-3 overflow-x-auto rounded-lg border border-slate-800 bg-[#060913] p-3.5 font-mono text-xs leading-relaxed text-cyan-200"
      >
        <code>{codeLines.join('\n')}</code>
      </pre>
    );
  }

  return <div className={`text-[15px] leading-relaxed ${className}`}>{blocks}</div>;
};
