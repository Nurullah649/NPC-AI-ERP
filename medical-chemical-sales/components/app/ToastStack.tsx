"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Info } from "lucide-react"

import { cn } from "../ui"

type ToastItem = {
  id: number
  type: "success" | "error" | "warning" | "info"
  message: string
  action?: React.ReactNode
}

type ToastStackProps = {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map(({ id, type, message, action }) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className={cn(
              "flex items-center justify-between gap-4 rounded-lg p-4 text-white shadow-lg",
              {
                "bg-green-600": type === "success",
                "bg-red-600": type === "error",
                "bg-amber-600": type === "warning",
                "bg-blue-600": type === "info",
              },
            )}
          >
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5" />
              <span>{message}</span>
            </div>
            {action ? action : <button onClick={() => onDismiss(id)}>×</button>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
