import { useState } from 'react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useNetwork } from '../../context/NetworkContext';
import type { DemandSignalOutcome } from '../../types';
import { formatDateTime } from '../../utils/formatters';

export function AdminDemandRadarPage() {
  const { state } = useNetwork();
  const [localityFilter, setLocalityFilter] = useState('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | DemandSignalOutcome>('ALL');

  const signals = state.demandSignals.filter((s) => {
    if (localityFilter !== 'ALL' && s.locality.toLowerCase() !== localityFilter.toLowerCase()) {
      return false;
    }
    if (outcomeFilter !== 'ALL' && s.outcome !== outcomeFilter) return false;
    return true;
  });

  const confirmedOrdersCount = state.orders.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1A2022]">Demand Radar</h1>
        <p className="text-sm text-[#526063] mt-1">
          Captures unmatched searches, out-of-stock nearby triggers, and registered customer interest. Kept strictly separate from confirmed purchases.
        </p>
      </div>

      {/* Explicit Separation: Demand Interest vs Confirmed Purchases */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E1E5E4] rounded-xl p-5">
          <p className="text-xs text-[#526063]">Search & Unmet Interest Signals (Demand Radar)</p>
          <p className="text-2xl font-semibold font-mono-tabular text-[#264C4F] mt-1">
            {state.demandSignals.length}
          </p>
          <p className="text-xs text-[#526063] mt-1">
            Non-transactional discovery signals logged by customers
          </p>
        </div>
        <div className="bg-white border border-[#E1E5E4] rounded-xl p-5">
          <p className="text-xs text-[#526063]">Confirmed Customer Orders (Separate Ledger)</p>
          <p className="text-2xl font-semibold font-mono-tabular text-[#1A2022] mt-1">
            {confirmedOrdersCount}
          </p>
          <p className="text-xs text-[#526063] mt-1">
            Completed checkout reservations assigned to store pick tasks
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E1E5E4] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F0F2F1] rounded-lg">
          {(
            [
              ['ALL', 'All Signals'],
              ['UNMATCHED_SEARCH', 'Unmatched Search'],
              ['OUT_OF_STOCK_NEARBY', 'Out of Stock Nearby'],
              ['REGISTERED_INTEREST', 'Registered Interest'],
              ['RESCUED_ALTERNATIVE', 'Rescued Alternative'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setOutcomeFilter(val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                outcomeFilter === val ? 'bg-white text-[#1A2022] shadow-xs' : 'text-[#526063]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          aria-label="Filter by locality"
          value={localityFilter}
          onChange={(e) => setLocalityFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-white border border-[#D4DAD8] rounded-lg"
        >
          <option value="ALL">All Localities</option>
          {state.stores.map((s) => (
            <option key={s.id} value={s.locality}>
              {s.locality}
            </option>
          ))}
        </select>
      </div>

      {/* Signals Table */}
      <div className="bg-white border border-[#E1E5E4] rounded-xl overflow-hidden">
        {signals.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#526063]">
            No demand signals match the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F8FAF9] border-b border-[#E1E5E4] text-xs font-semibold text-[#526063]">
                  <th className="py-3 px-4">Search Query / Product</th>
                  <th className="py-3 px-4">Inferred Category</th>
                  <th className="py-3 px-4">Locality</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF1F0]">
                {signals.map((sig) => (
                  <tr key={sig.id} className="hover:bg-[#FAFBFA]">
                    <td className="py-3.5 px-4 font-medium text-[#1A2022]">"{sig.query}"</td>
                    <td className="py-3.5 px-4 text-[#526063]">{sig.inferredCategory}</td>
                    <td className="py-3.5 px-4 text-[#1A2022]">{sig.locality}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge
                        label={sig.outcome.replace(/_/g, ' ')}
                        tone={
                          sig.outcome === 'REGISTERED_INTEREST'
                            ? 'teal'
                            : sig.outcome === 'UNMATCHED_SEARCH'
                              ? 'warning'
                              : 'neutral'
                        }
                      />
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular text-xs text-[#526063]">
                      {formatDateTime(sig.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
