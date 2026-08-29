import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

const styles = {
  primary: "bg-ink text-white hover:bg-[#442a1d] shadow-lg shadow-orange-950/10",
  secondary: "bg-orange-100 text-ink hover:bg-orange-200",
  ghost: "bg-transparent text-ink hover:bg-black/5",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = "primary", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      styles[variant],
      size === "sm" && "h-9 px-4 text-sm",
      size === "md" && "h-11 px-5 text-sm",
      size === "lg" && "h-12 px-6 text-base",
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";
