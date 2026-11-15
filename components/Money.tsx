import { formatNaira } from "@/lib/money";

/** Display only: round kobo to the nearest naira. The maths keeps kobo. */
export const wholeNaira = (kobo: number) => Math.round(kobo / 100) * 100;

/** A naira figure whose ₦ sign is set in Inter, so pixel and mono faces never fall back mid-number. */
export function Money({ kobo, whole = false, className = "" }: { kobo: number; whole?: boolean; className?: string }) {
  const text = formatNaira(whole ? wholeNaira(kobo) : kobo);
  const neg = text.startsWith("-");
  const digits = text.replace(/^-?₦/, "");
  return (
    <span className={`num ${className}`}>
      {neg && "-"}
      <span className="cur">₦</span>
      {digits}
    </span>
  );
}
