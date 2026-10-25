"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Input, Select } from "@/components/sakani";
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
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by first/last name, job title, email, phone..."
            leadingIcon={<Search className="h-4 w-4 text-[var(--color-fg-muted)]" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-36">
            <Select
              value={isPrimary}
              aria-label="Filter by primary contact status"
              onChange={(val) => {
                setIsPrimary(val);
                setPage(1);
              }}
              size="sm"
              options={[
                { label: "All Contacts", value: "all" },
                { label: "Primary Only", value: "true" },
                { label: "Non-Primary Only", value: "false" },
              ]}
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
              size="sm"
              options={[
                { label: "Active Only", value: "active" },
                { label: "Archived Only", value: "archived" },
                { label: "All Statuses", value: "" },
              ]}
            />
          </div>
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
