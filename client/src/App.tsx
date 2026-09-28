import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import LiveApp from "./live/LiveApp";
import Home from "./pages/Home";

/** `?demo` shows the hardcoded design prototype; otherwise the real app. */
const isDemo = new URLSearchParams(window.location.search).has("demo");

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          {isDemo ? <Home /> : <LiveApp />}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
