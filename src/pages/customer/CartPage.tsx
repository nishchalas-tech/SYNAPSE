import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShoppingBag, Store as StoreIcon, Trash2 } from 'lucide-react';
import { ProductImage } from '../../components/products/ProductImage';
import { useNetwork } from '../../context/NetworkContext';
import { formatInr, getPreferenceLabel } from '../../utils/formatters';

export function CartPage() {
  const { state, updateCartQuantity, removeFromCart } = useNetwork();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (state.cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="bg-white border border-[#E1E5E4] rounded-xl p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#F0F2F1] text-[#264C4F] flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-[#1A2022]">Your shopping cart is empty</h1>
          <p className="text-sm text-[#526063] max-w-md mx-auto">
            Explore our Bengaluru electronics catalog and choose your preferred store fulfilment priority.
          </p>
          <div className="pt-2">
            <Link
              to="/catalogue"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#264C4F] hover:bg-[#1D3B3D] rounded-lg transition-colors"
            >
              Browse Catalogue
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const assignedStore = state.stores.find((s) => s.id === state.cart[0].storeId);
  const preference = state.cart[0].fulfilmentPreference;

  const subtotalInr = state.cart.reduce((sum, item) => {
    const product = state.products.find((p) => p.id === item.productId);
    return sum + (product?.priceInr || 0) * item.quantity;
  }, 0);
  const deliveryFeeInr = assignedStore?.deliveryFeeInr || 0;
  const totalInr = subtotalInr + deliveryFeeInr;

  const handleQtyChange = (cartItemId: string, nextQty: number) => {
    const res = updateCartQuantity(cartItemId, nextQty);
    setErrorMsg(res.ok ? null : res.message);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1A2022]">Shopping Cart</h1>
        <p className="text-sm text-[#526063] mt-1">
          Fulfilled as a single-store promise from {assignedStore?.name || 'selected store'}.
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-4">
          {state.cart.map((item) => {
            const product = state.products.find((p) => p.id === item.productId);
            const inv = state.inventory.find(
              (r) => r.productId === item.productId && r.storeId === item.storeId
            );
            if (!product) return null;

            return (
              <div
                key={item.id}
                className="bg-white border border-[#E1E5E4] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center"
              >
                <div className="w-full sm:w-32 shrink-0 rounded-lg overflow-hidden border border-[#EEF1F0]">
                  <ProductImage src={product.imageUrl} alt={product.name} />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-[#526063]">
                    <span>{product.brand}</span>
                    <span aria-hidden="true">·</span>
                    <span>{product.sku}</span>
                  </div>
                  <Link
                    to={`/products/${product.id}`}
                    className="text-base font-semibold text-[#1A2022] hover:text-[#264C4F] block truncate"
                  >
                    {product.name}
                  </Link>
                  <p className="text-xs text-[#264C4F] font-mono-tabular">
                    {inv ? `${inv.sellableQty} sellable units at ${assignedStore?.locality}` : 'Checking stock'}
                  </p>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-center">
                  <div className="flex items-center border border-[#D4DAD8] rounded-lg">
                    <button
                      type="button"
                      aria-label={`Decrease quantity for ${product.name}`}
                      onClick={() => handleQtyChange(item.id, item.quantity - 1)}
                      className="px-2.5 py-1.5 text-sm hover:bg-[#F7F7F5]"
                    >
                      -
                    </button>
                    <span className="px-3 py-1.5 text-sm font-mono-tabular">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Increase quantity for ${product.name}`}
                      onClick={() => handleQtyChange(item.id, item.quantity + 1)}
                      className="px-2.5 py-1.5 text-sm hover:bg-[#F7F7F5]"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right min-w-24">
                    <p className="text-sm font-semibold font-mono-tabular text-[#1A2022]">
                      {formatInr(product.priceInr * item.quantity)}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={`Remove ${product.name} from cart`}
                    onClick={() => removeFromCart(item.id)}
                    className="p-2 text-[#526063] hover:text-red-700 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Card */}
        <div className="lg:col-span-4 bg-white border border-[#E1E5E4] rounded-xl p-6 space-y-5">
          <div className="space-y-2 pb-4 border-b border-[#EEF1F0]">
            <h2 className="text-base font-semibold text-[#1A2022]">Fulfilment Summary</h2>
            {assignedStore && (
              <div className="flex items-start gap-2 text-xs text-[#526063]">
                <StoreIcon className="w-4 h-4 text-[#264C4F] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-[#1A2022]">{assignedStore.name}</p>
                  <p>
                    {getPreferenceLabel(preference)} · {assignedStore.fulfilmentHours}h readiness ·{' '}
                    {assignedStore.distanceKm.toFixed(1)} km
                  </p>
                </div>
              </div>
            )}
          </div>

          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#526063]">Subtotal</dt>
              <dd className="font-mono-tabular font-medium text-[#1A2022]">{formatInr(subtotalInr)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#526063]">Local Store Fulfilment</dt>
              <dd className="font-mono-tabular font-medium text-[#1A2022]">
                {deliveryFeeInr === 0 ? 'Free (₹0)' : formatInr(deliveryFeeInr)}
              </dd>
            </div>
            <div className="flex justify-between pt-3 border-t border-[#EEF1F0] text-base font-semibold">
              <dt>Estimated Total</dt>
              <dd className="font-mono-tabular text-[#1A2022]">{formatInr(totalInr)}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => navigate('/checkout')}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-white bg-[#264C4F] hover:bg-[#1D3B3D] rounded-lg transition-colors"
          >
            Proceed to Demo Checkout
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
