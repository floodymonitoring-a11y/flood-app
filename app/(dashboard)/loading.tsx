import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main className="py-6">
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    </main>
  );
}
