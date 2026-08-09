"use client"

import React, { createContext, useContext, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, X } from "lucide-react"
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs))
}

export const Button = React.forwardRef<HTMLButtonElement, any>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp: any = asChild ? "div" : "button"
  const variants: { [key: string]: string } = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  }
  const sizes: { [key: string]: string } = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    xs: "h-8 rounded-md px-2",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  }
  return (
    <Comp
      className={cn(
        variants[variant] || variants.default,
        sizes[size] || sizes.default,
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export const Card = React.forwardRef<HTMLDivElement, any>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
))
Card.displayName = "Card"

export const CardHeader = React.forwardRef<HTMLDivElement, any>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
))
CardHeader.displayName = "CardHeader"

export const CardTitle = React.forwardRef<HTMLHeadingElement, any>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
))
CardTitle.displayName = "CardTitle"

export const CardDescription = React.forwardRef<HTMLParagraphElement, any>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
CardDescription.displayName = "CardDescription"

export const CardContent = React.forwardRef<HTMLDivElement, any>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

export const CardFooter = React.forwardRef<HTMLDivElement, any>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
))
CardFooter.displayName = "CardFooter"

export const Input = React.forwardRef<HTMLInputElement, any>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

export const Label = React.forwardRef<HTMLLabelElement, any>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  />
))
Label.displayName = "Label"

export const Checkbox = React.forwardRef<HTMLInputElement, any>(({ className, ...props }, ref) => (
  <input
    type="checkbox"
    ref={ref}
    className={cn(
      "h-4 w-4 shrink-0 rounded-sm border border-muted-foreground/50 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary",
      className,
    )}
    {...props}
  />
))
Checkbox.displayName = "Checkbox"

export const Alert = React.forwardRef<HTMLDivElement, any>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(
      "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
      variant === "destructive"
        ? "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive"
        : "",
      className,
    )}
    {...props}
  />
))
Alert.displayName = "Alert"

export const AlertTitle = React.forwardRef<HTMLHeadingElement, any>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
))
AlertTitle.displayName = "AlertTitle"

export const AlertDescription = React.forwardRef<HTMLDivElement, any>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
))
AlertDescription.displayName = "AlertDescription"

const DialogContext = createContext<any>(null)

export const Dialog = ({ children, open, onOpenChange }: any) => {
  const isControlled = open !== undefined && onOpenChange !== undefined
  const [internalOpen, setInternalOpen] = useState(false)

  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen

  return <DialogContext.Provider value={{ isOpen, setIsOpen }}>{children}</DialogContext.Provider>
}

export const DialogTrigger = ({ children, asChild = false }: any) => {
  const { setIsOpen } = useContext(DialogContext)
  const Comp = asChild ? React.Fragment : "div"
  const child = asChild ? React.Children.only(children) : children

  return (
    <Comp>
      {React.cloneElement(child, {
        onClick: (e: any) => {
          e.preventDefault()
          setIsOpen(true)
          if (child.props.onClick) child.props.onClick(e)
        },
      })}
    </Comp>
  )
}

export const DialogContent = ({ children, className, ...props }: any) => {
  const { isOpen, setIsOpen } = useContext(DialogContext)

  useEffect(() => {
    const handleEsc = (event: any) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }
    window.addEventListener("keydown", handleEsc)
    return () => {
      window.removeEventListener("keydown", handleEsc)
    }
  }, [setIsOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "relative z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg rounded-lg",
              className,
            )}
            onClick={(e) => e.stopPropagation()}
            {...props}
          >
            {children}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const DialogHeader = ({ children, ...props }: any) => (
  <div className="flex flex-col space-y-1.5 text-center sm:text-left" {...props}>
    {children}
  </div>
)
export const DialogTitle = ({ children, ...props }: any) => (
  <h2 className="text-lg font-semibold leading-none tracking-tight" {...props}>
    {children}
  </h2>
)
export const DialogDescription = ({ children, ...props }: any) => (
  <p className="text-sm text-muted-foreground" {...props}>
    {children}
  </p>
)
export const DialogFooter = ({ children, ...props }: any) => (
  <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2" {...props}>
    {children}
  </div>
)

const DropdownContext = createContext<any>(null)

export const DropdownMenu = ({ children }: any) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<any>(null)

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen }}>
      <div ref={menuRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

export const DropdownMenuTrigger = ({ children, asChild = false }: any) => {
  const { setIsOpen } = useContext(DropdownContext)
  const Comp = asChild ? React.Fragment : "div"
  const child = asChild ? React.Children.only(children) : children

  return (
    <Comp>
      {React.cloneElement(child, {
        onClick: (e: any) => {
          e.preventDefault()
          setIsOpen((prev: any) => !prev)
          if (child.props.onClick) child.props.onClick(e)
        },
      })}
    </Comp>
  )
}

export const DropdownMenuContent = ({ children, align = "start", side = "bottom", className, ...props }: any) => {
  const { isOpen } = useContext(DropdownContext)
  const alignClasses: { [key: string]: string } = {
    start: "origin-top-left left-0",
    end: "origin-top-right right-0",
  }
  const sideClasses: { [key: string]: string } = {
    bottom: "origin-top mt-2",
    top: "origin-bottom mb-2 bottom-full",
    right: "origin-left ml-2 left-full top-1/2 -translate-y-1/2",
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.1 }}
          className={cn(
            "absolute z-50 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            alignClasses[align],
            sideClasses[side],
            className,
          )}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const DropdownMenuLabel = React.forwardRef<HTMLDivElement, any>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold text-muted-foreground", inset && "pl-8", className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = "DropdownMenuLabel"

export const DropdownMenuSeparator = React.forwardRef<HTMLHRElement, any>(({ className, ...props }, ref) => (
  <hr ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
))
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

export const DropdownMenuCheckboxItem = ({ children, checked, onCheckedChange, onSelect, ...props }: any) => {
  return (
    <div
      className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors hover:bg-accent focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
      onClick={(e) => {
        if (onSelect) onSelect(e)
        if (!e.defaultPrevented) {
          onCheckedChange(!checked)
        }
      }}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {checked && <Check className="h-4 w-4" />}
      </span>
      {children}
    </div>
  )
}

const HoverMenuContext = createContext<any>({
  isOpen: false,
  setIsOpen: (isOpen: boolean) => {},
})

export const HoverMenu = ({ children }: any) => {
  const [isOpen, setIsOpen] = useState(false)
  const timeoutRef = useRef<any>(null)

  const openMenu = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsOpen(true)
  }

  const closeMenu = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 200) // 200ms gecikme
  }

  return (
    <HoverMenuContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="relative inline-block" onMouseEnter={openMenu} onMouseLeave={closeMenu}>
        {children}
      </div>
    </HoverMenuContext.Provider>
  )
}

export const HoverMenuTrigger = ({ children }: any) => {
  return <>{children}</>
}

export const HoverMenuContent = ({ children, align = "start", className, ...props }: any) => {
  const { isOpen } = useContext(HoverMenuContext)
  const alignClasses: { [key: string]: string } = {
    start: "origin-top-left left-0",
    end: "origin-top-right right-0",
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.1 }}
          className={cn(
            "absolute z-50 mt-2 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            alignClasses[align],
            className,
          )}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const Progress = ({ value, className }: any) => (
  <div className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}>
    <div
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </div>
)

export const Select = ({ children, value, onChange }: any) => (
  <select
    value={value}
    onChange={onChange}
    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </select>
)
export const SelectItem = ({ value, children }: any) => <option value={value}>{children}</option>

export const Table = React.forwardRef<HTMLTableElement, any>(({ className, ...props }, ref) => (
  <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
))
Table.displayName = "Table"
export const TableHeader = React.forwardRef<HTMLTableSectionElement, any>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"
export const TableBody = React.forwardRef<HTMLTableSectionElement, any>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
))
TableBody.displayName = "TableBody"
export const TableRow = React.forwardRef<HTMLTableRowElement, any>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted dark:border-[#393937]",
      className,
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"
export const TableHead = React.forwardRef<HTMLTableCellElement, any>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className,
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"
export const TableCell = React.forwardRef<HTMLTableCellElement, any>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
))
TableCell.displayName = "TableCell"

export const TooltipProvider = ({ children }: any) => {
  return <div>{children}</div>
}

export const Tooltip = ({ children, content, side = "top" }: any) => {
  const [show, setShow] = useState(false)

  const sideClasses: { [key: string]: string } = {
    top: "left-1/2 -translate-x-1/2 bottom-full mb-2",
    right: "top-1/2 -translate-y-1/2 left-full ml-2",
    bottom: "left-1/2 -translate-x-1/2 top-full mt-2",
    left: "top-1/2 -translate-y-1/2 right-full mr-2",
  }

  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && content && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={cn(
              "absolute whitespace-nowrap z-50 px-3 py-1.5 text-sm font-medium text-primary-foreground bg-primary rounded-md shadow-sm",
              sideClasses[side],
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
