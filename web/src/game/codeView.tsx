// Shows the generated "My Code" with simple syntax colors.
import { appCode, gameCode } from "../../../shared/codeText";

export { appCode, gameCode };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function CodeBlock({ code }: { code: string }) {
  const html = code
    .split("\n")
    .map((line) => {
      const ci = line.indexOf("//");
      const [src, comment] = ci >= 0 ? [line.slice(0, ci), line.slice(ci)] : [line, ""];
      const colored = esc(src)
        .replace(/("[^"]*")/g, '<span class="s">$1</span>')
        .replace(/\b(let|const|function|return|if|else|for|of|true|false)\b/g, '<span class="k">$1</span>')
        .replace(/\b(\d+)\b/g, '<span class="v">$1</span>');
      return colored + (comment ? `<span class="c">${esc(comment)}</span>` : "");
    })
    .join("\n");
  return <div className="code" dangerouslySetInnerHTML={{ __html: html }} />;
}
