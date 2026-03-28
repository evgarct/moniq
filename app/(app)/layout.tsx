import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <AppSidebar />
        <div className="min-w-0">
          <AppHeader />
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
