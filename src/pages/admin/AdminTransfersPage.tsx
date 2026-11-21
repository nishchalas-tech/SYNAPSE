import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useNetwork } from '../../context/NetworkContext';

export function AdminTransfersPage() {
  const { session } = useAuth();
  const { state, approveTransfer, rejectTransfer } = useNetwork();
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  if (!session) return null;

  const handleApprove = (recId: string) => {
    const res = approveTransfer(recId, notesById[recId] || '', session);
    setFeedback({ ok: res.ok, text: res.message });
  };

  const handleReject = (recId: string) => {
    const res = rejectTransfer(recId, notesById[recId] || '', session);
    setFeedback({ ok: res.ok, text: res.message });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A2022]">Transfer Recommendations</h1>
          <p className="text-sm text-[#526063] mt-1">
            Approve or reject Surplus Exchange demo rebalancing recommendations. Approving updates demo inventory levels across both stores; no physical transit is dispatched in demo mode.
          </p>
        </div>
        <Link
          to="/admin/transfers/history"
          className="text-xs font-medium text-[#264C4F] hover:underline whitespace-nowrap"
        >
          View Decision History ({state.transferDecisions.length})
        </Link>
      </div>

      {feedback && (
        <div
          role="status"
          className={`p-4 rounded-xl border text-xs ${
            feedback.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="space-y-4">
        {state.transferRecommendations.map((rec) => {
          const srcInv = state.inventory.find(
            (i) => i.storeId === rec.sourceStoreId && i.productId === rec.productId
          );
          const dstInv = state.inventory.find(
            (i) => i.storeId === rec.destinationStoreId && i.productId === rec.productId
          );

          return (
            <div key={rec.id} className="bg-white border border-[#E1E5E4] rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#EEF1F0]">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#1A2022]">
                    <span>{rec.sourceStoreName}</span>
                    <ArrowRight className="w-4 h-4 text-[#264C4F]" aria-hidden="true" />
                    <span>{rec.destinationStoreName}</span>
                  </div>
                  <p className="text-base font-semibold text-[#264C4F] mt-1">
                    {rec.productName} · <span className="font-mono-tabular">{rec.recommendedQty} units</span>
                  </p>
                </div>

                <StatusBadge
                  label={rec.status}
                  tone={
                    rec.status === 'APPROVED'
                      ? 'success'
                      : rec.status === 'REJECTED'
                        ? 'danger'
                        : 'warning'
                  }
                />
              </div>

              <p className="text-sm text-[#526063]">{rec.reason}</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-[#F7F7F5] border border-[#E1E5E4] rounded-lg text-xs">
                <div>
                  <span className="text-[#526063]">Current Source Sellable</span>
                  <p className="font-mono-tabular font-semibold text-[#1A2022] mt-0.5">
                    {srcInv?.sellableQty ?? rec.sourceSellableQty} units ({rec.sourceStoreName})
                  </p>
                </div>
                <div>
                  <span className="text-[#526063]">Current Destination Sellable</span>
                  <p className="font-mono-tabular font-semibold text-[#1A2022] mt-0.5">
                    {dstInv?.sellableQty ?? rec.destinationSellableQty} units ({rec.destinationStoreName})
                  </p>
                </div>
                <div>
                  <span className="text-[#526063]">Linked Demand Signals</span>
                  <p className="font-mono-tabular font-semibold text-[#1A2022] mt-0.5">
                    {rec.demandSignalCount} signal(s)
                  </p>
                </div>
              </div>

              {rec.status === 'PENDING' && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                  <input
                    type="text"
                    value={notesById[rec.id] || ''}
                    onChange={(e) =>
                      setNotesById((prev) => ({ ...prev, [rec.id]: e.target.value }))
                    }
                    placeholder="Optional decision note..."
                    aria-label={`Decision note for ${rec.productName}`}
                    className="flex-1 px-3.5 py-2 text-xs border border-[#D4DAD8] rounded-lg focus:outline-none focus:border-[#264C4F]"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApprove(rec.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#264C4F] hover:bg-[#1D3B3D] rounded-lg transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Approve Demo Transfer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(rec.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
