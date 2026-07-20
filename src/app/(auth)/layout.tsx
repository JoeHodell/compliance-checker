export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            Style Guide Compliance Checker
          </h1>
          <p className="mt-1 text-sm text-slate-500">The Harrington Agency — internal tool</p>
        </div>
        {children}
      </div>
    </div>
  );
}
