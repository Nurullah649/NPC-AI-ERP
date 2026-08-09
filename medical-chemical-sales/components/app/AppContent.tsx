"use client"

import React, { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { useAppContext } from "../../context/AppContext"
import { ThemeProvider } from "../ModeToggle"
import CustomSplashScreen from "../SplashScreen"
import { SettingsPage } from "../views/SettingsPage"
import { MainApplication } from "./MainApplication"
import { ToastStack } from "./ToastStack"

export function AppContent() {
  const { appStatus, setAppStatus, toasts, setToasts, toast } = useAppContext()

  useEffect(() => {
    if (!window.electronAPI) return

    const cleanupReady = window.electronAPI.onPythonReady(() => {
      setAppStatus("ready")
    })
    const cleanupError = window.electronAPI.onPythonError((error: string) => {
      setAppStatus("error")
      toast("error", `Kritik Arka Plan Hatası: ${error || "Bilinmeyen bir hata oluştu."}`)
    })
    const cleanupAuthError = window.electronAPI.onAuthenticationError(() => {
      setAppStatus("auth_error")
      window.electronAPI.loadSettings()
    })
    const cleanupInitialSetup = window.electronAPI.onInitialSetupRequired(() => {
      setAppStatus("setup_required")
      window.electronAPI.loadSettings()
    })

    window.electronAPI.rendererReady()

    return () => {
      cleanupReady()
      cleanupError()
      cleanupAuthError()
      cleanupInitialSetup()
    }
  }, [setAppStatus, toast])

  const renderContent = () => {
    switch (appStatus) {
      case "initializing":
        return <CustomSplashScreen key="splash" hasError={false} updateState={{}} />
      case "setup_required":
        return <SettingsPage authError={false} />
      case "ready":
        return <MainApplication key="main_app" />
      case "auth_error":
        return <SettingsPage authError />
      case "error":
        return <CustomSplashScreen key="splash-error" hasError updateState={{}} />
      default:
        return <CustomSplashScreen key="splash-default" hasError={false} updateState={{}} />
    }
  }

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
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
      <ToastStack
        toasts={toasts}
        onDismiss={(id: number) => setToasts((prev: any[]) => prev.filter((t: any) => t.id !== id))}
      />
    </ThemeProvider>
  )
}
