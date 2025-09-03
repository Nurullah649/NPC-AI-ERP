"use client"

import { useState, useEffect, createContext, useContext, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Home,
  Search,
  Users,
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
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Toaster, toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import SplashScreen from "@/public/SplashScreen"

// --------------------------------------------------------------------------------
// Electron API ve Veri Tipleri
// --------------------------------------------------------------------------------

interface SigmaVariation {
  material_number: string
  price: number | null
  currency: string
  availability_date: string | null
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
  calculated_price: string
}

interface ProductResult {
  product_name: string
  product_number: string
  cas_number: string
  brand: string
  sigma_variations: {
    tr?: SigmaVariation[]
    us?: SigmaVariation[]
    de?: SigmaVariation[]
    gb?: SigmaVariation[]
  }
  netflex_matches: NetflexResult[]
  cheapest_netflex_name: string
  cheapest_netflex_price_str: string
  cheapest_netflex_stock: number | string
  tci_variations?: TciVariation[]
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


// Global Electron API tanımı
declare global {
  interface Window {
    electronAPI: any
  }
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
// Sidebar
// --------------------------------------------------------------------------------
const Sidebar = ({ setPage, currentPage }) => {
  const navItems = [
    { name: "home", href: "#", icon: Home, label: "Ana Sayfa" },
    { name: "search", href: "#", icon: Search, label: "Ürün Arama" },
    { name: "customers", href: "#", icon: Users, label: "Müşteriler" },
    { name: "settings", href: "#", icon: Settings, label: "Ayarlar" },
  ]
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
        <a
          href="#"
          onClick={() => setPage("home")}
          className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
        >
          <Package2 className="h-4 w-4 transition-all group-hover:scale-110" />
          <span className="sr-only">Tales Job</span>
        </a>
        <TooltipProvider>
          {navItems.map((item) => (
            <Tooltip key={item.name}>
              <TooltipTrigger asChild>
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
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </nav>
      <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
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
  useEffect(() => { setSettings(initialSettings) }, [initialSettings])
  const handleChange = (key, value) => { setSettings((prev) => ({ ...prev, [key]: value })) }
  const handleSubmit = (e) => { e.preventDefault(); onSave(settings) }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary"/> Netflex API Bilgileri</CardTitle>
          <CardDescription>Netflex sisteminden veri çekmek için kullanılacak kullanıcı adı ve şifre.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="netflex_username">Kullanıcı Adı</Label>
            <Input id="netflex_username" value={settings.netflex_username || ''} onChange={(e) => handleChange('netflex_username', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="netflex_password">Şifre</Label>
            <Input id="netflex_password" type="password" value={settings.netflex_password || ''} onChange={(e) => handleChange('netflex_password', e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary"/> TCI Fiyatlandırma</CardTitle>
          <CardDescription>TCI ürünlerinin orijinal fiyatı ile çarpılacak katsayı.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="tci_coefficient">Fiyat Katsayısı</Label>
            <Input id="tci_coefficient" type="number" step="0.1" value={settings.tci_coefficient || 1.4} onChange={(e) => handleChange('tci_coefficient', e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isInitialSetup ? 'Ayarları Kaydet ve Başlat' : 'Ayarları Kaydet'}
        </Button>
      </div>
    </form>
  )
}
const SettingsPage = ({ authError, onSettingsSaved }) => {
  const [settings, setSettings] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  useEffect(() => { window.electronAPI.loadSettings() }, [])
  useEffect(() => {
    const cleanup = window.electronAPI.onSettingsLoaded(setSettings)
    return () => cleanup()
  }, [])

  const handleSave = async (newSettings) => {
    setIsSaving(true)
    const cleanup = window.electronAPI.onSettingsSaved((result) => {
      if (result.status === 'success') {
        toast.success('Ayarlar başarıyla kaydedildi.')
        onSettingsSaved()
      } else {
        toast.error(`Ayarlar kaydedilemedi: ${result.message}`)
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
        <Alert variant="destructive" className="mb-4">
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
    setAppStatus('initializing')
    window.electronAPI.saveSettings(settings)
  }
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-2xl">
        <Card className="shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><Wrench className="h-6 w-6"/></div>
            <CardTitle className="text-2xl">Uygulama Kurulumu</CardTitle>
            <CardDescription>Devam etmeden önce temel ayarları yapmanız gerekmektedir.</CardDescription>
          </CardHeader>
          <CardContent>
             <SettingsForm
                initialSettings={{ netflex_username: "", netflex_password: "", tci_coefficient: 1.4 }}
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
// Ana Sayfa (Dashboard)
// --------------------------------------------------------------------------------
const HomePage = ({ stats }) => {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold tracking-tight">Hoş Geldiniz!</h1>
      <p className="text-muted-foreground">Yönetim sisteminize genel bir bakış.</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Müşteriler</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customerCount}</div>
            <p className="text-xs text-muted-foreground">Toplam kayıtlı müşteri</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atanan Toplam Ürün</CardTitle>
            <Package2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUniqueProducts}</div>
            <p className="text-xs text-muted-foreground">Müşterilerdeki toplam ürün çeşidi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif Siparişler</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeOrders}</div>
            <p className="text-xs text-muted-foreground">Toplam ürün atama sayısı</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------------
// Müşteriler Sayfası
// --------------------------------------------------------------------------------
const CustomersPage = ({ customers, setCustomers, assignments, setAssignments }) => {
  const [newCustomer, setNewCustomer] = useState({ name: "" })
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerToDelete, setCustomerToDelete] = useState(null)

  const handleAddCustomer = () => {
    if (newCustomer.name.trim()) {
      setCustomers([
        ...customers,
        { id: customers.length > 0 ? Math.max(...customers.map((c) => c.id)) + 1 : 1, ...newCustomer },
      ])
      setNewCustomer({ name: "" })
      setIsAddDialogOpen(false)
      toast.success("Yeni müşteri başarıyla eklendi!")
    } else {
      toast.error("Lütfen müşteri adını girin.")
    }
  }

  const handleDeleteCustomer = () => {
    if (!customerToDelete) return

    setCustomers(customers.filter((c) => c.id !== customerToDelete.id))
    setAssignments((prev) => {
      const newAssignments = { ...prev }
      delete newAssignments[customerToDelete.id]
      return newAssignments
    })

    toast.success(`'${customerToDelete.name}' adlı müşteri silindi.`)
    setCustomerToDelete(null)
  }

  const handleExport = () => {
    if (!selectedCustomer || !window.electronAPI) return
    const assignedProducts = assignments[selectedCustomer.id] || []
    toast.info("Excel dosyası oluşturuluyor...")
    window.electronAPI.exportToExcel({ customerName: selectedCustomer.name, products: assignedProducts })
  }
  const assignedProducts = selectedCustomer ? assignments[selectedCustomer.id] || [] : []
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Müşteriler</h1>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Yeni Müşteri Ekle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Yeni Müşteri Ekle</DialogTitle>
              <DialogDescription>Yeni müşterinin adını ve soyadını girin.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Ad Soyad
                </Label>
                <Input
                  id="name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ name: e.target.value })}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleAddCustomer}>
                Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((customer) => (
          <Card
            key={customer.id}
            className="group relative cursor-pointer transition-shadow hover:shadow-lg"
            onClick={() => setSelectedCustomer(customer)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-7 w-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                setCustomerToDelete(customer)
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Müşteriyi Sil</span>
            </Button>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 py-4">
                <User className="h-5 w-5" />
                {customer.name}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.name} - Atanmış Ürünler</DialogTitle>
            <DialogDescription>Bu müşteriye atanmış ürünlerin listesi.</DialogDescription>
          </DialogHeader>
          {assignedProducts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Ürün Adı</TableHead>
                  <TableHead>Kodu</TableHead>
                  <TableHead>Fiyat</TableHead>
                  <TableHead>Stok</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedProducts.map((product, index) => (
                  <TableRow key={`${product.product_code}-${index}`}>
                    <TableCell>{product.source}</TableCell>
                    <TableCell className="font-medium" dangerouslySetInnerHTML={{ __html: product.product_name }} />
                    <TableCell>{product.product_code}</TableCell>
                    <TableCell>{product.price_str}</TableCell>
                    <TableCell>{product.cheapest_netflex_stock ?? "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Bu müşteriye henüz atanmış bir ürün bulunmuyor.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={handleExport} disabled={assignedProducts.length === 0}>
              <FileDown className="mr-2 h-4 w-4" /> Excel'e Aktar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!customerToDelete} onOpenChange={() => setCustomerToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Müşteriyi Silmek İstediğinizden Emin misiniz?</DialogTitle>
            <DialogDescription>
              '{customerToDelete?.name}' adlı müşteriyi silmek üzeresiniz. Bu işlem geri alınamaz. Müşteriye atanmış
              tüm ürün bilgileri de silinecektir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerToDelete(null)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDeleteCustomer}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --------------------------------------------------------------------------------
// Ürün Atama Dialog Bileşeni
// --------------------------------------------------------------------------------
const AssignmentDialog = ({ selectedForAssignment, customers, handleAssignConfirm }) => {
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
    const [selectedCustomer, setSelectedCustomer] = useState(null)

    const handleConfirmClick = () => {
      if (!selectedCustomer) {
        toast.error("Lütfen bir müşteri seçin.")
        return
      }
      handleAssignConfirm(selectedCustomer, selectedForAssignment)
      setIsAssignDialogOpen(false)
      setSelectedCustomer(null)
    }

    if (selectedForAssignment.length === 0) {
        return null
    }

    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg">
              <UserPlus className="mr-2 h-4 w-4" />
              {selectedForAssignment.length} Ürünü Müşteriye Ata
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Müşteriye Ata</DialogTitle>
              <DialogDescription>Seçili ürünleri atamak için bir müşteri seçin.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Bir müşteri seçin..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button onClick={handleConfirmClick} className="w-full">
                Atamayı Onayla
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
}


// --------------------------------------------------------------------------------
// Ürün Arama Sayfası
// --------------------------------------------------------------------------------
const SearchPage = ({ searchResults, isLoading, error, handleSearch, customers, onAssignProducts }) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    brands: { sigma: true, tci: true },
    countries: { tr: true, us: true, de: true, gb: true },
  })
  const [selectedForAssignment, setSelectedForAssignment] = useState<AssignmentItem[]>([])

  const countryLabels = { tr: "Türkiye", us: "Amerika", de: "Almanya", gb: "İngiltere" }
  const countryHeaders = { tr: "Türkiye (TR)", us: "Amerika (US)", de: "Almanya (DE)", gb: "İngiltere (GB)" }

  const onSearchClick = () => handleSearch(searchTerm)

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

  const getCombinedData = (product: ProductResult) => {
    const dataMap: { [key: string]: any } = {}
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
      const key = match.product_code
      if (!dataMap[key]) {
        dataMap[key] = { material_number: key, sigma: {}, netflex: null }
      }
      dataMap[key].netflex = match
    })
    return Object.values(dataMap)
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

  const handleSelectSigma = (product: ProductResult, item, countryCode, priceData) => {
    const assignmentItem: AssignmentItem = {
      product_name: product.product_name,
      product_code: item.material_number,
      cas_number: product.cas_number,
      price_numeric: priceData.price,
      price_str: priceData.price !== null ? `${priceData.price} ${priceData.currency}` : "Fiyat Bilgisi Yok",
      source: `Sigma (${countryCode.toUpperCase()})`,
      cheapest_netflex_stock: "N/A",
    }
    handleSelectionChange(assignmentItem)
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
    handleSelectionChange(assignmentItem)
  }

  const handleSelectTCI = (product: ProductResult, variation: TciVariation) => {
    const assignmentItem: AssignmentItem = {
      product_name: product.product_name,
      product_code: `${product.product_number}-${variation.unit}`,
      cas_number: product.cas_number,
      price_numeric: parseFloat(variation.calculated_price.replace(/[€.]/g, '').replace(',', '.')) || null,
      price_str: variation.calculated_price,
      source: 'TCI',
      cheapest_netflex_stock: ''
    };
    handleSelectionChange(assignmentItem);
  };


  const handleAssignConfirm = (customerId, products) => {
    onAssignProducts(customerId, products)
    const customerName = customers.find((c) => c.id.toString() === customerId)?.name
    toast.success(`${products.length} ürün, ${customerName} adlı müşteriye atandı!`)
    setSelectedForAssignment([])
  }

    const handleFilterChange = (type, key, value) => {
        setFilters(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [key]: value
            }
        }));
    };

    const filteredResults = searchResults.filter(product => {
        const brand = product.brand.toLowerCase();
        if (brand.includes('sigma')) return filters.brands.sigma;
        if (brand.includes('tci')) return filters.brands.tci;
        return true;
    });


  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Ürün Arama ve Atama</h1>
      <div className="flex gap-2 mb-4">
        <Input
          type="search"
          placeholder="Ürün adı, kodu veya CAS..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearchClick()}
          disabled={isLoading}
        />
        <Button
            onClick={onSearchClick}
            disabled={isLoading}
            className="relative w-32 overflow-hidden transition-all duration-300"
        >
            <span className="relative z-10 flex items-center justify-center gap-2">
                {isLoading ? (
                    <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        <span>Aranıyor...</span>
                    </>
                ) : (
                    "Ara"
                )}
            </span>
            {isLoading && (
                <motion.div
                    className="absolute bottom-0 left-0 top-0 bg-primary-foreground/20"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
                />
            )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <ListFilter className="mr-2 h-4 w-4" /> Filtrele
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-56">
             <DropdownMenuLabel>Marka</DropdownMenuLabel>
            <DropdownMenuSeparator />
             <DropdownMenuCheckboxItem
                checked={filters.brands.sigma}
                onCheckedChange={(checked) => handleFilterChange('brands', 'sigma', checked)}
                onSelect={(e) => e.preventDefault()}
              >Sigma</DropdownMenuCheckboxItem>
             <DropdownMenuCheckboxItem
                checked={filters.brands.tci}
                onCheckedChange={(checked) => handleFilterChange('brands', 'tci', checked)}
                onSelect={(e) => e.preventDefault()}
              >TCI</DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Ülkeler (Sigma)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(countryLabels).map(([code, label]) => (
              <DropdownMenuCheckboxItem
                key={code}
                checked={filters.countries[code]}
                onCheckedChange={(checked) => handleFilterChange('countries', code, checked)}
                onSelect={(e) => e.preventDefault()}
              >
                {label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Hata</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {filteredResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Arama Sonuçları ({filteredResults.length})</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="grid grid-cols-6 gap-4 p-4 border-b bg-muted/30 font-semibold text-sm">
              <div>Marka</div>
              <div>Ürün Adı</div>
              <div>Kodu</div>
              <div>CAS</div>
              <div>Fiyat</div>
              <div>Stok</div>
            </div>
            <div className="space-y-2">
              {filteredResults.map((product, index) => (
                <div key={product.product_number + index} className="border rounded-lg">
                  <div className="flex items-center justify-between p-4 hover:bg-muted/50">
                    <div className="flex-1 grid grid-cols-6 gap-4 items-center">
                       <div className="font-semibold flex items-center gap-2"><Building className="h-4 w-4 text-muted-foreground" /> {product.brand}</div>
                      <div className="font-medium" dangerouslySetInnerHTML={{ __html: product.product_name }} />
                      <div>{product.product_number}</div>
                      <div>{product.cas_number}</div>
                      <div>{product.cheapest_netflex_price_str}</div>
                      <div>{product.cheapest_netflex_stock}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => toggleProductExpansion(product.product_number)}>
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
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t bg-muted/20 p-4 overflow-hidden"
                     >
                      <h4 className="font-semibold mb-3">Ürün Varyasyonları</h4>
                       {product.brand.toLowerCase().includes('sigma') ? (
                         <div className="overflow-x-auto">
                           <Table>
                             <TableHeader>
                               <TableRow>
                                 <TableHead className="w-[150px]">Ürün Kodu</TableHead>
                                 <TableHead>Netflex</TableHead>
                                 {Object.entries(countryHeaders).map(
                                   ([code, name]) => filters.countries[code] && <TableHead key={code}>{name}</TableHead>,
                                 )}
                               </TableRow>
                             </TableHeader>
                             <TableBody>
                               {getCombinedData(product).map((item, itemIndex) => (
                                 <TableRow key={itemIndex}>
                                   <TableCell className="font-mono">{item.material_number}</TableCell>
                                   <TableCell>
                                     {item.netflex ? (
                                       <div className="flex items-center gap-2">
                                         <Checkbox
                                           id={`cb-netflex-${item.material_number}-${index}`}
                                           onCheckedChange={() => handleSelectNetflex(product, item)}
                                           checked={selectedForAssignment.some(
                                             (p) => p.product_code === item.material_number && p.source === "Netflex",
                                           )}
                                         />
                                         <Label
                                           htmlFor={`cb-netflex-${item.material_number}-${index}`}
                                           className="flex-grow cursor-pointer"
                                         >
                                           <div className="flex flex-col">
                                             <div className="flex items-baseline gap-2">
                                               <span className="font-semibold">{item.netflex.price_str}</span>
                                               <span className="font-medium text-sm text-muted-foreground">
                                                 Stok: {item.netflex.stock}
                                               </span>
                                             </div>
                                             <span
                                               className="text-xs text-muted-foreground truncate"
                                               title={item.netflex.product_name}
                                               dangerouslySetInnerHTML={{ __html: item.netflex.product_name }}
                                             />
                                           </div>
                                         </Label>
                                       </div>
                                     ) : (
                                       <span className="text-xs text-muted-foreground">-</span>
                                     )}
                                   </TableCell>
                                   {Object.keys(countryHeaders).map(
                                     (code) =>
                                       filters.countries[code] && (
                                         <TableCell key={code}>
                                           {item.sigma[code] ? (
                                             <div className="flex items-center gap-2">
                                               <Checkbox
                                                 id={`cb-${code}-${item.material_number}-${index}`}
                                                 onCheckedChange={() =>
                                                   handleSelectSigma(product, item, code, item.sigma[code])
                                                 }
                                                 checked={selectedForAssignment.some(
                                                   (p) =>
                                                     p.product_code === item.material_number &&
                                                     p.source === `Sigma (${code.toUpperCase()})`,
                                                 )}
                                               />
                                               <Label
                                                 htmlFor={`cb-${code}-${item.material_number}-${index}`}
                                                 className="flex items-baseline gap-2 cursor-pointer"
                                               >
                                                 <span className="font-semibold whitespace-nowrap">
                                                   {item.sigma[code].price !== null
                                                     ? `${item.sigma[code].price} ${item.sigma[code].currency}`
                                                     : "N/A"}
                                                 </span>
                                                 <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                   {item.sigma[code].availability_date || "Tarih Yok"}
                                                 </span>
                                               </Label>
                                             </div>
                                           ) : (
                                             <span className="text-xs text-muted-foreground">-</span>
                                           )}
                                         </TableCell>
                                       ),
                                   )}
                                 </TableRow>
                               ))}
                             </TableBody>
                           </Table>
                         </div>
                       ) : ( // TCI Products
                          <Table>
                             <TableHeader>
                               <TableRow>
                                 <TableHead className="w-[50px]"></TableHead>
                                 <TableHead>Birim</TableHead>
                                 <TableHead>Orijinal Fiyat</TableHead>
                                 <TableHead>Hesaplanmış Fiyat (x1.4)</TableHead>
                               </TableRow>
                             </TableHeader>
                             <TableBody>
                               {product.tci_variations?.map((variation, vIndex) => (
                                 <TableRow key={vIndex}>
                                   <TableCell>
                                      <Checkbox
                                        id={`cb-tci-${product.product_number}-${vIndex}`}
                                        onCheckedChange={() => handleSelectTCI(product, variation)}
                                        checked={selectedForAssignment.some(
                                            p => p.product_code === `${product.product_number}-${variation.unit}` && p.source === 'TCI'
                                        )}
                                      />
                                   </TableCell>
                                   <TableCell>{variation.unit}</TableCell>
                                   <TableCell>{variation.original_price}</TableCell>
                                   <TableCell className="font-semibold">{variation.calculated_price}</TableCell>
                                 </TableRow>
                               ))}
                             </TableBody>
                           </Table>
                       )}
                    </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && filteredResults.length === 0 && (
        <div className="text-center py-10">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Arama yapmak için yukarıdaki alanı kullanın.</p>
        </div>
      )}

      <AssignmentDialog
        selectedForAssignment={selectedForAssignment}
        customers={customers}
        handleAssignConfirm={handleAssignConfirm}
      />
    </div>
  )
}

// --------------------------------------------------------------------------------
// Ana Uygulama Mantığı
// --------------------------------------------------------------------------------
function MainApplication({ appStatus, setAppStatus }) {
  const [page, setPage] = useState("search");
  const [customers, setCustomers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Veriyi SADECE bir kez, component yüklendiğinde oku
  useEffect(() => {
    try {
      const savedCustomers = localStorage.getItem("customers");
      if (savedCustomers) { setCustomers(JSON.parse(savedCustomers)); }
      const savedAssignments = localStorage.getItem("assignments");
      if (savedAssignments) { setAssignments(JSON.parse(savedAssignments)); }
    } catch (error) {
      console.error("localStorage'dan veri yüklenirken hata:", error);
      toast.error("Kaydedilmiş veriler yüklenemedi.");
    } finally {
      setIsDataLoaded(true);
    }
  }, []);


  // Verileri her değiştiğinde kaydet
  useEffect(() => {
    if (isDataLoaded) {
      try {
        localStorage.setItem("customers", JSON.stringify(customers));
        localStorage.setItem("assignments", JSON.stringify(assignments));
      } catch (error) {
        console.error("Veriler kaydedilirken hata:", error);
      }
    }
  }, [customers, assignments, isDataLoaded]);

  const [dashboardStats, setDashboardStats] = useState({ customerCount: 0, totalUniqueProducts: 0, activeOrders: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return
    const cleanups = [
        window.electronAPI.onProductFound((product) => {
            setSearchResults((prev) => {
                const isProductAlreadyInList = prev.some((p) => p.product_number === product.product_number)
                if (!isProductAlreadyInList) { return [...prev, product] }
                return prev
            })
        }),
        window.electronAPI.onSearchComplete((summary) => {
            setIsLoading(false)
            if (summary.status === 'cancelled') { toast.warning("Arama iptal edildi.") }
            else { toast.success(`Arama tamamlandı! ${summary.total_found} eşleşme bulundu.`) }
        }),
        window.electronAPI.onSearchError((errorMessage) => { setError(errorMessage); setIsLoading(false) }),
        window.electronAPI.onExportResult((result) => {
            if (result.status === "success") { toast.success(`Excel dosyası kaydedildi: ${result.path}`) }
            else { toast.error(`Excel hatası: ${result.message}`) }
        }),
        window.electronAPI.onAuthenticationError(() => { setAppStatus('auth_error') }),
    ];
    return () => { cleanups.forEach(cleanup => cleanup()); }
  }, [setAppStatus])

  useEffect(() => {
    let productCount = 0
    const uniqueProducts = new Set<string>()
    Object.values(assignments).forEach((productList: AssignmentItem[]) => {
      productCount += productList.length
      productList.forEach((product) => { uniqueProducts.add(product.product_code) })
    })
    setDashboardStats({
      customerCount: customers.length,
      totalUniqueProducts: uniqueProducts.size,
      activeOrders: productCount,
    })
  }, [assignments, customers])

  const handleAssignProducts = (customerId, products: AssignmentItem[]) => {
    setAssignments((prev) => {
      const currentAssigned = prev[customerId] || []
      const newProducts = products.filter(
        (p) => !currentAssigned.some((ap) => ap.product_code === p.product_code && ap.source === p.source),
      )
      return { ...prev, [customerId]: [...currentAssigned, ...newProducts] }
    })
  }

  const handleSearch = (searchTerm: string) => {
    if (!searchTerm.trim() || isLoading) return
    setIsLoading(true)
    setSearchResults([])
    setError(null)
    if (window.electronAPI) {
        window.electronAPI.performSearch(searchTerm)
    } else {
        console.error("Electron API bulunamadı, arama yapılamıyor.")
        setIsLoading(false)
    }
  }

  const handleSettingsSaved = () => {
    // Ayarlar başarıyla kaydedildiğinde, durumu 'hazır' olarak güncelleyerek
    // ana uygulamaya geri dönülmesini sağla.
    setAppStatus('ready');
    // Sayfayı da arama sayfasına yönlendir.
    setPage('search');
  };


  const renderPage = () => {
    // Eğer kimlik doğrulama hatası varsa, doğrudan ayarlar sayfasını göster.
    if (appStatus === 'auth_error') {
      return <SettingsPage authError={true} onSettingsSaved={handleSettingsSaved} />;
    }

    switch (page) {
      case "search":
        return ( <SearchPage searchResults={searchResults} isLoading={isLoading} error={error} handleSearch={handleSearch} customers={customers} onAssignProducts={handleAssignProducts} /> )
      case "customers":
        return ( <CustomersPage customers={customers} setCustomers={setCustomers} assignments={assignments} setAssignments={setAssignments} /> )
      case "settings":
        return <SettingsPage authError={false} onSettingsSaved={handleSettingsSaved} />;
      case "home":
      default:
        return <HomePage stats={dashboardStats} />
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
        <Sidebar setPage={setPage} currentPage={page} />
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
          <main className="flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">{renderPage()}</main>
        </div>
        <Toaster position="bottom-right" />
      </div>
    </motion.div>
  )
}

// --------------------------------------------------------------------------------
// Ana Uygulama Yönlendiricisi
// --------------------------------------------------------------------------------
export default function App() {
  const [appStatus, setAppStatus] = useState('initializing') // 'initializing', 'setup_required', 'auth_error', 'ready', 'error'

  useEffect(() => {
    if (!window.electronAPI) {
      console.warn("Electron API bulunamadı. Geliştirme modu varsayılıyor.");
      const timer = setTimeout(() => setAppStatus('ready'), 2500); // Geliştirme için gecikme
      return () => clearTimeout(timer);
    }

    const cleanups = [
        window.electronAPI.onServicesReady((isReady) => {
            setAppStatus(isReady ? 'ready' : 'error')
            if (!isReady) toast.error("Arka plan servisleri başlatılamadı.")
        }),
        window.electronAPI.onInitialSetupRequired(() => setAppStatus('setup_required')),
        window.electronAPI.onAuthenticationError(() => setAppStatus('auth_error')),
        window.electronAPI.onPythonCrashed(() => {
            setAppStatus('error')
            toast.error("Kritik hata: Arka plan servisi çöktü.")
        })
    ];

    // Tüm dinleyiciler kurulduktan sonra, ana sürece hazır olduğumuzu bildiriyoruz.
    window.electronAPI.rendererReady();

    return () => cleanups.forEach(c => c())
  }, []);

  const renderContent = () => {
    switch (appStatus) {
      case 'initializing':
        return <SplashScreen key="splash" hasError={false} />;
      case 'setup_required':
        return <InitialSetupScreen key="setup" setAppStatus={setAppStatus} />;
      case 'ready':
      case 'auth_error': // auth_error durumunu MainApplication yönetecek
        return <MainApplication key="main_app" appStatus={appStatus} setAppStatus={setAppStatus} />;
      case 'error':
        return <SplashScreen key="splash-error" hasError={true} />;
      default:
        return <SplashScreen key="splash-default" hasError={false} />;
    }
  }

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <AnimatePresence mode="wait">
         <motion.div
            key={appStatus} // Durum değiştikçe animasyonun yeniden tetiklenmesini sağlar
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}>
          {renderContent()}
        </motion.div>
      </AnimatePresence>
      <Toaster position="bottom-right" />
    </ThemeProvider>
  )
}

