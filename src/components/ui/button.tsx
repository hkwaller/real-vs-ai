import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-display font-extrabold rounded-[16px] transition-all duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
  {
    variants: {
      variant: {
        // Coral — the signature physical button
        default:
          "bg-[#FF8552] text-[#151936] shadow-[0_6px_0_#C25327] hover:translate-y-[2px] hover:shadow-[0_4px_0_#C25327] active:translate-y-[2px] active:shadow-[0_4px_0_#C25327]",
        // Aqua
        secondary:
          "bg-[#57E6D2] text-[#151936] shadow-[0_6px_0_#2FA391] hover:translate-y-[2px] hover:shadow-[0_4px_0_#2FA391] active:translate-y-[2px] active:shadow-[0_4px_0_#2FA391]",
        // Danger
        destructive:
          "bg-[#FF6A6A] text-[#151936] shadow-[0_6px_0_#B84A4A] hover:translate-y-[2px] hover:shadow-[0_4px_0_#B84A4A] active:translate-y-[2px] active:shadow-[0_4px_0_#B84A4A]",
        // Ghost pill — hover turns aqua
        ghost:
          "bg-transparent border-[1.5px] border-white/15 text-[#C6CCF2] hover:border-[#57E6D2] hover:text-[#57E6D2]",
        outline:
          "bg-transparent border-[1.5px] border-white/15 text-[#C6CCF2] hover:border-[#57E6D2] hover:text-[#57E6D2]",
        link: "text-[#FF8552] underline-offset-4 hover:underline bg-transparent",
        neon: "bg-[#FF8552] text-[#151936] shadow-[0_6px_0_#C25327] hover:translate-y-[2px] hover:shadow-[0_4px_0_#C25327] active:translate-y-[2px] active:shadow-[0_4px_0_#C25327]",
      },
      size: {
        default: "h-12 px-6 text-base",
        sm: "h-9 px-4 text-sm rounded-[14px]",
        lg: "h-14 px-8 text-lg",
        icon: "h-11 w-11 rounded-[14px]",
        xl: "h-16 px-10 text-xl",
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
