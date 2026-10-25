"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Input, Select } from "@/components/sakani";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { toast } from "sonner";
import { useAccounts, useArchiveAccount, type Account } from "@/features/accounts/api";
import { AccountTable } from "@/features/accounts/components/account-table";
import { AccountDialog } from "@/features/accounts/components/account-form";

const ACCOUNT_TYPE_OPTIONS = [
  { label: "All Types", value: "all" },
  { label: "Customer", value: "customer" },
  { label: "Prospect", value: "prospect" },
  { label: "Partner", value: "partner" },
  { label: "Supplier", value: "supplier" },
];

const STATUS_OPTIONS = [
  { label: "Active Only", value: "active" },
  { label: "Archived Only", value: "archived" },
  { label: "All Statuses", value: "" },
];

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
    status: status || undefined,
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
          <Button onClick={handleCreate} variant="primary" className="gap-1.5 font-medium">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>New Account</span>
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-fg-muted)]" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, legal name, email, phone..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-36">
            <Select
              value={accountType}
              aria-label="Filter by account type"
              onChange={(val) => {
                setAccountType(val);
                setPage(1);
              }}
              options={ACCOUNT_TYPE_OPTIONS}
              size="sm"
            />
          </div>

          <div className="w-36">
            <Select
              value={status}
              aria-label="Filter by status"
              onChange={(val) => {
                setStatus(val);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
              size="sm"
            />
          </div>
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
