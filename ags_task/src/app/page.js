"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORIES, PRODUCTS } from "@/lib/products";

// Simple line icons: one per category, plus the cart.
const ICONS = {
  cpu: <><rect x="6" y="6" width="12" height="12" rx="1" /><rect x="9" y="9" width="6" height="6" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></>,
  gpu: <><rect x="2" y="7" width="20" height="10" rx="1" /><circle cx="8" cy="12" r="2.5" /><circle cx="16" cy="12" r="2.5" /><path d="M4 17v3" /></>,
  ram: <><rect x="2" y="7" width="20" height="8" rx="1" /><path d="M6 10v2M10 10v2M14 10v2M18 10v2M4 15v2M20 15v2" /></>,
  storage: <><rect x="3" y="8" width="18" height="8" rx="1" /><path d="M7 12h6M17 12h.01" /></>,
  motherboard: <><rect x="4" y="4" width="16" height="16" rx="1" /><rect x="7" y="7" width="5" height="5" /><path d="M15 7h2M15 10h2M7 15h10M7 17h6" /></>,
  psu: <><rect x="3" y="5" width="18" height="14" rx="1" /><circle cx="10" cy="12" r="4" /><path d="M10 8v8M6 12h8M17 9h1M17 12h1" /></>,
  case: <><rect x="6" y="2" width="12" height="20" rx="1" /><circle cx="12" cy="15" r="3" /><path d="M9 6h6" /></>,
  cooling: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="1.5" /><path d="M12 10.5c0-3 1-5 3-5M13.5 12c3 0 5 1 5 3M12 13.5c0 3-1 5-3 5M10.5 12c-3 0-5-1-5-3" /></>,
  cart: <><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M2 3h3l2.5 12h11L21 7H6.2" /></>,
};

function Icon({ name, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const price = (n) => `₪${n.toLocaleString("en-US")}`;

export default function Shop() {
  const [category, setCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState(0);
  const [status, setStatus] = useState({}); // productId -> "adding" | "added" | "failed"
  const [message, setMessage] = useState(null);

  async function addToCart(product) {
    setStatus((s) => ({ ...s, [product.id]: "adding" }));
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);

      setCart((c) => c + 1);
      setStatus((s) => ({ ...s, [product.id]: "added" }));
      setMessage({ ok: true, text: `${product.brand} item added to your cart.` });
    } catch (err) {
      setStatus((s) => ({ ...s, [product.id]: "failed" }));
      setMessage({ ok: false, text: `Couldn't add to cart: ${err.message}. Try again in a moment.` });
    }
    setTimeout(() => setStatus((s) => ({ ...s, [product.id]: undefined })), 1500);
  }

  const shown = PRODUCTS.filter((p) =>
    (!category || p.category === category) &&
    `${p.brand} ${p.name}`.toLowerCase().includes(search.toLowerCase())
  );

  const buttonLabel = { adding: "Adding…", added: "Added", failed: "Failed" };

  return (
    <div className="shop">
      <header className="shop-header">
        <button className="shop-logo" onClick={() => setCategory(null)}>
          <Icon name="cpu" size={22} /> Byte Shop
        </button>
        <input className="shop-search" type="search" placeholder="Search RTX 5070"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="shop-cart" aria-label={`Cart, ${cart} items`}>
          <Icon name="cart" size={22} />
          <span className="shop-cart-count">{cart}</span>
        </div>
      </header>

      <nav className="shop-nav">
        <button className={!category ? "active" : ""} onClick={() => setCategory(null)}>All parts</button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className={category === c.id ? "active" : ""} onClick={() => setCategory(c.id)}>
            {c.label}
          </button>
        ))}
      </nav>

      {message && (
        <div className={`shop-message ${message.ok ? "ok" : "fail"}`} role="status">
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {shown.length === 0 && <p className="shop-empty">No parts match your search.</p>}

      <div className="shop-grid">
        {shown.map((p) => (
          <div key={p.id} className="shop-item">
            {p.deal && <span className="shop-deal">Deal</span>}
            <div className="shop-item-img"><Icon name={p.category} size={72} /></div>
            <p className="shop-brand">{p.brand}</p>
            <p className="shop-sku">Item no. {p.id}</p>
            <p className="shop-name">{p.name}</p>

            <div className="shop-prices">
              <div>
                {p.oldPrice && <span className="shop-old">{price(p.oldPrice)}</span>}
                <span className="shop-price">{price(p.price)}</span>
              </div>
              <span className="shop-member">Members: <b>{price(p.memberPrice)}</b></span>
            </div>

            <button className={`shop-add ${status[p.id] || ""}`} onClick={() => addToCart(p)}
              disabled={status[p.id] === "adding"}>
              <Icon name="cart" size={18} />
              {buttonLabel[status[p.id]] || "Add to cart"}
            </button>
          </div>
        ))}
      </div>

      <footer className="shop-footer">
        <span>Byte Shop · Free shipping over ₪300</span>
        <Link href="/status">Service status</Link>
      </footer>
    </div>
  );
}
