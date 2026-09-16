import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?|```/g, ""))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^[#>*+-]+\s*/gm, "")
    .replace(/[`_*~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => {
          try {
            const parsed = new URL(url, "https://learnwithlia.invalid");
            return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? url : "";
          } catch {
            return "";
          }
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
