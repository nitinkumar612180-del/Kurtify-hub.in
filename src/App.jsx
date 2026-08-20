import { useState, useEffect, useMemo } from "react";

/* ============================================================
   KURTIFY HUB — E-commerce Website
   ============================================================
   NOTES FOR NITIN:
   - Data (products/orders/settings) is saved using window.storage
     (works right here in Claude). When you deploy this on GitHub
     Pages / Vercel etc, window.storage will NOT exist there — you'll
     need to connect a real backend (Firebase / Supabase / your own
     API) and swap the loadData()/saveData() functions below to call
     that instead. Everything else (UI, logic, flows) stays same.
   - Product photos are placeholders — replace the `img` field on
     each product with your real image URL once you have them.
   - Default admin password is "kurtify2026" — change it from
     Admin → Settings after first login.
   ============================================================ */

const BRAND = {
  maroon: "#5a1414",
  maroonDeep: "#3d0c0c",
  gold: "#b8912f",
  goldDeep: "#8f6e1f",
  cream: "#faf7f2",
  line: "#e6ddc9",
};

const DEFAULT_PRODUCTS = [
  {
    id: "p1", name: "Maroon Chikankari Short Kurti", price: 899, mrp: 1099,
    category: "Short Kurti", tags: ["short", "maroon", "trendy", "chikankari"],
    stock: 12, cod: true, returnable: true, returnDays: 3, launchingSoon: false,
    deliveryDays: "", img: "", views: 0, addToCart: 0,
  },
  {
    id: "p2", name: "Gold Print Anarkali", price: 1249, mrp: 1249,
    category: "Anarkali", tags: ["gold", "festive", "long"],
    stock: 3, cod: true, returnable: false, returnDays: 0, launchingSoon: false,
    deliveryDays: "", img: "", views: 0, addToCart: 0,
  },
  {
    id: "p3", name: "Blue Co-ord Set", price: 1499, mrp: 1499,
    category: "Co-ord Sets", tags: ["blue", "trendy", "coord"],
    stock: 0, cod: false, returnable: false, returnDays: 0, launchingSoon: false,
    deliveryDays: "", img: "", views: 0, addToCart: 0,
  },
  {
    id: "p4", name: "Festive Silk Short Kurti", price: 1699, mrp: 1699,
    category: "Short Kurti", tags: ["short", "silk", "festive", "trendy"],
    stock: 0, cod: false, returnable: false, returnDays: 0, launchingSoon: true,
    deliveryDays: "", img: "", views: 0, addToCart: 0,
  },
];

const DEFAULT_SETTINGS = {
  festivalBanner: "🪔 Diwali Sale — Flat 20% Off Storewide",
  heroMode: "2D",
  whatsappNumber: "919999999999",
  upiId: "kurtifyhub@upi",
  defaultDeliveryDays: "4-6 days",
  adminPassword: "kurtify2026",
  gokwikEnabled: false,
  gokwikMerchantId: "",
  courierPartner: "",
};

function getDeliveryText(product, settings) {
  return (product && product.deliveryDays) ? product.deliveryDays : settings.defaultDeliveryDays;
}

// Works two ways:
// 1) Inside Claude's environment — uses window.storage (shared across everyone testing here).
// 2) After you deploy on Vercel — window.storage won't exist there, so it
//    automatically falls back to the browser's localStorage. NOTE: localStorage
//    only saves data on THAT one device/browser — it does NOT sync between
//    your customers and you. For a real multi-customer store you'll want to
//    swap this for Firebase/Supabase later (ping me when you're ready).
async function loadKey(key, fallback, shared = true) {
  try {
    if (typeof window !== "undefined" && window.storage) {
      const res = await window.storage.get(key, shared);
      return res ? JSON.parse(res.value) : fallback;
    }
  } catch { /* fall through to localStorage */ }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
async function saveKey(key, value, shared = true) {
  try {
    if (typeof window !== "undefined" && window.storage) {
      await window.storage.set(key, JSON.stringify(value), shared);
      return;
    }
  } catch { /* fall through to localStorage */ }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("storage save failed", key, e);
  }
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [orders, setOrders] = useState([]);

  const [page, setPage] = useState("home"); // home | product | cart | checkout | tracking | admin-login | admin
  const [activeProductId, setActiveProductId] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]); // {productId, qty, size}
  const [lastOrderId, setLastOrderId] = useState(null);
  const [adminAuthed, setAdminAuthed] = useState(false);

  // Central navigation helper — always clears any stale product-link hash
  // so refreshing the page doesn't accidentally reopen an old product.
  function navigate(key) {
    window.location.hash = "";
    setPage(key);
  }

  // ---- URL hash → open a single product directly (for shareable links) ----
  useEffect(() => {
    function applyHash() {
      const hash = window.location.hash || "";
      if (hash.startsWith("#product-")) {
        const id = hash.replace("#product-", "");
        if (id) {
          setActiveProductId(id);
          setPage("product");
        }
      }
    }
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  // ---- load persisted data once ----
  useEffect(() => {
    (async () => {
      const p = await loadKey("kh:products", DEFAULT_PRODUCTS);
      const s = await loadKey("kh:settings", DEFAULT_SETTINGS);
      const o = await loadKey("kh:orders", []);
      setProducts(p);
      setSettings(s);
      setOrders(o);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) saveKey("kh:products", products); }, [products, loaded]);
  useEffect(() => { if (loaded) saveKey("kh:settings", settings); }, [settings, loaded]);
  useEffect(() => { if (loaded) saveKey("kh:orders", orders); }, [orders, loaded]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ["All", ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (category !== "All") list = list.filter((p) => p.category === category);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const hay = [p.name, p.category, ...(p.tags || [])].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [products, category, search]);

  function updateProduct(id, patch) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function addProduct(p) {
    setProducts((prev) => [...prev, { ...p, id: "p" + Date.now(), views: 0, addToCart: 0 }]);
  }
  function deleteProduct(id) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }
  function recordView(id) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, views: (p.views || 0) + 1 } : p)));
  }
  function addToCart(productId, size, qty = 1) {
    const prod = products.find((p) => p.id === productId);
    if (!prod || prod.stock <= 0 || prod.launchingSoon) return;
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, addToCart: (p.addToCart || 0) + 1 } : p)));
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === productId && c.size === size);
      const currentQty = existing ? existing.qty : 0;
      const cappedQty = Math.min(currentQty + qty, prod.stock);
      if (existing) {
        return prev.map((c) =>
          c.productId === productId && c.size === size ? { ...c, qty: cappedQty } : c
        );
      }
      return [...prev, { productId, size, qty: cappedQty }];
    });
  }
  function removeFromCart(productId, size) {
    setCart((prev) => prev.filter((c) => !(c.productId === productId && c.size === size)));
  }
  function updateCartQty(productId, size, qty) {
    setCart((prev) => prev.map((c) => (c.productId === productId && c.size === size ? { ...c, qty } : c)));
  }

  const cartDetailed = cart.map((c) => ({
    ...c,
    product: products.find((p) => p.id === c.productId),
  })).filter((c) => c.product);

  const cartTotal = cartDetailed.reduce((sum, c) => sum + c.product.price * c.qty, 0);
  const cartAllowsCOD = cartDetailed.length > 0 && cartDetailed.every((c) => c.product.cod);

  function placeOrder({ paymentMethod, name, phone, addressText, useLocation, locationText }) {
    // safety re-check: sum quantity PER PRODUCT (not per cart line) — a
    // product ordered in two sizes must not exceed its total stock combined
    const qtyRequestedByProduct = {};
    cartDetailed.forEach((c) => {
      qtyRequestedByProduct[c.productId] = (qtyRequestedByProduct[c.productId] || 0) + c.qty;
    });
    const outOfStockNow = Object.entries(qtyRequestedByProduct)
      .map(([pid, qty]) => ({ product: products.find((p) => p.id === pid), qty }))
      .filter(({ product, qty }) => !product || product.stock < qty);
    if (outOfStockNow.length > 0) {
      alert(`Kuch products ka stock kam ho gaya hai: ${outOfStockNow.map((o) => o.product?.name || "product").join(", ")}. Cart update kar ke dobara try karo.`);
      return;
    }
    const id = "KH" + Math.floor(1000 + Math.random() * 9000);
    const order = {
      id,
      items: cartDetailed.map((c) => ({
        productId: c.productId, name: c.product.name, price: c.product.price, qty: c.qty, size: c.size,
      })),
      total: cartTotal,
      paymentMethod,
      name, phone,
      address: useLocation ? (locationText || "Live location shared") : addressText,
      status: "Order Placed",
      deliveryEstimate: [...new Set(cartDetailed.map((c) => getDeliveryText(c.product, settings)))].join(", "),
      createdAt: new Date().toISOString(),
    };
    setOrders((prev) => [order, ...prev]);
    setCart([]);
    setLastOrderId(id);

    // decrease stock for each purchased item so "X left" stays accurate
    // (grouped by productId first — so if the same product was ordered in
    // multiple sizes, every unit is deducted, not just the last size's qty)
    const qtyOrderedByProduct = {};
    cartDetailed.forEach((c) => {
      qtyOrderedByProduct[c.productId] = (qtyOrderedByProduct[c.productId] || 0) + c.qty;
    });
    setProducts((prev) => prev.map((p) =>
      qtyOrderedByProduct[p.id] ? { ...p, stock: Math.max(0, p.stock - qtyOrderedByProduct[p.id]) } : p
    ));

    // Build WhatsApp message to owner (encode the WHOLE message once, so
    // emoji/spaces/₹/commas all come through correctly on every device)
    const itemsText = order.items.map((i) => `${i.name} (${i.size}) x${i.qty}`).join(", ");
    const plainMsg =
      `✅ Naya Order #${id}\n` +
      `${itemsText}\n` +
      `Total: ₹${order.total}\n` +
      `Payment: ${paymentMethod}\n` +
      `Customer: ${name}, ${phone}\n` +
      `Address: ${order.address}`;
    const ownerNumber = settings.whatsappNumber.replace(/\D/g, "");
    const waUrl = `https://wa.me/${ownerNumber}?text=${encodeURIComponent(plainMsg)}`;
    window.open(waUrl, "_blank");

    setPage("tracking");
  }

  function updateOrderStatus(id, status) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }
  function cancelOrder(id) {
    const order = orders.find((o) => o.id === id);
    if (order) {
      // same grouping fix as placeOrder — restore full quantity per product,
      // even if the order had that product in more than one size
      const qtyToRestoreByProduct = {};
      order.items.forEach((item) => {
        if (item.productId) {
          qtyToRestoreByProduct[item.productId] = (qtyToRestoreByProduct[item.productId] || 0) + item.qty;
        }
      });
      setProducts((prev) => prev.map((p) =>
        qtyToRestoreByProduct[p.id] ? { ...p, stock: p.stock + qtyToRestoreByProduct[p.id] } : p
      ));
    }
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "Cancelled" } : o)));
  }

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Georgia, serif", color: BRAND.maroon }}>
        Loading Kurtify Hub…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#efece6", fontFamily: "Georgia, 'Times New Roman', serif", color: "#2b2b2b" }}>
      <TopBrand settings={settings} />
      <Nav
        page={page} setPage={navigate}
        cartCount={cart.reduce((s, c) => s + c.qty, 0)}
        adminAuthed={adminAuthed}
      />

      {page === "home" && (
        <Home
          settings={settings}
          categories={categories}
          category={category} setCategory={setCategory}
          search={search} setSearch={setSearch}
          products={filteredProducts}
          onOpenProduct={(id) => { setActiveProductId(id); recordView(id); setPage("product"); window.location.hash = `product-${id}`; }}
          onAddToCart={(id) => addToCart(id, "M", 1)}
        />
      )}

      {page === "product" && activeProductId && (
        <ProductPage
          product={products.find((p) => p.id === activeProductId)}
          settings={settings}
          onAddToCart={(size, qty) => { addToCart(activeProductId, size, qty); setPage("cart"); window.location.hash = ""; }}
          onBack={() => navigate("home")}
        />
      )}

      {page === "cart" && (
        <CartPage
          items={cartDetailed}
          total={cartTotal}
          settings={settings}
          onRemove={removeFromCart}
          onUpdateQty={updateCartQty}
          onCheckout={() => setPage("checkout")}
          onBack={() => navigate("home")}
        />
      )}

      {page === "checkout" && (
        <CheckoutPage
          items={cartDetailed}
          total={cartTotal}
          codAllowed={cartAllowsCOD}
          upiId={settings.upiId}
          settings={settings}
          onPlaceOrder={placeOrder}
          onBack={() => setPage("cart")}
        />
      )}

      {page === "tracking" && (
        <TrackingPage orders={orders} highlightId={lastOrderId} onCancelOrder={cancelOrder} />
      )}

      {page === "admin-login" && (
        <AdminLogin
          correctPassword={settings.adminPassword}
          onSuccess={() => { setAdminAuthed(true); navigate("admin"); }}
        />
      )}

      {page === "admin" && adminAuthed && (
        <AdminPanel
          products={products}
          settings={settings}
          orders={orders}
          onUpdateProduct={updateProduct}
          onAddProduct={addProduct}
          onDeleteProduct={deleteProduct}
          onUpdateSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          onUpdateOrderStatus={updateOrderStatus}
          onLogout={() => { setAdminAuthed(false); navigate("home"); }}
        />
      )}

      {["about", "contact", "privacy", "terms", "shipping", "returns"].includes(page) && (
        <InfoPage page={page} settings={settings} onBack={() => navigate("home")} />
      )}

      <SiteFooter setPage={navigate} settings={settings} />
    </div>
  );
}

/* ---------------- Shared bits ---------------- */

const LOGO_DATA_URI = "data:image/png;base64,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njt79HU/8Ce//PtvOn128zX/7tP/x499xRc+41HTNKml9cGxv3nDe77yW//nP/zze+911akXf90zb7n97I2n757qDxf3XCVtNO+q14IHyJy6/NQDHnjfd731XX5AXHPdLZ/+pEc++MH3fsVr37wOD44QZcvQR03hC9/NaYTB/KLg3GaZVtOznvxxpSgkG9I0pc1s52643lf2LXcciWC7me84uz1acPPthytge26esogQeQLoQ+5plaYsZVYzrEgF3byvxNHoJ5eMtkNaLzmtRCLuBl4O9NGwDxUL/6EGpLR5zFokGRshZKLEwJDYVn3potEhL6penToQWqwjlE25W+lSO6uiNekXMGb820m4g0PAtaQ9Coh0sSRfrzvxTJTFdI6LQpr9mZA947Man/rN17w3OXxtz2xKlCllf2cC25MsQKElcmLal7Qi19OUmdSsqCoskxuomh2WZTGdq9uxqrn+aDZVN6Vzoxcbz5d6dDlE5nk6DDOrLrasxJ3OMKI/2faiOSXx49i3X84SwHe3AKlbsY6Tk0QekEg4nU3kceE1H771F3/vjTfcfPdzn/HI//a9z/665z7k5ErnWfcOLt7o3k/9yl/8x5f+2i233fWMJz/8137gs7/k0+73rGc+7va7y9ved527lQ9a4Nrt9MkGjVyAK6+68tJTl1zz3g8IMQMbtbe944Mv+94vvfpDt7z/6hv2ejXr1NWIDnNJnABj5GTLn0nAHXee//xnPepgldVM0h6Meycvvfmaj6ylFC2n79qe3ejZo2U2lGK20QMRWef9/XzbufnM0VbVVklIQWJKaWUoHkBAJE9Wqd7UiQIP8YtZnJVufkIbDp2uK4tyTNDjjEab6yCprNwdUySRkySKOH94X7LCSs85dM0bNqYAZ1OtU6uWOeFavF3pKS+4Btv2S7UqDu9Pg/tWS/U18czgdEqy1t1sZkt4HGkDgvwaHI2inKju1t2+OKR+28ReCbQ/904psFAJPqlX6quU9nJyyfzWJczAWiSTh2VxT7TF1A1Cq5E2FtM5Emb6GLMlQ5WowTlGjddg+RbkSttxA+mDde4woVU4aHnVa3pk4XhrRryUmpArCVLY/koMPNIwFLjj7OYpT3nkz730Wd/yJY+4z+UHm8NNoq6PHX/9O2762u/4lV//36+6x2UXff83f86PPP/Rlx/gaKuXHFt97tMf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gWjbzl1PPbn3phfefGDfvsFgeNHlV1x3/XUphBMnjq+eWXVq4ewzh4/c9d27f+lXfumTf/FRBCCgHrRSBAy9jg2RTudK46dhw5ymBsOt27efPn3mLW972+HDh++5555dF19y1z33HT50cOH06Ut3nPPM0aPbL7xw2DaHDh8997xzQggIcuPNt7zwllv+6I/+8OChgzvOO2/Pww8feeaZN7/1LdPT03see1Q0JFiglsxgJS/AXMZX86oAuO/pfYcPH3zm2IlXvubihbNnBlNTw3awsLhwznnn3/ov/zI1Ozuzao7adtjNPPbYYxdf/axjp86s37jl2LFj1z3/+Xseemjjpo3bzz2PKDzy0O4jx0/svOSSh3fvFqKH9jz6E+959zdv/Upje/zM8shfN2RXR5hZtfW88778hS++4AU3rlq1auM550yvWtUOh3vuv384PXXs0KH1mzc//2Uvvu6GG06dPt0O2m/t33/B5ZefOnZ0LHJmMt66c9fG7TsuvuSSv//c3+4/fHjzOeeGttlxwYU7zj//W9+6/TWve/2VV1711FNP3XbrN3ds27awvHjOrl1r5uf+/m//9o1veuPM7Gzq4u677gaRYWhywOswNPpINYiNYAKJhi+DiU0V1dhqL2SOuKjPGn8TBKvN6Aqqb4W+yQ1gRoxD0TyIgcFJ6+dnT88tpRiT4i049jTB0lnYGzIqZN/sydHdI1lyzX3Pu4d0F/ARQa1A/J7S2owLtWWs8GonIufu2rk8GqXx5IKLLlo4c+biKy9/7OFHBsNhE8LC4iLEuPOinceOHJ1EpnawsHDmvnvvu/jii170khc/+tDDq1evFuYzJ06eXViYXr92y5ZNB/c+fXD/gTXr1z587wNXXH3V4w89DF2s0WBaG8+vnp6baQ8dOkuE5mxGPVMw76amp2fOufTi/fv2nXPB+QAyaAYX7rzw1n/64rbzz3n8O3ev37Tppte/7t577+3Go5nZVdu3b3/mwMHdD+++YOdFKJyEA9Hhgwdf8vKX7n3yqaNHjjSIRw8fWTh5iijfhZVQFpFZ1qyZWjM/fPzp01QKDZ+mULjs2qufeebotu3bTp46teuinadPnzl75uwll17y7a99Y83aNXMzM5vOPffo0aObd2z71pduXT5+4vkve+mV11//T//4j5dedukzBw5wF8ddt3rjxrYJp44cOXLg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";

function TopBrand({ settings }) {
  return (
    <div style={{ textAlign: "center", padding: "16px 10px 10px", background: "#fff", borderBottom: `1px solid ${BRAND.line}` }}>
      <img src={LOGO_DATA_URI} alt="Kurtify Hub logo" style={{ height: 80, marginBottom: 4 }} />
      <div style={{ fontSize: 30, fontStyle: "italic" }}>
        <span style={{ color: "#9a9a9a" }}>Kurtify</span>{" "}
        <span style={{ color: BRAND.goldDeep }}>Hub</span>
      </div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#6b6b6b" }}>
        Your <span style={{ color: BRAND.goldDeep }}>Own</span> Kurti
      </div>
    </div>
  );
}

function Nav({ page, setPage, cartCount, adminAuthed }) {
  const item = (label, key) => (
    <button
      onClick={() => setPage(key)}
      style={{
        border: "none", background: "none", cursor: "pointer",
        fontFamily: "'Courier New', monospace", fontSize: 11,
        color: page === key ? BRAND.maroon : "#8a8478",
        fontWeight: page === key ? "bold" : "normal",
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 20, alignItems: "center", padding: "10px 12px", background: BRAND.cream, borderBottom: `1px solid ${BRAND.line}` }}>
      {item("HOME", "home")}
      {item(`CART (${cartCount})`, "cart")}
      {item("TRACK ORDER", "tracking")}
      {item(adminAuthed ? "ADMIN" : "ADMIN LOGIN", adminAuthed ? "admin" : "admin-login")}
    </div>
  );
}

function Badge({ children, bg, color = "#fff", offset = 0 }) {
  return (
    <span style={{
      position: "absolute", top: 6 + offset * 20, left: 6, fontFamily: "'Courier New', monospace",
      fontSize: 9, padding: "3px 6px", borderRadius: 4, fontWeight: "bold",
      background: bg, color,
    }}>{children}</span>
  );
}

function ProductImg({ img, height = 140 }) {
  return (
    <div style={{
      height, background: img ? `url(${img}) center/cover` : "repeating-linear-gradient(45deg,#f1ece0,#f1ece0 6px,#e8e0cd 6px,#e8e0cd 12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Courier New', monospace", fontSize: 9, color: "#a89a78", position: "relative",
    }}>
      {!img && "PRODUCT IMAGE"}
    </div>
  );
}

/* ---------------- Home ---------------- */

function Home({ settings, categories, category, setCategory, search, setSearch, products, onOpenProduct, onAddToCart }) {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div style={{ padding: "8px 12px", background: BRAND.cream, borderBottom: `1px solid ${BRAND.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${BRAND.line}`, borderRadius: 20, padding: "8px 14px" }}>
          <span>🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search — "short kurti", "maroon", "trendy"...'
            style={{ border: "none", outline: "none", fontFamily: "'Courier New', monospace", fontSize: 12, flex: 1, background: "transparent" }}
          />
        </div>
      </div>

      <div style={{ background: BRAND.goldDeep, color: "#fff", textAlign: "center", fontFamily: "'Courier New', monospace", fontSize: 11, padding: 6, letterSpacing: 1 }}>
        {settings.festivalBanner}
      </div>

      <div style={{ background: "linear-gradient(160deg,#faf6ee,#f1e9d8)", padding: "26px 14px", textAlign: "center" }}>
        <h1 style={{ color: BRAND.maroon, fontStyle: "italic", margin: "0 0 6px" }}>Your Own Kurti</h1>
        <p style={{ fontSize: 12, color: "#8a8478", margin: "0 0 10px" }}>Jaipur craft, Gen-Z fit — hero shown in {settings.heroMode} mode</p>
      </div>

      <div style={{ display: "flex", gap: 8, padding: 12, overflowX: "auto" }}>
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)} style={{
            flex: "none", border: `1px solid ${BRAND.maroon}`, background: category === c ? BRAND.maroon : "transparent",
            color: category === c ? "#fff" : BRAND.maroon, fontFamily: "'Courier New', monospace", fontSize: 10,
            padding: "6px 12px", borderRadius: 16, whiteSpace: "nowrap", cursor: "pointer",
          }}>{c}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 12px 20px" }}>
        {products.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#8a8478", fontSize: 12, padding: 20 }}>
            Koi product nahi mila. Kuch aur search karke dekho.
          </div>
        )}
        {products.map((p) => {
          const discount = p.mrp > p.price ? Math.round(100 - (p.price / p.mrp) * 100) : 0;
          return (
            <div key={p.id} style={{ background: BRAND.cream, border: `1px solid ${BRAND.line}`, borderRadius: 8, overflow: "hidden", cursor: "pointer" }}
              onClick={() => onOpenProduct(p.id)}>
              <div style={{ position: "relative" }}>
                <ProductImg img={p.img} height={110} />
                {discount > 0 && <Badge bg="#a1382f" offset={0}>{discount}% OFF</Badge>}
                {p.launchingSoon && <Badge bg="#2a4d6e" offset={discount > 0 ? 1 : 0}>LAUNCHING SOON</Badge>}
                {!p.launchingSoon && p.stock === 0 && <Badge bg="#999" offset={discount > 0 ? 1 : 0}>OUT OF STOCK</Badge>}
                {!p.launchingSoon && p.stock > 0 && p.stock <= 3 && (
                  <span style={{ position: "absolute", top: 6, right: 6, background: "#b8863a", color: "#fff", fontFamily: "'Courier New', monospace", fontSize: 9, padding: "3px 6px", borderRadius: 4, fontWeight: "bold" }}>
                    {p.stock} LEFT
                  </span>
                )}
              </div>
              <div style={{ padding: 8 }}>
                <div style={{ fontSize: 11, marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: BRAND.maroon, fontFamily: "'Courier New', monospace", fontWeight: "bold" }}>
                  ₹{p.price}{p.mrp > p.price && <span style={{ textDecoration: "line-through", color: "#b0a890", fontSize: 9, marginLeft: 4, fontWeight: "normal" }}>₹{p.mrp}</span>}
                </div>
                {p.launchingSoon ? (
                  <div style={{ marginTop: 6, textAlign: "center", fontFamily: "'Courier New', monospace", fontSize: 9, padding: 5, borderRadius: 4, border: `1px dashed ${BRAND.goldDeep}`, color: BRAND.goldDeep }}>
                    NOTIFY ME
                  </div>
                ) : p.stock === 0 ? (
                  <div style={{ marginTop: 6, textAlign: "center", fontFamily: "'Courier New', monospace", fontSize: 9, padding: 5, borderRadius: 4, background: "#e5e0d3", color: "#999" }}>
                    OUT OF STOCK
                  </div>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); onAddToCart(p.id); }} style={{
                    marginTop: 6, width: "100%", textAlign: "center", fontFamily: "'Courier New', monospace", fontSize: 9,
                    padding: 6, borderRadius: 4, background: BRAND.maroon, color: "#fff", border: "none", cursor: "pointer",
                  }}>ADD TO CART</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Product Page ---------------- */

function ProductPage({ product, settings, onAddToCart, onBack }) {
  const [size, setSize] = useState("M");
  const [qty, setQty] = useState(1);
  if (!product) {
    return (
      <div style={{ maxWidth: 480, margin: "40px auto", background: "#fff", padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#8a8478", marginBottom: 14 }}>Ye product ab available nahi hai — ho sakta hai remove ho gaya ho.</div>
        <button onClick={onBack} style={{ padding: "10px 20px", borderRadius: 20, background: BRAND.maroon, color: "#fff", border: "none", fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer" }}>← Back to Home</button>
      </div>
    );
  }
  const discount = product.mrp > product.price ? Math.round(100 - (product.price / product.mrp) * 100) : 0;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", background: "#fff" }}>
      <button onClick={onBack} style={{ margin: 10, border: "none", background: "none", color: BRAND.maroon, fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer" }}>← Back</button>
      <ProductImg img={product.img} height={220} />
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 16 }}>{product.name}</div>
        <div style={{ fontSize: 15, color: BRAND.maroon, fontFamily: "'Courier New', monospace", fontWeight: "bold", margin: "6px 0" }}>
          ₹{product.price} {discount > 0 && <span style={{ textDecoration: "line-through", color: "#b0a890", fontSize: 11, marginLeft: 6, fontWeight: "normal" }}>₹{product.mrp}</span>}
          <span style={{ fontSize: 9, color: "#8a8478", fontWeight: "normal", marginLeft: 6 }}>(incl. of all taxes)</span>
        </div>

        <div style={{ margin: "10px 0" }}>
          <div style={{ fontSize: 11, color: "#8a8478", marginBottom: 6 }}>Size</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["S", "M", "L", "XL"].map((s) => (
              <button key={s} onClick={() => setSize(s)} style={{
                width: 36, height: 36, borderRadius: "50%", border: `1px solid ${BRAND.maroon}`,
                background: size === s ? BRAND.maroon : "transparent", color: size === s ? "#fff" : BRAND.maroon,
                cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: 11,
              }}>{s}</button>
            ))}
          </div>
        </div>

        {!product.launchingSoon && product.stock > 0 && (
          <div style={{ margin: "10px 0" }}>
            <div style={{ fontSize: 11, color: "#8a8478", marginBottom: 6 }}>Quantity</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={qtyBtnStyle}>−</button>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 13 }}>{qty}</span>
              <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))} style={qtyBtnStyle}>+</button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: "#8a8478", margin: "10px 0" }}>
          🚚 Delivery in {getDeliveryText(product, settings)}<br />
          {product.cod ? "✅ Cash on Delivery available" : "❌ COD not available for this product"}<br />
          {product.returnable ? `✅ Returnable within ${product.returnDays} days` : "❌ Not returnable"}
        </div>

        {product.launchingSoon ? (
          <div style={{ textAlign: "center", fontFamily: "'Courier New', monospace", fontSize: 11, padding: 10, borderRadius: 6, border: `1px dashed ${BRAND.goldDeep}`, color: BRAND.goldDeep }}>
            Launching Soon — Notify me when available
          </div>
        ) : product.stock === 0 ? (
          <div style={{ textAlign: "center", fontFamily: "'Courier New', monospace", fontSize: 11, padding: 10, borderRadius: 6, background: "#e5e0d3", color: "#999" }}>
            Out of Stock
          </div>
        ) : (
          <button onClick={() => onAddToCart(size, qty)} style={{
            width: "100%", textAlign: "center", fontFamily: "'Courier New', monospace", fontSize: 12,
            padding: 12, borderRadius: 24, background: BRAND.maroon, color: "#fff", border: "none", cursor: "pointer", marginTop: 6,
          }}>ADD TO CART</button>
        )}
      </div>
    </div>
  );
}

const qtyBtnStyle = {
  width: 30, height: 30, borderRadius: "50%", border: `1px solid ${BRAND.maroon}`,
  background: "transparent", color: BRAND.maroon, fontSize: 16, cursor: "pointer", lineHeight: 1,
};

/* ---------------- Cart ---------------- */

function CartPage({ items, total, settings, onRemove, onUpdateQty, onCheckout, onBack }) {
  // total already-in-cart qty per product (across all sizes), so the "+"
  // button never lets combined quantity for a product exceed its stock
  const qtyByProduct = {};
  items.forEach((c) => { qtyByProduct[c.productId] = (qtyByProduct[c.productId] || 0) + c.qty; });

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", background: "#fff", padding: 14 }}>
      <button onClick={onBack} style={{ border: "none", background: "none", color: BRAND.maroon, fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer", marginBottom: 10 }}>← Continue Shopping</button>
      <h2 style={{ color: BRAND.maroon, fontStyle: "italic", margin: "0 0 12px" }}>Your Cart</h2>
      {items.length === 0 && <div style={{ color: "#8a8478", fontSize: 12 }}>Cart khali hai.</div>}
      {items.map((c, i) => {
        const totalForThisProduct = qtyByProduct[c.productId] || c.qty;
        const canIncrease = totalForThisProduct < c.product.stock;
        return (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${BRAND.line}` }}>
          <div style={{ width: 56 }}><ProductImg img={c.product.img} height={56} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12 }}>{c.product.name}</div>
            <div style={{ fontSize: 11, color: "#8a8478" }}>Size: {c.size}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
              <button onClick={() => onUpdateQty(c.productId, c.size, Math.max(1, c.qty - 1))} style={{ ...qtyBtnStyle, width: 22, height: 22, fontSize: 13 }}>−</button>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 12 }}>{c.qty}</span>
              <button
                disabled={!canIncrease}
                onClick={() => canIncrease && onUpdateQty(c.productId, c.size, c.qty + 1)}
                style={{ ...qtyBtnStyle, width: 22, height: 22, fontSize: 13, opacity: canIncrease ? 1 : 0.35, cursor: canIncrease ? "pointer" : "not-allowed" }}
              >+</button>
            </div>
            <div style={{ fontSize: 12, color: BRAND.maroon, fontFamily: "'Courier New', monospace" }}>₹{c.product.price * c.qty}</div>
            <div style={{ fontSize: 10, color: "#8a8478" }}>🚚 {getDeliveryText(c.product, settings)}</div>
          </div>
          <button onClick={() => onRemove(c.productId, c.size)} style={{ border: "none", background: "none", color: "#a1382f", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        );
      })}
      {items.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", fontSize: 14, fontWeight: "bold", color: BRAND.maroon }}>
            <span>Total</span><span>₹{total}</span>
          </div>
          <button onClick={onCheckout} style={{
            width: "100%", padding: 12, borderRadius: 24, background: BRAND.maroon, color: "#fff",
            border: "none", fontFamily: "'Courier New', monospace", fontSize: 12, cursor: "pointer",
          }}>PROCEED TO CHECKOUT</button>
        </>
      )}
    </div>
  );
}

/* ---------------- Checkout ---------------- */

function CheckoutPage({ items, total, codAllowed, upiId, settings, onPlaceOrder, onBack }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressText, setAddressText] = useState("");
  const [useLocation, setUseLocation] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [locating, setLocating] = useState(false);

  function handlePlace() {
    const cleanName = name.trim();
    const cleanAddress = addressText.trim();
    if (!cleanName || !phone || (!cleanAddress && !useLocation)) {
      alert("Naam, phone aur address/location bharo.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      alert("Sahi 10-digit phone number daalo — isi se order track aur WhatsApp update hoga.");
      return;
    }

    if (useLocation) {
      if (!navigator.geolocation) {
        alert("Is device/browser mein location access available nahi hai. 'Share live location' ka checkbox hata ke address type karo.");
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false);
          const mapsLink = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
          onPlaceOrder({ paymentMethod, name: cleanName, phone, addressText: cleanAddress, useLocation, locationText: `📍 Live location: ${mapsLink}` });
        },
        () => {
          setLocating(false);
          alert("Location access nahi mila. Location allow karo ya checkbox hata ke address type karo.");
        },
        { timeout: 10000 }
      );
      return;
    }

    onPlaceOrder({
      paymentMethod,
      name: cleanName, phone,
      addressText: cleanAddress,
      useLocation,
      locationText: "",
    });
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", background: "#fff", padding: 14 }}>
      <button onClick={onBack} style={{ border: "none", background: "none", color: BRAND.maroon, fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer", marginBottom: 10 }}>← Back to Cart</button>
      <h2 style={{ color: BRAND.maroon, fontStyle: "italic", margin: "0 0 12px" }}>Checkout</h2>

      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></Field>
      <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} /></Field>

      <div style={{ margin: "10px 0" }}>
        <label style={{ fontSize: 11, color: "#8a8478", display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={useLocation} onChange={(e) => setUseLocation(e.target.checked)} />
          Share live location instead of typing address
        </label>
      </div>
      {!useLocation && (
        <Field label="Address">
          <textarea value={addressText} onChange={(e) => setAddressText(e.target.value)} style={{ ...inputStyle, height: 60 }} />
        </Field>
      )}

      <div style={{ margin: "14px 0" }}>
        <div style={{ fontSize: 11, color: "#8a8478", marginBottom: 6 }}>Payment Method</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setPaymentMethod("UPI")} style={payBtn(paymentMethod === "UPI")}>UPI / QR</button>
          <button disabled={!codAllowed} onClick={() => setPaymentMethod("COD")} style={{ ...payBtn(paymentMethod === "COD"), opacity: codAllowed ? 1 : 0.4 }}>
            Cash on Delivery {!codAllowed && "(not available)"}
          </button>
        </div>
      </div>

      {paymentMethod === "UPI" && (
        <div style={{ textAlign: "center", padding: 14, border: `1px dashed ${BRAND.goldDeep}`, borderRadius: 8, margin: "10px 0" }}>
          <div style={{ fontSize: 11, color: "#8a8478" }}>Pay to UPI ID</div>
          <div style={{ fontSize: 14, color: BRAND.maroon, fontFamily: "'Courier New', monospace", fontWeight: "bold" }}>{upiId}</div>
          <div style={{ fontSize: 9, color: "#8a8478", marginTop: 4 }}>(QR code image goes here once you upload it in Admin → Settings)</div>
        </div>
      )}

      <div style={{ fontSize: 11, color: "#8a8478", margin: "6px 0" }}>
        🚚 Estimated delivery: {items.map((c) => getDeliveryText(c.product, settings)).join(", ")}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 14, fontWeight: "bold", color: BRAND.maroon }}>
        <span>Total</span><span>₹{total}</span>
      </div>

      <button onClick={handlePlace} disabled={locating} style={{
        width: "100%", padding: 12, borderRadius: 24, background: BRAND.maroon, color: "#fff",
        border: "none", fontFamily: "'Courier New', monospace", fontSize: 12, cursor: locating ? "wait" : "pointer", opacity: locating ? 0.6 : 1,
      }}>{locating ? "Getting location…" : "CONFIRM ORDER"}</button>
      <div style={{ fontSize: 9, color: "#8a8478", marginTop: 8, textAlign: "center" }}>
        Order confirm hote hi WhatsApp khulega — owner ko order details ka message ready milega.
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: "#8a8478", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
const inputStyle = { width: "100%", padding: 8, border: `1px solid ${BRAND.line}`, borderRadius: 6, fontFamily: "Georgia, serif", fontSize: 13 };
function payBtn(active) {
  return {
    flex: 1, padding: 10, borderRadius: 6, border: `1px solid ${BRAND.maroon}`,
    background: active ? BRAND.maroon : "transparent", color: active ? "#fff" : BRAND.maroon,
    fontFamily: "'Courier New', monospace", fontSize: 10, cursor: "pointer",
  };
}

/* ---------------- Tracking ---------------- */

function TrackingPage({ orders, highlightId, onCancelOrder }) {
  const steps = ["Order Placed", "Shipped", "Out for Delivery", "Delivered"];
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState(false);

  const cleanPhone = phone.replace(/\D/g, "");
  const myOrders = cleanPhone.length >= 10
    ? orders.filter((o) => o.phone.replace(/\D/g, "").endsWith(cleanPhone.slice(-10)))
    : [];

  function handleSearch() {
    if (cleanPhone.length < 10) {
      alert("Sahi 10-digit phone number daalo.");
      return;
    }
    setSearched(true);
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", background: "#fff", padding: 14 }}>
      <h2 style={{ color: BRAND.maroon, fontStyle: "italic", margin: "0 0 12px" }}>Track Order</h2>
      <div style={{ fontSize: 11, color: "#8a8478", marginBottom: 8 }}>Apna order dekhne ke liye wahi phone number daalo jo order karte waqt diya tha.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Phone number" style={inputStyle} />
        <button onClick={handleSearch} style={{ padding: "0 16px", borderRadius: 6, background: BRAND.maroon, color: "#fff", border: "none", fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer" }}>Search</button>
      </div>

      {searched && myOrders.length === 0 && <div style={{ color: "#8a8478", fontSize: 12 }}>Is number se koi order nahi mila.</div>}

      {(searched ? myOrders : orders.filter((o) => o.id === highlightId)).map((o) => {
        const stepIndex = steps.indexOf(o.status);
        const canCancel = o.status === "Order Placed";
        return (
          <div key={o.id} style={{
            border: `1px solid ${BRAND.line}`, borderRadius: 8, padding: 12, marginBottom: 10,
            background: o.id === highlightId ? "#faf6ee" : "#fff",
          }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, fontWeight: "bold", color: BRAND.maroon }}>#{o.id}</div>
            <div style={{ fontSize: 11, color: "#8a8478", margin: "4px 0" }}>{o.items.map((i) => `${i.name} x${i.qty}`).join(", ")}</div>
            <div style={{ fontSize: 12, fontWeight: "bold" }}>₹{o.total} · {o.paymentMethod}</div>
            {o.status === "Cancelled" && <div style={{ fontSize: 11, color: "#a1382f", fontWeight: "bold", marginTop: 4 }}>❌ Order Cancelled</div>}
            {o.deliveryEstimate && o.status !== "Cancelled" && <div style={{ fontSize: 10, color: "#8a8478" }}>🚚 Estimated delivery: {o.deliveryEstimate}</div>}
            {o.status !== "Cancelled" && (
            <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
              {steps.map((s, i) => (
                <div key={s} style={{ flex: 1 }}>
                  <div style={{ height: 4, borderRadius: 2, background: i <= stepIndex ? BRAND.maroon : "#e5e0d3" }} />
                  <div style={{ fontSize: 8, color: i <= stepIndex ? BRAND.maroon : "#b0a890", marginTop: 3, textAlign: "center" }}>{s}</div>
                </div>
              ))}
            </div>
            )}
            {canCancel && (
              <button onClick={() => window.confirm("Order cancel karein?") && onCancelOrder(o.id)} style={{
                marginTop: 10, padding: "6px 12px", borderRadius: 6, border: "1px solid #a1382f", background: "transparent",
                color: "#a1382f", fontFamily: "'Courier New', monospace", fontSize: 10, cursor: "pointer",
              }}>Cancel Order</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Admin Login ---------------- */

function AdminLogin({ correctPassword, onSuccess }) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");

  function tryLogin() {
    if (pwd === correctPassword) onSuccess();
    else setError("Galat password.");
  }

  return (
    <div style={{ maxWidth: 360, margin: "40px auto", background: "#fff", padding: 20, borderRadius: 8, border: `1px solid ${BRAND.line}` }}>
      <h2 style={{ color: BRAND.maroon, fontStyle: "italic", textAlign: "center" }}>Admin Login</h2>
      <input
        type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && tryLogin()}
        placeholder="Password" style={inputStyle} autoFocus
      />
      {error && <div style={{ color: "#a1382f", fontSize: 11, marginTop: 6 }}>{error}</div>}
      <button onClick={tryLogin} style={{
        width: "100%", marginTop: 10, padding: 10, borderRadius: 6, background: BRAND.maroon, color: "#fff",
        border: "none", fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer",
      }}>LOGIN</button>
    </div>
  );
}

/* ---------------- Admin Panel ---------------- */

function AdminPanel({ products, settings, orders, onUpdateProduct, onAddProduct, onDeleteProduct, onUpdateSettings, onUpdateOrderStatus, onLogout }) {
  const [tab, setTab] = useState("products"); // products | orders | settings | analytics

  const totalViews = products.reduce((s, p) => s + (p.views || 0), 0);
  const totalCarts = products.reduce((s, p) => s + (p.addToCart || 0), 0);
  const trending = [...products].sort((a, b) => (b.addToCart || 0) - (a.addToCart || 0))[0];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", background: "#fff", padding: 16, border: `1px solid ${BRAND.line}`, borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ color: BRAND.maroon, fontStyle: "italic", margin: 0 }}>Admin Panel</h2>
        <button onClick={onLogout} style={{ border: "none", background: "none", color: "#a1382f", fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer" }}>Logout</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["products", "orders", "settings", "analytics"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "6px 14px", borderRadius: 16, border: `1px solid ${BRAND.maroon}`,
            background: tab === t ? BRAND.maroon : "transparent", color: tab === t ? "#fff" : BRAND.maroon,
            fontFamily: "'Courier New', monospace", fontSize: 10, cursor: "pointer", textTransform: "uppercase",
          }}>{t}</button>
        ))}
      </div>

      {tab === "analytics" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <StatCard num={totalViews} label="TOTAL PRODUCT VIEWS" />
          <StatCard num={totalCarts} label="TOTAL ADD TO CART" />
          <StatCard num={trending ? trending.name : "—"} label="TOP TRENDING" small />
        </div>
      )}

      {tab === "products" && (
        <ProductsAdmin products={products} onUpdateProduct={onUpdateProduct} onAddProduct={onAddProduct} onDeleteProduct={onDeleteProduct} />
      )}

      {tab === "orders" && (
        <OrdersAdmin orders={orders} onUpdateOrderStatus={onUpdateOrderStatus} />
      )}

      {tab === "settings" && (
        <SettingsAdmin settings={settings} onUpdateSettings={onUpdateSettings} />
      )}
    </div>
  );
}

function StatCard({ num, label, small }) {
  return (
    <div style={{ border: `1px solid ${BRAND.line}`, borderRadius: 8, padding: 12, background: BRAND.cream, textAlign: "center" }}>
      <div style={{ fontSize: small ? 13 : 20, color: BRAND.maroon, fontFamily: "'Courier New', monospace", fontWeight: "bold" }}>{num}</div>
      <div style={{ fontSize: 9, color: "#8a8478", fontFamily: "'Courier New', monospace" }}>{label}</div>
    </div>
  );
}

function ProductsAdmin({ products, onUpdateProduct, onAddProduct, onDeleteProduct }) {
  const [newP, setNewP] = useState({ name: "", price: "", mrp: "", category: "", tags: "", stock: "", cod: true, returnable: true, returnDays: 3, deliveryDays: "", launchingSoon: false, img: "" });

  function handleAdd() {
    if (!newP.name.trim() || !newP.price) return alert("Naam aur price bharo.");
    if (isNaN(Number(newP.price)) || Number(newP.price) <= 0) return alert("Sahi price daalo (0 se zyada number).");
    if (newP.mrp && isNaN(Number(newP.mrp))) return alert("MRP sahi number honi chahiye.");
    onAddProduct({
      name: newP.name.trim(), price: Math.max(0, Number(newP.price)), mrp: Math.max(0, Number(newP.mrp)) || Number(newP.price),
      category: newP.category.trim() || "Uncategorized",
      tags: newP.tags.split(",").map((t) => t.trim()).filter(Boolean),
      stock: Math.max(0, Number(newP.stock) || 0), cod: newP.cod, returnable: newP.returnable,
      returnDays: Math.max(0, Number(newP.returnDays) || 0), deliveryDays: newP.deliveryDays, launchingSoon: newP.launchingSoon, img: newP.img,
    });
    setNewP({ name: "", price: "", mrp: "", category: "", tags: "", stock: "", cod: true, returnable: true, returnDays: 3, deliveryDays: "", launchingSoon: false, img: "" });
  }

  return (
    <div>
      <div style={{ border: `1px dashed ${BRAND.goldDeep}`, borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: "bold", color: BRAND.maroon, marginBottom: 8 }}>+ Add New Product</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input placeholder="Name" value={newP.name} onChange={(e) => setNewP({ ...newP, name: e.target.value })} style={inputStyle} />
          <input placeholder="Category" value={newP.category} onChange={(e) => setNewP({ ...newP, category: e.target.value })} style={inputStyle} />
          <input type="number" min="0" placeholder="Price" value={newP.price} onChange={(e) => setNewP({ ...newP, price: e.target.value })} style={inputStyle} />
          <input type="number" min="0" placeholder="MRP (optional)" value={newP.mrp} onChange={(e) => setNewP({ ...newP, mrp: e.target.value })} style={inputStyle} />
          <input type="number" min="0" placeholder="Stock count" value={newP.stock} onChange={(e) => setNewP({ ...newP, stock: e.target.value })} style={inputStyle} />
          <input placeholder="Tags (comma separated)" value={newP.tags} onChange={(e) => setNewP({ ...newP, tags: e.target.value })} style={inputStyle} />
          <input placeholder='Delivery time (e.g. "3-5 days") — blank = use default' value={newP.deliveryDays} onChange={(e) => setNewP({ ...newP, deliveryDays: e.target.value })} style={inputStyle} />
          <input placeholder="Image URL (photo link)" value={newP.img} onChange={(e) => setNewP({ ...newP, img: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11 }}>
          <label><input type="checkbox" checked={newP.cod} onChange={(e) => setNewP({ ...newP, cod: e.target.checked })} /> COD</label>
          <label><input type="checkbox" checked={newP.returnable} onChange={(e) => setNewP({ ...newP, returnable: e.target.checked })} /> Returnable</label>
          <label><input type="checkbox" checked={newP.launchingSoon} onChange={(e) => setNewP({ ...newP, launchingSoon: e.target.checked })} /> Launching Soon</label>
        </div>
        <button onClick={handleAdd} style={{ marginTop: 10, padding: "8px 16px", borderRadius: 6, background: BRAND.maroon, color: "#fff", border: "none", fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer" }}>Add Product</button>
      </div>

      {products.map((p) => (
        <div key={p.id} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: "bold", fontSize: 13 }}>{p.name}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => {
                const link = `${window.location.origin}${window.location.pathname}#product-${p.id}`;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(link).then(
                    () => alert("Product link copy ho gaya:\n" + link),
                    () => alert("Copy nahi ho paya, ye link manually copy kar lo:\n" + link)
                  );
                } else {
                  alert("Ye link manually copy kar lo:\n" + link);
                }
              }} style={{ border: "none", background: "none", color: BRAND.maroon, cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: 10 }}>🔗 Copy Link</button>
              <button onClick={() => window.confirm("Delete this product?") && onDeleteProduct(p.id)} style={{ border: "none", background: "none", color: "#a1382f", cursor: "pointer" }}>Delete</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 8, fontSize: 11 }}>
            <label>Price<input type="number" min="0" value={p.price} onChange={(e) => onUpdateProduct(p.id, { price: Math.max(0, Number(e.target.value)) })} style={inputStyle} /></label>
            <label>MRP<input type="number" min="0" value={p.mrp} onChange={(e) => onUpdateProduct(p.id, { mrp: Math.max(0, Number(e.target.value)) })} style={inputStyle} /></label>
            <label>Stock<input type="number" min="0" value={p.stock} onChange={(e) => onUpdateProduct(p.id, { stock: Math.max(0, Number(e.target.value)) })} style={inputStyle} /></label>
            <label>Return Days<input type="number" min="0" value={p.returnDays} onChange={(e) => onUpdateProduct(p.id, { returnDays: Math.max(0, Number(e.target.value)) })} style={inputStyle} /></label>
          </div>
          <label style={{ display: "block", fontSize: 11, marginTop: 8 }}>Tags
            <input value={(p.tags || []).join(", ")} onChange={(e) => onUpdateProduct(p.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} style={inputStyle} />
          </label>
          <label style={{ display: "block", fontSize: 11, marginTop: 8 }}>Delivery time (blank = use default from Settings)
            <input placeholder='e.g. "3-5 days"' value={p.deliveryDays || ""} onChange={(e) => onUpdateProduct(p.id, { deliveryDays: e.target.value })} style={inputStyle} />
          </label>
          <label style={{ display: "block", fontSize: 11, marginTop: 8 }}>Image URL (photo link)
            <input placeholder="https://..." value={p.img || ""} onChange={(e) => onUpdateProduct(p.id, { img: e.target.value })} style={inputStyle} />
          </label>
          <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11 }}>
            <label><input type="checkbox" checked={p.cod} onChange={(e) => onUpdateProduct(p.id, { cod: e.target.checked })} /> COD</label>
            <label><input type="checkbox" checked={p.returnable} onChange={(e) => onUpdateProduct(p.id, { returnable: e.target.checked })} /> Returnable</label>
            <label><input type="checkbox" checked={p.launchingSoon} onChange={(e) => onUpdateProduct(p.id, { launchingSoon: e.target.checked })} /> Launching Soon</label>
          </div>
          <div style={{ fontSize: 9, color: "#8a8478", marginTop: 6 }}>👁 {p.views || 0} views · 🛒 {p.addToCart || 0} added to cart</div>
        </div>
      ))}
    </div>
  );
}

function OrdersAdmin({ orders, onUpdateOrderStatus }) {
  const steps = ["Order Placed", "Shipped", "Out for Delivery", "Delivered"];
  if (orders.length === 0) return <div style={{ color: "#8a8478", fontSize: 12 }}>Abhi tak koi order nahi hai.</div>;

  function messageCustomer(o) {
    const msg = encodeURIComponent(`Hi ${o.name}, aapka order #${o.id} ka status ab hai: ${o.status}. Total: ₹${o.total}.`);
    window.open(`https://wa.me/91${o.phone.replace(/\D/g, "").slice(-10)}?text=${msg}`, "_blank");
  }

  return (
    <div>
      {orders.map((o) => (
        <div key={o.id} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontWeight: "bold", color: BRAND.maroon }}>#{o.id} — {o.name}, {o.phone}</div>
            <div style={{ fontWeight: "bold" }}>₹{o.total}</div>
          </div>
          <div style={{ fontSize: 11, color: "#8a8478", margin: "4px 0" }}>{o.items.map((i) => `${i.name} x${i.qty}`).join(", ")}</div>
          <div style={{ fontSize: 11, color: "#8a8478" }}>{o.address}</div>
          {o.status === "Cancelled" ? (
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "#a1382f", fontWeight: "bold" }}>❌ Cancelled by customer</span>
              <button onClick={() => messageCustomer(o)} style={{
                padding: "6px 12px", borderRadius: 6, border: `1px solid ${BRAND.maroon}`, background: "transparent",
                color: BRAND.maroon, fontFamily: "'Courier New', monospace", fontSize: 10, cursor: "pointer",
              }}>💬 Message Customer (WhatsApp)</button>
            </div>
          ) : (
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select value={o.status} onChange={(e) => onUpdateOrderStatus(o.id, e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                {steps.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => messageCustomer(o)} style={{
                padding: "6px 12px", borderRadius: 6, border: `1px solid ${BRAND.maroon}`, background: "transparent",
                color: BRAND.maroon, fontFamily: "'Courier New', monospace", fontSize: 10, cursor: "pointer",
              }}>💬 Message Customer (WhatsApp)</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SettingsSection({ title, children }) {
  return (
    <div style={{ border: `1px solid ${BRAND.line}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: "bold", color: BRAND.maroon, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </div>
  );
}

function SettingsAdmin({ settings, onUpdateSettings }) {
  const [newPwd, setNewPwd] = useState("");
  const [savedField, setSavedField] = useState("");

  // Every field auto-saves on change/blur — no "local draft" that can be
  // lost if the admin switches tabs before pressing a Save button.
  function saveField(fieldName, patch) {
    onUpdateSettings(patch);
    setSavedField(fieldName);
    setTimeout(() => setSavedField((f) => (f === fieldName ? "" : f)), 1200);
  }

  const savedTick = (name) =>
    savedField === name ? <span style={{ color: "#3f7d4f", fontSize: 10, marginLeft: 6 }}>✓ Saved</span> : null;

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 9, color: "#8a8478", marginBottom: 14 }}>Har field yahan turant save hoti hai — koi alag se "Save" button dabane ki zaroorat nahi.</div>

      <SettingsSection title="Store Branding & Theme">
        <Field label={<>Hero Style {savedTick("hero")}</>}>
          <select value={settings.heroMode} onChange={(e) => saveField("hero", { heroMode: e.target.value })} style={inputStyle}>
            <option value="2D">2D Image</option>
            <option value="3D">3D Render</option>
          </select>
        </Field>
      </SettingsSection>

      <SettingsSection title="Festival Banner">
        <Field label={<>Banner Text (shows on homepage top strip) {savedTick("banner")}</>}>
          <input
            defaultValue={settings.festivalBanner}
            onBlur={(e) => saveField("banner", { festivalBanner: e.target.value })}
            style={inputStyle}
          />
        </Field>
      </SettingsSection>

      <SettingsSection title="Delivery Settings">
        <Field label={<>Default delivery time (used when a product doesn't set its own) {savedTick("delivery")}</>}>
          <input
            placeholder='e.g. "4-6 days"'
            defaultValue={settings.defaultDeliveryDays}
            onBlur={(e) => saveField("delivery", { defaultDeliveryDays: e.target.value })}
            style={inputStyle}
          />
        </Field>
        <div style={{ fontSize: 9, color: "#8a8478" }}>Har product apna alag delivery time set kar sakta hai — Products tab mein us product ko edit karo.</div>
      </SettingsSection>

      <SettingsSection title="Payment Settings">
        <Field label={<>UPI ID {savedTick("upi")}</>}>
          <input
            defaultValue={settings.upiId}
            onBlur={(e) => saveField("upi", { upiId: e.target.value })}
            style={inputStyle}
          />
        </Field>
        {settings.upiId && !settings.upiId.includes("@") && (
          <div style={{ fontSize: 9, color: "#a1382f" }}>⚠ Ye UPI ID sahi format mein nahi lag rahi (e.g. "name@bank") — customers payment nahi kar payenge.</div>
        )}
      </SettingsSection>

      <SettingsSection title="WhatsApp Settings">
        <Field label={<>WhatsApp Number (country code, no +, e.g. 919999999999) {savedTick("wa")}</>}>
          <input
            defaultValue={settings.whatsappNumber}
            onBlur={(e) => saveField("wa", { whatsappNumber: e.target.value })}
            style={inputStyle}
          />
        </Field>
        {settings.whatsappNumber && settings.whatsappNumber.replace(/\D/g, "").length < 10 && (
          <div style={{ fontSize: 9, color: "#a1382f" }}>⚠ Ye number 10 digit se kam hai — order alerts aapko nahi milenge.</div>
        )}
      </SettingsSection>

      <SettingsSection title="Delivery Partner / RTO Protection">
        <Field label={<>Courier Partner (e.g. Delhivery, Shiprocket, Ecom Express) {savedTick("courier")}</>}>
          <input
            placeholder="Not connected yet"
            defaultValue={settings.courierPartner}
            onBlur={(e) => saveField("courier", { courierPartner: e.target.value })}
            style={inputStyle}
          />
        </Field>
        <label style={{ fontSize: 11, display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={settings.gokwikEnabled}
            onChange={(e) => saveField("gokwik", { gokwikEnabled: e.target.checked })}
          />
          Enable GoKwik-style OTP checkout verification (reduces RTO)
        </label>
        {settings.gokwikEnabled && (
          <Field label={<>GoKwik Merchant ID {savedTick("gokwikid")}</>}>
            <input
              defaultValue={settings.gokwikMerchantId}
              onBlur={(e) => saveField("gokwikid", { gokwikMerchantId: e.target.value })}
              style={inputStyle}
            />
          </Field>
        )}
        <div style={{ fontSize: 9, color: "#8a8478" }}>Ye dono third-party services hain — inka apna account bana ke ID yahan daalni hogi, tabhi asal mein connect hoga.</div>
      </SettingsSection>

      <SettingsSection title="Admin Security">
        <Field label="Change Admin Password">
          <input value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Naya password" style={inputStyle} />
        </Field>
        <button
          onClick={() => {
            if (!newPwd) return;
            saveField("pwd", { adminPassword: newPwd });
            setNewPwd("");
          }}
          style={saveBtnStyle}
        >
          Save New Password
        </button>
        {savedField === "pwd" && <span style={{ color: "#3f7d4f", fontSize: 10 }}>✓ Password changed</span>}
      </SettingsSection>
    </div>
  );
}
const saveBtnStyle = {
  padding: "8px 16px", borderRadius: 6, background: BRAND.maroon, color: "#fff", border: "none",
  fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer", width: "fit-content",
};

/* ---------------- Info Pages (About / Contact / Legal) ---------------- */

const INFO_CONTENT = {
  about: {
    title: "About Us",
    body: `Kurtify Hub Jaipur ki mitti se shuru hui ek chhoti si soch hai — har kurti aapki apni pehchaan bane, isliye humara tagline hai "Your Own Kurti". Hum premium fabric, hand-finished detailing aur trend-forward designs par kaam karte hain, taaki traditional aur modern dono style ke customers ko kuch khaas mil sake.

Hum directly aapko bechte hain — bina kisi bade middleman ke — isliye price fair rehta hai aur quality par koi compromise nahi.`,
  },
  contact: {
    title: "Contact Us",
    body: `Kisi bhi order, sizing ya general query ke liye humse WhatsApp par seedha judiye — website par "Track Order" ke through ya kisi bhi product page se turant reply milega.

Business Hours: 10 AM – 7 PM (Mon–Sat)
Email: (apna business email yahan admin se add karo)
Address: (apna business address yahan admin se add karo)`,
  },
  privacy: {
    title: "Privacy Policy",
    body: `Hum sirf wahi jaankari lete hain jo order process karne ke liye zaroori hai — naam, phone number, address/location, aur order details. Ye jaankari sirf order deliver karne aur aapko updates dene ke liye use hoti hai.

Hum aapka data kisi third party ko sell nahi karte. Payment UPI ke through directly hota hai — hum card/bank details store nahi karte.

(Ye ek starting template hai — launch se pehle isko apne actual practices ke hisaab se update/finalize karwana zaroori hai.)`,
  },
  terms: {
    title: "Terms & Conditions",
    body: `Website use karke aap in terms se agree karte hain:
— Saare products ke prices aur availability bina notice ke badal sakte hain.
— Order confirm hone ke baad WhatsApp par confirmation bheja jaata hai.
— Return/exchange sirf un products par applicable hai jahan explicitly mention kiya gaya ho, aur diye gaye din ke andar.
— COD sirf select products par available hai.

(Ye starting template hai — apne business ke hisaab se customize karwao.)`,
  },
  shipping: {
    title: "Shipping Policy",
    body: `Har product par uska estimated delivery time product page aur checkout par dikhaya jaata hai. Order dispatch hone ke baad tracking update WhatsApp par bheja jaata hai.

Delivery time location aur courier availability ke hisaab se thoda aage-peeche ho sakta hai. Kisi bhi delay ki soorat mein WhatsApp par update milega.`,
  },
  returns: {
    title: "Return & Refund Policy",
    body: `Return sirf un products par available hai jahan product page par "Returnable" likha ho — us product ke specific return window (jaise 3 din) ke andar hi return accept hoga.

Return ke liye product unused, original packaging mein hona chahiye. Refund UPI ke through process kiya jaata hai order cancel/return confirm hone ke baad.

Jo products "Not Returnable" marked hain, unke liye return accept nahi kiya jaayega — ye har product page par pehle se clearly likha rehta hai.`,
  },
};

function InfoPage({ page, settings, onBack }) {
  const info = INFO_CONTENT[page];
  if (!info) return null;
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", background: "#fff", padding: 18 }}>
      <button onClick={onBack} style={{ border: "none", background: "none", color: BRAND.maroon, fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer", marginBottom: 10 }}>← Back to Home</button>
      <h2 style={{ color: BRAND.maroon, fontStyle: "italic", margin: "0 0 12px" }}>{info.title}</h2>
      <div style={{ fontSize: 12, color: "#3a3a3a", whiteSpace: "pre-line", lineHeight: 1.7 }}>
        {info.body}
        {page === "shipping" && `\n\nAbhi default delivery time: ${settings.defaultDeliveryDays}`}
      </div>
    </div>
  );
}

/* ---------------- Footer with newsletter + legal links ---------------- */

function SiteFooter({ setPage, settings }) {
  const [contact, setContact] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  async function handleSubscribe() {
    if (!contact.trim()) return;
    const existing = await loadKey("kh:subscribers", []);
    await saveKey("kh:subscribers", [...existing, { contact, at: new Date().toISOString() }]);
    setSubscribed(true);
    setContact("");
  }

  const linkStyle = { border: "none", background: "none", color: "#8a8478", fontFamily: "'Courier New', monospace", fontSize: 10, cursor: "pointer", padding: 0 };

  return (
    <footer style={{ padding: "30px 20px 50px", background: BRAND.cream, borderTop: `1px solid ${BRAND.line}`, marginTop: 20 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: BRAND.maroon, marginBottom: 8 }}>Naye arrivals aur festival offers sabse pehle paane ke liye</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="WhatsApp number ya email" style={{ ...inputStyle, maxWidth: 220 }} />
          <button onClick={handleSubscribe} style={{ padding: "0 14px", borderRadius: 6, background: BRAND.maroon, color: "#fff", border: "none", fontFamily: "'Courier New', monospace", fontSize: 10, cursor: "pointer" }}>Subscribe</button>
        </div>
        {subscribed && <div style={{ fontSize: 10, color: "#3f7d4f", marginBottom: 12 }}>Subscribe ho gaye ✓</div>}

        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <button style={linkStyle} onClick={() => setPage("about")}>About Us</button>
          <button style={linkStyle} onClick={() => setPage("contact")}>Contact Us</button>
          <button style={linkStyle} onClick={() => setPage("shipping")}>Shipping Policy</button>
          <button style={linkStyle} onClick={() => setPage("returns")}>Return & Refund</button>
          <button style={linkStyle} onClick={() => setPage("privacy")}>Privacy Policy</button>
          <button style={linkStyle} onClick={() => setPage("terms")}>Terms & Conditions</button>
        </div>

        <div style={{ fontSize: 10, color: "#9a927a", fontFamily: "'Courier New', monospace" }}>
          © Kurtify Hub — Your Own Kurti
        </div>
      </div>
    </footer>
  );
}
