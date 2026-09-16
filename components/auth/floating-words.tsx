import { zh } from "@/lib/i18n/zh";

const positions = [
  ["8%", "11%", "0s"], ["78%", "9%", "-5s"], ["12%", "71%", "-8s"],
  ["82%", "76%", "-3s"], ["67%", "42%", "-11s"], ["23%", "37%", "-6s"],
  ["48%", "17%", "-9s"], ["43%", "82%", "-1s"],
] as const;

export function FloatingWords() {
  return (
    <div className="floating-words" aria-hidden="true">
      {zh.home.floatingWords.map((word, index) => {
        const [left, top, delay] = positions[index]!;
        return (
        <span
          key={word}
          style={{ left, top, animationDelay: delay, animationDuration: `${15 + index}s` }}
        >
          {word}
        </span>
        );
      })}
    </div>
  );
}
