"use client"

import React, { useState, useEffect, createContext, useContext, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Package2,
  Activity,
  PlusCircle,
  User,
  UserPlus,
  FileText,
  Moon,
  Sun,
  LoaderCircle,
  AlertCircle,
  FileDown,
  ListFilter,
  ChevronDown,
  ChevronUp,
  Trash2,
  Settings,
  Save,
  Wrench,
  KeyRound,
  Calculator,
  XCircle,
  Building,
  FileSearch,
  Upload,
  ArrowLeft,
  SkipForward,
  Filter,
  Eye,
  EyeOff,
  DollarSign,
  Euro,
  History,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Bell,
  Check,
  X,
  Mail,
  Phone,
  Briefcase,
  Users,
} from "lucide-react"

// --------------------------------------------------------------------------------
// Yerleşik Bileşenler ve Yardımcı Fonksiyonlar (Hata Düzeltmesi)
// --------------------------------------------------------------------------------

// Tailwind CSS sınıflarını birleştirmek için yardımcı fonksiyon
const cn = (...classes) => classes.filter(Boolean).join(" ")

// --- UI Bileşenleri (shadcn/ui yerine yerleşik olarak eklendi) ---

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
)
CardContent.displayName = "CardContent"

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }
>(({ className, variant = "default", size = "default", ...props }, ref) => {
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
  }
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    xs: "h-8 px-2.5",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  }
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
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
  },
)
Input.displayName = "Input"

const Label = React.forwardRef<
  React.ElementRef<"label">,
  React.ComponentPropsWithoutRef<"label">
>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
))
Label.displayName = "Label"

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  ),
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />,
)
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
)
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)}
      {...props}
    />
  ),
)
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn("h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  ),
)
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
  ),
)
TableCell.displayName = "TableCell"

const Checkbox = React.forwardRef<
  HTMLButtonElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    type="checkbox"
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className,
    )}
    {...props}
  />
))
Checkbox.displayName = "Checkbox"

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: string }
>(({ className, variant, ...props }, ref) => {
    const variants = {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
    }
    return (
        <div ref={ref} role="alert" className={cn("relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground", variants[variant], className)} {...props} />
    )
})
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
))
AlertDescription.displayName = "AlertDescription"

const Progress = React.forwardRef<
    React.ElementRef<'div'>,
    React.ComponentPropsWithoutRef<'div'> & { value?: number }
>(({ className, value, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
        {...props}
    >
        <div
            className="h-full w-full flex-1 bg-primary transition-all"
            style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
    </div>
))
Progress.displayName = "Progress"

// --- Dialog Bileşenleri ---
const Dialog = ({ open, onOpenChange, children }) => {
    if (!open) return null
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center animate-in fade-in-0" onClick={() => onOpenChange(false)}>
        <div className="relative bg-background p-6 rounded-lg shadow-lg w-full max-w-lg border" onClick={(e) => e.stopPropagation()}>
            {children}
        </div>
      </div>
    )
}
const DialogHeader = ({ className, ...props }) => <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
const DialogFooter = ({ className, ...props }) => <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
const DialogTitle = ({ className, ...props }) => <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
const DialogDescription = ({ className, ...props }) => <p className={cn("text-sm text-muted-foreground", className)} {...props} />
const DialogContent = ({ className, ...props }) => <div className={cn(className)} {...props} />
const DialogTrigger = ({ children }) => children;

// --- Select Bileşenleri ---
const Select = ({ children, ...props }) => <select className={cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50")} {...props}>{children}</select>
const SelectValue = () => null
const SelectTrigger = ({ children }) => children
const SelectContent = ({ children }) => children
const SelectItem = ({ value, children }) => <option value={value}>{children}</option>

// --- DropdownMenu Bileşenleri ---
const DropdownMenu = ({ children }) => <div className="relative inline-block text-left">{children}</div>
const DropdownMenuTrigger = ({ children }) => children
const DropdownMenuContent = ({ children, ...props }) => <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-popover ring-1 ring-black ring-opacity-5 focus:outline-none z-10" {...props}>{children}</div>
const DropdownMenuLabel = ({ className, ...props }) => <div className={cn("px-4 py-2 text-sm font-semibold", className)} {...props} />
const DropdownMenuSeparator = ({ className, ...props }) => <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
const DropdownMenuCheckboxItem = ({ checked, onCheckedChange, children, ...props }) => (
    <label className="flex items-center px-4 py-2 text-sm text-popover-foreground hover:bg-accent cursor-pointer">
        <Checkbox checked={checked} onChange={e => onCheckedChange(e.target.checked)} className="mr-2" />
        {children}
    </label>
)
// --- Tooltip Bileşenleri ---
const TooltipContext = createContext(null);
const TooltipProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return <TooltipContext.Provider value={{ isOpen, setIsOpen }}>{children}</TooltipContext.Provider>
}
const Tooltip = ({ children }) => <div className="relative flex items-center">{children}</div>
const TooltipTrigger = ({ children }) => {
    const { setIsOpen } = useContext(TooltipContext);
    return <div onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>{children}</div>
}
const TooltipContent = ({ children, side = 'right', className, ...props }) => {
    const { isOpen } = useContext(TooltipContext);
    if (!isOpen) return null;
    const sideClasses = {
        right: 'left-full ml-2',
        top: 'bottom-full mb-2',
        bottom: 'top-full mt-2',
        left: 'right-full mr-2'
    }
    return <div className={cn("absolute z-10 whitespace-nowrap bg-popover text-popover-foreground px-3 py-1.5 text-sm rounded-md shadow-md animate-in fade-in-0 zoom-in-95", sideClasses[side], className)} {...props}>{children}</div>
}


// --- SplashScreen Bileşeni ---
import SplashScreen from "@/public/SplashScreen";

// --------------------------------------------------------------------------------
// Electron API ve Veri Tipleri
// --------------------------------------------------------------------------------

interface SigmaVariation {
  material_number: string
  price: number | null
  price_eur?: number | null
  currency: string
  availability_date: string | null
  price_eur_str?: string
  original_price_str?: string
}

interface NetflexResult {
  source: "Netflex"
  product_name: string
  product_code: string
  price_numeric: number | null
  price_str: string
  stock: number | string
}

interface TciVariation {
  unit: string
  original_price: string
  original_price_numeric: number | null
  stock_info?: { country: string; stock: string }[]
  calculated_price_eur?: number | null
  calculated_price_eur_str?: string
}

interface ProductResult {
  source: string
  product_name: string
  product_number: string
  cas_number: string
  brand: string
  sigma_variations: {
    us?: SigmaVariation[]
    de?: SigmaVariation[]
    gb?: SigmaVariation[]
  }
  netflex_matches: NetflexResult[]
  tci_variations?: TciVariation[]
  cheapest_eur_price_str?: string
  cheapest_material_number?: string
  cheapest_source_country?: string
  cheapest_netflex_stock?: number | string
}

interface AssignmentItem {
  product_name: string
  product_code: string
  cas_number: string
  price_numeric: number | null
  price_str: string
  source: string
  cheapest_netflex_stock?: number | string
}

interface AppSettings {
  netflex_username: string
  netflex_password: string
  orkim_username: string
  orkim_password: string
  OCR_API_KEY: string
  tci_coefficient: number
  sigma_coefficient_us: number
  sigma_coefficient_de: number
  sigma_coefficient_gb: number
}

interface SearchHistoryItem {
  term: string
  timestamp: number
}

interface CalendarNote {
  id: string
  date: string // YYYY-MM-DD formatında
  note: string
  meetings: Meeting[]
}

interface Meeting {
  id: string
  type: "görüşme" | "toplantı"
  companyName: string
  authorizedPerson: string
  department: string
  email: string
  phone: string
  meetingNotes: string
  nextMeetingDate: string | null // YYYY-MM-DD formatında
  priority: "low" | "medium" | "high"
  completed: boolean
  notificationFrequency: string
  notificationDailyFrequency: "once" | "twice" | "thrice" | "five_times" | "ten_times" | "hourly"
}

// Global Electron API tanımı
declare global {
  interface Window {
    electronAPI: {
      rendererReady: () => void
      performSearch: (searchTerm: string) => void
      cancelSearch: () => void
      exportToExcel: (data: any) => void
      loadSettings: () => void
      saveSettings: (settings: any) => void
      selectFile: () => Promise<string | null>
      startBatchSearch: (data: { filePath: string; customerName: string }) => void
      cancelBatchSearch: () => void
      cancelCurrentTermSearch: () => void
      getParities: () => void
      onServicesReady: (callback: (isReady: boolean) => void) => () => void
      onInitialSetupRequired: (callback: () => void) => () => void
      onProductFound: (callback: (message: { product: any; context?: any }) => void) => () => void
      onSearchComplete: (callback: (summary: any) => void) => () => void
      onExportResult: (callback: (result: any) => void) => () => void
      onSearchError: (callback: (error: string) => void) => () => void
      onSettingsLoaded: (callback: (settings: any) => void) => () => void
      onSettingsSaved: (callback: (result: any) => void) => () => void
      onAuthenticationError: (callback: () => void) => () => void
      onPythonCrashed: (callback: () => void) => () => void
      onBatchSearchProgress: (callback: (progress: any) => void) => () => void
      onBatchSearchComplete: (callback: (summary: any) => void) => () => void
      onParitiesUpdated: (callback: (parities: any) => void) => () => void
      onLogSearchTerm: (callback: (data: { term: string }) => void) => () => void
      saveCalendarNotes: (notes: CalendarNote[]) => void
      loadCalendarNotes: () => void
      onCalendarNotesLoaded: (callback: (notes: CalendarNote[]) => void) => () => void
      exportMeetings: (data: { notes: CalendarNote[]; startDate: string; endDate: string }) => void
      onExportMeetingsResult: (callback: (result: any) => void) => () => void
    }
  }
}

// --------------------------------------------------------------------------------
// Yardımcı Fonksiyonlar ve Bileşenler
// --------------------------------------------------------------------------------
const formatCurrency = (value: number | null | undefined, currency = "EUR") => {
  if (value === null || value === undefined || isNaN(value)) return "N/A"
  const currencySymbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : "£"
  const locale = currency === "EUR" ? "de-DE" : currency === "USD" ? "en-US" : "en-GB"
  const parts = value.toFixed(2).split(".")
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${parts.join(",")}${currencySymbol}`
}

const stripHtml = (html: string | null | undefined): string => {
  if (!html) return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body.textContent || ""
}

const cleanAndDecodeHtml = (html: string | null | undefined): string => {
  if (!html) return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body.innerHTML
}

const calculateProductPrices = (product: ProductResult, settings: AppSettings, parities: any): ProductResult => {
  // Orkim gibi önceden fiyatı formatlanmış kaynaklar için hesaplamayı atla
  if (product.source === "Orkim") {
    return product
  }

  if (!product || !settings || !parities || parities.error) {
    return {
      ...product,
      cheapest_eur_price_str: "Hesaplanamadı",
      cheapest_material_number: product.product_number,
      cheapest_source_country: product.source || "Bilinmiyor",
    }
  }

  const newProduct = JSON.parse(JSON.stringify(product))
  const allPriceOptions: { price: number; code: string; source: string }[] = []

  if (newProduct.source === "Sigma" && newProduct.sigma_variations) {
    Object.entries(newProduct.sigma_variations).forEach(([countryCode, variations]: [string, any[]]) => {
      const coefficient = settings[`sigma_coefficient_${countryCode}`] || 1.0
      if (variations) {
        variations.forEach((varItem) => {
          const original_price = varItem.price
          const currency = varItem.currency?.toUpperCase()
          varItem.original_price_str = `${original_price ?? "N/A"} ${currency || ""}`.trim()
          varItem.price_eur = null
          varItem.price_eur_str = "N/A"

          if (original_price != null) {
            let base_price_eur: number | null = null
            if (currency === "USD" && parities.usd_eur) base_price_eur = original_price * parities.usd_eur
            else if (currency === "GBP" && parities.gbp_eur) base_price_eur = original_price * parities.gbp_eur
            else if (currency === "EUR") base_price_eur = original_price

            if (base_price_eur != null) {
              const final_price_eur = base_price_eur * coefficient
              varItem.price_eur = final_price_eur
              varItem.price_eur_str = formatCurrency(final_price_eur, "EUR")
              allPriceOptions.push({
                price: final_price_eur,
                code: varItem.material_number,
                source: `Sigma (${countryCode.toUpperCase()})`,
              })
            }
          }
        })
      }
    })
  }

  if (newProduct.source === "TCI" && newProduct.tci_variations) {
    newProduct.tci_variations.forEach((varItem) => {
      const calculatedPrice =
        varItem.original_price_numeric != null
          ? varItem.original_price_numeric * (settings.tci_coefficient || 1.4)
          : null
      varItem.calculated_price_eur = calculatedPrice
      varItem.calculated_price_eur_str = formatCurrency(calculatedPrice, "EUR")

      if (calculatedPrice !== null) {
        allPriceOptions.push({
          price: calculatedPrice,
          code: `${newProduct.product_number}-${varItem.unit}`,
          source: "TCI",
        })
      }
    })
  }

  if (newProduct.netflex_matches) {
    newProduct.netflex_matches.forEach((match) => {
      if (match.price_numeric != null) {
        allPriceOptions.push({
          price: match.price_numeric,
          code: match.product_code,
          source: "Netflex",
        })
      }
    })
  }

  if (allPriceOptions.length > 0) {
    const cheapestOption = allPriceOptions.reduce((min, p) => (p.price < min.price ? p : min), allPriceOptions[0])
    newProduct.cheapest_eur_price_str = formatCurrency(cheapestOption.price, "EUR")
    newProduct.cheapest_material_number = cheapestOption.code
    newProduct.cheapest_source_country = cheapestOption.source
  } else {
    newProduct.cheapest_eur_price_str = "N/A"
    newProduct.cheapest_material_number = newProduct.product_number
    newProduct.cheapest_source_country = newProduct.source
  }

  const priced_matches = newProduct.netflex_matches?.filter((p) => p.price_numeric != null) || []
  if (priced_matches.length > 0) {
    const cheapest_netflex = priced_matches.reduce(
      (min, p) => (p.price_numeric < min.price_numeric ? p : min),
      priced_matches[0],
    )
    newProduct.cheapest_netflex_stock = cheapest_netflex.stock
  } else if (newProduct.source === "TCI" && newProduct.tci_variations) {
    const cheapestTciVariation = newProduct.tci_variations.find(
      (v) => v.calculated_price_eur_str === newProduct.cheapest_eur_price_str,
    )
    newProduct.cheapest_netflex_stock =
      cheapestTciVariation?.stock_info?.map((s) => `${s.country}: ${s.stock}`).join(", ") || "N/A"
  } else {
    newProduct.cheapest_netflex_stock = "N/A"
  }

  return newProduct
}

// --------------------------------------------------------------------------------
// Tema Yönetimi
// --------------------------------------------------------------------------------
const ThemeProviderContext = createContext({ theme: "system", setTheme: (theme: string) => {} })
const ThemeProvider = ({ children, defaultTheme = "system", storageKey = "vite-ui-theme" }) => {
  const [theme, setTheme] = useState(defaultTheme)

  useEffect(() => {
    const storedTheme = localStorage.getItem(storageKey) || defaultTheme
    setTheme(storedTheme)
  }, [storageKey, defaultTheme])

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.add(systemTheme)
      return
    }
    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (newTheme: string) => {
      localStorage.setItem(storageKey, newTheme)
      setTheme(newTheme)
    },
  }
  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>
}
const useTheme = () => useContext(ThemeProviderContext)
const ModeToggle = () => {
  const { theme, setTheme } = useTheme()
  return (
    <Button variant="outline" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Temayı değiştir</span>
    </Button>
  )
}

// --------------------------------------------------------------------------------
// Bildirimler Bileşeni
// --------------------------------------------------------------------------------
const NotificationBell = ({ notifications, onToggleComplete, onGoToDate }) => {
    const [isOpen, setIsOpen] = useState(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative" onClick={() => setIsOpen(!isOpen)}>
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <span className="absolute top-0 right-0 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
            </span>
          )}
          <span className="sr-only">Bildirimler</span>
        </Button>
      </DropdownMenuTrigger>
      {isOpen && (
      <DropdownMenuContent align="center" side="right" className="w-96">
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Bugünün Bildirimleri</span>
          <span className="text-xs font-normal text-muted-foreground">({notifications.length} adet)</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto custom-scrollbar">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <div key={notif.id} className="p-2 text-sm border-b last:border-b-0">
                <p className="font-semibold">{notif.companyName}</p>
                {notif.meetingNotes && <p className="text-muted-foreground text-xs py-1">{notif.meetingNotes}</p>}
                <p className="text-xs text-muted-foreground">
                  Görüşme Tarihi: {new Date(notif.parentNoteDate + "T00:00:00").toLocaleDateString("tr-TR")}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <Button
                    size="xs"
                    variant="ghost"
                    className="text-xs h-7"
                    onClick={() => onGoToDate(notif.parentNoteDate)}
                  >
                    Tarihe Git
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => onToggleComplete(notif.parentNoteDate, notif.id)}
                  >
                    <Check className="h-3 w-3 mr-1" /> Tamamlandı
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="p-4 text-center text-sm text-muted-foreground">Bugün için bildirim yok.</p>
          )}
        </div>
      </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}

// --------------------------------------------------------------------------------
// Sidebar
// --------------------------------------------------------------------------------
const Sidebar = ({ setPage, currentPage, notifications, onToggleComplete, onGoToDate }) => {
  const navItems = [
    { name: "home", href: "#", icon: User, label: "Müşteri Listesi" },
    { name: "search", href: "#", icon: Search, label: "Ürün Arama" },
    { name: "batch-search", href: "#", icon: FileSearch, label: "Toplu Proforma Arama" },
    { name: "frequent-searches", href: "#", icon: TrendingUp, label: "Sık Aratılanlar" },
    { name: "search-history", href: "#", icon: History, label: "Arama Geçmişi" },
    { name: "calendar", href: "#", icon: Calendar, label: "Ajanda" },
    { name: "settings", href: "#", icon: Settings, label: "Ayarlar" },
  ]
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
        <div className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base">
          <Package2 className="h-4 w-4 transition-all group-hover:scale-110" />
          <span className="sr-only">Tales Job</span>
        </div>
        <TooltipProvider>
          {navItems.map((item) => (
            <Tooltip key={item.name}>
              <TooltipTrigger>
                <a
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault()
                    setPage(item.name)
                  }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8",
                    { "bg-accent text-accent-foreground": currentPage === item.name },
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="sr-only">{item.label}</span>
                </a>
              </TooltipTrigger>
              <TooltipContent>{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </nav>
      <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
        <NotificationBell
          notifications={notifications}
          onToggleComplete={onToggleComplete}
          onGoToDate={onGoToDate}
        />
        <ModeToggle />
      </nav>
    </aside>
  )
}
// --------------------------------------------------------------------------------
// Ayarlar Sayfası ve İlk Kurulum Ekranı
// --------------------------------------------------------------------------------
const SettingsForm = ({ initialSettings, onSave, isSaving, isInitialSetup = false }) => {
  const [settings, setSettings] = useState(initialSettings)
  useEffect(() => {
    setSettings(initialSettings)
  }, [initialSettings])
  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }
  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(settings)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Netflex API Bilgileri
          </CardTitle>
          <CardDescription>Netflex sisteminden veri çekmek için kullanılacak kullanıcı adı ve şifre.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="netflex_username">Kullanıcı Adı</Label>
            <Input
              id="netflex_username"
              value={settings.netflex_username || ""}
              onChange={(e) => handleChange("netflex_username", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="netflex_password">Şifre</Label>
            <Input
              id="netflex_password"
              type="password"
              value={settings.netflex_password || ""}
              onChange={(e) => handleChange("netflex_password", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" /> Sigma Fiyatlandırma
          </CardTitle>
          <CardDescription>
            Sigma-Aldrich ürünlerinin EUR fiyatları ile çarpılacak ülkeye özel katsayılar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sigma_coefficient_us">Amerika (US) Katsayısı</Label>
            <Input
              id="sigma_coefficient_us"
              type="number"
              step="0.1"
              value={settings.sigma_coefficient_us || 1.0}
              onChange={(e) => handleChange("sigma_coefficient_us", Number.parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sigma_coefficient_de">Almanya (DE) Katsayısı</Label>
            <Input
              id="sigma_coefficient_de"
              type="number"
              step="0.1"
              value={settings.sigma_coefficient_de || 1.0}
              onChange={(e) => handleChange("sigma_coefficient_de", Number.parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sigma_coefficient_gb">İngiltere (GB) Katsayısı</Label>
            <Input
              id="sigma_coefficient_gb"
              type="number"
              step="0.1"
              value={settings.sigma_coefficient_gb || 1.0}
              onChange={(e) => handleChange("sigma_coefficient_gb", Number.parseFloat(e.target.value) || 0)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" /> TCI Fiyatlandırma
          </CardTitle>
          <CardDescription>TCI ürünlerinin orijinal fiyatı ile çarpılacak katsayı.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="tci_coefficient">Fiyat Katsayısı</Label>
            <Input
              id="tci_coefficient"
              type="number"
              step="0.1"
              value={settings.tci_coefficient || 1.4}
              onChange={(e) => handleChange("tci_coefficient", Number.parseFloat(e.target.value) || 0)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Orkim Market Bilgileri
          </CardTitle>
          <CardDescription>
            Orkim Market sistemine giriş ve CAPTCHA çözümü için gerekli bilgiler.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orkim_username">Kullanıcı Adı</Label>
            <Input
              id="orkim_username"
              value={settings.orkim_username || ""}
              onChange={(e) => handleChange("orkim_username", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orkim_password">Şifre</Label>
            <Input
              id="orkim_password"
              type="password"
              value={settings.orkim_password || ""}
              onChange={(e) => handleChange("orkim_password", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="OCR_API_KEY">OpenAI API Anahtarı (CAPTCHA için)</Label>
            <Input
              id="OCR_API_KEY"
              type="password"
              value={settings.OCR_API_KEY || ""}
              onChange={(e) => handleChange("OCR_API_KEY", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isInitialSetup ? "Ayarları Kaydet ve Başlat" : "Ayarları Kaydet"}
        </Button>
      </div>
    </form>
  )
}
const SettingsPage = ({ authError, settings, onSaveSettings, toast }) => {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (newSettings: AppSettings) => {
    setIsSaving(true)
    const cleanup = window.electronAPI.onSettingsSaved((result) => {
      if (result.status === "success") {
        toast("success", "Ayarlar başarıyla kaydedildi.")
        onSaveSettings(newSettings)
      } else {
        toast("error", `Ayarlar kaydedilemedi: ${result.message}`)
      }
      setIsSaving(false)
      cleanup()
    })
    window.electronAPI.saveSettings(newSettings)
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Uygulama Ayarları</h1>
      {authError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Kimlik Doğrulama Hatası!</AlertTitle>
          <AlertDescription>
            Netflex kullanıcı adı veya şifreniz yanlış. Lütfen bilgilerinizi kontrol edip tekrar kaydedin.
          </AlertDescription>
        </Alert>
      )}
      {settings ? (
        <SettingsForm initialSettings={settings} onSave={handleSave} isSaving={isSaving} />
      ) : (
        <div className="flex justify-center items-center h-64">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  )
}
const InitialSetupScreen = ({ setAppStatus }) => {
  const [isSaving, setIsSaving] = useState(false)
  const onSave = (settings) => {
    setIsSaving(true)
    setAppStatus("initializing")
    window.electronAPI.saveSettings(settings)
  }
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <Card className="shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Wrench className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Uygulama Kurulumu</CardTitle>
            <CardDescription>Devam etmeden önce temel ayarları yapmanız gerekmektedir.</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm
              initialSettings={{
                netflex_username: "",
                netflex_password: "",
                orkim_username: "",
                orkim_password: "",
                OCR_API_KEY: "",
                tci_coefficient: 1.4,
                sigma_coefficient_us: 1.0,
                sigma_coefficient_de: 1.0,
                sigma_coefficient_gb: 1.0,
              }}
              onSave={onSave}
              isSaving={isSaving}
              isInitialSetup={true}
            />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// --------------------------------------------------------------------------------
// Müşteri (Ana Sayfa)
// --------------------------------------------------------------------------------
const CustomerPage = ({ assignments, setAssignments, toast }) => {
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportCustomerName, setExportCustomerName] = useState("")
  const [selectedForDeletion, setSelectedForDeletion] = useState<AssignmentItem[]>([])

  const handleDeleteAssignment = (productToRemove: AssignmentItem) => {
    setAssignments((prev) =>
      prev.filter((p) => !(p.product_code === productToRemove.product_code && p.source === productToRemove.source)),
    )
    toast("warning", `'${stripHtml(productToRemove.product_name)}' listeden kaldırıldı.`)
  }

  const handleBulkDelete = () => {
    if (selectedForDeletion.length === 0) return
    const itemsToDeleteKeys = new Set(selectedForDeletion.map((p) => `${p.product_code}-${p.source}`))
    setAssignments((prev) => prev.filter((p) => !itemsToDeleteKeys.has(`${p.product_code}-${p.source}`)))
    toast("warning", `${selectedForDeletion.length} ürün listeden kaldırıldı.`)
    setSelectedForDeletion([])
  }

  const handleRowSelect = (product: AssignmentItem) => {
    setSelectedForDeletion((prev) => {
      const isSelected = prev.some((p) => p.product_code === product.product_code && p.source === product.source)
      if (isSelected) {
        return prev.filter((p) => !(p.product_code === product.product_code && p.source === product.source))
      } else {
        return [...prev, product]
      }
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedForDeletion(assignments)
    } else {
      setSelectedForDeletion([])
    }
  }

  const isAllSelected = assignments.length > 0 && selectedForDeletion.length === assignments.length

  const handleExport = () => {
    if (!exportCustomerName.trim()) {
      toast("error", "Lütfen bir müşteri adı girin.")
      return
    }
    toast("info", "Excel dosyası oluşturuluyor...")
    window.electronAPI.exportToExcel({ customerName: exportCustomerName, products: assignments })
    setIsExportDialogOpen(false)
    setExportCustomerName("")
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Müşteri Listesi - Atanmış Ürünler</h1>
        <div className="flex items-center gap-2">
          <Button variant="destructive" onClick={handleBulkDelete} disabled={selectedForDeletion.length === 0}>
            <Trash2 className="mr-2 h-4 w-4" /> Seçilenleri Sil ({selectedForDeletion.length})
          </Button>

          <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={assignments.length === 0} onClick={() => setIsExportDialogOpen(true)}>
                <FileDown className="mr-2 h-4 w-4" /> Excel'e Aktar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excel'e Aktar</DialogTitle>
                <DialogDescription>Dosya adında kullanılacak müşteri adını girin.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="customerNameExport">Müşteri Adı</Label>
                <Input
                  id="customerNameExport"
                  value={exportCustomerName}
                  onChange={(e) => setExportCustomerName(e.target.value)}
                  placeholder="Örn: Proje A Müşterisi"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                  İptal
                </Button>
                <Button onClick={handleExport}>Onayla ve Aktar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {assignments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      aria-label="Tümünü seç"
                    />
                  </TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Ürün Adı</TableHead>
                  <TableHead>Kodu</TableHead>
                  <TableHead>Fiyat</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead className="w-[50px] text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((product, index) => {
                  const isRowSelected = selectedForDeletion.some(
                    (p) => p.product_code === product.product_code && p.source === product.source,
                  )
                  return (
                    <TableRow key={`${product.product_code}-${index}`} data-state={isRowSelected ? "selected" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={isRowSelected}
                          onChange={() => handleRowSelect(product)}
                          aria-label="Satırı seç"
                        />
                      </TableCell>
                      <TableCell>{product.source}</TableCell>
                      <TableCell
                        className="font-medium"
                        dangerouslySetInnerHTML={{ __html: cleanAndDecodeHtml(product.product_name) }}
                      />
                      <TableCell>{product.product_code}</TableCell>
                      <TableCell>{product.price_str}</TableCell>
                      <TableCell>{product.cheapest_netflex_stock ?? "N/A"}</TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteAssignment(product)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Ürünü Sil</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Henüz atanmış bir ürün bulunmuyor.</p>
              <p className="text-sm text-muted-foreground">Ürün atamak için Arama sayfalarını kullanabilirsiniz.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// --------------------------------------------------------------------------------
// Ürün Atama Buton Bileşeni
// --------------------------------------------------------------------------------
const AssignmentButton = ({ selectedForAssignment, handleAssignConfirm }) => {
  if (selectedForAssignment.length === 0) {
    return null
  }

  const handleDirectAssign = () => {
    handleAssignConfirm(selectedForAssignment)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button className="shadow-lg" onClick={handleDirectAssign}>
        <UserPlus className="mr-2 h-4 w-4" />
        {selectedForAssignment.length} Ürünü Ata
      </Button>
    </div>
  )
}

// --------------------------------------------------------------------------------
// Ürün Arama Sayfası (Ortak Bileşenler)
// --------------------------------------------------------------------------------

const ProductResultItem = ({
  product,
  settings,
  expandedProducts,
  toggleProductExpansion,
  selectedForAssignment,
  onSelectionChange,
  isProductNameVisible,
  showOriginalPrices,
}) => {
  const countryHeaders = { us: "Amerika (US)", de: "Almanya (DE)", gb: "İngiltere (GB)" }

  const gridClasses = cn(
    "grid gap-x-4 items-center p-4 hover:bg-muted/50",
    isProductNameVisible
      ? "grid-cols-[150px_150px_150px_150px_120px_1fr_auto]"
      : "grid-cols-[150px_150px_150px_150px_120px_auto]",
  )

  const getCombinedData = useMemo(() => {
    const dataMap: { [key: string]: any } = {}
    if (product.source === "Sigma") {
      Object.entries(product.sigma_variations).forEach(([country, variations]) => {
        if (variations) {
          variations.forEach((variation) => {
            const key = variation.material_number
            if (!dataMap[key]) {
              dataMap[key] = { material_number: key, sigma: {}, netflex: null }
            }
            dataMap[key].sigma[country] = variation
          })
        }
      })
      product.netflex_matches.forEach((match) => {
        const key = match.product_code.replace(".", "")
        if (!dataMap[key]) {
          dataMap[key] = { material_number: key, sigma: {}, netflex: null }
        }
        dataMap[key].netflex = match
      })
    }
    return Object.values(dataMap)
  }, [product])

  const handleSelectSigma = (product: ProductResult, item, countryCode, priceData) => {
    const assignmentItem: AssignmentItem = {
      product_name: product.product_name,
      product_code: item.material_number,
      cas_number: product.cas_number,
      price_numeric: priceData.price_eur,
      price_str: priceData.price_eur_str,
      source: `Sigma (${countryCode.toUpperCase()})`,
      cheapest_netflex_stock: "N/A",
    }
    onSelectionChange(assignmentItem)
  }

  const handleSelectNetflex = (product: ProductResult, item) => {
    const assignmentItem: AssignmentItem = {
      product_name: item.netflex.product_name,
      product_code: item.material_number,
      cas_number: product.cas_number,
      price_numeric: item.netflex.price_numeric,
      price_str: item.netflex.price_str,
      source: "Netflex",
      cheapest_netflex_stock: item.netflex.stock,
    }
    onSelectionChange(assignmentItem)
  }

  const handleSelectTCI = (product: ProductResult, variation: TciVariation) => {
    const assignmentItem: AssignmentItem = {
      product_name: product.product_name,
      product_code: `${product.product_number}-${variation.unit}`,
      cas_number: product.cas_number,
      price_numeric: variation.calculated_price_eur,
      price_str: variation.calculated_price_eur_str,
      source: "TCI",
      cheapest_netflex_stock: variation.stock_info?.map((s) => `${s.country}: ${s.stock}`).join(", ") || "N/A",
    }
    onSelectionChange(assignmentItem)
  }

  return (
    <div className="border rounded-lg">
      <div className={gridClasses}>
        <div>{product.cas_number}</div>
        <div className="font-mono">{product.cheapest_material_number || product.product_number}</div>
        <div className="font-semibold flex items-center gap-2 truncate" title={product.brand}>
          <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />{" "}
          <span className="truncate">{product.brand}</span>
        </div>
        <div className="font-semibold">{product.cheapest_eur_price_str}</div>
        <div className="truncate" title={product.cheapest_source_country}>
          {product.cheapest_source_country}
        </div>
        {isProductNameVisible && (
          <div
            className="min-w-0 font-medium truncate"
            title={stripHtml(product.product_name)}
            dangerouslySetInnerHTML={{ __html: cleanAndDecodeHtml(product.product_name) }}
          />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => toggleProductExpansion(product.product_number)}
          className="justify-self-end"
        >
          {expandedProducts.has(product.product_number) ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      <AnimatePresence>
        {expandedProducts.has(product.product_number) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t bg-muted/20 p-4 overflow-hidden"
          >
            <h4 className="font-semibold mb-3">Ürün Varyasyonları</h4>
            {product.source === "Sigma" ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Ürün Kodu</TableHead>
                      <TableHead>Netflex</TableHead>
                      {Object.entries(countryHeaders).map(([code, name]) => (
                        <TableHead key={code}>{name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getCombinedData.map((item, itemIndex) => {
                      const isCheapestNetflex =
                        item.netflex &&
                        item.netflex.price_numeric !== null &&
                        product.cheapest_eur_price_str === item.netflex.price_str
                      return (
                        <TableRow key={itemIndex}>
                          <TableCell className="font-mono">{item.material_number}</TableCell>
                          <TableCell>
                            {item.netflex ? (
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`cb-netflex-${item.material_number}`}
                                  onChange={() => handleSelectNetflex(product, item)}
                                  checked={selectedForAssignment.some(
                                    (p) => p.product_code === item.material_number && p.source === "Netflex",
                                  )}
                                  className="h-5 w-5 border-slate-400 data-[state=checked]:border-primary"
                                />
                                <Label
                                  htmlFor={`cb-netflex-${item.material_number}`}
                                  className="flex-grow cursor-pointer"
                                >
                                  <div className="flex flex-col">
                                    <div
                                      className={cn(
                                        "flex items-baseline gap-2",
                                        isCheapestNetflex && "text-red-600 font-bold",
                                      )}
                                    >
                                      <span>{item.netflex.price_str}</span>
                                      <span className="font-medium text-sm text-muted-foreground">
                                        Stok: {item.netflex.stock}
                                      </span>
                                    </div>
                                    <span
                                      className="text-xs text-muted-foreground truncate"
                                      title={stripHtml(item.netflex.product_name)}
                                      dangerouslySetInnerHTML={{
                                        __html: cleanAndDecodeHtml(item.netflex.product_name),
                                      }}
                                    />
                                  </div>
                                </Label>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          {Object.keys(countryHeaders).map((code) => {
                            const isCheapestSigma =
                              item.sigma[code] &&
                              item.sigma[code].price_eur !== null &&
                              product.cheapest_eur_price_str === item.sigma[code].price_eur_str
                            return (
                              <TableCell key={code}>
                                {item.sigma[code] ? (
                                  <div className="flex items-start gap-2">
                                    <Checkbox
                                      id={`cb-${code}-${item.material_number}`}
                                      onChange={() => handleSelectSigma(product, item, code, item.sigma[code])}
                                      checked={selectedForAssignment.some(
                                        (p) =>
                                          p.product_code === item.material_number &&
                                          p.source === `Sigma (${code.toUpperCase()})`,
                                      )}
                                      className="h-5 w-5 border-slate-400 data-[state=checked]:border-primary mt-1"
                                    />
                                    <Label
                                      htmlFor={`cb-${code}-${item.material_number}`}
                                      className={cn(
                                        "flex flex-col cursor-pointer",
                                        isCheapestSigma && "text-red-600 font-bold",
                                      )}
                                    >
                                      <span className="whitespace-nowrap font-semibold">
                                        {item.sigma[code].price_eur_str || "N/A"}
                                      </span>
                                      {showOriginalPrices && (
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                          {item.sigma[code].original_price_str || "..."}
                                        </span>
                                      )}
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {item.sigma[code].availability_date || "Tarih Yok"}
                                      </span>
                                    </Label>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Birim</TableHead>
                    <TableHead>Orijinal Fiyat</TableHead>
                    <TableHead>Hesaplanmış Fiyat (x{settings?.tci_coefficient || 1.4})</TableHead>
                    <TableHead>Stok Durumu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.tci_variations?.map((variation, vIndex) => (
                    <TableRow key={vIndex}>
                      <TableCell>
                        <Checkbox
                          id={`cb-tci-${product.product_number}-${vIndex}`}
                          onChange={() => handleSelectTCI(product, variation)}
                          checked={selectedForAssignment.some(
                            (p) =>
                              p.product_code === `${product.product_number}-${variation.unit}` && p.source === "TCI",
                          )}
                          className="h-5 w-5 border-slate-400 data-[state=checked]:border-primary"
                        />
                      </TableCell>
                      <TableCell>{variation.unit}</TableCell>
                      <TableCell>{variation.original_price}</TableCell>
                      <TableCell className="font-semibold">{variation.calculated_price_eur_str || "N/A"}</TableCell>
                      <TableCell className="text-xs">
                        {variation.stock_info && variation.stock_info.length > 0
                          ? variation.stock_info.map((s) => `${s.country}: ${s.stock}`).join(", ")
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
const MemoizedProductResultItem = React.memo(ProductResultItem)

// --------------------------------------------------------------------------------
// Ürün Arama Sayfası
// --------------------------------------------------------------------------------
const SearchPage = ({
  searchResults,
  isLoading,
  error,
  handleSearch,
  handleCancel,
  onAssignProducts,
  settings,
  initialSearchTerm,
  onSearchExecuted,
  toast
}) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || "")
  const [filterTerm, setFilterTerm] = useState("")
  const [debouncedFilterTerm, setDebouncedFilterTerm] = useState("")
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({ brands: { sigma: true, tci: true, orkim: true } })
  const [isProductNameVisible, setIsProductNameVisible] = useState(false)
  const [showOriginalPrices, setShowOriginalPrices] = useState(false)
  const [selectedForAssignment, setSelectedForAssignment] = useState<AssignmentItem[]>([])
  const [isHovering, setIsHovering] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const isMounted = useRef(false);

  useEffect(() => {
    // Bu effect'in yalnızca component mount edildikten sonra çalışmasını sağlıyoruz
    // Arama geçmişinden gelindiğinde ilk render'da aramayı tetiklememek için
    if (isMounted.current) {
        if (initialSearchTerm) {
            setSearchTerm(initialSearchTerm);
            handleSearch(initialSearchTerm);
            onSearchExecuted();
        }
    } else {
        // Component mount olduğunda, initialSearchTerm'i state'e ata
        if(initialSearchTerm) {
            setSearchTerm(initialSearchTerm);
        }
        isMounted.current = true;
    }
}, [initialSearchTerm, handleSearch, onSearchExecuted]);


  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilterTerm(filterTerm)
    }, 300)
    return () => clearTimeout(handler)
  }, [filterTerm])

  useEffect(() => {
    if (isLoading) {
      const newProgress = 1 - 1 / (searchResults.length + 1.5)
      setProgress(Math.min(newProgress, 0.95))
    } else {
      setProgress(0)
    }
  }, [searchResults.length, isLoading])

  const onSearchOrCancelClick = () => {
    if (isLoading) {
      handleCancel()
    } else {
      setFilterTerm("")
      setDebouncedFilterTerm("")
      handleSearch(searchTerm)
    }
  }

  const toggleProductExpansion = (productNumber: string) => {
    setExpandedProducts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(productNumber)) {
        newSet.delete(productNumber)
      } else {
        newSet.add(productNumber)
      }
      return newSet
    })
  }

  const handleSelectionChange = (item: AssignmentItem) => {
    setSelectedForAssignment((prev) => {
      const isSelected = prev.some((p) => p.product_code === item.product_code && p.source === item.source)
      if (isSelected) {
        return prev.filter((p) => !(p.product_code === item.product_code && p.source === item.source))
      } else {
        return [...prev, item]
      }
    })
  }

  const handleAssignConfirm = (products: AssignmentItem[]) => {
    onAssignProducts(products)
    toast("success", `${products.length} ürün, müşteri listesine atandı!`)
    setSelectedForAssignment([])
  }

  const handleFilterChange = (type, key, value) => {
    setFilters((prev) => ({ ...prev, [type]: { ...prev[type], [key]: value } }))
  }

  const filteredResults = useMemo(() => {
    const lowerCaseFilter = debouncedFilterTerm.toLowerCase().trim()
    return searchResults.filter((product) => {
      const brand = product.brand.toLowerCase()
      const brandMatch =
        (brand.includes("sigma") && filters.brands.sigma) ||
        (brand.includes("tci") && filters.brands.tci) ||
        (brand.includes("orkim") && filters.brands.orkim)

      if (!brandMatch) return false
      if (lowerCaseFilter) {
        const nameMatch = stripHtml(product.product_name).toLowerCase().includes(lowerCaseFilter)
        const numberMatch = product.product_number.toLowerCase().includes(lowerCaseFilter)
        const casMatch = product.cas_number.toLowerCase().includes(lowerCaseFilter)
        return nameMatch || numberMatch || casMatch
      }
      return true
    })
  }, [searchResults, filters, debouncedFilterTerm])

  const headerGridClasses = cn(
    "grid gap-x-4 font-semibold text-sm text-muted-foreground",
    isProductNameVisible
      ? "grid-cols-[150px_150px_150px_150px_120px_1fr_auto]"
      : "grid-cols-[150px_150px_150px_150px_120px_auto]",
  )

  return (
    <div className="container mx-auto p-4 flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold mb-4">Ürün Arama ve Atama</h1>
        <div className="flex gap-2 mb-4">
          <Input
            type="search"
            placeholder="Ürün adı, kodu veya CAS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isLoading && onSearchOrCancelClick()}
            disabled={isLoading}
          />
          <Button
            onClick={onSearchOrCancelClick}
            onMouseEnter={() => {
              if (isLoading) setIsHovering(true)
            }}
            onMouseLeave={() => {
              if (isLoading) setIsHovering(false)
            }}
            className={cn(
              "relative w-36 overflow-hidden transition-all duration-300 ease-in-out",
              isLoading && isHovering && "w-44",
            )}
            variant={isLoading && isHovering ? "destructive" : "default"}
          >
            <div className="relative z-10">
              <AnimatePresence mode="wait">
                {isLoading && isHovering ? (
                  <motion.span
                    key="cancel"
                    className="flex items-center justify-center"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                  >
                    <XCircle className="mr-2 h-5 w-5" /> Aramayı İptal Et
                  </motion.span>
                ) : isLoading ? (
                  <motion.span
                    key="searching"
                    className="flex items-center justify-center"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LoaderCircle className="h-4 w-4 animate-spin mr-2" /> Aranıyor...
                  </motion.span>
                ) : (
                  <motion.span
                    key="search"
                    className="flex items-center justify-center"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Search className="mr-2 h-4 w-4" /> Ara
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            {isLoading && !isHovering && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 bg-primary/20"
                initial={{ height: "0%" }}
                animate={{ height: `${progress * 100}%` }}
                transition={{ type: "spring", stiffness: 50, damping: 20 }}
                style={{ zIndex: 5 }}
              />
            )}
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button variant="outline" size="icon" onClick={() => setShowOriginalPrices(!showOriginalPrices)}>
                  <span className="sr-only">Orijinal Fiyatları Gizle/Göster</span>
                  {showOriginalPrices ? <Euro className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Orijinal Fiyatları Göster/Gizle</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <Button variant="outline" size="icon" onClick={() => setIsProductNameVisible(!isProductNameVisible)}>
                  <span className="sr-only">Ürün Adını Gizle/Göster</span>
                  {isProductNameVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ürün Adı Sütununu Göster/Gizle</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                <ListFilter className="mr-2 h-4 w-4" /> Marka Filtrele
              </Button>
            </DropdownMenuTrigger>
            {isDropdownOpen && (
            <DropdownMenuContent align="end" side="bottom" className="w-56">
              <DropdownMenuLabel>Marka</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filters.brands.sigma}
                onCheckedChange={(checked) => handleFilterChange("brands", "sigma", checked)}
                onSelect={(e) => e.preventDefault()}
              >
                Sigma
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.brands.tci}
                onCheckedChange={(checked) => handleFilterChange("brands", "tci", checked)}
                onSelect={(e) => e.preventDefault()}
              >
                TCI
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.brands.orkim}
                onCheckedChange={(checked) => handleFilterChange("brands", "orkim", checked)}
                onSelect={(e) => e.preventDefault()}
              >
                Orkim
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
            )}
          </DropdownMenu>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Hata</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {searchResults.length > 0 && (
        <Card className="flex-grow flex flex-col overflow-hidden mt-4">
          <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between">
            <CardTitle>Arama Sonuçları ({filteredResults.length})</CardTitle>
            <div className="relative w-full max-w-xs">
              <Input
                placeholder="Sonuçlar içinde ara..."
                value={filterTerm}
                onChange={(e) => setFilterTerm(e.target.value)}
                className="pl-8"
              />
              <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col overflow-hidden p-0">
            <div className="p-4 border-b bg-muted/40 flex-shrink-0">
              <div className={headerGridClasses}>
                <div className="truncate">CAS</div>
                <div className="truncate">En Ucuz Kod</div>
                <div className="truncate">Marka</div>
                <div className="truncate">En Ucuz Fiyat (EUR)</div>
                <div className="truncate">Kaynak</div>
                {isProductNameVisible && <div className="truncate">Ürün Adı</div>}
                <div className="w-9"></div>
              </div>
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar p-4">
              <div className="space-y-2">
                {filteredResults.map((product, index) => (
                  <MemoizedProductResultItem
                    key={`${product.source}-${product.product_number}-${index}`}
                    product={product}
                    settings={settings}
                    expandedProducts={expandedProducts}
                    toggleProductExpansion={toggleProductExpansion}
                    selectedForAssignment={selectedForAssignment}
                    onSelectionChange={handleSelectionChange}
                    isProductNameVisible={isProductNameVisible}
                    showOriginalPrices={showOriginalPrices}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && searchResults.length === 0 && (
        <div className="text-center py-10 flex-grow flex flex-col justify-center items-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Arama yapmak için yukarıdaki alanı kullanın.</p>
        </div>
      )}

      <AssignmentButton
        selectedForAssignment={selectedForAssignment}
        handleAssignConfirm={handleAssignConfirm}
      />
    </div>
  )
}

// --------------------------------------------------------------------------------
// Toplu Proforma Arama Sayfası
// --------------------------------------------------------------------------------
const BatchSearchPage = ({ onAssignProducts, settings, batchState, setBatchState, toast }) => {
  const {
    pageState,
    filePath,
    fileName,
    customerName,
    searchProgress,
    batchResults,
    expandedProducts,
    selectedForAssignment,
    selectedTerm,
  } = batchState
  const [filterTerm, setFilterTerm] = useState("")
  const [debouncedFilterTerm, setDebouncedFilterTerm] = useState("")
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false)
  const [isProductNameVisible, setIsProductNameVisible] = useState(false)
  const [showOriginalPrices, setShowOriginalPrices] = useState(false)

  const updateState = (newState) => {
    setBatchState((prev) => ({ ...prev, ...newState }))
  }

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilterTerm(filterTerm)
    }, 300)
    return () => clearTimeout(handler)
  }, [filterTerm])

  useEffect(() => {
    if (!window.electronAPI) return
    const cleanup = window.electronAPI.onProductFound(({ product, context }) => {
      if (context?.batch_search_term) {
        setBatchState((prev) => {
          const newResults = new Map(prev.batchResults)
          const term = context.batch_search_term
          const existing = newResults.get(term) || []
          const isProductAlreadyInList = existing.some((p) => p.product_number === product.product_number)
          if (!isProductAlreadyInList) {
            newResults.set(term, [...existing, product])
          }
          return { ...prev, batchResults: newResults }
        })
      }
    })
    return () => cleanup()
  }, [setBatchState])

  useEffect(() => {
    if (!window.electronAPI) return
    const cleanups = [
      window.electronAPI.onBatchSearchProgress((progress) => {
        setBatchState((prev) => {
          const isFirstUpdate = progress.current === 1 && !prev.selectedTerm
          return {
            ...prev,
            searchProgress: { ...progress, running: true },
            selectedTerm: isFirstUpdate ? progress.term : prev.selectedTerm,
          }
        })
      }),
      window.electronAPI.onBatchSearchComplete((summary) => {
        setBatchState((prev) => ({ ...prev, searchProgress: { ...prev.searchProgress, running: false } }))
        if (summary.status === "cancelled") {
          toast("warning", "Toplu arama iptal edildi.")
        } else if (summary.status === "complete") {
          toast("success", "Toplu arama tamamlandı!")
        }
      }),
    ]
    return () => cleanups.forEach((c) => c())
  }, [setBatchState])

  const handleFileSelect = async () => {
    const selectedPath = await window.electronAPI.selectFile()
    if (selectedPath) {
      updateState({ filePath: selectedPath, fileName: selectedPath.split(/[\\/]/).pop() || null })
      setIsCustomerDialogOpen(true)
    }
  }

  const handleStartSearch = () => {
    if (!filePath || !customerName.trim()) {
      toast("error", "Lütfen dosya seçip müşteri adı girin.")
      return
    }
    setIsCustomerDialogOpen(false)
    setBatchState((prev) => ({
      ...prev,
      pageState: "searching_and_results",
      batchResults: new Map(),
      selectedForAssignment: [],
      selectedTerm: null,
    }))
    window.electronAPI.startBatchSearch({ filePath, customerName })
  }

  const handleCancelSearch = () => {
    window.electronAPI.cancelBatchSearch()
  }
  const handleSkipTerm = () => {
    toast("info", `'${searchProgress.term}' araması atlanıyor...`)
    window.electronAPI.cancelCurrentTermSearch()
  }
  const handleResetBatchSearch = () => {
    window.electronAPI.cancelBatchSearch()
    updateState({
      pageState: "idle",
      filePath: null,
      fileName: null,
      customerName: "",
      searchProgress: { term: "", current: 0, total: 0, running: false },
      batchResults: new Map(),
      selectedForAssignment: [],
      selectedTerm: null,
    })
  }

  const handleSelectionChange = (item: AssignmentItem) => {
    setBatchState((prev) => {
      const isSelected = prev.selectedForAssignment.some(
        (p) => p.product_code === item.product_code && p.source === item.source,
      )
      const newSelection = isSelected
        ? prev.selectedForAssignment.filter((p) => !(p.product_code === item.product_code && p.source === item.source))
        : [...prev.selectedForAssignment, item]
      return { ...prev, selectedForAssignment: newSelection }
    })
  }

  const handleAssignConfirm = (products: AssignmentItem[]) => {
    onAssignProducts(products)
    toast("success", `${products.length} ürün, ${customerName} adlı müşteriye atandı!`)
    updateState({ selectedForAssignment: [] })
  }

  const toggleProductExpansion = (productNumber: string) => {
    setBatchState((prev) => {
      const newSet = new Set(prev.expandedProducts)
      if (newSet.has(productNumber)) {
        newSet.delete(productNumber)
      } else {
        newSet.add(productNumber)
      }
      return { ...prev, expandedProducts: newSet }
    })
  }

  const resultsArray = useMemo(() => Array.from(batchResults.keys()), [batchResults])

  const currentResultsForSelectedTerm = useMemo(() => {
    const results = batchResults.get(selectedTerm) || []
    const lowerCaseFilter = debouncedFilterTerm.toLowerCase().trim()
    if (!lowerCaseFilter) {
      return results
    }
    return results.filter((product) => {
      const nameMatch = stripHtml(product.product_name).toLowerCase().includes(lowerCaseFilter)
      const numberMatch = product.product_number.toLowerCase().includes(lowerCaseFilter)
      const casMatch = product.cas_number.toLowerCase().includes(lowerCaseFilter)
      return nameMatch || numberMatch || casMatch
    })
  }, [batchResults, selectedTerm, debouncedFilterTerm])

  return (
    <div className="container mx-auto p-4 h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Toplu Proforma Arama</h1>
          {pageState !== "idle" && (
            <Button variant="outline" onClick={handleResetBatchSearch}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Yeni Toplu Arama
            </Button>
          )}
        </div>
      </div>

      {pageState === "idle" && (
        <div className="flex-grow flex items-center justify-center">
          <Card className="text-center w-full max-w-lg">
            <CardHeader>
              <CardTitle>Arama Dosyasını Yükleyin</CardTitle>
              <CardDescription>
                Ürünleri aramak için `.xlsx`, `.csv` veya `.docx` formatında bir dosya seçin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" onClick={handleFileSelect}>
                <Upload className="mr-2 h-5 w-5" /> Dosya Seç
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Müşteri Bilgisi</DialogTitle>
            <DialogDescription>Arama sonuçlarının atanacağı müşterinin adını ve soyadını girin.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="customerName">Müşteri Adı Soyadı</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => updateState({ customerName: e.target.value })}
              placeholder="Örn: Ahmet Yılmaz"
            />
            <p className="text-sm text-muted-foreground pt-2">
              Seçilen Dosya: <strong>{fileName}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCustomerDialogOpen(false)
              }}
            >
              İptal
            </Button>
            <Button onClick={handleStartSearch}>Aramayı Başlat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pageState === "searching_and_results" && (
        <div className="flex-grow flex flex-col overflow-hidden">
          {searchProgress.running && (
            <Card className="mb-4 flex-shrink-0">
              <CardHeader>
                <CardTitle>Arama Devam Ediyor...</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={(searchProgress.current / searchProgress.total) * 100} className="w-full" />
                <div className="text-sm text-muted-foreground text-center">
                  <p>
                    ({searchProgress.current}/{searchProgress.total}) - <strong>{searchProgress.term}</strong>{" "}
                    aranıyor...
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button variant="outline" className="w-full bg-transparent" onClick={handleSkipTerm}>
                    <SkipForward className="mr-2 h-4 w-4" /> Sıradakine Geç
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={handleCancelSearch}>
                    <XCircle className="mr-2 h-4 w-4" /> Tüm Aramayı İptal Et
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-6 flex-grow overflow-hidden">
            <aside className="w-1/3 lg:w-1/4 h-full">
              <Card className="h-full flex flex-col">
                <CardHeader className="flex-shrink-0">
                  <CardTitle>Arama Terimleri</CardTitle>
                  <CardDescription>{resultsArray.length} ürün arandı.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow overflow-y-auto custom-scrollbar p-2">
                  {resultsArray.map((term) => (
                    <Button
                      key={term}
                      variant={selectedTerm === term ? "secondary" : "ghost"}
                      className="w-full justify-between h-auto py-2"
                      onClick={() => updateState({ selectedTerm: term, filterTerm: "" })}
                    >
                      <span className="truncate text-left whitespace-normal text-sm">{term}</span>
                      <span className="flex-shrink-0 ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-secondary-foreground bg-secondary rounded-full">
                        {batchResults.get(term)?.length || 0}
                      </span>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </aside>

            <main className="w-2/3 lg:w-3/4 h-full">
              {!selectedTerm ? (
                <div className="flex items-center justify-center h-full rounded-lg border-2 border-dashed border-muted-foreground/30">
                  <div className="text-center py-10">
                    <FileSearch className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">Detayları görmek için soldaki listeden bir ürün seçin.</p>
                  </div>
                </div>
              ) : (
                <Card className="h-full flex flex-col overflow-hidden">
                  <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between">
                    <CardTitle>
                      Sonuçlar: "{selectedTerm}" ({currentResultsForSelectedTerm.length})
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowOriginalPrices(!showOriginalPrices)}
                            >
                              <span className="sr-only">Orijinal Fiyatları Gizle/Göster</span>
                              {showOriginalPrices ? <Euro className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Orijinal Fiyatları Göster/Gizle</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setIsProductNameVisible(!isProductNameVisible)}
                            >
                              <span className="sr-only">Ürün Adını Gizle/Göster</span>
                              {isProductNameVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Ürün Adı Sütununu Göster/Gizle</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <div className="relative w-full max-w-xs">
                        <Input
                          placeholder="Sonuçlar içinde ara..."
                          value={filterTerm}
                          onChange={(e) => setFilterTerm(e.target.value)}
                          className="pl-8"
                        />
                        <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow overflow-y-auto custom-scrollbar p-4">
                    {currentResultsForSelectedTerm.length > 0 ? (
                      <div className="space-y-2">
                        {currentResultsForSelectedTerm.map((product, index) => (
                          <MemoizedProductResultItem
                            key={`${product.source}-${product.product_number}-${index}`}
                            product={product}
                            settings={settings}
                            expandedProducts={expandedProducts}
                            toggleProductExpansion={toggleProductExpansion}
                            selectedForAssignment={selectedForAssignment}
                            onSelectionChange={handleSelectionChange}
                            isProductNameVisible={isProductNameVisible}
                            showOriginalPrices={showOriginalPrices}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-5">Bu terim için sonuç bulunamadı.</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </main>
          </div>
        </div>
      )}
      <AssignmentButton
        selectedForAssignment={selectedForAssignment}
        handleAssignConfirm={handleAssignConfirm}
      />
    </div>
  )
}

// --------------------------------------------------------------------------------
// Sık Aratılanlar Sayfası
// --------------------------------------------------------------------------------
const FrequentlySearchedPage = ({ searchHistory, onReSearch, onShowHistoryAssignments }) => {
  const frequentSearches = useMemo(() => {
    const counts = new Map<string, number>()
    searchHistory.forEach((item) => {
      const term = item.term.trim()
      if (term) {
        counts.set(term, (counts.get(term) || 0) + 1)
      }
    })
    return Array.from(counts.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 1000)
  }, [searchHistory])

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">En Sık Aratılanlar</h1>
      <Card>
        <CardContent className="p-0">
          {frequentSearches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Sıra</TableHead>
                  <TableHead>Arama Terimi</TableHead>
                  <TableHead className="w-[150px]">Arama Sayısı</TableHead>
                  <TableHead className="w-[200px] text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {frequentSearches.map((item, index) => (
                  <TableRow key={item.term}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{item.term}</TableCell>
                    <TableCell>{item.count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Button variant="ghost" size="icon" onClick={() => onShowHistoryAssignments(item.term)}>
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Atanmış Ürünleri Göster</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button variant="outline" size="sm" onClick={() => onReSearch(item.term)}>
                          <Search className="mr-2 h-4 w-4" /> Tekrar Ara
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Henüz arama yapılmamış.</p>
              <p className="text-sm text-muted-foreground">Arama yaptıkça bu liste dolacaktır.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// --------------------------------------------------------------------------------
// Arama Geçmişi Sayfası
// --------------------------------------------------------------------------------
const SearchHistoryPage = ({ searchHistory, onReSearch, onShowHistoryAssignments }) => {
  const [filter, setFilter] = useState("monthly")

  const filteredHistory = useMemo(() => {
    const now = new Date()
    const oneDay = 24 * 60 * 60 * 1000
    const oneWeek = 7 * oneDay
    const oneMonth = 30 * oneDay
    const oneYear = 365 * oneDay

    return searchHistory
      .filter((item) => {
        const itemDate = new Date(item.timestamp)
        switch (filter) {
          case "daily":
            return now.getTime() - itemDate.getTime() < oneDay
          case "weekly":
            return now.getTime() - itemDate.getTime() < oneWeek
          case "monthly":
            return now.getTime() - itemDate.getTime() < oneMonth
          case "yearly":
            return now.getTime() - itemDate.getTime() < oneYear
          default:
            return true
        }
      })
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [searchHistory, filter])

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Arama Geçmişi</h1>
        <div className="w-[200px]">
          <Select value={filter} onChange={e => setFilter(e.target.value)}>
            <SelectItem value="daily">Son 24 Saat</SelectItem>
            <SelectItem value="weekly">Son 1 Hafta</SelectItem>
            <SelectItem value="monthly">Son 1 Ay</SelectItem>
            <SelectItem value="yearly">Son 1 Yıl</SelectItem>
          </Select>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          {filteredHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arama Terimi</TableHead>
                  <TableHead className="w-[250px]">Tarih</TableHead>
                  <TableHead className="w-[200px] text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.term}</TableCell>
                    <TableCell>{new Date(item.timestamp).toLocaleString("tr-TR")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Button variant="ghost" size="icon" onClick={() => onShowHistoryAssignments(item.term)}>
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Atanmış Ürünleri Göster</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button variant="outline" size="sm" onClick={() => onReSearch(item.term)}>
                          <Search className="mr-2 h-4 w-4" /> Tekrar Ara
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <History className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Seçili filtre için geçmiş arama bulunamadı.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// --------------------------------------------------------------------------------
// Geçmiş Arama Sonuçları Dialog
// --------------------------------------------------------------------------------
const HistoryResultsDialog = ({ historyResults, onClose, onReSearchAndAssign }) => {
  if (!historyResults) return null

  return (
    <Dialog open={historyResults !== null} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>"{historyResults.term}" Araması İçin Atanmış Ürünler</DialogTitle>
          <DialogDescription>
            Bu listedeki ürünler, geçmişte bu arama terimiyle bulunan ve bir müşteriye atanan ürünlerdir. Fiyatlar atama
            anındaki fiyatlardır. Yeniden atamak için fiyatı güncelleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {historyResults.products.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün Adı</TableHead>
                  <TableHead>Kodu</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Eski Fiyat</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyResults.products.map((product, index) => (
                  <TableRow key={`${product.product_code}-${index}`}>
                    <TableCell dangerouslySetInnerHTML={{ __html: cleanAndDecodeHtml(product.product_name) }} />
                    <TableCell>{product.product_code}</TableCell>
                    <TableCell>{product.source}</TableCell>
                    <TableCell>{product.price_str}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => onReSearchAndAssign(product.product_code)}>
                        <Activity className="mr-2 h-4 w-4" /> Fiyatı Güncelle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Bu arama için daha önce atanmış bir ürün bulunamadı.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const CalendarPage = ({ calendarNotes, setCalendarNotes, toast }) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isAddingMeeting, setIsAddingMeeting] = useState(false)
  const [newMeeting, setNewMeeting] = useState({
    type: "görüşme" as "görüşme" | "toplantı",
    companyName: "",
    authorizedPerson: "",
    department: "",
    email: "",
    phone: "",
    meetingNotes: "",
    nextMeetingDate: "",
    priority: "medium" as "low" | "medium" | "high",
    notificationFrequency: "for_3_days",
    notificationDailyFrequency: "once" as "once" | "twice" | "thrice" | "five_times" | "ten_times" | "hourly",
  })
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportDates, setExportDates] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split("T")[0],
  })

  useEffect(() => {
    if (selectedDate) {
      const existingNote = calendarNotes.find((n) => n.date === selectedDate)
      if (existingNote) {
        setMeetings(existingNote.meetings)
      } else {
        setMeetings([])
      }
    }
  }, [selectedDate, calendarNotes])

  // Etkinlik tipi değiştiğinde hatırlatma seçeneklerini sıfırla
  useEffect(() => {
    if (newMeeting.type === "görüşme") {
      setNewMeeting((prev) => ({ ...prev, notificationFrequency: "for_3_days" }))
    } else {
      // toplantı
      setNewMeeting((prev) => ({ ...prev, notificationFrequency: "1_day_before" }))
    }
  }, [newMeeting.type])

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7 // Pazartesi = 0
    const days: (number | null)[] = []
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }
    return days
  }

  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const handleDayClick = (day: number) => {
    const dateStr = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day)
    setSelectedDate(dateStr)
  }

  const handleSaveDay = () => {
    if (!selectedDate) return
    const updatedNotes = [...calendarNotes]
    const existingIndex = updatedNotes.findIndex((n) => n.date === selectedDate)

    // Sadece not metni ve meetings'i al, diğer notları koru
    const noteOnThisDate = calendarNotes.find((n) => n.date === selectedDate)
    const otherNotes = noteOnThisDate ? noteOnThisDate.note : ""

    const noteData: CalendarNote = {
      id: existingIndex >= 0 ? updatedNotes[existingIndex].id : Date.now().toString(),
      date: selectedDate,
      note: otherNotes, // Eski notu koru
      meetings: meetings,
    }
    if (existingIndex >= 0) {
      updatedNotes[existingIndex] = noteData
    } else {
      updatedNotes.push(noteData)
    }
    setCalendarNotes(updatedNotes)
    if (window.electronAPI) {
      window.electronAPI.saveCalendarNotes(updatedNotes)
    }
    toast("success", "Gün kaydedildi!")
  }

  const handleAddMeeting = () => {
    if (!selectedDate) {
      toast("error", "Lütfen önce bir gün seçin!")
      return
    }
    if (!newMeeting.companyName.trim()) {
      toast("error", "Lütfen firma adı girin!")
      return
    }
    const meeting: Meeting = {
      id: Date.now().toString(),
      ...newMeeting,
      nextMeetingDate: newMeeting.type === "görüşme" ? selectedDate : newMeeting.nextMeetingDate || null,
      completed: false,
    }
    setMeetings([...meetings, meeting])
    setNewMeeting({
      type: "görüşme",
      companyName: "",
      authorizedPerson: "",
      department: "",
      email: "",
      phone: "",
      meetingNotes: "",
      nextMeetingDate: "",
      priority: "medium",
      notificationFrequency: "for_3_days",
      notificationDailyFrequency: "once",
    })
    setIsAddingMeeting(false)
  }

  const handleDeleteMeeting = (meetingId: string) => {
    setMeetings(meetings.filter((m) => m.id !== meetingId))
  }

  const handleToggleMeetingComplete = (meetingId: string) => {
    setMeetings(meetings.map((m) => (m.id === meetingId ? { ...m, completed: !m.completed } : m)))
  }

  const handleExportMeetings = () => {
    if (!exportDates.startDate || !exportDates.endDate) {
      toast("error", "Lütfen başlangıç ve bitiş tarihlerini seçin.")
      return
    }
    toast("info", "Görüşmeler Excel'e aktarılıyor...")
    window.electronAPI.exportMeetings({
      notes: calendarNotes,
      startDate: exportDates.startDate,
      endDate: exportDates.endDate,
    })
    setIsExportDialogOpen(false)
  }

  const hasEventsOnDate = (dateStr: string) => {
    const note = calendarNotes.find((n) => n.date === dateStr)
    return note && note.meetings.length > 0
  }

  const hasUpcomingMeetingOnDate = (dateStr: string) => {
    const note = calendarNotes.find((n) => n.date === dateStr)
    if (note) {
      return note.meetings.some((m) => !m.completed)
    }
    // Ayrıca, başka bir güne kaydedilmiş ama toplantı tarihi bu gün olanları da kontrol et
    return calendarNotes.some((n) => n.meetings.some((m) => m.nextMeetingDate === dateStr && !m.completed))
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-500 bg-red-50 dark:bg-red-950"
      case "medium":
        return "text-yellow-500 bg-yellow-50 dark:bg-yellow-950"
      case "low":
        return "text-green-500 bg-green-50 dark:bg-green-950"
      default:
        return "text-gray-500 bg-gray-50 dark:bg-gray-950"
    }
  }

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Yüksek"
      case "medium":
        return "Orta"
      case "low":
        return "Düşük"
      default:
        return "Orta"
    }
  }

  const days = getDaysInMonth(currentDate)
  const monthNames = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ]
  const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dijital Ajanda</h1>
        <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(true)}>
              <FileDown className="mr-2 h-4 w-4" /> Raporu Dışa Aktar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Görüşme Raporunu Dışa Aktar</DialogTitle>
              <DialogDescription>
                Rapor oluşturmak için lütfen bir başlangıç ve bitiş tarihi seçin.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Başlangıç Tarihi</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={exportDates.startDate}
                  onChange={(e) => setExportDates({ ...exportDates, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Bitiş Tarihi</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={exportDates.endDate}
                  onChange={(e) => setExportDates({ ...exportDates, endDate: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                İptal
              </Button>
              <Button onClick={handleExportMeetings}>Excel Oluştur</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle>
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-sm font-semibold text-muted-foreground p-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="aspect-square" />
                }
                const dateStr = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day)
                const isSelected = selectedDate === dateStr
                const isToday =
                  dateStr === formatDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
                const hasEvent = hasEventsOnDate(dateStr)
                const hasUpcoming = hasUpcomingMeetingOnDate(dateStr)
                return (
                  <Button
                    key={day}
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "aspect-square p-2 relative flex flex-col h-auto",
                      isToday && !isSelected && "border-primary border-2",
                      hasEvent && "font-bold",
                    )}
                    onClick={() => handleDayClick(day)}
                  >
                    <span>{day}</span>
                    {hasEvent && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                    )}
                    {hasUpcoming && <Bell className="absolute top-1 right-1 h-3 w-3 text-orange-500" />}
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {selectedDate
                ? new Date(selectedDate + "T00:00:00").toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Bir tarih seçin"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedDate ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Etkinlikler</Label>
                    <Button size="sm" variant="outline" onClick={() => setIsAddingMeeting(!isAddingMeeting)}>
                      <PlusCircle className="h-4 w-4 mr-1" />
                      Ekle
                    </Button>
                  </div>

                  {isAddingMeeting && (
                    <Card className="p-4 space-y-4">
                      <Select
                        value={newMeeting.type}
                        onChange={(e) => setNewMeeting({ ...newMeeting, type: e.target.value as any })}
                      >
                          <SelectItem value="görüşme">Görüşme</SelectItem>
                          <SelectItem value="toplantı">Toplantı</SelectItem>
                      </Select>

                      <Input
                        placeholder="Firma Adı"
                        value={newMeeting.companyName}
                        onChange={(e) => setNewMeeting({ ...newMeeting, companyName: e.target.value })}
                      />
                      <Input
                        placeholder="Yetkili Kişi"
                        value={newMeeting.authorizedPerson}
                        onChange={(e) => setNewMeeting({ ...newMeeting, authorizedPerson: e.target.value })}
                      />
                      <Input
                        placeholder="Departman"
                        value={newMeeting.department}
                        onChange={(e) => setNewMeeting({ ...newMeeting, department: e.target.value })}
                      />
                      <Input
                        placeholder="E-mail Adresi"
                        value={newMeeting.email}
                        onChange={(e) => setNewMeeting({ ...newMeeting, email: e.target.value })}
                      />
                      <Input
                        placeholder="Telefon"
                        value={newMeeting.phone}
                        onChange={(e) => setNewMeeting({ ...newMeeting, phone: e.target.value })}
                      />
                      <textarea
                        className="w-full min-h-[60px] p-2 border rounded-md bg-background text-sm"
                        placeholder="Açıklama / Notlar"
                        value={newMeeting.meetingNotes}
                        onChange={(e) => setNewMeeting({ ...newMeeting, meetingNotes: e.target.value })}
                      />

                      {newMeeting.type === "toplantı" && (
                        <div className="space-y-2">
                          <Label>Toplantı Tarihi</Label>
                          <Input
                            type="date"
                            value={newMeeting.nextMeetingDate}
                            onChange={(e) => setNewMeeting({ ...newMeeting, nextMeetingDate: e.target.value })}
                          />
                        </div>
                      )}

                      <Select
                        value={newMeeting.priority}
                        onChange={(e) =>
                          setNewMeeting({ ...newMeeting, priority: e.target.value as any })
                        }
                      >
                          <SelectItem value="low">Düşük Öncelik</SelectItem>
                          <SelectItem value="medium">Orta Öncelik</SelectItem>
                          <SelectItem value="high">Yüksek Öncelik</SelectItem>
                      </Select>

                      <div className="space-y-2">
                        <Label htmlFor="notificationFrequency">Hatırlatma Şekli</Label>
                        {newMeeting.type === "görüşme" ? (
                          <Select
                            value={newMeeting.notificationFrequency}
                            onChange={(e) => setNewMeeting({ ...newMeeting, notificationFrequency: e.target.value })}
                            id="notificationFrequency"
                          >
                               <SelectItem value="none">Bildirme</SelectItem>
                               <SelectItem value="for_1_day">1 Gün Boyunca</SelectItem>
                               <SelectItem value="for_3_days">3 Gün Boyunca</SelectItem>
                               <SelectItem value="for_1_week">1 Hafta Boyunca</SelectItem>
                          </Select>
                        ) : (
                          // Toplantı
                          <Select
                            value={newMeeting.notificationFrequency}
                            onChange={(e) => setNewMeeting({ ...newMeeting, notificationFrequency: e.target.value })}
                            id="notificationFrequency"
                          >
                              <SelectItem value="none">Bildirme</SelectItem>
                              <SelectItem value="on_day">Olay Günü</SelectItem>
                              <SelectItem value="1_day_before">1 Gün Önce</SelectItem>
                              <SelectItem value="1_week_before">1 Hafta Önce</SelectItem>
                          </Select>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notificationDailyFrequency">Gün İçi Sıklık</Label>
                        <Select
                          value={newMeeting.notificationDailyFrequency}
                          onChange={(e) =>
                            setNewMeeting({ ...newMeeting, notificationDailyFrequency: e.target.value as any })
                          }
                          id="notificationDailyFrequency"
                        >
                            <SelectItem value="once">Günde 1 Kez (Sabah)</SelectItem>
                            <SelectItem value="twice">Günde 2 Kez (Sabah, Akşam)</SelectItem>
                            <SelectItem value="thrice">Günde 3 Kez (Sabah, Öğle, Akşam)</SelectItem>
                            <SelectItem value="five_times">Günde 5 Kez</SelectItem>
                            <SelectItem value="ten_times">Günde 10 Kez</SelectItem>
                            <SelectItem value="hourly">Saat Başı (Mesai Saatleri)</SelectItem>
                        </Select>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={handleAddMeeting} className="flex-1">
                          <Check className="h-4 w-4 mr-1" />
                          Ekle
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsAddingMeeting(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  )}

                  {meetings.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {meetings.map((meeting) => (
                        <Card key={meeting.id} className={cn("p-3", meeting.completed && "opacity-50")}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={meeting.completed}
                                  onChange={() => handleToggleMeetingComplete(meeting.id)}
                                />
                                <p className={cn("font-semibold text-sm", meeting.completed && "line-through")}>
                                  {meeting.companyName}{" "}
                                  <span className="text-xs font-normal text-muted-foreground">
                                    ({meeting.type})
                                  </span>
                                </p>
                              </div>
                              <div className="pl-6 space-y-1.5 text-xs text-muted-foreground">
                                {meeting.authorizedPerson && (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-3 w-3" />
                                    <span>{meeting.authorizedPerson}</span>
                                  </div>
                                )}
                                {meeting.department && (
                                  <div className="flex items-center gap-2">
                                    <Briefcase className="h-3 w-3" />
                                    <span>{meeting.department}</span>
                                  </div>
                                )}
                                {meeting.email && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-3 w-3" />
                                    <span>{meeting.email}</span>
                                  </div>
                                )}
                                {meeting.phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3" />
                                    <span>{meeting.phone}</span>
                                  </div>
                                )}
                                {meeting.meetingNotes && <p className="pt-1">{meeting.meetingNotes}</p>}
                              </div>
                              {meeting.nextMeetingDate && (
                                <div className="flex items-center gap-1 pl-6 text-xs pt-1">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    Tarih:{" "}
                                    {new Date(meeting.nextMeetingDate + "T00:00:00").toLocaleDateString("tr-TR")}
                                  </span>
                                </div>
                              )}
                              <div
                                className={cn(
                                  "inline-block px-2 py-0.5 rounded text-xs ml-6",
                                  getPriorityColor(meeting.priority),
                                )}
                              >
                                {getPriorityLabel(meeting.priority)}
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleDeleteMeeting(meeting.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Bu gün için etkinlik yok</p>
                  )}
                </div>

                <Button onClick={handleSaveDay} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  Günü Kaydet
                </Button>
              </>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Ajandadan bir tarih seçin</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------------
// Ana Uygulama Mantığı
// --------------------------------------------------------------------------------
const calculateRelevance = (product: ProductResult, term: string): number => {
  let score = 0
  const termLower = term.toLowerCase().trim()
  if (!termLower) return 0
  const name = stripHtml(product.product_name || "").toLowerCase()
  const number = (product.product_number || "").toLowerCase()
  const cas = (product.cas_number || "").toLowerCase()
  if (termLower === number) score += 10000
  if (termLower === cas) score += 5000
  if (termLower === name) score += 2000
  if (name.startsWith(termLower)) score += 500
  if (number.startsWith(termLower)) score += 500
  if (name.includes(termLower)) score += 100 + 50 / (name.length + 1)
  const termWords = new Set(termLower.split(" ").filter((w) => w))
  const nameWords = new Set(name.split(" ").filter((w) => w))
  let allWordsPresent = true
  for (const word of termWords) {
    if (!nameWords.has(word)) {
      allWordsPresent = false
      break
    }
  }
  if (allWordsPresent && termWords.size > 0) {
    score += termWords.size * 50
  }
  const commonWords = new Set([...termWords].filter((x) => nameWords.has(x)))
  score += commonWords.size * 10
  return score
}


function MainApplication({ appStatus, setAppStatus }) {
  const [page, setPage] = useState("calendar")
  const [assignments, setAssignments] = useState<AssignmentItem[]>([])
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([])
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>([])
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [parities, setParities] = useState(null)
  const [activeNotifications, setActiveNotifications] = useState<any[]>([])

  const [toasts, setToasts] = useState([])
  const toast = (type, message) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, type, message }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 5000);
  };

  const [batchSearchState, setBatchSearchState] = useState({
    pageState: "idle",
    filePath: null as string | null,
    fileName: null as string | null,
    customerName: "",
    searchProgress: { term: "", current: 0, total: 0, running: false },
    batchResults: new Map<string, ProductResult[]>(),
    expandedProducts: new Set<string>(),
    selectedForAssignment: [] as AssignmentItem[],
    selectedTerm: null as string | null,
  })

  useEffect(() => {
    try {
      const savedAssignments = localStorage.getItem("assignments_single")
      if (savedAssignments) setAssignments(JSON.parse(savedAssignments))
      const savedHistory = localStorage.getItem("search_history")
      if (savedHistory) setSearchHistory(JSON.parse(savedHistory))
    } catch (error) {
      console.error("localStorage'dan veri yüklenirken hata:", error)
      toast("error", "Kaydedilmiş veriler yüklenemedi.")
    } finally {
      setIsDataLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.loadSettings()
      const cleanupSettings = window.electronAPI.onSettingsLoaded((loadedSettings) => {
        setSettings(loadedSettings)
      })
      window.electronAPI.getParities()
      const cleanupParities = window.electronAPI.onParitiesUpdated((updatedParities) => {
        setParities(updatedParities)
      })
      window.electronAPI.loadCalendarNotes()
      const cleanupCalendarNotes = window.electronAPI.onCalendarNotesLoaded((loadedNotes) => {
        if (loadedNotes && Array.isArray(loadedNotes)) {
          setCalendarNotes(loadedNotes)
        }
      })
      const cleanupExport = window.electronAPI.onExportMeetingsResult((result) => {
        if (result.status === "success") {
          toast("success", `Excel dosyası başarıyla oluşturuldu: ${result.path}`)
        } else if (result.status === "info") {
          toast("info", result.message)
        } else {
          toast("error", `Excel oluşturulurken bir hata oluştu: ${result.message}`)
        }
      })

      return () => {
        cleanupSettings()
        cleanupParities()
        cleanupCalendarNotes()
        cleanupExport()
      }
    }
  }, [])

  useEffect(() => {
    if (isDataLoaded) {
      try {
        localStorage.setItem("assignments_single", JSON.stringify(assignments))
        localStorage.setItem("search_history", JSON.stringify(searchHistory))
      } catch (error) {
        console.error("Veriler kaydedilirken hata:", error)
      }
    }
  }, [assignments, searchHistory, isDataLoaded])

  useEffect(() => {
    const today = new Date()
    const upcomingNotifications: any[] = []
    calendarNotes.forEach((note) => {
      note.meetings.forEach((meeting) => {
        if (meeting.completed || !meeting.nextMeetingDate || meeting.notificationFrequency === "none") {
          return
        }
        const meetingDate = new Date(meeting.nextMeetingDate + "T00:00:00")
        let notificationDate = new Date(meetingDate)
        switch (meeting.notificationFrequency) {
          case "on_day":
            break
          case "1_day_before":
            notificationDate.setDate(notificationDate.getDate() - 1)
            break
          case "1_week_before":
            notificationDate.setDate(notificationDate.getDate() - 7)
            break
          default:
            return
        }
        const notificationDateOnly = new Date(
          notificationDate.getFullYear(),
          notificationDate.getMonth(),
          notificationDate.getDate(),
        )
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        if (notificationDateOnly.getTime() <= todayOnly.getTime()) {
          upcomingNotifications.push({ ...meeting, parentNoteDate: note.date })
        }
      })
    })
    setActiveNotifications(upcomingNotifications)
  }, [calendarNotes])

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawSearchResults, setRawSearchResults] = useState<ProductResult[]>([])
  const [currentSearchTerm, setCurrentSearchTerm] = useState("")
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [searchTermForPage, setSearchTermForPage] = useState<string | null>(null)
  const [historyResults, setHistoryResults] = useState<{ term: string; products: AssignmentItem[] } | null>(null)

  const productQueueRef = useRef<ProductResult[]>([])
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const searchResults = useMemo(() => {
    if (!settings || !parities) {
      return rawSearchResults.map((p) => ({
        ...p,
        cheapest_eur_price_str: p.cheapest_eur_price_str || "Hesaplanıyor...",
        cheapest_material_number: p.cheapest_material_number || p.product_number,
        cheapest_source_country: "...",
      }))
    }
    const priced = rawSearchResults.map((p) => calculateProductPrices(p, settings, parities))
    priced.sort((a, b) => {
      const scoreA = calculateRelevance(a, currentSearchTerm)
      const scoreB = calculateRelevance(b, currentSearchTerm)

      // Primary sort: by relevance score, descending
      if (scoreA !== scoreB) {
        return scoreB - scoreA
      }

      // Secondary sort: by price, ascending
      const getNumericPrice = (priceStr: string | undefined): number => {
        if (!priceStr || priceStr === "N/A" || priceStr === "Teklif İsteyiniz") return Number.POSITIVE_INFINITY
        const cleanedPrice = priceStr.replace(/€/g, "").replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".")
        const numericValue = Number.parseFloat(cleanedPrice)
        return isNaN(numericValue) ? Number.POSITIVE_INFINITY : numericValue
      }
      const priceA = getNumericPrice(a.cheapest_eur_price_str)
      const priceB = getNumericPrice(b.cheapest_eur_price_str)
      return priceA - priceB
    })
    return priced
  }, [rawSearchResults, settings, parities, currentSearchTerm])

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return

    const cleanups = [
      window.electronAPI.onProductFound(({ product, context }) => {
        if (!context) {
          productQueueRef.current.push(product)
          if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current)
          }
          updateTimeoutRef.current = setTimeout(() => {
            if (productQueueRef.current.length === 0) return
            setRawSearchResults((prev) => {
              const newProductsMap = new Map(prev.map((p) => [`${p.source}-${p.product_number}`, p]))
              productQueueRef.current.forEach((p) => {
                const key = `${p.source}-${p.product_number}`
                if (!newProductsMap.has(key)) {
                  newProductsMap.set(key, p)
                }
              })
              productQueueRef.current = []
              return Array.from(newProductsMap.values())
            })
          }, 200)
        }
      }),
      window.electronAPI.onSearchComplete((summary) => {
        setIsLoading(false)
        if (summary.status === "cancelled") {
          toast("warning", "Arama iptal edildi.")
        } else {
          toast("success", `Arama tamamlandı! ${summary.total_found} eşleşme bulundu.`)
        }
      }),
      window.electronAPI.onSearchError((errorMessage) => {
        setError(errorMessage)
        setIsLoading(false)
      }),
      window.electronAPI.onExportResult((result) => {
        if (result.status === "success") {
          toast("success", `Excel dosyası kaydedildi: ${result.path}`)
        } else {
          toast("error", `Excel hatası: ${result.message}`)
        }
      }),
      window.electronAPI.onAuthenticationError(() => {
        setAppStatus("auth_error")
      }),
      window.electronAPI.onLogSearchTerm(({ term }) => {
        if (term && term.trim()) {
          setSearchHistory((prev) => [{ term: term.trim(), timestamp: Date.now() }, ...prev].slice(0, 5000))
        }
      }),
    ]
    return () => {
      cleanups.forEach((cleanup) => cleanup())
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [setAppStatus])

  const handleAssignProducts = (products: AssignmentItem[]) => {
    setAssignments((prev) => {
      const newProducts = products.filter(
        (p) => !prev.some((ap) => ap.product_code === p.product_code && ap.source === ap.source),
      )
      return [...prev, ...newProducts]
    })
  }

 const handleSearch = (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    // isLoading'i burada kontrol etmiyoruz çünkü yeni bir arama her zaman başlatılabilmeli
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    productQueueRef.current = [];
    setIsLoading(true);
    setRawSearchResults([]);
    setError(null);
    setCurrentSearchTerm(searchTerm);
    if (window.electronAPI) {
      window.electronAPI.performSearch(searchTerm);
    } else {
      console.error("Electron API bulunamadı, arama yapılamıyor.");
      setIsLoading(false);
    }
  };

  const handleReSearch = (term: string) => {
    setSearchTermForPage(term)
    setPage("search")
  }

  const handleCancel = () => {
    if (isLoading && window.electronAPI) {
      toast("info", "Arama iptal ediliyor...")
      window.electronAPI.cancelSearch()
    }
  }

  const onSearchExecuted = () => {
    setSearchTermForPage(null);
  };


  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings)
    if (appStatus === "auth_error") {
      setAppStatus("ready")
      setPage("search")
    }
  }

  const handleShowHistoryAssignments = (term: string) => {
    const lowerCaseTerm = term.toLowerCase()
    const matchingAssignments = assignments.filter(
      (p) =>
        stripHtml(p.product_name).toLowerCase().includes(lowerCaseTerm) ||
        p.product_code.toLowerCase().includes(lowerCaseTerm) ||
        (p.cas_number && p.cas_number.toLowerCase().includes(lowerCaseTerm)),
    )
    setHistoryResults({ term, products: matchingAssignments })
  }

  const handleReSearchAndAssign = (productCode: string) => {
    setHistoryResults(null)
    setSearchTermForPage(productCode)
    setPage("search")
  }

  const handleToggleMeetingCompleteForNotification = (noteDate: string, meetingId: string) => {
    const newNotes = calendarNotes.map((note) => {
      if (note.date === noteDate) {
        const newMeetings = note.meetings.map((meeting) => {
          if (meeting.id === meetingId) {
            return { ...meeting, completed: !meeting.completed }
          }
          return meeting
        })
        return { ...note, meetings: newMeetings }
      }
      return note
    })
    setCalendarNotes(newNotes)
    window.electronAPI.saveCalendarNotes(newNotes)
    toast("success", "Görüşme durumu güncellendi.")
  }

  const handleGoToDate = (date: string) => {
    setPage("calendar")
  }

  const renderPage = () => {
    if (appStatus === "auth_error") {
      return <SettingsPage authError={true} settings={settings} onSaveSettings={handleSaveSettings} toast={toast} />
    }

    switch (page) {
      case "search":
        return (
          <SearchPage
            searchResults={searchResults}
            isLoading={isLoading}
            error={error}
            handleSearch={handleSearch}
            handleCancel={handleCancel}
            onAssignProducts={handleAssignProducts}
            settings={settings}
            initialSearchTerm={searchTermForPage}
            onSearchExecuted={onSearchExecuted}
            toast={toast}
          />
        )
      case "batch-search":
        return (
          <BatchSearchPage
            onAssignProducts={handleAssignProducts}
            settings={settings}
            batchState={batchSearchState}
            setBatchState={setBatchSearchState}
            toast={toast}
          />
        )
      case "frequent-searches":
        return (
          <FrequentlySearchedPage
            searchHistory={searchHistory}
            onReSearch={handleReSearch}
            onShowHistoryAssignments={handleShowHistoryAssignments}
          />
        )
      case "search-history":
        return (
          <SearchHistoryPage
            searchHistory={searchHistory}
            onReSearch={handleReSearch}
            onShowHistoryAssignments={handleShowHistoryAssignments}
          />
        )
      case "calendar":
        return <CalendarPage calendarNotes={calendarNotes} setCalendarNotes={setCalendarNotes} toast={toast} />
      case "settings":
        return <SettingsPage authError={false} settings={settings} onSaveSettings={handleSaveSettings} toast={toast} />
      case "home":
      default:
        return <CustomerPage assignments={assignments} setAssignments={setAssignments} toast={toast} />
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
        <Sidebar
          setPage={setPage}
          currentPage={page}
          notifications={activeNotifications}
          onToggleComplete={handleToggleMeetingCompleteForNotification}
          onGoToDate={handleGoToDate}
        />
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
          <main className="flex-1 items-start gap-4 sm:px-6 sm:py-0 md:gap-8">{renderPage()}</main>
        </div>

        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
            {toasts.map(t => {
                const colors = {
                    success: "bg-green-600 border-green-700",
                    error: "bg-red-600 border-red-700",
                    warning: "bg-yellow-500 border-yellow-600",
                    info: "bg-blue-600 border-blue-700",
                }
                return (
                    <motion.div
                        key={t.id}
                        layout
                        initial={{ opacity: 0, y: 50, scale: 0.3 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                        className={cn("text-white p-4 rounded-md shadow-lg border text-sm font-medium", colors[t.type] || colors.info)}
                    >
                        {t.message}
                    </motion.div>
                )
            })}
        </div>

        <HistoryResultsDialog
          historyResults={historyResults}
          onClose={() => setHistoryResults(null)}
          onReSearchAndAssign={handleReSearchAndAssign}
        />
      </div>
    </motion.div>
  )
}

// --------------------------------------------------------------------------------
// Ana Uygulama Yönlendiricisi
// --------------------------------------------------------------------------------
export default function App() {
  const [appStatus, setAppStatus] = useState("initializing")
  const [toasts, setToasts] = useState([])

  const toast = (type, message) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, type, message }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 5000);
  };

  useEffect(() => {
    if (!window.electronAPI) {
      console.warn("Electron API bulunamadı. Geliştirme modu varsayılıyor.")
      const timer = setTimeout(() => setAppStatus("ready"), 2500)
      return () => clearTimeout(timer)
    }

    const cleanups = [
      window.electronAPI.onServicesReady((isReady) => {
        setAppStatus(isReady ? "ready" : "error")
        if (!isReady) toast("error", "Arka plan servisleri başlatılamadı.")
      }),
      window.electronAPI.onInitialSetupRequired(() => setAppStatus("setup_required")),
      window.electronAPI.onAuthenticationError(() => setAppStatus("auth_error")),
      window.electronAPI.onPythonCrashed(() => {
        setAppStatus("error")
        toast("error", "Kritik hata: Arka plan servisi çöktü.")
      }),
    ]

    window.electronAPI.rendererReady()

    return () => cleanups.forEach((c) => c())
  }, [])

  const renderContent = () => {
    switch (appStatus) {
      case "initializing":
        return <SplashScreen key="splash" hasError={false} />
      case "setup_required":
        return <InitialSetupScreen key="setup" setAppStatus={setAppStatus} />
      case "ready":
      case "auth_error":
        return <MainApplication key="main_app" appStatus={appStatus} setAppStatus={setAppStatus} />
      case "error":
        return <SplashScreen key="splash-error" hasError={true} />
      default:
        return <SplashScreen key="splash-default" hasError={false} />
    }
  }

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: transparent;
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: hsl(var(--border));
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: hsl(var(--primary));
        }
      `}</style>
      <AnimatePresence mode="wait">
        <motion.div
          key={appStatus}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
            {toasts.map(t => {
                 const colors = {
                    success: "bg-green-600 border-green-700",
                    error: "bg-red-600 border-red-700",
                    warning: "bg-yellow-500 border-yellow-600",
                    info: "bg-blue-600 border-blue-700",
                }
                return (
                    <motion.div
                        key={t.id}
                        layout
                        initial={{ opacity: 0, y: 50, scale: 0.3 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                        className={cn("text-white p-4 rounded-md shadow-lg border text-sm font-medium", colors[t.type] || colors.info)}
                    >
                        {t.message}
                    </motion.div>
                )
            })}
        </div>
    </ThemeProvider>
  )
}

