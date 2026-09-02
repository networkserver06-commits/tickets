import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import EventStorefront from "./pages/EventStorefront";
import TicketPage from "./pages/TicketPage";
import VerifyPage from "./pages/VerifyPage";
import GateCheckin from "./pages/GateCheckin";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={EventStorefront} />
      <Route path={"/event/:id"} component={EventStorefront} />
      <Route path={"/admin"} component={Home} />
      <Route path={"/admin/orders"} component={Home} />
      <Route path={"/admin/tickets"} component={Home} />
      <Route path={"/admin/transactions"} component={Home} />
      <Route path={"/admin/settings"} component={Home} />
      <Route path={"/ticket/:id"} component={TicketPage} />
      <Route path={"/verify/:id"} component={VerifyPage} />
      <Route path={"/gate-checkin-x9k2"} component={GateCheckin} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
