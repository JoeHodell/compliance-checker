import { prisma } from "@/lib/prisma";
import { NewCheckForm } from "@/components/NewCheckForm";

export default async function NewCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Check a document</h1>
      <p className="mb-6 text-sm text-slate-500">
        Runs every active rule for the selected client, plus a universal grammar/mechanical pass.
      </p>
      {clients.length === 0 ? (
        <p className="text-sm text-slate-500">No clients yet.</p>
      ) : (
        <NewCheckForm clients={clients} defaultClientId={clientId} />
      )}
    </div>
  );
}
