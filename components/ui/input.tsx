import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn("h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-ink outline-none placeholder:text-stone-400 focus:border-saffron focus:ring-4 focus:ring-orange-100", className)}
    {...props}
  />
));
Input.displayName = "Input";
