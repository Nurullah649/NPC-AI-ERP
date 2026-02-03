"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  LoaderCircle,
  AlertCircle,
  ListFilter,
  ChevronDown,
  Filter,
  XCircle,
  Euro,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  UserPlus,
} from "lucide-react"
import {
  cn,
  Button,
  Input,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  Tooltip,
  Alert,
  AlertTitle,
  AlertDescription,
  Card,
  CardContent,
} from "../ui"
import { MemoizedProductResultItem } from "../ProductResultItem"
import { ProductResult, AssignmentItem, AppSettings } from "../../types"

const stripHtml = (html: string | null | undefined): string => {
  if (!html) return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body.textContent || ""
}

const AssignmentButton = ({ selectedForAssignment, handleAssignConfirm }: { selectedForAssignment: AssignmentItem[], handleAssignConfirm: (items: AssignmentItem[]) => void }) => {
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

export const SearchPage = ({
  searchResults,
  isLoading,
  error,
  handleSearch,
  handleCancel,
  onAssignProducts,
  settings,
  initialSearchTerm,
  onSearchExecuted,
  toast,
  filters,
  expandedProducts,
  setExpandedProducts,
  handleFilterChange,
  toggleProductExpansion,
}: {
  searchResults: ProductResult[]
  isLoading: boolean
  error: string | null
  handleSearch: (searchTerm: string, searchLogic: string) => void
  handleCancel: () => void
  onAssignProducts: (products: AssignmentItem[]) => void
  settings: AppSettings | null
  initialSearchTerm: string | null
  onSearchExecuted: () => void
  toast: (type: "success" | "error" | "warning" | "info", message: string) => void
  filters: any
  expandedProducts: Set<string>
  setExpandedProducts: React.Dispatch<React.SetStateAction<Set<string>>>
  handleFilterChange: (type: string, key: string, value: boolean) => void
  toggleProductExpansion: (productNumber: string) => void
}) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || "")
  const [searchLogic, setSearchLogic] = useState("exact")
  const [filterTerm, setFilterTerm] = useState("")
  const [debouncedFilterTerm, setDebouncedFilterTerm] = useState("")
  const [isProductNameVisible] = useState(true)
  const [showOriginalPrices, setShowOriginalPrices] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedForAssignment, setSelectedForAssignment] = useState<AssignmentItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [isHovering, setIsHovering] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm)
      onSearchExecuted()
    }
  }, [initialSearchTerm, onSearchExecuted])

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
    if (isSearching && !isLoading) return

    if (isLoading) {
      handleCancel()
    } else {
      setIsSearching(true)
      setFilterTerm("")
      setDebouncedFilterTerm("")
      setCurrentPage(1)
      handleSearch(searchTerm, searchLogic)
      setTimeout(() => setIsSearching(false), 1000)
    }
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

  const filteredResults = useMemo(() => {
    const lowerCaseFilter = debouncedFilterTerm.toLowerCase().trim()
    return searchResults.filter((product) => {
      const source = product.source.toLowerCase()
      const brandMatch =
        (source.includes("sigma") && filters.brands.sigma) ||
        (source.includes("tci") && filters.brands.tci) ||
        (source.includes("orkim") && filters.brands.orkim) ||
        (source.includes("itk") && filters.brands.itk)

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

  const itemsPerPage = 10
  const paginatedResults = useMemo(() => {
    return filteredResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  }, [filteredResults, currentPage, itemsPerPage])
  const headerGridClasses = cn(
    "grid gap-x-4 font-semibold text-sm text-muted-foreground items-center",
    isProductNameVisible
      ? "grid-cols-[60px_150px_150px_150px_150px_120px_100px_1fr_auto]"
      : "grid-cols-[60px_150px_150px_150px_150px_120px_100px_auto]",
  )

  return (
    <div className="container mx-auto p-4 flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold mb-4">Ürün Arama ve Atama</h1>
        <div className="flex w-full items-center gap-2 mb-4">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Ürün adı, kodu veya CAS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoading && !isSearching && onSearchOrCancelClick()}
              disabled={isLoading || isSearching}
              className="pl-8 w-full"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                <span>{searchLogic === 'similar' ? 'Benzer Arama' : 'İsabetli Arama'}</span>
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Arama Tipi</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={searchLogic === 'similar'}
                onCheckedChange={() => setSearchLogic('similar')}
              >
                Benzer Arama
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={searchLogic === 'exact'}
                onCheckedChange={() => setSearchLogic('exact')}
              >
                İsabetli Arama
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip content="Orijinal Fiyatları Göster/Gizle">
            <Button variant="outline" size="icon" onClick={() => setShowOriginalPrices(!showOriginalPrices)}>
              <span className="sr-only">Orijinal Fiyatları Gizle/Göster</span>
              {showOriginalPrices ? <Euro className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
            </Button>
          </Tooltip>

          <div className="relative w-full max-w-xs">
            <Input
              placeholder="Sonuçlar içinde ara..."
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              className="pl-8"
            />
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-shrink-0 bg-transparent">
                <ListFilter className="mr-2 h-4 w-4" /> Marka Filtrele
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Marka</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filters.brands.sigma}
                onCheckedChange={(checked) => handleFilterChange("brands", "sigma", checked)}
              >
                Sigma
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.brands.tci}
                onCheckedChange={(checked) => handleFilterChange("brands", "tci", checked)}
              >
                TCI
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.brands.orkim}
                onCheckedChange={(checked) => handleFilterChange("brands", "orkim", checked)}
              >
                Orkim
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filters.brands.itk}
                onCheckedChange={(checked) => handleFilterChange("brands", "itk", checked)}
              >
                ITK
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={onSearchOrCancelClick}
            disabled={isSearching && !isLoading}
            onMouseEnter={() => {
              if (isLoading) setIsHovering(true)
            }}
            onMouseLeave={() => {
              if (isLoading) setIsHovering(false)
            }}
            className={cn("relative w-48 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out")}
            variant={isLoading && isHovering ? "destructive" : "default"}
          >
            <div className="relative z-10">
            <AnimatePresence mode="wait" initial={false}>
              {isLoading ? (
                isHovering ? (
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
                ) : (
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
                )
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
        </div>
      </div>

      {searchResults.length > 0 && (
        <div className="flex-shrink-0 text-right pr-1 pb-2">
          <span className="text-sm font-normal text-muted-foreground">({filteredResults.length} adet sonuç bulundu)</span>
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Hata</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {searchResults.length > 0 && (
        <Card className="flex-grow flex flex-col overflow-hidden">
          <CardContent className="flex-grow flex flex-col overflow-hidden p-0">
            <div className="p-4 border-b bg-[#e2e8f0] dark:bg-[#383838] flex-shrink-0">
              <div className={headerGridClasses}>
                <div className="text-center">Seç</div>
                <div className="truncate">CAS</div>
                <div className="truncate">En Ucuz Kod</div>
                <div className="truncate">Marka</div>
                <div className="truncate">En Ucuz Fiyat (EUR)</div>
                <div className="truncate">Kaynak</div>
                <div className="truncate">Stok</div>
                {isProductNameVisible && <div className="truncate">Ürün Adı</div>}
                <div className="w-16 text-right">Detay</div>
              </div>
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar p-4">
              <div className="space-y-2">
                {paginatedResults.map((product, index) => (
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
            {filteredResults.length > itemsPerPage && (
              <div className="flex items-center justify-center gap-2 p-3 border-t flex-shrink-0 mt-auto">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Önceki
                </Button>
                <span className="text-xs text-muted-foreground">
                  Sayfa {currentPage} / {Math.ceil(filteredResults.length / itemsPerPage)}
                </span>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(filteredResults.length / itemsPerPage)))}
                  disabled={currentPage * itemsPerPage >= filteredResults.length}
                >
                  Sonraki <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && searchResults.length === 0 && (
        <div className="text-center py-10 flex-grow flex flex-col justify-center items-center">
          <Search className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Arama yapmak için yukarıdaki alanı kullanın.</p>
        </div>
      )}

      <AssignmentButton selectedForAssignment={selectedForAssignment} handleAssignConfirm={handleAssignConfirm} />
    </div>
  )
}
