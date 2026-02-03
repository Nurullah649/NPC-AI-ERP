"use client"

import React, { useState, useEffect } from "react"
import {
  LoaderCircle,
  AlertCircle,
  Save,
  KeyRound,
  DollarSign,
  Calculator,
} from "lucide-react"
import {
  cn,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Label,
  Alert,
  AlertTitle,
  AlertDescription,
} from "../ui"
import { AppSettings } from "../../types"

const SettingsForm = ({ initialSettings, onSave, isSaving, isInitialSetup = false, children, onManualUpdateCheck }: any) => {
  const [settings, setSettings] = useState(initialSettings)
  useEffect(() => {
    setSettings(initialSettings)
  }, [initialSettings])
  const handleChange = (key: any, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }))
  }
  const handleSubmit = (e: any) => {
    e.preventDefault()
    onSave(settings)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {children}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Netflex API
            </CardTitle>
            <CardDescription>Netflex sistemine giriş bilgileri.</CardDescription>
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
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Orkim Market
            </CardTitle>
            <CardDescription>Orkim Market sistemine giriş bilgileri.</CardDescription>
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
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> ITK Bayi
            </CardTitle>
            <CardDescription>ITK bayi sistemine giriş bilgileri.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="itk_username">Kullanıcı Adı</Label>
              <Input
                id="itk_username"
                value={settings.itk_username || ""}
                onChange={(e) => handleChange("itk_username", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="itk_password">Şifre</Label>
              <Input
                id="itk_password"
                type="password"
                value={settings.itk_password || ""}
                onChange={(e) => handleChange("itk_password", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" /> Sigma Fiyatlandırma
            </CardTitle>
            <CardDescription>Sigma-Aldrich ürünleri için ülkeye özel katsayılar.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sigma_coefficient_us">Amerika (US)</Label>
              <Input
                id="sigma_coefficient_us"
                type="number"
                step="0.1"
                value={settings.sigma_coefficient_us || 1.0}
                onChange={(e) => handleChange("sigma_coefficient_us", Number.parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sigma_coefficient_de">Almanya (DE)</Label>
              <Input
                id="sigma_coefficient_de"
                type="number"
                step="0.1"
                value={settings.sigma_coefficient_de || 1.0}
                onChange={(e) => handleChange("sigma_coefficient_de", Number.parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sigma_coefficient_gb">İngiltere (GB)</Label>
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
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" /> Diğer Katsayılar
            </CardTitle>
            <CardDescription>TCI ve ITK için fiyat katsayıları.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tci_coefficient">TCI Katsayısı</Label>
              <Input
                id="tci_coefficient"
                type="number"
                step="0.1"
                value={settings.tci_coefficient || 1.4}
                onChange={(e) => handleChange("tci_coefficient", Number.parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="itk_coefficient">ITK Katsayısı</Label>
              <Input
                id="itk_coefficient"
                type="number"
                step="0.1"
                value={settings.itk_coefficient || 1.0}
                onChange={(e) => handleChange("itk_coefficient", Number.parseFloat(e.target.value) || 0)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isInitialSetup ? "Ayarları Kaydet ve Başlat" : "Ayarları Kaydet"}
        </Button>
      </div>
    </form>
  )
}

export const SettingsPage = ({ authError, settings, onSaveSettings, toast, updateStatus, updateInfo, appVersion, onManualUpdateCheck }: any) => {
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

  const UpdateStatusComponent = () => {
    const handleRestart = () => {
      if (window.electronAPI) {
        window.electronAPI.restartAppAndUpdate()
      }
    }

    const handleCheckForUpdates = () => {
      if (window.electronAPI) {
        if (onManualUpdateCheck) onManualUpdateCheck()
      }
    }

    let statusText = "Güncellemeler kontrol ediliyor..."
    let statusColor = "text-muted-foreground"
    let actionButton = null

    switch (updateStatus) {
      case "up_to_date":
        statusText = `Uygulamanız güncel.`
        statusColor = "text-green-600"
        break
      case "available":
        statusText = `Yeni sürüm mevcut: v${updateInfo.version}. İndiriliyor...`
        statusColor = "text-blue-600"
        break
      case "downloading":
        statusText = `Güncelleme indiriliyor... (${updateInfo.percent.toFixed(0)}%)`
        statusColor = "text-blue-600"
        break
      case "ready_to_install":
        statusText = `Yeni sürüm (v${updateInfo.version}) kuruluma hazır.`
        statusColor = "text-orange-600"
        actionButton = (
          <Button size="sm" onClick={handleRestart}>
            Yeniden Başlat ve Yükle
          </Button>
        )
        break
      case "error":
        statusText = `Güncelleme hatası: ${updateInfo.error?.message || "Bilinmeyen bir hata oluştu."}`
        statusColor = "text-destructive"
    }

    return (
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border rounded-lg bg-muted/50 mb-6">
        <div className="flex flex-col">
          <p className={cn("text-sm font-medium", statusColor)}>{statusText}</p>
          <p className="text-xs text-muted-foreground">Mevcut Sürüm: v{appVersion}</p>
        </div>
        <div className="flex items-center gap-2">
          {actionButton}
          <Button size="sm" variant="outline" onClick={handleCheckForUpdates} disabled={updateStatus === "downloading"}>
            Güncellemeleri Kontrol Et
          </Button>
        </div>
      </div>
    )
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
        <SettingsForm initialSettings={settings} onSave={handleSave} isSaving={isSaving} onManualUpdateCheck={onManualUpdateCheck}>
          {!isSaving && <UpdateStatusComponent />}
        </SettingsForm>
      ) : (
        <div className="flex justify-center items-center h-64">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  )
}
