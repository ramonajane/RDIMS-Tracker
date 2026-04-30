import { Package, User, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth"; // Added to handle logout logic

export const Header = () => {
  const { signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between px-4">
        
        {/* Logo Section - Uses text-slate-900 (Dark Gray) */}
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Package className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">
            RDIMS <span className="text-blue-600">Tracker</span>
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
            <User className="h-4 w-4 text-slate-600" />
            <span className="text-xs font-semibold text-slate-700 uppercase">Admin Portal</span>
          </div>

          <Button variant="ghost" size="icon" className="text-slate-600 hover:text-blue-600">
            <Settings className="h-5 w-5" />
          </Button>

          <Button 
            variant="outline" 
            onClick={() => signOut()}
            className="border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};