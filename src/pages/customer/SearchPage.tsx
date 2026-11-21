import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, Check, Search } from 'lucide-react';
import { ProductCard } from '../../components/products/ProductCard';
import { useAuth } from '../../context/AuthContext';
import { useNetwork } from '../../context/NetworkContext';
import { getSearchSuggestions, inferCategoryFromQuery, searchCatalog } from '../../services/discoveryService';
import type { ProductCategory } from '../../types';

const CATEGORIES: Array<ProductCategory | 'All'> = [
  'All',
  'Laptops',
  'Monitors',
  'Keyboards',
  'Mice',
  'Headphones',
];

export function SearchPage() {
  const { state, recordDemandSignal } = useNetwork();
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [inputValue, setInputValue] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [category, setCategory] = useState<ProductCategory | 'All'>('All');
  const [locality, setLocality] = useState('Indiranagar');
  const [sortBy, setSortBy] = useState<'relevance' | 'price_asc' | 'price_desc'>('relevance');
  const [interestLoggedForQuery, setInterestLoggedForQuery] = useState<string | null>(null);

  const preferredStoreId = session?.preferredStoreId || 'indiranagar';

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setInputValue(q);
    setSubmittedQuery(q);
  }, [searchParams]);

  const results = useMemo(() => {
    return searchCatalog(state.products, state.inventory, state.stores, {
      query: submittedQuery,
      category,
      city: 'Bengaluru',
      sortBy,
    });
  }, [state.products, state.inventory, state.stores, submittedQuery, category, sortBy]);

  // Automatically log unmatched searches to Demand Radar
  useEffect(() => {
    const clean = submittedQuery.trim();
    if (clean && results.total === 0) {
      recordDemandSignal({
        query: clean,
        inferredCategory: inferCategoryFromQuery(clean),
        locality,
        outcome: 'UNMATCHED_SEARCH',
        session,
      });
    }
  }, [submittedQuery, results.total, locality, recordDemandSignal, session]);

  const suggestions = getSearchSuggestions(state.products, inputValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInterestLoggedForQuery(null);
    setSubmittedQuery(inputValue);
    setSearchParams(inputValue.trim() ? { q: inputValue.trim() } : {});
  };

  const handleChipClick = (q: string) => {
    setInterestLoggedForQuery(null);
    setInputValue(q);
    setSubmittedQuery(q);
    setSearchParams({ q });
  };

  const handleRegisterUnmatchedInterest = () => {
    if (!submittedQuery.trim()) return;
    recordDemandSignal({
      query: submittedQuery.trim(),
      inferredCategory: inferCategoryFromQuery(submittedQuery),
      locality,
      outcome: 'REGISTERED_INTEREST',
      session,
    });
    setInterestLoggedForQuery(submittedQuery.trim());
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="bg-white border border-[#E1E5E4] rounded-xl p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A2022]">Intelligent Discovery</h1>
          <p className="text-sm text-[#526063] mt-1">
            Typo-tolerant and natural-language discovery across our Bengaluru catalog. Unmatched searches automatically inform Demand Radar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-[#526063] absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search by product, typo ('macbok'), or intent ('4k usb-c monitor for mac')"
              aria-label="Search query"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#F7F7F5] border border-[#D4DAD8] rounded-lg focus:bg-white focus:outline-none focus:border-[#264C4F]"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#264C4F] hover:bg-[#1D3B3D] rounded-lg whitespace-nowrap"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#526063]">Suggested searches:</span>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleChipClick(s)}
                className="px-2.5 py-1 bg-[#F0F2F1] hover:bg-[#E7F0EE] text-[#1A2022] rounded-md transition-colors"
              >
                {s}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleChipClick('oled ultrawide 49 inch monitor')}
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-md transition-colors"
            >
              Test Unmatched Query
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="search-locality" className="text-[#526063]">
              Locality
            </label>
            <select
              id="search-locality"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              className="px-2.5 py-1.5 border border-[#D4DAD8] rounded-md bg-white"
            >
              {state.stores.map((s) => (
                <option key={s.id} value={s.locality}>
                  {s.locality}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filters & Count Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#E9ECEB] rounded-lg">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                category === cat ? 'bg-white text-[#1A2022] shadow-xs' : 'text-[#526063]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono-tabular text-[#526063]">
            {results.total} {results.total === 1 ? 'result' : 'results'}
          </span>
          <select
            aria-label="Sort search results"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'relevance' | 'price_asc' | 'price_desc')}
            className="px-2.5 py-1.5 text-xs bg-white border border-[#D4DAD8] rounded-md"
          >
            <option value="relevance">Relevance</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Search Results or Empty State with Demand Radar Action */}
      {results.total === 0 ? (
        <div className="bg-white border border-[#E1E5E4] rounded-xl p-8 sm:p-10 space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-amber-800">Unmatched Query Captured</p>
            <h2 className="text-lg font-semibold text-[#1A2022]">
              No catalog models matched "{submittedQuery}"
            </h2>
            <p className="text-sm text-[#526063] max-w-2xl">
              SYNAPSE recorded this unmatched search for {locality} on the Administrator Demand Radar (distinct from confirmed purchase orders). You can also register explicit restock interest below.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={interestLoggedForQuery === submittedQuery.trim()}
              onClick={handleRegisterUnmatchedInterest}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#264C4F] hover:bg-[#1D3B3D] disabled:bg-emerald-700 rounded-lg transition-colors"
            >
              {interestLoggedForQuery === submittedQuery.trim() ? (
                <>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  Demand Interest Registered
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                  Register Interest for "{submittedQuery}"
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleChipClick('')}
              className="px-4 py-2 text-xs font-medium text-[#1A2022] border border-[#D4DAD8] rounded-lg hover:bg-[#F7F7F5]"
            >
              View All Products
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.products.map(({ product }) => (
            <ProductCard
              key={product.id}
              product={product}
              preferredStoreId={preferredStoreId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
