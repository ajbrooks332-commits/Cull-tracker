import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-6">
      <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-10 h-10 text-destructive" />
      </div>
      <h1 className="text-3xl font-display font-bold text-foreground mb-2">404 Not Found</h1>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link href="/" className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
        Return Home
      </Link>
    </div>
  );
}
