import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Split duel: flat, square, uppercase Archivo 900 at 125% width. Press darkens; nothing lifts.
  'inline-flex items-center justify-center gap-3 whitespace-nowrap type-display tracking-normal rounded-none transition-[filter,background-color,color] duration-150 ease-out hover:brightness-[0.92] active:brightness-[0.84] disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Primary action: orange with ink text
        default: 'bg-side-a text-ink',
        // Committing a setup: blue with white text
        secondary: 'bg-side-b text-paper',
        // Destructive and single actions on paper: ink with white text
        destructive: 'bg-ink text-paper',
        ink: 'bg-ink text-paper',
        paper: 'bg-paper text-ink',
        // Secondary on any ground: 4px outline in the current text colour
        ghost: 'bg-transparent text-current border-4 border-current hover:brightness-100 hover:bg-current/10',
        outline: 'bg-transparent text-current border-4 border-current hover:brightness-100 hover:bg-current/10',
        link: 'bg-transparent text-side-b underline underline-offset-4 normal-case font-bold hover:brightness-100',
        neon: 'bg-side-a text-ink',
      },
      size: {
        default: 'h-14 px-6 text-lg',
        sm: 'h-11 px-4 text-sm [&_svg]:size-4',
        lg: 'h-[72px] px-8 text-2xl [&_svg]:size-6',
        icon: 'h-12 w-12 [&_svg]:size-5',
        xl: 'h-[88px] px-10 text-3xl [&_svg]:size-7',
        bar: 'h-[112px] w-full justify-between px-6 text-[30px] [&_svg]:size-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
