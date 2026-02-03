"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Upload,
  ArrowLeft,
  SkipForward,
  XCircle,
  FileSearch,
  Filter,
  Eye,
  EyeOff,
  DollarSign,
  Euro,
  UserPlus,
} from "lucide-react"
import {
  cn,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Input,
  Progress,
  Tooltip,
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

export const BatchSearchPage = ({ onAssignProducts, settings, batchState, setBatchState, toast }: any) => {
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

  const updateState = (newState: any) => {
    setBatchState((prev: any) => ({ ...prev, ...newState }))
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
        setBatchState((prev: any) => {
          const newResults = new Map(prev.batchResults)
          const term = context.batch_search_term
          const existing = newResults.get(term) || []
          const isProductAlreadyInList = existing.some((p: any) => p.product_number === product.product_number)
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
        setBatchState((prev: any) => {
          const isFirstUpdate = progress.current === 1 && !prev.selectedTerm
          return {
            ...prev,
            searchProgress: { ...progress, running: true },
            selectedTerm: isFirstUpdate ? progress.term : prev.selectedTerm,
          }
        })
      }),
      window.electronAPI.onBatchSearchComplete((summary) => {
        setBatchState((prev: any) => ({ ...prev, searchProgress: { ...prev.searchProgress, running: false } }))
        if (summary.status === "cancelled") {
          toast("warning", "Toplu arama iptal edildi.")
        } else if (summary.status === "complete") {
          toast("success", "Toplu arama tamamlandı!")
        }
      }),
    ]
    return () => cleanups.forEach((c) => c())
  }, [setBatchState, toast])

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
    setBatchState((prev: any) => ({
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
    setBatchState((prev: any) => {
      const isSelected = prev.selectedForAssignment.some(
        (p: any) => p.product_code === item.product_code && p.source === item.source,
      )
      const newSelection = isSelected
        ? prev.selectedForAssignment.filter((p: any) => !(p.product_code === item.product_code && p.source === item.source))
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
    setBatchState((prev: any) => {
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
    return results.filter((product: any) => {
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
                      <Tooltip content="Orijinal Fiyatları Göster/Gizle" side="bottom">
                        <Button variant="ghost" size="icon" onClick={() => setShowOriginalPrices(!showOriginalPrices)}>
                          <span className="sr-only">Orijinal Fiyatları Gizle/Göster</span>
                          {showOriginalPrices ? <Euro className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
                        </Button>
                      </Tooltip>
                      <Tooltip content="Ürün Adı Sütununu Göster/Gizle" side="bottom">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsProductNameVisible(!isProductNameVisible)}
                        >
                          <span className="sr-only">Ürün Adını Gizle/Göster</span>
                          {isProductNameVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow overflow-y-auto custom-scrollbar p-4">
                    {currentResultsForSelectedTerm.length > 0 ? (
                      <div className="space-y-2">
                        {currentResultsForSelectedTerm.map((product: any, index: any) => (
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
      <AssignmentButton selectedForAssignment={selectedForAssignment} handleAssignConfirm={handleAssignConfirm} />
    </div>
  )
}
