"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Phone,
  Mail,
  Globe,
  Plus,
  Users,
  Briefcase,
  History,
  ArrowLeft,
  CheckCircle,
  Archive,
  Edit,
  Star,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { InitialsAvatar } from "@/components/data-display/initials-avatar";
import { LoadingSkeleton } from "@/components/data-display/loading-skeleton";
import { EmptyState } from "@/components/data-display/empty-state";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { toast } from "sonner";
import { formatDate, formatDateTime, formatMoney } from "@/lib/formatters/formatters";
import {
  useAccount,
  useAccountContacts,
  useAccountTimeline,
  useArchiveAccount,
  type Account,
  type Contact,
} from "@/features/accounts/api";
import { AccountDialog } from "@/features/accounts/components/account-form";
import { ContactDialog } from "@/features/contacts/components/contact-form";
import { useOpportunities } from "@/features/opportunities/api";

export default function AccountDetailPage({ params }: { params: Promise<{ accountId: string }> }) {
  const resolvedParams = React.use(params);
  const accountId = resolvedParams.accountId;

  const { data: account, isLoading: accountLoading } = useAccount(accountId);
  const { data: contactsData, isLoading: contactsLoading } = useAccountContacts(accountId);
  const { data: timelineData, isLoading: timelineLoading } = useAccountTimeline(accountId);
  const { data: oppsData, isLoading: oppsLoading } = useOpportunities({ account_id: accountId });

  const [activeTab, setActiveTab] = React.useState<"contacts" | "opportunities" | "timeline">("contacts");
  const [accountDialogOpen, setAccountDialogOpen] = React.useState(false);
  const [contactDialogOpen, setContactDialogOpen] = React.useState(false);
  const [selectedContact, setSelectedContact] = React.useState<Contact | null>(null);

  const [archiveDialogOpen, setArchiveDialogOpen] = React.useState(false);
  const archiveMutation = useArchiveAccount(accountId);

  if (accountLoading) {
    return (
      <PageContainer>
        <div className="py-8 space-y-4">
          <LoadingSkeleton rows={5} />
        </div>
      </PageContainer>
    );
  }

  if (!account) {
    return (
      <PageContainer>
        <EmptyState
          title="Account Not Found"
          description="The requested account does not exist or has been removed."
          action={
            <Link href="/app/accounts">
              <Button variant="outline">Back to Accounts</Button>
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const handleArchive = async () => {
    try {
      await archiveMutation.mutateAsync(account.version);
      toast.success(`Account "${account.name}" archived`);
      setArchiveDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive account");
    }
  };

  return (
    <PageContainer>
      <div className="mb-4">
        <Link
          href="/app/accounts"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Accounts</span>
        </Link>
      </div>

      <PageHeader
        title={account.name}
        description={account.legal_name && account.legal_name !== account.name ? account.legal_name : undefined}
        breadcrumbs={[
          { label: "Workspace", href: "/app/dashboard" },
          { label: "Accounts", href: "/app/accounts" },
          { label: account.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAccountDialogOpen(true)} className="gap-1.5">
              <Edit className="h-3.5 w-3.5" />
              <span>Edit Account</span>
            </Button>
            {account.status === "active" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setArchiveDialogOpen(true)}
                className="gap-1.5 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>Archive</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Account Overview Summary Card */}
      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary-soft)] text-[var(--primary)] font-semibold">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[var(--foreground)]">{account.name}</h2>
                <StatusBadge
                  label={account.status}
                  variant={account.status === "active" ? "success" : "neutral"}
                />
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Type: <strong className="capitalize text-[var(--foreground)]">{account.account_type}</strong> | Industry:{" "}
                <strong className="text-[var(--foreground)]">{account.industry || "General Industrial"}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--muted-foreground)]">
            {account.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-[var(--foreground)]" />
                <span>{account.phone}</span>
              </div>
            )}
            {account.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-[var(--foreground)]" />
                <span>{account.email}</span>
              </div>
            )}
            {account.website && (
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-[var(--foreground)]" />
                <a
                  href={account.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--primary)] hover:underline"
                >
                  {account.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
          </div>
        </div>

        {account.notes && (
          <div className="mt-4 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--foreground)]">
            <span className="font-semibold text-[var(--muted-foreground)]">Account Notes: </span>
            {account.notes}
          </div>
        )}
      </div>

      {/* Tabs: Contacts / Deals / Timeline */}
      <div className="mt-6">
        <div className="flex border-b border-[var(--border)] gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("contacts")}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "contacts"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Contacts ({contactsData?.total ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("opportunities")}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "opportunities"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>Opportunities ({oppsData?.total ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab("timeline")}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "timeline"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <History className="h-4 w-4" />
            <span>Audit Timeline</span>
          </button>
        </div>

        {/* Tab 1: Contacts */}
        {activeTab === "contacts" && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--muted-foreground)]">
                Contacts associated with {account.name}. Primary contact receives quotation documents.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedContact(null);
                  setContactDialogOpen(true);
                }}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Contact</span>
              </Button>
            </div>

            {contactsData?.items && contactsData.items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contactsData.items.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-start justify-between rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs"
                  >
                    <div className="flex items-start gap-3">
                      <InitialsAvatar name={`${contact.first_name} ${contact.last_name}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-[var(--foreground)]">
                            {contact.first_name} {contact.last_name}
                          </h4>
                          {contact.is_primary && (
                            <span className="inline-flex items-center gap-1 rounded bg-[var(--primary-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                              <Star className="h-3 w-3 fill-current" /> Primary
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)]">{contact.job_title || "Team Member"}</p>
                        <div className="mt-2 space-y-1 text-xs text-[var(--muted-foreground)]">
                          {contact.email && <p>Email: {contact.email}</p>}
                          {contact.phone && <p>Phone: {contact.phone}</p>}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedContact(contact);
                        setContactDialogOpen(true);
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No contacts yet"
                description="Add procurement leads and decision makers for this account."
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedContact(null);
                      setContactDialogOpen(true);
                    }}
                  >
                    Add First Contact
                  </Button>
                }
              />
            )}
          </div>
        )}

        {/* Tab 2: Opportunities */}
        {activeTab === "opportunities" && (
          <div className="mt-4 space-y-3">
            {oppsData?.items && oppsData.items.length > 0 ? (
              <div className="divide-y divide-[var(--border)] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
                {oppsData.items.map((opp) => (
                  <div key={opp.id} className="flex items-center justify-between p-4">
                    <div>
                      <Link
                        href={`/app/opportunities/${opp.id}`}
                        className="font-medium text-sm text-[var(--primary)] hover:underline"
                      >
                        {opp.name}
                      </Link>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Close target: {formatDate(opp.expected_close_date)} | Owner: {opp.owner_name || "Unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-sm text-[var(--foreground)]">
                        {formatMoney(opp.estimated_value, opp.currency_code)}
                      </span>
                      <StatusBadge label={opp.stage} variant="info" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No opportunities for this account"
                description="Create a deal or RFQ flow to track pipeline for this account."
              />
            )}
          </div>
        )}

        {/* Tab 3: Timeline */}
        {activeTab === "timeline" && (
          <div className="mt-4 space-y-3">
            {timelineData && timelineData.length > 0 ? (
              <div className="space-y-3">
                {timelineData.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 text-xs"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--foreground)] font-semibold text-[10px]">
                      {act.actor_name ? act.actor_name.slice(0, 2).toUpperCase() : "FF"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--foreground)]">{act.summary}</span>
                        <span className="text-[var(--muted-foreground)]">{formatDateTime(act.occurred_at)}</span>
                      </div>
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        Event: <span className="font-mono">{act.event_type}</span> by {act.actor_name || "System"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No activity history"
                description="Mutations and changes to this account will be recorded here."
              />
            )}
          </div>
        )}
      </div>

      {/* Edit Account Dialog */}
      <AccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        account={account}
      />

      {/* Add / Edit Contact Dialog */}
      <ContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        accountId={accountId}
        contact={selectedContact}
      />

      {/* Archive Account Dialog */}
      <ConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title="Archive Account"
        description={`Are you sure you want to archive "${account.name}"?`}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={handleArchive}
      />
    </PageContainer>
  );
}
