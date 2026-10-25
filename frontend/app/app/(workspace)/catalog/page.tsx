"use client";

import * as React from "react";
import { Plus, Search, Boxes, ShieldAlert } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useCatalogProducts, type CatalogProduct } from "@/features/catalog/api";
import { CatalogTable } from "@/features/catalog/components/catalog-table";
import { ProductDialog } from "@/features/catalog/components/product-form";
import { AliasDialog } from "@/features/catalog/components/alias-dialog";

export default function CatalogPage() {
  const { hasPermission, user } = useAuth();
  const canWrite = hasPermission("catalog:manage") || hasPermission("catalog:write");
  const canSeeCost = hasPermission("catalog:cost");

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [stockStatus, setStockStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const pageSize = 20;

  const [productDialogOpen, setProductDialogOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<CatalogProduct | null>(null);

  const [aliasDialogOpen, setAliasDialogOpen] = React.useState(false);
  const [aliasProduct, setAliasProduct] = React.useState<CatalogProduct | null>(null);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading } = useCatalogProducts({
    search: debouncedSearch || undefined,
    category: category !== "all" ? category : undefined,
    stock_status: stockStatus !== "all" ? stockStatus : undefined,
    page,
    page_size: pageSize,
  });

  const handleEdit = (p: CatalogProduct) => {
    setSelectedProduct(p);
    setProductDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedProduct(null);
    setProductDialogOpen(true);
  };

  const handleManageAliases = (p: CatalogProduct) => {
    setAliasProduct(p);
    setAliasDialogOpen(true);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Industrial Product Catalog"
        description="Master pricing catalog, SKU configurations, and customer alias normalization mappings"
        breadcrumbs={[{ label: "Workspace", href: "/app/dashboard" }, { label: "Catalog" }]}
        actions={
          canWrite && (
            <Button onClick={handleCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span>New Product</span>
            </Button>
          )
        }
      />

      {/* Role / Cost Visibility Notice */}
      {!canSeeCost && (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted-foreground)] flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-[var(--primary)]" />
          <span>
            Sales View Active: You are viewing customer-facing sell pricing. Internal margin costs and vendor acquisition rates are restricted to catalog managers.
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU, product name, or manufacturer..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            aria-label="Filter by product category"
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="Motors & Drives">Motors & Drives</option>
            <option value="Switchgear & Protection">Switchgear & Protection</option>
            <option value="Pumps & Valves">Pumps & Valves</option>
            <option value="Piping & Structural">Piping & Structural</option>
            <option value="Automation & Sensors">Automation & Sensors</option>
            <option value="Bearings & Power Transmission">Bearings & Transmission</option>
          </select>

          <select
            value={stockStatus}
            aria-label="Filter by stock status"
            onChange={(e) => {
              setStockStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
          >
            <option value="all">All Stock Statuses</option>
            <option value="in_stock">In Stock</option>
            <option value="limited">Limited</option>
            <option value="backorder">Backorder</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="mt-4">
        <CatalogTable
          data={data?.items || []}
          total={data?.total || 0}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onEdit={handleEdit}
          onManageAliases={handleManageAliases}
          isLoading={isLoading}
        />
      </div>

      {/* Product Form Dialog */}
      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProduct}
      />

      {/* Alias Dialog */}
      {aliasProduct && (
        <AliasDialog
          open={aliasDialogOpen}
          onOpenChange={(open) => {
            if (!open) setAliasProduct(null);
          }}
          product={aliasProduct}
        />
      )}
    </PageContainer>
  );
}
