"use client";

import * as React from "react";
import { Plus, Search, Building2, Filter } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { toast } from "sonner";
import { useAccounts, useArchiveAccount, type Account } from "@/features/accounts/api";
import { AccountTable } from "@/features/accounts/components/account-table";
import { AccountDialog } from "@/features/accounts/components/account-form";

export default function AccountsPage() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [accountType, setAccountType] = React.useState("all");
  const [status, setStatus] = React.useState("active");
  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedAccount, setSelectedAccount] = React.useState<Account | null>(null);

  const [archiveDialogOpen, setArchiveDialogOpen] = React.useState(false);
  const [accountToArchive, setAccountToArchive] = React.useState<Account | null>(null);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading } = useAccounts({
    search: debouncedSearch || undefined,
    account_type: accountType !== "all" ? accountType : undefined,
    status,
    page,
    page_size: pageSize,
  });

  const archiveMutation = useArchiveAccount(accountToArchive?.id || "");

  const handleEdit = (acc: Account) => {
    setSelectedAccount(acc);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedAccount(null);
    setDialogOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (!accountToArchive) return;
    try {
      await archiveMutation.mutateAsync(accountToArchive.version);
      toast.success(`Account "${accountToArchive.name}" archived`);
      setArchiveDialogOpen(false);
      setAccountToArchive(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive account");
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Accounts"
        description="Manage industrial B2B customer accounts, procurement leads, and relationships"
        breadcrumbs={[{ label: "Workspace", href: "/app/dashboard" }, { label: "Accounts" }]}
        actions={
          <Button onClick={handleCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span>New Account</span>
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, legal name, email, phone..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={accountType}
            aria-label="Filter by account type"
            onChange={(e) => {
              setAccountType(e.target.value);
              setPage(1);
            }}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="customer">Customer</option>
            <option value="prospect">Prospect</option>
            <option value="partner">Partner</option>
            <option value="supplier">Supplier</option>
          </select>

          <select
            value={status}
            aria-label="Filter by status"
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
          >
            <option value="active">Active Only</option>
            <option value="archived">Archived Only</option>
            <option value="">All Statuses</option>
          </select>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="mt-4">
        <AccountTable
          data={data?.items || []}
          total={data?.total || 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onEdit={handleEdit}
          onArchive={(acc) => {
            setAccountToArchive(acc);
            setArchiveDialogOpen(true);
          }}
          isLoading={isLoading}
        />
      </div>

      {/* Create / Edit Dialog */}
      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={selectedAccount}
      />

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title="Archive Account"
        description={`Are you sure you want to archive "${accountToArchive?.name}"? It will be hidden from default searches and workflows.`}
        confirmLabel="Archive Account"
        variant="destructive"
        onConfirm={handleArchiveConfirm}
      />
    </PageContainer>
  );
}
