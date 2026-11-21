import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useNetwork } from '../../context/NetworkContext';

export function AdminSurplusExchangePage() {
  const { state } = useNetwork();

  // Compute live surplus and shortage pairings from current inventory + demand signals
  const pairings = state.products
    .map((product) => {
      const storeRows = state.stores.map((store) => {
        const inv = state.inventory.find(
          (i) => i.storeId === store.id && i.productId === product.id
        );
        return { store, sellableQty: inv?.sellableQty ?? 0 };
      });
      const surplusStores = storeRows.filter((r) => r.sellableQty >= 5);
      const shortageStores = storeRows.filter((r) => r.sellableQty <= 1);
      const relatedSignals = state.demandSignals.filter(
        (d) => d.inferredProductId === product.id
      );

      return { product, surplusStores, shortageStores, relatedSignals };
    })
    .filter((p) => p.surplusStores.length > 0 && p.shortageStores.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A2022]">Surplus Exchange</h1>
          <p className="text-sm text-[#526063] mt-1">
            Identifies products with surplus sellable stock (&ge; 5 units) alongside shortage stores (&le; 1 unit) and Demand Radar signals.
          </p>
        </div>
        <Link
          to="/admin/transfers"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#264C4F] hover:bg-[#1D3B3D] rounded-lg whitespace-nowrap"
        >
          Open Transfer Recommendations
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>

      {pairings.length === 0 ? (
        <div className="bg-white border border-[#E1E5E4] rounded-xl p-10 text-center text-sm text-[#526063]">
          No simultaneous surplus and shortage pairings currently detected across the 4 stores.
        </div>
      ) : (
        <div className="space-y-4">
          {pairings.map(({ product, surplusStores, shortageStores, relatedSignals }) => (
            <div key={product.id} className="bg-white border border-[#E1E5E4] rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EEF1F0]">
                <div>
                  <p className="text-xs font-mono-tabular text-[#526063]">{product.sku} · {product.category}</p>
                  <h2 className="text-base font-semibold text-[#1A2022]">{product.name}</h2>
                </div>
                <span className="text-xs font-mono-tabular text-[#264C4F]">
                  {relatedSignals.length} related Demand Radar signal(s)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-[#F8FAF9] border border-[#D4E4E1] rounded-lg space-y-1.5">
                  <p className="font-semibold text-[#264C4F]">Surplus Stores (&ge; 5 sellable)</p>
                  {surplusStores.map(({ store, sellableQty }) => (
                    <div key={store.id} className="flex justify-between font-mono-tabular">
                      <span className="text-[#1A2022]">{store.name}</span>
                      <span className="font-semibold text-[#264C4F]">{sellableQty} units</span>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-lg space-y-1.5">
                  <p className="font-semibold text-amber-900">Shortage Stores (&le; 1 sellable)</p>
                  {shortageStores.map(({ store, sellableQty }) => (
                    <div key={store.id} className="flex justify-between font-mono-tabular">
                      <span className="text-[#1A2022]">{store.name}</span>
                      <span className="font-semibold text-amber-900">{sellableQty} units</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
