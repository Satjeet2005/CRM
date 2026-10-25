"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Users, Star, Mail, Phone, Edit, Archive } from "lucide-react";
import { DataTable } from "@/components/data-display/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/data-display/initials-avatar";
import type { Contact } from "../api";

interface ContactTableProps {
  data: Contact[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (contact: Contact) => void;
  onArchive: (contact: Contact) => void;
  isLoading?: boolean;
}

export function ContactTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onEdit,
  onArchive,
  isLoading,
}: ContactTableProps) {
  const columns: ColumnDef<Contact>[] = [
    {
      accessorKey: "first_name",
      header: "Contact Name",
      cell: ({ row }) => {
        const c = row.original;
        const fullName = `${c.first_name} ${c.last_name}`;
        return (
          <div className="flex items-center gap-2.5">
            <InitialsAvatar name={fullName} size="sm" />
            <div className="flex flex-col">
              <span className="font-medium text-[var(--foreground)] flex items-center gap-1.5">
                {fullName}
                {c.is_primary && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-[var(--primary-soft)] px-1 py-0.2 text-[9px] font-semibold text-[var(--primary)]">
                    <Star className="h-2.5 w-2.5 fill-current" /> Primary
                  </span>
                )}
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">{c.job_title || "Team Member"}</span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "account_name",
      header: "Account",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <Link
            href={`/app/accounts/${c.account_id}`}
            className="text-xs font-medium text-[var(--primary)] hover:underline"
          >
            {c.account_name || "View Account"}
          </Link>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => {
        const email = row.original.email;
        if (!email) return <span className="text-xs text-[var(--muted-foreground)]">—</span>;
        return (
          <a
            href={`mailto:${email}`}
            className="text-xs text-[var(--foreground)] hover:text-[var(--primary)] flex items-center gap-1"
          >
            <Mail className="h-3 w-3 text-[var(--muted-foreground)]" />
            <span>{email}</span>
          </a>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => {
        const phone = row.original.phone;
        if (!phone) return <span className="text-xs text-[var(--muted-foreground)]">—</span>;
        return (
          <span className="text-xs text-[var(--foreground)] flex items-center gap-1">
            <Phone className="h-3 w-3 text-[var(--muted-foreground)]" />
            <span>{phone}</span>
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.status}
          variant={row.original.status === "active" ? "success" : "neutral"}
        />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEdit(c)} title="Edit contact">
              <Edit className="h-3.5 w-3.5" />
            </Button>
            {c.status === "active" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onArchive(c)}
                title="Archive contact"
                className="text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      emptyTitle="No contacts found."
    />
  );
}
