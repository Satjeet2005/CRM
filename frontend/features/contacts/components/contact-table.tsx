"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Star, Mail, Phone, Edit, Archive } from "lucide-react";
import { DataTable } from "@/components/data-display/data-table";
import { Badge, Button, Avatar } from "@/components/sakani";
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
  total: _total,
  page: _page,
  pageSize: _pageSize,
  onPageChange: _onPageChange,
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
            <Avatar
              size="sm"
              initials={`${c.first_name[0] ?? ""}${c.last_name ? c.last_name[0] : ""}`}
            />
            <div className="flex flex-col">
              <span className="font-medium text-[var(--color-fg-default)] flex items-center gap-1.5">
                {fullName}
                {c.is_primary && (
                  <Badge variant="accent" emphasis="subtle" leftIcon={<Star className="h-2.5 w-2.5 fill-current" />}>
                    Primary
                  </Badge>
                )}
              </span>
              <span className="text-xs text-[var(--color-fg-muted)]">{c.job_title || "Team Member"}</span>
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
            className="text-xs font-semibold text-[var(--color-primary-600)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
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
        if (!email) return <span className="text-xs text-[var(--color-fg-muted)]">—</span>;
        return (
          <a
            href={`mailto:${email}`}
            className="text-xs text-[var(--color-fg-default)] hover:text-[var(--color-primary-600)] hover:underline flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)]"
          >
            <Mail className="h-3 w-3 text-[var(--color-fg-muted)]" />
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
        if (!phone) return <span className="text-xs text-[var(--color-fg-muted)]">—</span>;
        return (
          <span className="text-xs text-[var(--color-fg-default)] flex items-center gap-1.5">
            <Phone className="h-3 w-3 text-[var(--color-fg-muted)]" />
            <span>{phone}</span>
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge
            variant={status === "active" ? "success" : "neutral"}
            emphasis="subtle"
          >
            {status}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(c)}
              title="Edit contact"
              aria-label={`Edit ${c.first_name} ${c.last_name}`}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            {c.status === "active" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onArchive(c)}
                title="Archive contact"
                aria-label={`Archive ${c.first_name} ${c.last_name}`}
                className="text-[var(--color-danger-600)] hover:bg-[var(--color-danger-50)]"
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
      emptyDescription="No procurement agents or contacts match the search criteria."
    />
  );
}
