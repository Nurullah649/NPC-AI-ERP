"use client"

import { useState, useEffect, createContext, useContext, useMemo } from "react"
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
  FileSearch,
  Upload,
  ArrowLeft,
  SkipForward, // Yeni ikon
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
import { Progress } from "@/components/ui/progress"


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
  original_price_numeric: number | null
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

interface AppSettings {
    netflex_username: string;
    netflex_password: string;
    tci_coefficient: number;
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
      cancelCurrentTermSearch: () => void; // Yeni fonksiyon
      onServicesReady: (callback: (isReady: boolean) => void) => () => void
      onInitialSetupRequired: (callback: () => void) => () => void
      onProductFound: (callback: (message: { product: any, context?: any }) => void) => () => void
      onSearchComplete: (callback: (summary: any) => void) => () => void
      onExportResult: (callback: (result: any) => void) => () => void
      onSearchError: (callback: (error: string) => void) => () => void
      onSettingsLoaded: (callback: (settings: any) => void) => () => void
      onSettingsSaved: (callback: (result: any) => void) => () => void
      onAuthenticationError: (callback: () => void) => () => void
      onPythonCrashed: (callback: () => void) => () => void
      onBatchSearchProgress: (callback: (progress: any) => void) => () => void
      onBatchSearchComplete: (callback: (summary: any) => void) => () => void
    }
  }
}

// --------------------------------------------------------------------------------
// Yardımcı Fonksiyonlar ve Bileşenler
// --------------------------------------------------------------------------------
const formatCurrency = (value: number | null, currency = "EUR") => {
    if (value === null || isNaN(value)) return "N/A"
    const currencySymbol = currency === "EUR" ? "€" : currency
    return `${currencySymbol}${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const stripHtml = (html: string | null | undefined): string => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
};

// YENİ EKLENEN FONKSİYON
const cleanAndDecodeHtml = (html: string | null | undefined): string => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.innerHTML;
};

import SplashScreen from "@/public/SplashScreen"


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
    { name: "batch-search", href: "#", icon: FileSearch, label: "Toplu Proforma Arama" },
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
            <Input id="tci_coefficient" type="number" step="0.1" value={settings.tci_coefficient || 1.4} onChange={(e) => handleChange('tci_coefficient', parseFloat(e.target.value) || 0)} />
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
const SettingsPage = ({ authError, settings, onSaveSettings }) => {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (newSettings: AppSettings) => {
    setIsSaving(true)
    const cleanup = window.electronAPI.onSettingsSaved((result) => {
      if (result.status === 'success') {
        toast.success('Ayarlar başarıyla kaydedildi.')
        onSaveSettings(newSettings) // Ana uygulama state'ini güncelle
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
                    {/* DEĞİŞİKLİK BURADA */}
                    <TableCell className="font-medium" dangerouslySetInnerHTML={{ __html: cleanAndDecodeHtml(product.product_name) }} />
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
const AssignmentDialog = ({ selectedForAssignment, customers, handleAssignConfirm, targetCustomerName }) => {
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

    const handleConfirmClick = () => {
      const customerId = targetCustomerName ? customers.find(c => c.name === targetCustomerName)?.id.toString() : selectedCustomerId;

      if (!customerId) {
        toast.error("Lütfen bir müşteri seçin.")
        return
      }
      handleAssignConfirm(customerId, selectedForAssignment)
      setIsAssignDialogOpen(false)
      setSelectedCustomerId(null)
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
              {selectedForAssignment.length} Ürünü Ata
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Müşteriye Ürün Ata</DialogTitle>
              {targetCustomerName ? (
                <DialogDescription>Seçili {selectedForAssignment.length} ürün, <strong>{targetCustomerName}</strong> adlı müşteriye atanacak.</DialogDescription>
              ) : (
                <DialogDescription>Seçili ürünleri atamak için bir müşteri seçin.</DialogDescription>
              )}
            </DialogHeader>
            <div className="py-4">
              {targetCustomerName ? (
                 <div className="flex items-center gap-2 rounded-md border p-3">
                    <User className="h-5 w-5 text-primary" />
                    <span className="font-medium">{targetCustomerName}</span>
                 </div>
              ) : (
                  <Select onValueChange={setSelectedCustomerId}>
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
              )}
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
// Ürün Arama Sayfası (Tekli ve Toplu için Ortak Bileşenler)
// --------------------------------------------------------------------------------

const ProductResultItem = ({ product, settings, expandedProducts, toggleProductExpansion, selectedForAssignment, onSelectionChange }) => {

    const countryLabels = { tr: "Türkiye", us: "Amerika", de: "Almanya", gb: "İngiltere" }
    const countryHeaders = { tr: "Türkiye (TR)", us: "Amerika (US)", de: "Almanya (DE)", gb: "İngiltere (GB)" }
    const [filters, setFilters] = useState({ countries: { tr: true, us: true, de: true, gb: true } });

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
      const calculatedPrice = variation.original_price_numeric
          ? variation.original_price_numeric * settings.tci_coefficient
          : null;

      const assignmentItem: AssignmentItem = {
        product_name: product.product_name,
        product_code: `${product.product_number}-${variation.unit}`,
        cas_number: product.cas_number,
        price_numeric: calculatedPrice,
        price_str: formatCurrency(calculatedPrice),
        source: 'TCI',
        cheapest_netflex_stock: ''
      };
      onSelectionChange(assignmentItem);
    };

    return (
        <div className="border rounded-lg">
          <div className="grid grid-cols-[1.5fr_4fr_2fr_1.5fr_2fr_1fr_auto] gap-x-4 items-center p-4 hover:bg-muted/50">
             <div className="font-semibold flex items-center gap-2 truncate"><Building className="h-4 w-4 text-muted-foreground" /> {product.brand}</div>
             {/* DEĞİŞİKLİK BURADA */}
             <div className="min-w-0 font-medium truncate" title={stripHtml(product.product_name)} dangerouslySetInnerHTML={{ __html: cleanAndDecodeHtml(product.product_name) }} />
            <div className="font-mono">{product.product_number}</div>
            <div>{product.cas_number}</div>
            <div>{product.cheapest_netflex_price_str}</div>
            <div>{product.brand.toLowerCase().includes('tci') ? '' : product.cheapest_netflex_stock}</div>
            <Button variant="outline" size="sm" onClick={() => toggleProductExpansion(product.product_number)} className="justify-self-end">
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
                                   id={`cb-netflex-${item.material_number}`}
                                   onCheckedChange={() => handleSelectNetflex(product, item)}
                                   checked={selectedForAssignment.some(
                                     (p) => p.product_code === item.material_number && p.source === "Netflex",
                                   )}
                                 />
                                 <Label
                                   htmlFor={`cb-netflex-${item.material_number}`}
                                   className="flex-grow cursor-pointer"
                                 >
                                   <div className="flex flex-col">
                                     <div className="flex items-baseline gap-2">
                                       <span className="font-semibold">{item.netflex.price_str}</span>
                                       <span className="font-medium text-sm text-muted-foreground">
                                         Stok: {item.netflex.stock}
                                       </span>
                                     </div>
                                      {/* DEĞİŞİKLİK BURADA */}
                                     <span
                                       className="text-xs text-muted-foreground truncate"
                                       title={stripHtml(item.netflex.product_name)}
                                       dangerouslySetInnerHTML={{ __html: cleanAndDecodeHtml(item.netflex.product_name) }}
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
                                         id={`cb-${code}-${item.material_number}`}
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
                                         htmlFor={`cb-${code}-${item.material_number}`}
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
                         <TableHead>Hesaplanmış Fiyat (x{settings.tci_coefficient})</TableHead>
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
                           <TableCell className="font-semibold">
                             {formatCurrency(variation.original_price_numeric
                                 ? variation.original_price_numeric * settings.tci_coefficient
                                 : null
                             )}
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

// --------------------------------------------------------------------------------
// Ürün Arama Sayfası
// --------------------------------------------------------------------------------
const SearchPage = ({ searchResults, isLoading, error, handleSearch, handleCancel, customers, onAssignProducts, settings }) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    brands: { sigma: true, tci: true },
    countries: { tr: true, us: true, de: true, gb: true },
  })
  const [selectedForAssignment, setSelectedForAssignment] = useState<AssignmentItem[]>([])
  const [isHovering, setIsHovering] = useState(false)
  const [progress, setProgress] = useState(0)

  // Arama ilerlemesini hesaplamak için
  useEffect(() => {
    if (isLoading) {
      const newProgress = 1 - (1 / (searchResults.length + 1.5));
      setProgress(Math.min(newProgress, 0.95));
    } else {
      setProgress(0);
    }
  }, [searchResults.length, isLoading]);


  const countryLabels = { tr: "Türkiye", us: "Amerika", de: "Almanya", gb: "İngiltere" }

  const onSearchOrCancelClick = () => {
      if (isLoading) {
          handleCancel();
      } else {
          handleSearch(searchTerm);
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
    <div className="container mx-auto p-4 flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold mb-4">Ürün Arama ve Atama</h1>
        <div className="flex gap-2 mb-4">
          <Input
            type="search"
            placeholder="Ürün adı, kodu veya CAS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSearch(searchTerm)}
            disabled={isLoading}
          />
          <Button
              onClick={onSearchOrCancelClick}
              onMouseEnter={() => { if(isLoading) setIsHovering(true) }}
              onMouseLeave={() => { if(isLoading) setIsHovering(false) }}
              className={cn(
                  "relative w-36 overflow-hidden transition-all duration-300 ease-in-out",
                  isLoading && isHovering && "w-44" // İptal durumunda buton genişler
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
                              <XCircle className="mr-2 h-5 w-5" />
                              Aramayı İptal Et
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
                              <LoaderCircle className="h-4 w-4 animate-spin mr-2" />
                              Aranıyor...
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
                              <Search className="mr-2 h-4 w-4" />
                               Ara
                          </motion.span>
                      )}
                  </AnimatePresence>
              </div>

              {isLoading && !isHovering && (
                  <motion.div
                      className="absolute bottom-0 left-0 right-0 bg-primary/20"
                      initial={{ height: "0%" }}
                      animate={{ height: `${progress * 100}%` }}
                      transition={{ type: 'spring', stiffness: 50, damping: 20 }}
                      style={{ zIndex: 5 }}
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
      </div>


      {error && (
        <Alert variant="destructive" className="flex-shrink-0">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Hata</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {filteredResults.length > 0 && (
        <Card className="flex-grow flex flex-col overflow-hidden mt-4">
          <CardHeader className="flex-shrink-0">
            <CardTitle>Arama Sonuçları ({filteredResults.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col overflow-hidden p-0">
            <div className="p-4 border-b bg-muted/40 flex-shrink-0">
              <div className="grid grid-cols-[1.5fr_4fr_2fr_1.5fr_2fr_1fr_auto] gap-x-4 font-semibold text-sm text-muted-foreground">
                  <div className="truncate">Marka</div>
                  <div className="truncate">Ürün Adı</div>
                  <div className="truncate">Kodu</div>
                  <div className="truncate">CAS</div>
                  <div className="truncate">Fiyat</div>
                  <div className="truncate">Stok</div>
                  <div className="w-9"></div> {/* Button column placeholder */}
              </div>
            </div>
             <div className="flex-grow overflow-y-auto custom-scrollbar p-4">
                <div className="space-y-2">
                  {filteredResults.map((product, index) => (
                    <ProductResultItem
                        key={product.product_number + index}
                        product={product}
                        settings={settings}
                        expandedProducts={expandedProducts}
                        toggleProductExpansion={toggleProductExpansion}
                        selectedForAssignment={selectedForAssignment}
                        onSelectionChange={handleSelectionChange}
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

      <AssignmentDialog
        selectedForAssignment={selectedForAssignment}
        customers={customers}
        handleAssignConfirm={handleAssignConfirm}
        targetCustomerName={null}
      />
    </div>
  )
}


// --------------------------------------------------------------------------------
// Toplu Proforma Arama Sayfası
// --------------------------------------------------------------------------------
const BatchSearchPage = ({ customers, onAssignProducts, settings, batchState, setBatchState }) => {
    // Durum (state) artık parent bileşenden (MainApplication) prop olarak geliyor.
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
    } = batchState;

    // Sadece dialog'un açık/kapalı durumunu yöneten lokal state
    const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);

    // Parent'tan gelen state'i güncellemek için yardımcı fonksiyon
    const updateState = (newState) => {
        setBatchState(prev => ({ ...prev, ...newState }));
    };

    // onProductFound event listener'ı
    useEffect(() => {
        if (!window.electronAPI) return;

        const cleanup = window.electronAPI.onProductFound(({ product, context }) => {
            if (context?.batch_search_term) {
                setBatchState(prev => {
                    const newResults = new Map(prev.batchResults);
                    const term = context.batch_search_term;
                    const existing = newResults.get(term) || [];
                    const isProductAlreadyInList = existing.some(p => p.product_number === product.product_number);
                    if (!isProductAlreadyInList) {
                        newResults.set(term, [...existing, product]);
                    }
                    return { ...prev, batchResults: newResults };
                });
            }
        });

        return () => cleanup();
    }, [setBatchState]);

    // Arama ilerlemesi ve tamamlama event listener'ları
    useEffect(() => {
        if (!window.electronAPI) return;
        const cleanups = [
            window.electronAPI.onBatchSearchProgress(progress => {
                setBatchState(prev => {
                    const isFirstUpdate = progress.current === 1 && !prev.selectedTerm;
                    return {
                        ...prev,
                        searchProgress: { ...progress, running: true },
                        selectedTerm: isFirstUpdate ? progress.term : prev.selectedTerm,
                    };
                });
            }),
            window.electronAPI.onBatchSearchComplete(summary => {
                setBatchState(prev => ({ ...prev, searchProgress: { ...prev.searchProgress, running: false } }));
                 if (summary.status === 'cancelled') {
                    toast.warning("Toplu arama iptal edildi.")
                } else if(summary.status === 'complete') {
                    toast.success("Toplu arama tamamlandı!");
                }
            }),
        ];

        return () => cleanups.forEach(c => c());
    }, [setBatchState]);


    const handleFileSelect = async () => {
        const selectedPath = await window.electronAPI.selectFile();
        if (selectedPath) {
            updateState({
                filePath: selectedPath,
                fileName: selectedPath.split(/[\\/]/).pop() || null,
            });
            setIsCustomerDialogOpen(true);
        }
    };

    const handleStartSearch = () => {
        if (!filePath || !customerName.trim()) {
            toast.error("Lütfen dosya seçip müşteri adı girin.");
            return;
        }
        setIsCustomerDialogOpen(false);
        setBatchState(prev => ({
            ...prev,
            pageState: 'searching_and_results',
            batchResults: new Map(),
            selectedForAssignment: [],
            selectedTerm: null,
        }));
        window.electronAPI.startBatchSearch({ filePath, customerName });
    };

    const handleCancelSearch = () => {
        window.electronAPI.cancelBatchSearch();
    };

    const handleSkipTerm = () => {
        toast.info(`'${searchProgress.term}' araması atlanıyor...`);
        window.electronAPI.cancelCurrentTermSearch();
    };

    const handleResetBatchSearch = () => {
        window.electronAPI.cancelBatchSearch();
        updateState({
            pageState: 'idle',
            filePath: null,
            fileName: null,
            customerName: '',
            searchProgress: { term: '', current: 0, total: 0, running: false },
            batchResults: new Map(),
            selectedForAssignment: [],
            selectedTerm: null,
        });
    };

    const handleSelectionChange = (item: AssignmentItem) => {
      setBatchState(prev => {
        const isSelected = prev.selectedForAssignment.some((p) => p.product_code === item.product_code && p.source === item.source);
        const newSelection = isSelected
            ? prev.selectedForAssignment.filter((p) => !(p.product_code === item.product_code && p.source === item.source))
            : [...prev.selectedForAssignment, item];
        return { ...prev, selectedForAssignment: newSelection };
      });
    };

    const handleAssignConfirm = (customerId, products) => {
        onAssignProducts(customerId, products);
        toast.success(`${products.length} ürün, ${customerName} adlı müşteriye atandı!`);
        updateState({ selectedForAssignment: [] });
    };

     const toggleProductExpansion = (productNumber: string) => {
        setBatchState(prev => {
          const newSet = new Set(prev.expandedProducts)
          if (newSet.has(productNumber)) {
            newSet.delete(productNumber)
          } else {
            newSet.add(productNumber)
          }
          return { ...prev, expandedProducts: newSet };
        })
    }

    const resultsArray = useMemo(() => Array.from(batchResults.keys()), [batchResults]);
    const currentResultsForSelectedTerm = useMemo(() => batchResults.get(selectedTerm) || [], [batchResults, selectedTerm]);


    return (
        <div className="container mx-auto p-4 h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold">Toplu Proforma Arama</h1>
                    {pageState !== 'idle' && (
                         <Button variant="outline" onClick={handleResetBatchSearch}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Yeni Toplu Arama
                         </Button>
                    )}
                </div>
            </div>

            {pageState === 'idle' && (
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
                        <DialogDescription>
                            Arama sonuçlarının atanacağı müşterinin adını ve soyadını girin.
                        </DialogDescription>
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
                        <Button variant="outline" onClick={() => {setIsCustomerDialogOpen(false);}}>İptal</Button>
                        <Button onClick={handleStartSearch}>Aramayı Başlat</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {pageState === 'searching_and_results' && (
                <div className="flex-grow flex flex-col overflow-hidden">
                    {searchProgress.running && (
                        <Card className="mb-4 flex-shrink-0">
                           <CardHeader><CardTitle>Arama Devam Ediyor...</CardTitle></CardHeader>
                           <CardContent className="space-y-3">
                               <Progress value={(searchProgress.current / searchProgress.total) * 100} className="w-full" />
                               <div className="text-sm text-muted-foreground text-center">
                                   <p>({searchProgress.current}/{searchProgress.total}) - <strong>{searchProgress.term}</strong> aranıyor...</p>
                               </div>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                   <Button variant="outline" className="w-full" onClick={handleSkipTerm}>
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
                                            onClick={() => updateState({ selectedTerm: term })}
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
                                    <CardHeader className="flex-shrink-0">
                                        <CardTitle>Sonuçlar: "{selectedTerm}"</CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex-grow overflow-y-auto custom-scrollbar p-4">
                                        {currentResultsForSelectedTerm.length > 0 ? (
                                            <div className="space-y-2">
                                                {currentResultsForSelectedTerm.map((product, index) => (
                                                    <ProductResultItem
                                                        key={product.product_number + index}
                                                        product={product}
                                                        settings={settings}
                                                        expandedProducts={expandedProducts}
                                                        toggleProductExpansion={toggleProductExpansion}
                                                        selectedForAssignment={selectedForAssignment}
                                                        onSelectionChange={handleSelectionChange}
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


            <AssignmentDialog
                selectedForAssignment={selectedForAssignment}
                customers={customers}
                handleAssignConfirm={handleAssignConfirm}
                targetCustomerName={customerName}
            />

        </div>
    );
};


// --------------------------------------------------------------------------------
// Ana Uygulama Mantığı
// --------------------------------------------------------------------------------
function MainApplication({ appStatus, setAppStatus }) {
  const [page, setPage] = useState("batch-search");
  const [customers, setCustomers] = useState<{id: number, name: string}[]>([]);
  const [assignments, setAssignments] = useState<{[key: number]: AssignmentItem[]}>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Toplu Arama Sayfasının durumunu yukarı taşıdık (state lifting)
  const [batchSearchState, setBatchSearchState] = useState({
      pageState: 'idle', // 'idle' | 'searching_and_results'
      filePath: null as string | null,
      fileName: null as string | null,
      customerName: '',
      searchProgress: { term: '', current: 0, total: 0, running: false },
      batchResults: new Map<string, ProductResult[]>(),
      expandedProducts: new Set<string>(),
      selectedForAssignment: [] as AssignmentItem[],
      selectedTerm: null as string | null,
  });


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

  // Ayarları Yükle
  useEffect(() => {
    if (window.electronAPI) {
        window.electronAPI.loadSettings();
        const cleanup = window.electronAPI.onSettingsLoaded((loadedSettings) => {
            setSettings(loadedSettings);
        });
        return () => cleanup();
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
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return
    const cleanups = [
        window.electronAPI.onProductFound(({ product, context }) => {
            // Sadece bağlamı olmayan (yani tekli aramadan gelen) sonuçları işle
            if (!context) {
                setSearchResults((prev) => {
                    const isProductAlreadyInList = prev.some((p) => p.product_number === product.product_number)
                    if (!isProductAlreadyInList) { return [...prev, product] }
                    return prev
                })
            }
        }),
        window.electronAPI.onSearchComplete((summary) => {
            setIsLoading(false)
            if (summary.status === 'cancelled') {
              toast.warning("Arama iptal edildi.")
            }
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

  const handleAssignProducts = (customerId: string, products: AssignmentItem[]) => {
    setAssignments((prev) => {
      const currentAssigned = prev[parseInt(customerId)] || []
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

  const handleCancel = () => {
    if(isLoading && window.electronAPI) {
        toast.info("Arama iptal ediliyor...");
        window.electronAPI.cancelSearch();
    }
  }

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (appStatus === 'auth_error') {
        setAppStatus('ready');
        setPage('search');
    }
  };


  const renderPage = () => {
    if (appStatus === 'auth_error') {
      return <SettingsPage authError={true} settings={settings} onSaveSettings={handleSaveSettings} />;
    }

    switch (page) {
      case "search":
        return ( <SearchPage searchResults={searchResults} isLoading={isLoading} error={error} handleSearch={handleSearch} handleCancel={handleCancel} customers={customers} onAssignProducts={handleAssignProducts} settings={settings}/> )
      case "batch-search":
        return ( <BatchSearchPage
                    customers={customers}
                    onAssignProducts={handleAssignProducts}
                    settings={settings}
                    batchState={batchSearchState}
                    setBatchState={setBatchSearchState}
                 />)
      case "customers":
        return ( <CustomersPage customers={customers} setCustomers={setCustomers} assignments={assignments} setAssignments={setAssignments} /> )
      case "settings":
        return <SettingsPage authError={false} settings={settings} onSaveSettings={handleSaveSettings} />;
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
          <main className="flex-1 items-start gap-4 sm:px-6 sm:py-0 md:gap-8">{renderPage()}</main>
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
        <style jsx global>{`
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