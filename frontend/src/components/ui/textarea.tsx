import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-[var(--wu-radius)] border border-input bg-surface px-3 py-2 text-base placeholder:text-subtle focus-visible:border-ring focus-visible:outline-none aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-50 md:text-[13.5px]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
