"use client"

import React, { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Activity,
  Building,
} from "lucide-react"
import {
  cn,
  Button,
  Checkbox,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Label,
} from "./ui"
import {
  ProductResult,
  AssignmentItem,
  SigmaVariation,
  TciVariation,
  AppSettings,
} from "../types"

// Helper functions that were in page.tsx
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

const ProductResultItem = ({
  product,
  settings,
  expandedProducts,
  toggleProductExpansion,
  selectedForAssignment,
  onSelectionChange,
  isProductNameVisible,
  showOriginalPrices,
}: {
  product: ProductResult
  settings: AppSettings | null
  expandedProducts: Set<string>
  toggleProductExpansion: (productNumber: string) => void
  selectedForAssignment: AssignmentItem[]
  onSelectionChange: (item: AssignmentItem) => void
  isProductNameVisible: boolean
  showOriginalPrices: boolean
}) => {
  const countryHeaders = { us: "Amerika (US)", de: "Almanya (DE)", gb: "İngiltere (GB)" }

  const hasActualSigmaVariations = useMemo(() => {
    if (product.source !== "Sigma" || !product.sigma_variations) return false
    return Object.values(product.sigma_variations).some((vars) => vars && vars.length > 0)
  }, [product])

  const hasVariations =
    (product.source === "Sigma" && hasActualSigmaVariations) ||
    (product.source === "TCI" && product.tci_variations && product.tci_variations.length > 0)

  const gridClasses = cn(
    "grid gap-x-4 items-center p-4",
    isProductNameVisible
      ? "grid-cols-[60px_150px_150px_150px_150px_120px_100px_1fr_auto]"
      : "grid-cols-[60px_150px_150px_150px_150px_120px_100px_auto]",
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

  const [orkimStock, setOrkimStock] = useState<number | string | null>(null)
  const [isCheckingStock, setIsCheckingStock] = useState(false)

  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.onOrkimStockResult) return

    const cleanup = window.electronAPI.onOrkimStockResult((result) => {
      if (result.url === product.product_url) {
        setOrkimStock(result.stock)
        setIsCheckingStock(false)
      }
    })
    return () => cleanup()
  }, [product.product_url])

  const handleCheckOrkimStock = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!product.product_url) {
      console.error("Bu ürün için URL bulunamadı, stok sorgulanamıyor.")
      return
    }
    setIsCheckingStock(true)
    setOrkimStock(null)
    if (window.electronAPI && window.electronAPI.getOrkimStock) {
      window.electronAPI.getOrkimStock(product.product_url)
    }
  }

  const handleSelectSigma = (product: ProductResult, item: any, countryCode: string, priceData: SigmaVariation) => {
    const assignmentItem: AssignmentItem = {
      product_name: product.product_name,
      product_code: item.material_number,
      cas_number: product.cas_number,
      price_numeric: priceData.price_eur || null,
      price_str: priceData.price_eur_str || "N/A",
      source: `Sigma (${countryCode.toUpperCase()})`,
      cheapest_netflex_stock: product.cheapest_netflex_stock ?? "N/A",
      brand: `Sigma (${product.brand})`,
      unit: priceData.package_size || "Adet",
    }
    onSelectionChange(assignmentItem)
  }

  const handleSelectNetflex = (product: ProductResult, item: any) => {
    const assignmentItem: AssignmentItem = {
      product_name: item.netflex.product_name,
      product_code: item.material_number,
      cas_number: product.cas_number,
      price_numeric: item.netflex.price_numeric,
      price_str: item.netflex.price_str,
      source: "Netflex",
      cheapest_netflex_stock: item.netflex.stock,
      brand: item.netflex.brand || "Netflex",
      unit: "Adet",
    }
    onSelectionChange(assignmentItem)
  }

  const handleSelectTCI = (product: ProductResult, variation: TciVariation) => {
    const assignmentItem: AssignmentItem = {
      product_name: product.product_name,
      product_code: `${product.product_number}-${variation.unit}`,
      cas_number: product.cas_number,
      price_numeric: variation.calculated_price_eur || null,
      price_str: variation.calculated_price_eur_str || "N/A",
      source: "TCI",
      cheapest_netflex_stock: variation.stock_info?.map((s) => `${s.country}: ${s.stock}`).join(", ") || "N/A",
      brand: "TCI",
      unit: variation.unit,
    }
    onSelectionChange(assignmentItem)
  }

  const handleSelectMainProduct = (p: ProductResult) => {
    const priceNumeric =
      p.itk_variations?.[0]?.price ||
      p.netflex_matches?.find((m) => m.price_str === p.cheapest_eur_price_str)?.price_numeric ||
      p.tci_variations?.find((v) => v.calculated_price_eur_str === p.cheapest_eur_price_str)?.calculated_price_eur ||
      null

    let unit = "Adet"
    if (p.sigma_variations) {
      const firstCountry = Object.keys(p.sigma_variations)[0]
      if (firstCountry && p.sigma_variations[firstCountry as keyof typeof p.sigma_variations]?.length > 0) {
        unit = p.sigma_variations[firstCountry as keyof typeof p.sigma_variations]?.[0].package_size || "Adet"
      }
    } else if (p.tci_variations && p.tci_variations.length > 0) {
      unit = p.tci_variations[0].unit || "Adet"
    } else if (p.itk_variations && p.itk_variations.length > 0) {
      unit = p.itk_variations[0].unit || "Adet"
    }

    const assignmentItem: AssignmentItem = {
      product_name: p.product_name,
      product_code: p.cheapest_material_number || p.product_number,
      cas_number: p.cas_number || "N/A",
      price_numeric: priceNumeric,
      price_str: p.cheapest_eur_price_str || "N/A",
      source: p.cheapest_source_country || p.source,
      cheapest_netflex_stock: p.cheapest_netflex_stock || "N/A",
      brand: p.brand,
      unit: unit,
    }
    onSelectionChange(assignmentItem)
  }

  return (
    <div className="border rounded-lg bg-card hover:bg-muted/50">
      <div className={gridClasses}>
        <div className="flex items-center justify-center">
          <Checkbox
            checked={selectedForAssignment.some(
              (p) =>
                p.product_code === (product.cheapest_material_number || product.product_number) &&
                p.source === (product.cheapest_source_country || product.source),
            )}
            onChange={() => handleSelectMainProduct(product)}
            className="h-5 w-5"
          />
        </div>

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
        <div className="flex items-center">
          {isCheckingStock ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : orkimStock !== null ? (
            <span className="font-semibold">{orkimStock === 0 ? "Stokta Yok" : `${orkimStock} adet`}</span>
          ) : product.cheapest_netflex_stock === 0 ? (
            <span className="text-destructive">Stokta Yok</span>
          ) : product.cheapest_netflex_stock === "Var" &&
            (product.source === "Orkim" || product.cheapest_source_country === "Orkim") ? (
            <Button
              size="xs"
              variant="outline"
              className="text-xs h-7"
              onClick={handleCheckOrkimStock}
              title="Orkim stoğunu detaylı sorgula"
            >
              <Activity className="h-3 w-3 mr-1" />
              Sorgula
            </Button>
          ) : (
            <span>{product.cheapest_netflex_stock ?? "N/A"}</span>
          )}
        </div>
        {isProductNameVisible && (
          <div
            className="min-w-0 font-medium truncate"
            title={stripHtml(product.product_name)}
            dangerouslySetInnerHTML={{ __html: cleanAndDecodeHtml(product.product_name) }}
          />
        )}
        <div className="justify-self-end">
          {hasVariations && (
            <Button variant="outline" size="sm" onClick={() => toggleProductExpansion(product.product_number)}>
              {expandedProducts.has(product.product_number) ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {hasVariations && expandedProducts.has(product.product_number) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t bg-muted/20 p-4 overflow-hidden dark:border-[#393937]"
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
                        item.netflex.price_numeric != null &&
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
                                  className="h-5 w-5"
                                />
                                <Label
                                  htmlFor={`cb-netflex-${item.material_number}`}
                                  className="flex-grow cursor-pointer"
                                >
                                  <div className="flex flex-col">
                                    <div
                                      className={cn(
                                        "flex items-baseline gap-2 font-semibold",
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
                              item.sigma[code]?.price_eur != null &&
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
                                      className="h-5 w-5 mt-1"
                                    />
                                    <Label
                                      htmlFor={`cb-${code}-${item.material_number}`}
                                      className={cn(
                                        "flex flex-col cursor-pointer font-semibold",
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
            ) : product.source === "TCI" && settings ? (
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
                  {product.tci_variations?.map((variation, vIndex) => {
                      const isCheapestTCI =
                        variation.calculated_price_eur !== null &&
                        product.cheapest_eur_price_str === variation.calculated_price_eur_str
                      return (
                        <TableRow key={vIndex}>
                          <TableCell>
                            <Checkbox
                              id={`cb-tci-${product.product_number}-${vIndex}`}
                              onChange={() => handleSelectTCI(product, variation)}
                              checked={selectedForAssignment.some(
                                (p) =>
                                  p.product_code === `${product.product_number}-${variation.unit}` && p.source === "TCI",
                              )}
                              className="h-5 w-5"
                            />
                          </TableCell>
                          <TableCell>{variation.unit}</TableCell>
                          <TableCell>{variation.original_price}</TableCell>
                          <TableCell className={cn("font-semibold", isCheapestTCI && "text-red-600 font-bold")}>
                            {variation.calculated_price_eur_str || "N/A"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {variation.stock_info && variation.stock_info.length > 0
                              ? variation.stock_info.map((s) => `${s.country}: ${s.stock}`).join(", ")
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      )
                  })}
                </TableBody>
              </Table>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
export const MemoizedProductResultItem = React.memo(ProductResultItem)
