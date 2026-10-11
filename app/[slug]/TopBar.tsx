/**
 * COD trust bar — pinned message at the very top of every landing page:
 * order now, open the parcel, check the quality, THEN pay.
 *
 * Conversion note: cash-on-delivery buyers fear paying for junk sight unseen.
 * This single line answers that fear before they scroll.
 *
 * Perf: pure static server HTML — zero JS, zero images, zero layout shift
 * (it is part of first paint). Every class below is already used elsewhere
 * in the bundle, so this bar adds literally zero bytes of CSS.
 */
export default function TopBar() {
  return (
    <div
      role="note"
      className="bg-green-700 px-3 py-2 text-center text-xs font-extrabold text-white"
    >
      ✅ افتح الطلبية وتأكد من الجودة وبعدها خلص
    </div>
  );
}
