import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageContainer({ children, className, ...props }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 md:px-7",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
