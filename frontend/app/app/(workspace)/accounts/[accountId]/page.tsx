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
  Archive,
  Edit,
  Star,
} from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button, Badge, Card, Avatar, Tabs } from "@/components/sakani";
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
  type Contact,
} from "@/features/accounts/api";
import { AccountDialog } from "@/features/accounts/components/account-form";
import { ContactDialog } from "@/features/contacts/components/contact-form";
import { useOpportunities } from "@/features/opportunities/api";

export default function AccountDetailPage({ params }: { params: Promise<{ accountId: string }> }) {
  const resolvedParams = React.use(params);
  const accountId = resolvedParams.accountId;

  const { data: account, isLoading: accountLoading } = useAccount(accountId);
  const { data: contactsData } = useAccountContacts(accountId);
  const { data: timelineData } = useAccountTimeline(accountId);
  const { data: oppsData } = useOpportunities({ account_id: accountId });

  const [activeTab, setActiveTab] = React.useState<string>("contacts");
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

  const tabItems = [
    {
      value: "contacts",
      label: "Contacts",
      icon: <Users className="h-4 w-4" />,
      badge: (
        <Badge variant="neutral" emphasis="subtle">
          {contactsData?.total ?? 0}
        </Badge>
      ),
    },
    {
      value: "opportunities",
      label: "Opportunities",
      icon: <Briefcase className="h-4 w-4" />,
      badge: (
        <Badge variant="neutral" emphasis="subtle">
          {oppsData?.total ?? 0}
        </Badge>
      ),
    },
    {
      value: "timeline",
      label: "Audit Timeline",
      icon: <History className="h-4 w-4" />,
    },
  ];

  return (
    <PageContainer>
      <div className="mb-4">
        <Link
          href="/app/accounts"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
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
                className="gap-1.5 text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)] hover:border-[var(--color-danger-200)]"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>Archive</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Account Overview Summary Card */}
      <Card className="mt-6 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--color-border-subtle)] pb-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-50)] text-[var(--color-primary-600)] border border-[var(--color-primary-100)] font-semibold shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-[var(--color-fg-default)]">{account.name}</h2>
                <Badge
                  variant={account.status === "active" ? "success" : "neutral"}
                  emphasis="subtle"
                >
                  {account.status}
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                Type: <strong className="capitalize text-[var(--color-fg-default)] font-medium">{account.account_type}</strong> | Industry:{" "}
                <strong className="text-[var(--color-fg-default)] font-medium">{account.industry || "General Industrial"}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-fg-muted)]">
            {account.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-[var(--color-fg-default)]" />
                <span>{account.phone}</span>
              </div>
            )}
            {account.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-[var(--color-fg-default)]" />
                <a href={`mailto:${account.email}`} className="hover:text-[var(--color-primary-600)] hover:underline">
                  {account.email}
                </a>
              </div>
            )}
            {account.website && (
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-[var(--color-fg-default)]" />
                <a
                  href={account.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-primary-600)] hover:underline"
                >
                  {account.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
          </div>
        </div>

        {account.notes && (
          <div className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] p-3.5 text-xs text-[var(--color-fg-default)]">
            <span className="font-semibold text-[var(--color-fg-muted)]">Account Notes: </span>
            {account.notes}
          </div>
        )}
      </Card>

      {/* Tabs: Contacts / Deals / Timeline */}
      <div className="mt-6">
        <Tabs
          items={tabItems}
          value={activeTab}
          onChange={setActiveTab}
        />

        {/* Tab 1: Contacts */}
        {activeTab === "contacts" && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--color-fg-muted)]">
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
                  <Card
                    key={contact.id}
                    className="flex items-start justify-between p-4"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        size="md"
                        initials={`${contact.first_name[0] ?? ""}${contact.last_name ? contact.last_name[0] : ""}`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-[var(--color-fg-default)]">
                            {contact.first_name} {contact.last_name}
                          </h4>
                          {contact.is_primary && (
                            <Badge variant="accent" emphasis="subtle" leftIcon={<Star className="h-2.5 w-2.5 fill-current" />}>
                              Primary
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-fg-muted)]">{contact.job_title || "Team Member"}</p>
                        <div className="mt-2 space-y-1 text-xs text-[var(--color-fg-muted)]">
                          {contact.email && (
                            <p className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3 text-[var(--color-fg-muted)]" />
                              <a href={`mailto:${contact.email}`} className="hover:text-[var(--color-primary-600)] hover:underline">
                                {contact.email}
                              </a>
                            </p>
                          )}
                          {contact.phone && (
                            <p className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3 text-[var(--color-fg-muted)]" />
                              <span>{contact.phone}</span>
                            </p>
                          )}
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
                      title="Edit Contact"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </Card>
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
          <div className="mt-5 space-y-3">
            {oppsData?.items && oppsData.items.length > 0 ? (
              <div className="divide-y divide-[var(--color-border-subtle)] rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
                {oppsData.items.map((opp) => (
                  <div key={opp.id} className="flex items-center justify-between p-4 hover:bg-[var(--color-bg-subtle)] transition-colors">
                    <div>
                      <Link
                        href={`/app/opportunities/${opp.id}`}
                        className="font-medium text-sm text-[var(--color-primary-600)] hover:underline"
                      >
                        {opp.name}
                      </Link>
                      <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
                        Close target: {formatDate(opp.expected_close_date)} | Owner: {opp.owner_name || "Unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-sm text-[var(--color-fg-default)]">
                        {formatMoney(opp.estimated_value, opp.currency_code)}
                      </span>
                      <Badge
                        variant={
                          opp.stage === "won"
                            ? "success"
                            : opp.stage === "lost"
                            ? "danger"
                            : opp.stage === "proposal" || opp.stage === "negotiation"
                            ? "warning"
                            : "info"
                        }
                        emphasis="subtle"
                      >
                        {opp.stage}
                      </Badge>
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
          <div className="mt-5 space-y-3">
            {timelineData && timelineData.length > 0 ? (
              <div className="space-y-3">
                {timelineData.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3 text-xs"
                  >
                    <Avatar
                      size="sm"
                      initials={act.actor_name ? act.actor_name.slice(0, 2).toUpperCase() : "FF"}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--color-fg-default)]">{act.summary}</span>
                        <span className="text-[var(--color-fg-muted)]">{formatDateTime(act.occurred_at)}</span>
                      </div>
                      <span className="text-[10px] text-[var(--color-fg-muted)] mt-0.5 block">
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
