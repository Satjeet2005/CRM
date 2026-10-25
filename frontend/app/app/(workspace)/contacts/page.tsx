"use client";

import * as React from "react";
import { Plus, Search, Users } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { toast } from "sonner";
import { useContacts, useArchiveContact, type Contact } from "@/features/contacts/api";
import { ContactTable } from "@/features/contacts/components/contact-table";
import { ContactDialog } from "@/features/contacts/components/contact-form";

export default function ContactsPage() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [isPrimary, setIsPrimary] = React.useState<string>("all");
  const [status, setStatus] = React.useState("active");
  const [page, setPage] = React.useState(1);
  const pageSize = 15;

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedContact, setSelectedContact] = React.useState<Contact | null>(null);

  const [archiveDialogOpen, setArchiveDialogOpen] = React.useState(false);
  const [contactToArchive, setContactToArchive] = React.useState<Contact | null>(null);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading } = useContacts({
    search: debouncedSearch || undefined,
    is_primary: isPrimary === "true" ? true : isPrimary === "false" ? false : undefined,
    status,
    page,
    page_size: pageSize,
  });

  const archiveMutation = useArchiveContact(contactToArchive?.id || "");

  const handleEdit = (contact: Contact) => {
    setSelectedContact(contact);
    setDialogOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (!contactToArchive) return;
    try {
      await archiveMutation.mutateAsync(contactToArchive.version);
      toast.success(`Contact "${contactToArchive.first_name} ${contactToArchive.last_name}" archived`);
      setArchiveDialogOpen(false);
      setContactToArchive(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive contact");
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Contacts"
        description="Directory of customer procurement agents, engineers, and executive contacts"
        breadcrumbs={[{ label: "Workspace", href: "/app/dashboard" }, { label: "Contacts" }]}
      />

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by first/last name, job title, email, phone..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={isPrimary}
            aria-label="Filter by primary contact status"
            onChange={(e) => {
              setIsPrimary(e.target.value);
              setPage(1);
            }}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
          >
            <option value="all">All Contacts</option>
            <option value="true">Primary Only</option>
            <option value="false">Non-Primary Only</option>
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

      {/* Contacts Table */}
      <div className="mt-4">
        <ContactTable
          data={data?.items || []}
          total={data?.total || 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onEdit={handleEdit}
          onArchive={(c) => {
            setContactToArchive(c);
            setArchiveDialogOpen(true);
          }}
          isLoading={isLoading}
        />
      </div>

      {/* Edit Contact Dialog */}
      {selectedContact && (
        <ContactDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          accountId={selectedContact.account_id}
          contact={selectedContact}
        />
      )}

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title="Archive Contact"
        description={`Are you sure you want to archive "${contactToArchive?.first_name} ${contactToArchive?.last_name}"?`}
        confirmLabel="Archive Contact"
        variant="destructive"
        onConfirm={handleArchiveConfirm}
      />
    </PageContainer>
  );
}
