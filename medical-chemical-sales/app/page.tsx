"use client"

import React, { useState, useEffect, createContext, useContext } from "react"
import { motion, AnimatePresence } from 'framer-motion';
import {
  Euro,
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
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
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
// import SplashScreen from '../public/SplashScreen'; // YOL HATASI: Bu import, derleme hatasına neden olduğu için kaldırıldı.

// --- YER TUTUCU SPLASH SCREEN ---
// Projenin derlenememesine neden olan yol (path) hatasını gidermek için
// harici dosya yerine geçici bir başlangıç ekranı bileşeni eklenmiştir.
// Kendi SplashScreen bileşeninizi kullanmak için onu 'src' klasörü altına taşıyıp
// import yolunu buna göre (örn: import SplashScreen from './components/SplashScreen';)
// güncellemeniz önerilir.
import SplashScreen from '../public/SplashScreen.jsx'


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
}

interface AssignmentItem {
  product_name: string
  product_code: string
  price_numeric: number | null
  price_str: string
  source: string
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
  }, [])
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
  ]
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      {" "}
      <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
        {" "}
        <a
          href="#"
          onClick={() => setPage("home")}
          className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
        >
          <Package2 className="h-4 w-4 transition-all group-hover:scale-110" />
          <span className="sr-only">Tales Job</span>
        </a>{" "}
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
          ))}{" "}
        </TooltipProvider>{" "}
      </nav>{" "}
      <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
        <ModeToggle />
      </nav>{" "}
    </aside>
  )
}

// --------------------------------------------------------------------------------
// Ana Sayfa (Dashboard)
// --------------------------------------------------------------------------------
const HomePage = ({ stats }) => {
  const formatCurrency = (value) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value)
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold tracking-tight">Hoş Geldiniz!</h1>
      <p className="text-muted-foreground">Yönetim sisteminize genel bir bakış.</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Ciro</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Müşterilere atanan tüm ürünler</p>
          </CardContent>
        </Card>
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
const CustomersPage = ({ customers, setCustomers, assignments }) => {
  const [newCustomer, setNewCustomer] = useState({ name: "" })
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
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
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedCustomer(customer)}
          >
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
        <DialogContent className="sm:max-w-2xl">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedProducts.map((product, index) => (
                  <TableRow key={`${product.product_code}-${index}`}>
                    <TableCell>{product.source}</TableCell>
                    <TableCell className="font-medium" dangerouslySetInnerHTML={{ __html: product.product_name }} />
                    <TableCell>{product.product_code}</TableCell>
                    <TableCell>{product.price_str}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-10">
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
    </div>
  )
}

// --------------------------------------------------------------------------------
// Ürün Detayları için Modal (Popup) Bileşeni
// --------------------------------------------------------------------------------
const ProductDetailModal = ({
  product,
  isOpen,
  onClose,
  visibleCountries,
  onSelectionChange,
  selectedItems,
  customers,
  onAssignConfirm,
}) => {
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const combinedData = React.useMemo(() => {
    if (!product) return []
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
  }, [product])

  if (!product) return null
  const countryHeaders = { tr: "Türkiye (TR)", us: "Amerika (US)", de: "Almanya (DE)", gb: "İngiltere (GB)" }

  const handleSelect = (item, source, priceData) => {
    const assignmentItem: AssignmentItem = {
      product_name: source === "Netflex" ? item.netflex.product_name : product.product_name,
      product_code: item.material_number,
      price_numeric: priceData.price,
      price_str: priceData.price !== null ? `${priceData.price} ${priceData.currency}` : "Fiyat Bilgisi Yok",
      source: `Sigma (${source.toUpperCase()})`,
    }
    if (source === "Netflex") {
      assignmentItem.source = "Netflex"
      assignmentItem.price_str = item.netflex.price_str
    }
    onSelectionChange(assignmentItem)
  }

  const handleConfirmAssignment = () => {
    if (!selectedCustomer) {
      toast.error("Lütfen bir müşteri seçin.")
      return
    }
    onAssignConfirm(selectedCustomer, selectedItems)
    setIsAssignDialogOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[150vw] max-w-[200vw] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle dangerouslySetInnerHTML={{ __html: product.product_name }} />
          <DialogDescription>
            Ürün Kodu: {product.product_number} | CAS: {product.cas_number}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-4">
          <h3 className="font-semibold text-lg mb-2">Karşılaştırma Tablosu</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Ürün Kodu</TableHead>
                <TableHead>Netflex</TableHead>
                {Object.entries(countryHeaders).map(
                  ([code, name]) => visibleCountries[code] && <TableHead key={code}>{name}</TableHead>,
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {combinedData.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono">{item.material_number}</TableCell>
                  <TableCell>
                    {item.netflex ? (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`cb-netflex-${item.material_number}`}
                          onCheckedChange={(checked) => handleSelect(item, "Netflex", item.netflex)}
                          checked={selectedItems.some(
                            (p) => p.product_code === item.material_number && p.source === "Netflex",
                          )}
                        />
                        <Label htmlFor={`cb-netflex-${item.material_number}`} className="flex-grow">
                          <div className="flex items-baseline gap-2">
                            <span className="font-semibold">{item.netflex.price_str}</span>
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
                      visibleCountries[code] && (
                        <TableCell key={code}>
                          {item.sigma[code] ? (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`cb-${code}-${item.material_number}`}
                                onCheckedChange={() => handleSelect(item, code, item.sigma[code])}
                                checked={selectedItems.some(
                                  (p) =>
                                    p.product_code === item.material_number && p.source.includes(code.toUpperCase()),
                                )}
                              />
                              <Label
                                htmlFor={`cb-${code}-${item.material_number}`}
                                className="flex items-baseline gap-2"
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
        <DialogFooter>
          {selectedItems.length > 0 && (
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {selectedItems.length} Ürünü Müşteriye Ata
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
                      ))}{" "}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button onClick={handleConfirmAssignment} className="w-full">
                    Atamayı Onayla
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" onClick={onClose}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --------------------------------------------------------------------------------
// Ürün Arama Sayfası
// --------------------------------------------------------------------------------
const SearchPage = ({ searchResults, isLoading, error, progress, handleSearch, customers, onAssignProducts }) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<ProductResult | null>(null)
  const [visibleCountries, setVisibleCountries] = useState({ tr: true, us: true, de: true, gb: true })
  const [selectedForAssignment, setSelectedForAssignment] = useState<AssignmentItem[]>([])

  const countryLabels = { tr: "Türkiye", us: "Amerika", de: "Almanya", gb: "İngiltere" }
  const onSearchClick = () => handleSearch(searchTerm)
  const progressValue = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0

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
    setSelectedProduct(null)
  }

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
        <Button onClick={onSearchClick} disabled={isLoading} className="w-28">
          {isLoading ? <LoaderCircle className="animate-spin" /> : "Ara"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <ListFilter className="mr-2 h-4 w-4" /> Filtrele
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-56">
            <DropdownMenuLabel>Gösterilecek Ülkeler</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {Object.entries(countryLabels).map(([code, label]) => (
              <DropdownMenuCheckboxItem
                key={code}
                checked={visibleCountries[code]}
                onCheckedChange={() => setVisibleCountries((prev) => ({ ...prev, [code]: !prev[code] }))}
                onSelect={(e) => e.preventDefault()}
              >
                {label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading && (
        <div className="my-4 p-4 border rounded-lg">
          {" "}
          <div className="flex justify-between items-center mb-2">
            {" "}
            <p className="text-sm font-medium">
              {" "}
              {progress.status === "found_sigma"
                ? `Sigma'da ${progress.total} ürün bulundu, işleniyor...`
                : `Ürünler işleniyor...`}{" "}
            </p>{" "}
            <p className="text-sm text-muted-foreground">
              {progress.processed} / {progress.total}
            </p>{" "}
          </div>{" "}
          <Progress value={progressValue} className="w-full" />{" "}
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          {" "}
          <AlertCircle className="h-4 w-4" /> <AlertTitle>Hata</AlertTitle> <AlertDescription>
            {error}
          </AlertDescription>{" "}
        </Alert>
      )}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Arama Sonuçları ({searchResults.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sigma Ürün Adı</TableHead>
                  <TableHead>Ürün Kodu</TableHead>
                  <TableHead>CAS</TableHead>
                  <TableHead>En Ucuz Netflex</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.map((product, index) => (
                  <TableRow
                    key={product.product_number + index}
                    onClick={() => setSelectedProduct(product)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium" dangerouslySetInnerHTML={{ __html: product.product_name }} />
                    <TableCell>{product.product_number}</TableCell>
                    <TableCell>{product.cas_number}</TableCell>
                    <TableCell>{product.cheapest_netflex_price_str}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!isLoading && searchResults.length === 0 && progress.status === "complete" && (
        <div className="text-center py-10">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Bu arama için sonuç bulunamadı.</p>
        </div>
      )}
      <ProductDetailModal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        visibleCountries={visibleCountries}
        onSelectionChange={handleSelectionChange}
        selectedItems={selectedForAssignment}
        customers={customers}
        onAssignConfirm={handleAssignConfirm}
      />
    </div>
  )
}

// --------------------------------------------------------------------------------
// 1. Ana Uygulama Mantığı (Yeni Bileşen)
// Bu bileşen, tüm ana uygulama durumunu ve mantığını içerir.
// --------------------------------------------------------------------------------
function MainApplication() {
    const [page, setPage] = useState("search")
    const [customers, setCustomers] = useState<{ id: number; name: string }[]>([])
    const [assignments, setAssignments] = useState<{ [key: string]: AssignmentItem[] }>({})
    const [dashboardStats, setDashboardStats] = useState({
        totalRevenue: 0,
        customerCount: 0,
        totalUniqueProducts: 0,
        activeOrders: 0,
    })

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [searchResults, setSearchResults] = useState<ProductResult[]>([])
    const [progress, setProgress] = useState({ status: "idle", total: 0, processed: 0, message: "" })

    useEffect(() => {
        if (typeof window === 'undefined' || !window.electronAPI) return
        window.electronAPI.onDatabaseResults((data) => {
            setSearchResults(data.results)
            setIsLoading(false)
            toast.success(`Veritabanında ${data.results.length} sonuç bulundu.`)
        })
        window.electronAPI.onProductFound((product) => {
            // Kontrol: Ürün zaten listede var mı?
            setSearchResults((prev) => {
                const isProductAlreadyInList = prev.some(
                    (p) => p.product_number === product.product_number
                );
                // Eğer ürün listede yoksa ekle
                if (!isProductAlreadyInList) {
                    return [...prev, product];
                }
                // Varsa listeyi olduğu gibi bırak
                return prev;
            });
        });
        window.electronAPI.onSearchProgress((progressData) => {
            setProgress(progressData)
        })
        window.electronAPI.onSearchComplete((summary) => {
            setIsLoading(false)
            setProgress((prev) => ({ ...prev, status: "complete" }))
            toast.success(`Arama tamamlandı! ${summary.total_found} eşleşme bulundu.`)
        })
        window.electronAPI.onSearchError((errorMessage) => {
            setError(errorMessage)
            setIsLoading(false)
            setProgress({ status: "error", total: 0, processed: 0, message: "" })
        })
        window.electronAPI.onExportResult((result) => {
            if (result.status === "success") {
                toast.success(`Excel dosyası kaydedildi: ${result.path}`)
            } else {
                toast.error(`Excel hatası: ${result.message}`)
            }
        })
    }, [])

    useEffect(() => {
        let revenue = 0
        let productCount = 0
        const uniqueProducts = new Set<string>()
        Object.values(assignments).forEach((productList) => {
            productCount += productList.length
            productList.forEach((product) => {
                uniqueProducts.add(product.product_code)
                if (product.price_numeric) {
                    revenue += product.price_numeric
                } else if (product.price_str) {
                    const priceMatch = product.price_str.match(/[\d.,]+/)
                    if (priceMatch) {
                        const cleanedPrice = priceMatch[0].replace(/\./g, "").replace(",", ".")
                        revenue += Number.parseFloat(cleanedPrice) || 0
                    }
                }
            })
        })
        setDashboardStats({
            totalRevenue: revenue,
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
        setProgress({ status: "searching", total: 0, processed: 0, message: "Arama başlatılıyor..." })
        window.electronAPI.performSearch(searchTerm)
    }

    const renderPage = () => {
        switch (page) {
            case "search":
                return (
                    <SearchPage
                        searchResults={searchResults}
                        isLoading={isLoading}
                        error={error}
                        progress={progress}
                        handleSearch={handleSearch}
                        customers={customers}
                        onAssignProducts={handleAssignProducts}
                    />
                )
            case "customers":
                return <CustomersPage customers={customers} setCustomers={setCustomers} assignments={assignments} />
            case "home":
            default:
                return <HomePage stats={dashboardStats} />
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
                <Sidebar setPage={setPage} currentPage={page} />
                <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
                    <main className="flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">{renderPage()}</main>
                </div>
                <Toaster position="bottom-right" />
            </div>
        </motion.div>
    );
}


// --------------------------------------------------------------------------------
// 2. Yükleme Ekranı ve Ana Uygulama Yönlendiricisi (Yeni App Bileşeni)
// Bu bileşen artık sadece uygulamanın yüklenip yüklenmediğini kontrol eder.
// Yükleniyorsa SplashScreen'i, bittiyse MainApplication'ı gösterir.
// --------------------------------------------------------------------------------
export default function App() {
    const [isAppLoading, setIsAppLoading] = useState(true);

    useEffect(() => {
        // Python'dan gelecek "hazır" sinyalini dinle
        if (window.electronAPI && typeof window.electronAPI.onPythonReady === 'function') {
            const cleanup = window.electronAPI.onPythonReady(() => {
                console.log("Python'dan 'hazır' sinyali alındı. Arayüz yükleniyor.");
                setIsAppLoading(false);
            });
            return () => cleanup();
        } else {
            // Electron API'si yoksa (tarayıcıda geliştirme gibi), kısa bir süre bekle
            console.warn("Electron API bulunamadı. Geliştirme ortamı varsayılıyor, 2 saniye sonra devam edilecek.");
            const timer = setTimeout(() => setIsAppLoading(false), 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    return (
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
            <AnimatePresence mode="wait">
                {isAppLoading ? (
                    <motion.div key="splash" exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                        <SplashScreen />
                    </motion.div>
                ) : (
                    <motion.div key="main_app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                        <MainApplication />
                    </motion.div>
                )}
            </AnimatePresence>
        </ThemeProvider>
    );
}
