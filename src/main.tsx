import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import "./index.css"
import App from "./App"
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ConfirmDialogHost />
        <Toaster
          theme="dark"
          richColors
          position="bottom-right"
          toastOptions={{ className: "rounded-xl" }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
