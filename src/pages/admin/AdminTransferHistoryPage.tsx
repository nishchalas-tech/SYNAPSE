import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useNetwork } from '../../context/NetworkContext';
import { formatDateTime } from '../../utils/formatters';

export function AdminTransferHistoryPage() {
  const { state } = useNetwork();

  return (
    <div className="space-y-6">
      <Link
        to="/admin/transfers"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#526063] hover:text-[#1A2022]"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        Back to Transfer Queue
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-[#1A2022]">Transfer Decision History</h1>
        <p className="text-sm text-[#526063] mt-1">
          Recorded Surplus Exchange approvals and rejections with administrator attribution.
        </p>
      </div>

      <div className="bg-white border border-[#E1E5E4] rounded-xl overflow-hidden">
        {state.transferDecisions.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <h2 className="text-base font-semibold text-[#1A2022]">No transfer decisions recorded yet</h2>
            <p className="text-sm text-[#526063]">
              Approve or reject a recommendation in the Transfer Queue to log an auditable decision here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EEF1F0]">
            {state.transferDecisions.map((dec) => (
              <div key={dec.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#1A2022]">
                    <span>{dec.sourceStoreName}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#264C4F]" aria-hidden="true" />
                    <span>{dec.destinationStoreName}</span>
                    <StatusBadge
                      label={dec.decision}
                      tone={dec.decision === 'APPROVED' ? 'success' : 'danger'}
                    />
                  </div>
                  <p className="text-xs text-[#1A2022]">
                    {dec.productName} · <span className="font-mono-tabular">{dec.quantity} units</span>
                  </p>
                  <p className="text-xs text-[#526063]">
                    Decided by {dec.decidedBy} · Note: {dec.notes}
                  </p>
                </div>
                <span className="text-xs font-mono-tabular text-[#526063] shrink-0">
                  {formatDateTime(dec.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
