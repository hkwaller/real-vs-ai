import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-bold tracking-widest uppercase transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 font-orbitron cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[#FF6B1A] text-[#0B0F2E] hover:bg-[#FF8C42] hover:shadow-[0_0_20px_rgba(255,107,26,0.5)] rounded-sm",
        destructive:
          "bg-[#FF3D1A] text-[#F5F0E8] hover:bg-[#FF5533] hover:shadow-[0_0_20px_rgba(255,61,26,0.5)] rounded-sm",
        outline:
          "border border-[#FF6B1A] bg-transparent text-[#FF6B1A] hover:bg-[#FF6B1A]/10 hover:shadow-[0_0_15px_rgba(255,107,26,0.3)] rounded-sm",
        secondary:
          "bg-[#1A2355] text-[#F5F0E8] border border-[#2A3468] hover:border-[#00FFE5] hover:text-[#00FFE5] hover:shadow-[0_0_15px_rgba(0,255,229,0.2)] rounded-sm",
        ghost:
          "bg-transparent text-[#8B97C8] hover:text-[#F5F0E8] hover:bg-[#1A2355] rounded-sm",
        link: "text-[#FF6B1A] underline-offset-4 hover:underline bg-transparent",
        neon: "bg-[#FF6B1A] text-[#0B0F2E] hover:bg-[#FF8C42] hover:shadow-[0_0_20px_rgba(255,107,26,0.5)] rounded-sm",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
        xl: "h-14 px-10 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
