import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../common/PageHeader';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { StockReportItem, StockReportSummary, StockReportResponse } from '../../types';
import {
  Search,
  RefreshCw,
  Filter,
  ArrowUpDown,
  History,
  TrendingUp,
  Boxes,
  DollarSign,
  Percent,
  Download,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';

export const StockReportView: React.FC = () => {
  const { setActivePath, products: cachedProducts } = useApp();
  const { sessionToken, currentUser } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all_time');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');

  // Sorting
  const [sortBy, setSortBy] = useState<string>('sku');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Response data
  const [reportData, setReportData] = useState<StockReportResponse | null>(null);

  // Unique categories and brands for filter dropdowns
  const availableCategories = Array.from(
    new Set(cachedProducts.map((p) => p.category_name).filter(Boolean))
  ).sort() as string[];

  const availableBrands = Array.from(
    new Set(cachedProducts.map((p) => p.brand).filter(Boolean))
  ).sort() as string[];

  const fetchStockReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('page_size', String(pageSize));
      params.set('sort_by', sortBy);
      params.set('sort_order', sortOrder);

      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      if (categoryFilter !== 'all') {
        params.set('category', categoryFilter);
      }
      if (brandFilter !== 'all') {
        params.set('brand', brandFilter);
      }
      if (locationFilter !== 'all') {
        params.set('location', locationFilter);
      }

      // Date range mapping for aggregated sold/transferred/adjusted
      if (dateRangeFilter === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        params.set('date_from', today);
        params.set('date_to', today);
      } else if (dateRangeFilter === 'yesterday') {
        const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        params.set('date_from', yest);
        params.set('date_to', yest);
      } else if (dateRangeFilter === 'last_7') {
        const past7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        params.set('date_from', past7);
      } else if (dateRangeFilter === 'last_30') {
        const past30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        params.set('date_from', past30);
      } else if (dateRangeFilter === 'this_month') {
        const d = new Date();
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
        params.set('date_from', startOfMonth);
      } else if (dateRangeFilter === 'custom') {
        if (customDateFrom) params.set('date_from', customDateFrom);
        if (customDateTo) params.set('date_to', customDateTo);
      }

      const token = sessionToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('mirage_session_token') : null);
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (currentUser?.id) {
        headers['x-authenticated-user-id'] = currentUser.id;
      }

      const res = await fetch(`/api/reports/stock?${params.toString()}`, { headers });
      if (!res.ok) {
        throw new Error(`Failed to load stock report: HTTP ${res.status}`);
      }
      const data: StockReportResponse = await res.json();
      setReportData(data);
    } catch (err: any) {
      setError(err.message || 'Error loading stock report');
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    pageSize,
    searchQuery,
    categoryFilter,
    brandFilter,
    locationFilter,
    dateRangeFilter,
    customDateFrom,
    customDateTo,
    sortBy,
    sortOrder,
    sessionToken,
    currentUser,
  ]);

  useEffect(() => {
    fetchStockReport();
  }, [fetchStockReport]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleViewHistory = (productId: string) => {
    sessionStorage.setItem('stock_history_product_id', productId);
    if (locationFilter !== 'all') {
      sessionStorage.setItem('stock_history_warehouse_id', locationFilter);
    } else {
      sessionStorage.removeItem('stock_history_warehouse_id');
    }
    const locParam = locationFilter !== 'all' ? `&warehouse_id=${locationFilter}` : '';
    setActivePath(`/inventory/stock-history?product_id=${productId}${locParam}`);
  };

  const handleExportCsv = () => {
    if (!reportData || !reportData.products.length) return;
    const headers = [
      'SKU',
      'Product',
      'Category',
      'Brand',
      'Location',
      'Unit Selling Price (BDT)',
      'Landed Avg Cost (BDT)',
      'Current Stock',
      'Available Stock',
      'Closing Value Purchase (BDT)',
      'Closing Value Sale (BDT)',
      'Potential Profit (BDT)',
      'Profit Margin (%)',
      'Total Unit Sold',
      'Total Transferred',
      'Total Adjusted',
    ];

    const rows = reportData.products.map((item) => [
      `"${item.sku}"`,
      `"${(item.display_name || item.name).replace(/"/g, '""')}"`,
      `"${(item.category_name || '').replace(/"/g, '""')}"`,
      `"${(item.brand || '').replace(/"/g, '""')}"`,
      `"${item.location.replace(/"/g, '""')}"`,
      item.selling_price,
      item.avg_cost,
      item.current_stock,
      item.available_stock,
      item.closing_stock_value_purchase,
      item.closing_stock_value_sale,
      item.potential_profit,
      `${item.profit_margin_pct}%`,
      item.total_unit_sold,
      item.total_transferred,
      item.total_adjusted,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mirage_stock_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = reportData?.summary;
  const products = reportData?.products || [];
  const total = reportData?.total || 0;
  const totalPages = reportData?.total_pages || 1;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        eyebrow="Inventory & Valuation"
        title="Stock Report"
        desc="Global product inventory valuation, closing stock at purchase & sale prices, potential profit margins, and movement velocity."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={loading || products.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={fetchStockReport}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Summary KPI Cards (Computed from endpoint aggregate totals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Closing Stock by Purchase Price */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Closing Stock (Purchase)</span>
            <Boxes className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-xl font-bold font-mono text-[var(--text)] tracking-tight">
            ৳{summary ? summary.closing_stock_value_purchase.toLocaleString() : '0'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1 flex items-center gap-1">
            <span>Avg Cost Valuation</span>
            <span className="font-semibold text-[var(--text)]">
              ({summary ? summary.total_stock_on_hand.toLocaleString() : 0} units total)
            </span>
          </div>
        </div>

        {/* Closing Stock by Sale Price */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Closing Stock (Sale)</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
            ৳{summary ? summary.closing_stock_value_sale.toLocaleString() : '0'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1 flex items-center gap-1">
            <span>Full Retail Revenue Potential</span>
          </div>
        </div>

        {/* Potential Profit */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Potential Profit</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold font-mono text-[var(--accent-secondary)] tracking-tight">
            ৳{summary ? summary.potential_profit.toLocaleString() : '0'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1 flex items-center gap-1">
            <span>Gross projected unrealized return</span>
          </div>
        </div>

        {/* Profit Margin % */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--text-muted)] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Profit Margin %</span>
            <Percent className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 tracking-tight">
              {summary ? `${summary.profit_margin_pct}%` : '0%'}
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
              Blended
            </span>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Across {summary ? summary.total_products_count : 0} matching SKUs
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3.5 shadow-xs space-y-3">
        {/* Primary Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
          {/* Search Query */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search product name, SKU, brand, barcode..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Location Filter */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-sunken)] px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
            <Building2 className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase shrink-0">Location:</span>
            <select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-xs text-[var(--text)] font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Locations (Consolidated)</option>
              <option value="wh_shop">Shop Floor (Showroom)</option>
              <option value="wh_main">Main / Back-store (2nd Floor)</option>
            </select>
          </div>

          {/* Date Range for Velocity Aggregates */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-sunken)] px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
            <Filter className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase shrink-0">Period:</span>
            <select
              value={dateRangeFilter}
              onChange={(e) => {
                setDateRangeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-xs text-[var(--text)] font-medium focus:outline-none cursor-pointer"
            >
              <option value="all_time">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7">Last 7 Days</option>
              <option value="last_30">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter Row: Category & Brand + Custom Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-[var(--border)]">
          {/* Category Filter */}
          <div className="flex items-center gap-2 bg-[var(--surface-sunken)] px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase shrink-0">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-xs text-[var(--text)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Brand Filter */}
          <div className="flex items-center gap-2 bg-[var(--surface-sunken)] px-2.5 py-1.5 rounded-lg border border-[var(--border)]">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase shrink-0">Brand:</span>
            <select
              value={brandFilter}
              onChange={(e) => {
                setBrandFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-xs text-[var(--text)] focus:outline-none cursor-pointer"
            >
              <option value="all">All Brands</option>
              {availableBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Date Inputs when 'custom' is active */}
          {dateRangeFilter === 'custom' && (
            <>
              <div className="flex items-center gap-1.5 bg-[var(--surface-sunken)] px-2 py-1.5 rounded-lg border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase shrink-0">From:</span>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => {
                    setCustomDateFrom(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-transparent text-xs text-[var(--text)] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-[var(--surface-sunken)] px-2 py-1.5 rounded-lg border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase shrink-0">To:</span>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => {
                    setCustomDateTo(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-transparent text-xs text-[var(--text)] focus:outline-none"
                />
              </div>
            </>
          )}

          {/* Reset Filters */}
          <div className="flex items-center justify-end md:ml-auto">
            {(searchQuery || categoryFilter !== 'all' || brandFilter !== 'all' || locationFilter !== 'all' || dateRangeFilter !== 'all_time') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setBrandFilter('all');
                  setLocationFilter('all');
                  setDateRangeFilter('all_time');
                  setCustomDateFrom('');
                  setCustomDateTo('');
                  setCurrentPage(1);
                }}
                className="text-xs text-[var(--text-muted)] hover:text-rose-500 underline font-medium cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Compact Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--surface-sunken)] border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <th
                  onClick={() => handleSort('sku')}
                  className="py-3 px-3 cursor-pointer hover:text-[var(--text)] whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    SKU
                    <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('product')}
                  className="py-3 px-3 cursor-pointer hover:text-[var(--text)] whitespace-nowrap min-w-[200px]"
                >
                  <div className="flex items-center gap-1">
                    Product
                    <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  className="py-3 px-3 cursor-pointer hover:text-[var(--text)] whitespace-nowrap"
                >
                  Category
                </th>
                <th
                  onClick={() => handleSort('brand')}
                  className="py-3 px-3 cursor-pointer hover:text-[var(--text)] whitespace-nowrap"
                >
                  Brand
                </th>
                <th className="py-3 px-3 whitespace-nowrap">Location</th>
                <th
                  onClick={() => handleSort('price')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text)] whitespace-nowrap"
                >
                  Unit Price
                </th>
                <th
                  onClick={() => handleSort('stock')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text)] whitespace-nowrap"
                >
                  Current Stock
                </th>
                <th
                  onClick={() => handleSort('value_purchase')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text)] whitespace-nowrap"
                >
                  Stock Value (Cost)
                </th>
                <th
                  onClick={() => handleSort('value_sale')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text)] whitespace-nowrap"
                >
                  Stock Value (Sale)
                </th>
                <th
                  onClick={() => handleSort('potential_profit')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text)] whitespace-nowrap"
                >
                  Potential Profit
                </th>
                <th
                  onClick={() => handleSort('units_sold')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text)] whitespace-nowrap"
                  title="Units sold in selected period"
                >
                  Sold
                </th>
                <th
                  onClick={() => handleSort('total_transferred')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text)] whitespace-nowrap"
                  title="Units transferred between warehouses"
                >
                  Transferred
                </th>
                <th
                  onClick={() => handleSort('total_adjusted')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-[var(--text)] whitespace-nowrap"
                  title="Damage, Loss, Tester conversions, or audit adjustments"
                >
                  Adjusted
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-[var(--text-muted)]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent)]" />
                      <span>Loading stock report...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-[var(--text-muted)]">
                    No products matching your search and filter criteria.
                  </td>
                </tr>
              ) : (
                products.map((item) => {
                  const isLowStock = item.current_stock <= 5;
                  const isOutOfStock = item.current_stock === 0;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[var(--surface-hover)] transition-colors group"
                    >
                      {/* SKU */}
                      <td className="py-2.5 px-3 font-mono font-bold text-[var(--accent)] whitespace-nowrap">
                        {item.sku}
                      </td>

                      {/* Product */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[var(--text)] leading-snug">
                          {item.display_name}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {item.name !== item.display_name ? item.name : ''}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3 text-[var(--text-secondary)] whitespace-nowrap">
                        {item.category_name ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--surface-sunken)] border border-[var(--border)] text-[var(--text-secondary)] font-medium">
                            {item.category_name}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Brand */}
                      <td className="py-2.5 px-3 font-medium text-[var(--text)] whitespace-nowrap">
                        {item.brand || '-'}
                      </td>

                      {/* Location */}
                      <td className="py-2.5 px-3 text-[11px] text-[var(--text-muted)] whitespace-nowrap font-mono">
                        {item.location}
                      </td>

                      {/* Unit Price */}
                      <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                        <div className="font-bold text-[var(--text)]">৳{item.selling_price.toLocaleString()}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          Cost: ৳{item.avg_cost.toLocaleString()}
                        </div>
                      </td>

                      {/* Current Stock */}
                      <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`font-bold ${
                              isOutOfStock
                                ? 'text-rose-500'
                                : isLowStock
                                ? 'text-amber-500'
                                : 'text-[var(--text)]'
                            }`}
                          >
                            {item.current_stock}
                          </span>
                          {isOutOfStock ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              OUT
                            </span>
                          ) : isLowStock ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              LOW
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          avail: {item.available_stock}
                        </div>
                      </td>

                      {/* Stock Value (Cost) */}
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-[var(--text-secondary)] whitespace-nowrap">
                        ৳{item.closing_stock_value_purchase.toLocaleString()}
                      </td>

                      {/* Stock Value (Sale) */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ৳{item.closing_stock_value_sale.toLocaleString()}
                      </td>

                      {/* Potential Profit */}
                      <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                        <div className="font-bold text-[var(--accent-secondary)]">
                          ৳{item.potential_profit.toLocaleString()}
                        </div>
                        <div className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                          {item.profit_margin_pct}% margin
                        </div>
                      </td>

                      {/* Total Sold */}
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {item.total_unit_sold > 0 ? `${item.total_unit_sold}` : '-'}
                      </td>

                      {/* Total Transferred */}
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                        {item.total_transferred > 0 ? `${item.total_transferred}` : '-'}
                      </td>

                      {/* Total Adjusted */}
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--text-secondary)] whitespace-nowrap">
                        {item.total_adjusted > 0 ? `${item.total_adjusted}` : '-'}
                      </td>

                      {/* Action -> Link to Part 2 Product Stock History */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleViewHistory(item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--surface-sunken)] hover:bg-[var(--accent)] hover:text-white border border-[var(--border)] text-[var(--text)] transition-colors cursor-pointer shadow-xs"
                          title="View complete product stock history and chronological running balance"
                        >
                          <History className="w-3 h-3" />
                          History
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-[var(--border)] bg-[var(--surface-sunken)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-[var(--text-muted)]">
            Showing{' '}
            <strong className="text-[var(--text)]">
              {total > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong className="text-[var(--text)]">
              {Math.min(currentPage * pageSize, total)}
            </strong>{' '}
            of <strong className="text-[var(--text)]">{total}</strong> products
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[var(--card)] border border-[var(--border)] rounded px-1.5 py-1 text-xs text-[var(--text)] cursor-pointer focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="p-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 text-xs font-semibold text-[var(--text)] font-mono">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                className="p-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
