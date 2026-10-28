import Sidebar from "@/components/Sidebar";
import LogoutButton from "@/app/(dashboard)/dashboard/logout-button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar logoutButton={<LogoutButton />} />
      <div className="w-full">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
