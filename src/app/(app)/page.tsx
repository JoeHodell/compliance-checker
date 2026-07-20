import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button, Card } from "@/components/ui";

export default async function HomePage() {
  const clientRows = await prisma.client.findMany({ orderBy: { name: "asc" } });
  const clients = await Promise.all(
    clientRows.map(async (client) => ({
      ...client,
      activeRuleCount: await prisma.rule.count({
        where: { clientId: client.id, status: "ACTIVE" },
      }),
    }))
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Clients</h1>
        <Link href="/clients/new">
          <Button>Add client</Button>
        </Link>
      </div>

      {clients.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          No clients yet. Click &ldquo;Add client&rdquo; to onboard one.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card className="p-5 transition-shadow hover:shadow-md">
                <h2 className="font-medium text-slate-900">{client.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {client.activeRuleCount} active rule{client.activeRuleCount === 1 ? "" : "s"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
