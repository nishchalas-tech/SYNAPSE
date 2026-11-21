import { ArrowRight, Bell, Check, Store as StoreIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Product, RescueEvaluation } from '../../types';
import { formatInr } from '../../utils/formatters';
import { StatusBadge } from '../ui/StatusBadge';

interface ProductRescuePanelProps {
  product: Product;
  evaluation: RescueEvaluation;
  isInterestRegistered: boolean;
  onSelectStore: (storeId: string) => void;
  onRegisterInterest: () => void;
  selectedStoreId: string;
}

export function ProductRescuePanel({
  product,
  evaluation,
  isInterestRegistered,
  onSelectStore,
  onRegisterInterest,
  selectedStoreId,
}: ProductRescuePanelProps) {
  if (evaluation.outcome === 'AVAILABLE_PREFERRED') {
    return null;
  }

  return (
    <div className="bg-[#F8FAF9] border border-[#C9DBD7] rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#264C4F]">Product Rescue</p>
          <h3 className="text-sm font-semibold text-[#1A2022] mt-0.5">{evaluation.summary}</h3>
        </div>
        <StatusBadge
          label={
            evaluation.outcome === 'RESCUE_OTHER_STORE'
              ? 'Priority 1 · Network Store Match'
              : evaluation.outcome === 'RESCUE_COMPATIBLE_PRODUCT'
                ? 'Priority 2 · Compatible Alternative'
                : 'Priority 3 · Register Interest'
          }
          tone={evaluation.outcome === 'REGISTER_INTEREST' ? 'warning' : 'teal'}
        />
      </div>

      {evaluation.outcome === 'RESCUE_OTHER_STORE' && (
        <div className="space-y-2">
          {evaluation.alternativeStoreOptions.map((opt) => {
            const isSelected = selectedStoreId === opt.store.id;
            return (
              <div
                key={opt.store.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border transition-colors ${
                  isSelected
                    ? 'bg-white border-[#264C4F]'
                    : 'bg-white/70 border-[#E1E5E4] hover:border-[#B9C5C2]'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#1A2022]">
                    <StoreIcon className="w-4 h-4 text-[#264C4F]" aria-hidden="true" />
                    <span>{opt.store.name}</span>
                    <span className="text-xs font-normal text-[#526063]">
                      · {opt.distanceKm.toFixed(1)} km · {opt.fulfilmentHours}h readiness
                    </span>
                  </div>
                  <p className="text-xs text-[#526063]">{opt.reason}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold font-mono-tabular text-[#1A2022]">
                      {formatInr(opt.totalCostInr)}
                    </p>
                    <p className="text-[11px] text-[#264C4F] font-mono-tabular">
                      {opt.inventory.sellableQty} sellable
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectStore(opt.store.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                      isSelected
                        ? 'bg-[#264C4F] text-white'
                        : 'bg-[#E7F0EE] text-[#264C4F] hover:bg-[#D4E4E1]'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Select Store'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {evaluation.outcome === 'RESCUE_COMPATIBLE_PRODUCT' && (
        <div className="space-y-2.5">
          <p className="text-xs text-[#526063]">
            Matched via compatibility attribute:{' '}
            <span className="font-medium text-[#1A2022]">{product.compatibilityLabel}</span>
          </p>
          {evaluation.compatibleAlternatives.map(({ product: alt, bestOption }) => (
            <div
              key={alt.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white border border-[#E1E5E4] rounded-lg"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#1A2022]">{alt.name}</p>
                <p className="text-xs text-[#526063]">
                  {alt.brand} · {bestOption.inventory.sellableQty} sellable at {bestOption.store.name} ·{' '}
                  <span className="font-mono-tabular font-medium text-[#1A2022]">
                    {formatInr(alt.priceInr)}
                  </span>
                </p>
              </div>
              <Link
                to={`/products/${alt.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#264C4F] hover:bg-[#1D3B3D] rounded-md whitespace-nowrap shrink-0 transition-colors"
              >
                View Compatible Model
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {evaluation.outcome === 'REGISTER_INTEREST' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <p className="text-xs text-[#526063]">
            Logging interest records a live signal on Demand Radar so network planners can prioritize restocking.
          </p>
          <button
            type="button"
            disabled={isInterestRegistered}
            onClick={onRegisterInterest}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
              isInterestRegistered
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                : 'bg-[#264C4F] text-white hover:bg-[#1D3B3D]'
            }`}
          >
            {isInterestRegistered ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                Interest Recorded
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                Register Restock Interest
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
