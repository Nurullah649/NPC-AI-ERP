"use client"

import { AppProvider } from "../context/AppContext"
import { AppContent } from "../components/app/AppContent"

export default function App() {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
}
