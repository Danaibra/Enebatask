import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import './styles.css'

// ---------- API: every piece of content comes from the backend ----------
const cid: string = localStorage.cid || (localStorage.cid = crypto.randomUUID())
async function api<T = any>(p: string, o: { method?: string; body?: any } = {}): Promise<T> {
  const r = await fetch('/api' + p, { method: o.method || 'GET', body: o.body ? JSON.stringify(o.body) : undefined,
    headers: { 'Content-Type': 'application/json', 'X-Client': cid, ...(localStorage.tok ? { Authorization: 'Bearer ' + localStorage.tok } : {}) } })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'Request failed')
  return d
}
function useApi<T = any>(p: string) {
  const [s, set] = useState<{ d?: T; l: boolean; e?: string }>({ l: true }); const [n, setN] = useState(0)
  useEffect(() => { let ok = true; set(x => ({ ...x, l: true, e: undefined }))
    api<T>(p).then(d => ok && set({ d, l: false }), e => ok && set({ l: false, e: e.message })); return () => { ok = false } }, [p, n])
  return { ...s, reload: () => setN(x => x + 1) }
}
function Async({ r, err, skel, children }: { r: any; err: string; skel?: React.ReactNode; children: (d: any) => React.ReactNode }) {
  if (r.e) return <div className="err">{err} <button className="btn" onClick={r.reload}>Retry</button></div>
  if (!r.d) return <>{skel || <div className="skel" style={{ height: 120 }} />}</>
  return <>{children(r.d)}</>
}
const eur = (n: number) => '€' + (+n).toFixed(2)
const Skels = ({ n = 3, h = 280 }) => <div className="grid">{Array.from({ length: n }, (_, i) => <div key={i} className="skel" style={{ height: h }} />)}</div>
const C = createContext<any>(null); const useC = () => useContext(C)

// ---------- Shared components ----------
function Card({ p }: { p: any }) {
  const off = Math.round((1 - p.price / p.base) * 100)
  return <Link to={'/p/' + p.id} className="card"><div className="thumb" style={{ background: p.img }}>{off > 0 && <span className="off">-{off}%</span>}<span className="heart">♡</span></div>
    <span className="plat">{p.platform}</span><h4>{p.title}</h4>
    <div className="meta"><span>★ {p.rating}</span><span className="ok">⚡ Instant delivery</span></div>
    <div className="price"><small>From</small><b>{eur(p.price)}</b><s>{eur(p.base)}</s></div></Link>
}
function Header() {
  const { user, count, setAuth, setSearch, layout } = useC(); const [dd, setDd] = useState(false)
  return <header className="hd"><div className="wrap row">
    <Link to="/" className="logo">eneba</Link>
    <div className="cat" onMouseEnter={() => setDd(true)} onMouseLeave={() => setDd(false)}><button>☰ Catalog of games ▾</button>
      {dd && layout && <div className="mega">{layout.catalog.map((c: any) => <Link key={c.label} to={c.to} onClick={() => setDd(false)}>{c.label}</Link>)}</div>}</div>
    <div className="sb" onClick={() => setSearch(true)}>🔍<input readOnly placeholder="Search games, gift cards and more" /></div>
    <Link to="/checkout/cart" className="cart" aria-label="Cart">🛒{count > 0 && <i>{count}</i>}</Link>
    {user ? <Link to="/account" className="btn pu">👤 {user.name || user.email.split('@')[0]}</Link> : <button className="btn pu" onClick={() => setAuth('in')}>👤 Log in</button>}
  </div></header>
}
function Footer() {
  const { layout } = useC(); if (!layout) return null
  return <><div className="vp"><div className="wrap">{layout.valueProps.map((v: any) => <div key={v.title}><b>{v.icon} {v.title}</b><span>{v.sub}</span></div>)}</div></div>
    <footer className="ft"><div className="wrap row"><div><div className="logo">eneba</div><div>{layout.footer.tagline}</div><small>{layout.footer.copy}</small></div><div className="sp" />
      <nav>{layout.footer.links.map((l: string) => <a key={l} href="#">{l}</a>)}</nav></div></footer></>
}
function CheckoutHeader({ step }: { step: number }) {
  const { layout } = useC(); const L = ['Cart', 'Payment', 'Get your product']
  return <header className="hd"><div className="wrap row"><Link to="/" className="logo">eneba</Link><div className="sp" />
    <div className="step">{L.map((l, i) => <span key={l} className={i === step ? 'on' : i < step ? 'done' : ''}>{i < step ? '✓' : i + 1}. {l}</span>)}</div><div className="sp" /><span>{layout?.locale}</span></div></header>
}

// ---------- Search overlay ----------
function Search() {
  const { setSearch } = useC(); const nav = useNavigate()
  const [q, setQ] = useState(''); const [r, setR] = useState<any>(null); const [l, setL] = useState(false); const [e, setE] = useState(false)
  useEffect(() => { const k = (x: KeyboardEvent) => x.key === 'Escape' && setSearch(false); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [])
  useEffect(() => { const t = setTimeout(() => { setL(true); setE(false)
    api('/search?q=' + encodeURIComponent(q.trim().length > 1 ? q.trim() : '')).then(setR, () => setE(true)).finally(() => setL(false)) }, q.length > 1 ? 300 : 0); return () => clearTimeout(t) }, [q])
  const go = (s: string) => { setSearch(false); nav('/catalog?q=' + encodeURIComponent(s)) }
  return <div className="ov" onClick={() => setSearch(false)}><div className="mod" onClick={e => e.stopPropagation()}>
    <div className="row"><span>🔍</span><input autoFocus className="inp" value={q} placeholder="Search games, gift cards and more" onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && q && go(q)} />{l && <span>⏳</span>}<button className="btn" onClick={() => setSearch(false)}>✕</button></div>
    {e && <p className="help">Search is temporarily unavailable. Press Enter to view catalog.</p>}
    {r && !e && (r.total === 0 ? <p className="empty">No results found for '{q}'. Check your spelling or try a broader term.</p> : <>
      <h5>{r.trending ? 'TRENDING' : 'SUGGESTIONS'}</h5>{r.suggestions.map((s: string) => <div key={s} className="srow" style={{ cursor: 'pointer' }} onClick={() => go(s)}>🔍 {s}</div>)}
      <h5>PRODUCTS {!r.trending && <a className="l" style={{ color: 'var(--p)', cursor: 'pointer', float: 'right' }} onClick={() => go(q)}>View all {r.total} results ›</a>}</h5>
      {r.products.map((p: any) => <Link key={p.id} to={'/p/' + p.id} className="srow" onClick={() => setSearch(false)}><div className="t" style={{ background: p.img }} />
        <div className="sg"><span className="plat">{p.platform}</span><div>{p.title}</div></div><s style={{ color: 'var(--mu)' }}>{eur(p.base)}</s><b>{eur(p.price)}</b>›</Link>)}</>)}
  </div></div>
}

// ---------- Auth modal ----------
function Auth() {
  const { auth, setAuth, refresh } = useC(); const [tab, setTab] = useState(auth)
  const [em, setEm] = useState(''); const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [fe, setFe] = useState<any>({}); const [msg, setMsg] = useState(''); const [reset, setReset] = useState(false)
  const done = (d: any) => { localStorage.tok = d.token; refresh(); setAuth(null) }
  const submit = async (e: any) => { e.preventDefault(); setErr('')
    const f: any = {}; if (!/^\S+@\S+\.\S+$/.test(em)) f.em = 'Please enter a valid email address'; if (!reset && pw.length < 8) f.pw = 'Password must be at least 8 characters'
    setFe(f); if (f.em || f.pw) return; setBusy(true)
    try { if (reset) { await api('/auth/reset', { method: 'POST', body: { email: em } }); setMsg('If an account exists, a reset link has been sent.') }
      else done(await api('/auth/' + (tab === 'in' ? 'login' : 'register'), { method: 'POST', body: { email: em, password: pw } })) } catch (x: any) { setErr(x.message) }
    setBusy(false) }
  const google = async () => { setBusy(true); try { done(await api('/auth/google', { method: 'POST' })) } catch (x: any) { setErr(x.message) } setBusy(false) }
  return <div className="ov" onClick={() => setAuth(null)}><form className="mod c" onClick={e => e.stopPropagation()} onSubmit={submit}>
    <button type="button" className="x" onClick={() => setAuth(null)}>✕</button><div className="logo" style={{ color: 'var(--p)', textAlign: 'center' }}>eneba</div>
    {!reset && <div className="tabs"><button type="button" className={tab === 'in' ? 'on' : ''} onClick={() => { setTab('in'); setErr('') }}>Sign in</button><button type="button" className={tab === 'up' ? 'on' : ''} onClick={() => { setTab('up'); setErr('') }}>Create account</button></div>}
    <h3>{reset ? 'Reset password' : tab === 'in' ? 'Welcome back' : 'Join the game'}</h3><p style={{ color: 'var(--mu)' }}>{reset ? 'Enter your email and we will send a reset link.' : tab === 'in' ? 'Sign in to continue to your account.' : 'Create an account and start saving.'}</p>
    {err && <div className="err">{err}</div>}{msg && <div className="ok">{msg}</div>}
    {!reset && <><button type="button" className="btn full" disabled={busy} onClick={google}>G Continue with Google</button><p style={{ textAlign: 'center', color: 'var(--mu)' }}>or continue with email</p></>}
    <input className={'inp' + (fe.em ? ' bad' : '')} disabled={busy} placeholder="you@example.com" value={em} onChange={e => setEm(e.target.value)} />{fe.em && <div className="help">{fe.em}</div>}
    {!reset && <><input className={'inp' + (fe.pw ? ' bad' : '')} style={{ marginTop: 10 }} type="password" disabled={busy} placeholder="At least 8 characters" value={pw} onChange={e => setPw(e.target.value)} />{fe.pw && <div className="help">{fe.pw}</div>}
      <div className="row" style={{ margin: '12px 0' }}><label className="chk" style={{ margin: 0 }}><input type="checkbox" /> Remember me</label><span className="sp" />{tab === 'in' && <a href="#" onClick={e => { e.preventDefault(); setReset(true) }} style={{ color: 'var(--p)' }}>Forgot password?</a>}</div></>}
    <button className="btn or full" disabled={busy} style={{ marginTop: 12 }}>{busy ? '⏳' : reset ? 'SEND LINK' : tab === 'in' ? 'SIGN IN' : 'CREATE ACCOUNT'}</button>
    <small style={{ color: 'var(--mu)', display: 'block', marginTop: 12 }}>By continuing, you agree to our Terms & Conditions and Privacy Policy.</small>
  </form></div>
}

// ---------- Home ----------
function Hero({ slides }: { slides: any[] }) {
  const [i, setI] = useState(0); const nav = useNavigate()
  useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % slides.length), 6000); return () => clearInterval(t) }, [slides.length])
  const s = slides[i]
  return <div className="hero" style={{ background: s.bg }}><small>{s.tag}</small><h1>{s.headline}</h1><p style={{ maxWidth: 440 }}>{s.sub}</p>
    <div><Link to={s.to} className="btn or">{s.cta} ›</Link></div>
    <div className="badge" style={{ cursor: 'pointer' }} onClick={() => nav(s.to)}>-{s.off}%<span>Now from {eur(s.from)}</span></div>
    <div className="dots">{slides.map((_, k) => <i key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} />)}</div></div>
}
function Home() {
  const h = useApi('/hero'), sh = useApi('/shelves')
  return <main className="wrap">
    <Async r={h} err="Unable to load campaigns" skel={<div className="skel hero" />}>{(s: any[]) => <Hero slides={s} />}</Async>
    <Async r={sh} err="Unable to load products" skel={<Skels />}>{(S: any[]) => <>{S.map(x => <section className="sh" key={x.id}>
      <header><div><small>{x.pre}</small><h2>{x.title}</h2></div><Link className="l" to={x.link.to}>{x.link.label} ›</Link></header>
      {x.items.length ? <div className="grid">{x.items.map((p: any) => <Card key={p.id} p={p} />)}</div> : <div className="empty">No deals available right now. Check back soon!</div>}</section>)}</>}</Async></main>
}

// ---------- Catalog ----------
function Catalog() {
  const [sp, setSp] = useSearchParams(); const qs = sp.toString()
  const pr = useApi('/products?' + qs), fc = useApi('/facets?' + qs)
  const upd = (f: (x: URLSearchParams) => void) => { const n = new URLSearchParams(sp); f(n); if (n.toString() !== qs) setSp(n) }
  const tog = (k: string, v: string) => upd(n => { const a = n.getAll(k); n.delete(k); (a.includes(v) ? a.filter(x => x !== v) : [...a, v]).forEach(x => n.append(k, x)) })
  const [lo, setLo] = useState(sp.get('min') || ''), [hi, setHi] = useState(sp.get('max') || '')
  useEffect(() => { const t = setTimeout(() => upd(n => { lo ? n.set('min', lo) : n.delete('min'); hi ? n.set('max', hi) : n.delete('max') }), 300); return () => clearTimeout(t) }, [lo, hi])
  const G: [string, string][] = [['platform', 'Platform'], ['region', 'Region'], ['genre', 'Genre']]
  return <main className="wrap"><div className="bc">Home / All products{sp.get('q') && ' / “' + sp.get('q') + '”'}</div>
    <div className="row" style={{ marginBottom: 18 }}><div><span className="eyebrow">GAME KEYS</span><h1>All Products <small style={{ color: 'var(--mu)' }}>({pr.d ? pr.d.total : '…'})</small></h1></div><span className="sp" />
      <label>Sort by <select className="inp" style={{ width: 'auto' }} value={sp.get('sort') || ''} onChange={e => upd(n => n.set('sort', e.target.value))}>
        <option value="">Relevance (Lowest price first)</option><option value="price_desc">Highest price</option><option value="best">Best selling</option><option value="rating">Top rated</option><option value="newest">Release date</option><option value="discount">Biggest discount</option></select></label></div>
    <div className="cols"><aside className={'side' + (pr.l ? ' dim' : '')}>
      {fc.d && G.map(([k, t]) => <details open key={k}><summary>{t}</summary>{fc.d[k].map((o: any) => <label key={o.v} className={'chk' + (o.off ? ' dis' : '')}>
        <input type="checkbox" disabled={o.off} checked={sp.getAll(k).includes(o.v)} onChange={() => tog(k, o.v)} />{o.v}<em>{o.n}</em></label>)}</details>)}
      <details open><summary>Price Range ⓘ</summary><div className="pr"><input className="inp" type="number" placeholder="€0" value={lo} onChange={e => setLo(e.target.value)} /><input className="inp" type="number" placeholder="€100" value={hi} onChange={e => setHi(e.target.value)} /></div>
        <input type="range" min={0} max={100} value={lo || 0} onChange={e => setLo(e.target.value)} /><input type="range" min={0} max={100} value={hi || 100} onChange={e => setHi(e.target.value)} /></details>
      <details><summary>More filters +</summary><p style={{ color: 'var(--mu)' }}>Publisher, release year and edition coming soon.</p></details></aside>
      <section><Async r={pr} err="Failed to load catalog results" skel={<div className="grid2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skel" style={{ height: 280 }} />)}</div>}>
        {(d: any) => d.items.length ? <div className="grid2" style={{ opacity: pr.l ? .5 : 1 }}>{d.items.map((p: any) => <Card key={p.id} p={p} />)}</div>
          : <div className="empty"><h3>No products match your selected filters</h3><button className="btn pu" onClick={() => { setLo(''); setHi(''); setSp({}) }}>Clear all filters</button></div>}</Async></section></div></main>
}

// ---------- Product ----------
function Product() {
  const { id } = useParams(); const nav = useNavigate(); const { refresh } = useC()
  const p = useApi('/products/' + id), o = useApi('/products/' + id + '/offers'); const [tab, setTab] = useState('d'); const [more, setMore] = useState(false); const [busy, setBusy] = useState(''); const [em, setEm] = useState(''); const [sent, setSent] = useState(false)
  const buy = async (oid: string) => { setBusy(oid); try { await api('/cart/items', { method: 'POST', body: { offerId: oid } }); refresh(); nav('/checkout/cart') } finally { setBusy('') } }
  return <main className="wrap"><Async r={p} err="Unable to load product" skel={<div className="skel" style={{ height: 400, marginTop: 24 }} />}>{(d: any) => { const x = d.product; return <>
    <div className="bc">Home / PC Games / {x.title}</div>
    <div className="pg"><div className="box"><div className="row" style={{ alignItems: 'flex-start', gap: 22 }}><div className="cover" style={{ background: x.img }} />
      <div><div><span className="pill">{x.platform.toUpperCase()}</span><span className="pill">KEY</span><span className="pill">{x.region.toUpperCase()}</span></div><h1 style={{ margin: '12px 0' }}>{x.title}</h1>
        <div style={{ color: 'var(--mu)' }}><span style={{ color: '#f5a623' }}>★★★★☆</span> {x.rating}/5 from {d.ratingCount} ratings · {x.dev}</div></div></div>
      <div className="tabs"><button className={tab === 'd' ? 'on' : ''} onClick={() => setTab('d')}>Description</button><button className={tab === 'a' ? 'on' : ''} onClick={() => setTab('a')}>Activation guide</button></div>
      {tab === 'd' ? <><h3>About this game</h3><p>{x.desc}{more && ' System requirements and legal notices are provided by the publisher. Region restrictions apply as listed.'}</p>
        <div className="feat"><div>Explore the world</div><div>Become a legend</div><div>{x.genre} • {x.year}</div></div>
        <h3>Other details</h3>{[['Release date', x.year], ['Publisher', x.dev], ['Developer', x.dev]].map(([k, v]) => <div className="kv" key={k as string}><span>{k}</span><b>{v}</b></div>)}
        <a href="#" style={{ color: 'var(--p)' }} onClick={e => { e.preventDefault(); setMore(!more) }}>{more ? 'Show less' : 'Read more'}</a></>
        : <ol>{(d.guide || ['Activation steps will be sent with your key.']).map((s: string) => <li key={s} style={{ margin: '8px 0' }}>{s}</li>)}</ol>}</div>
      <aside><Async r={o} err="Unable to load seller offers. Please refresh the page." skel={<div className="skel" style={{ height: 300 }} />}>{(offs: any[]) => offs.length === 0 ?
        <div className="box"><h3>Currently out of stock</h3>{sent ? <p className="ok">We'll email you!</p> : <><input className="inp" placeholder="you@example.com" value={em} onChange={e => setEm(e.target.value)} style={{ margin: '10px 0' }} /><button className="btn pu full" onClick={() => /\S+@\S+/.test(em) && api('/notify', { method: 'POST', body: { email: em } }).then(() => setSent(true))}>Notify me when available</button></>}</div> : <>
        <div className="box best"><span className="eyebrow">BEST PRICE</span><div className="big">{eur(offs[0].price)}</div><div style={{ color: 'var(--mu)', margin: '4px 0 14px' }}>{offs[0].seller.name} · ★ {offs[0].seller.pct}% positive</div>
          <button className="btn or full" disabled={!!busy} onClick={() => buy(offs[0].offerId)}>{busy === offs[0].offerId ? '⏳' : 'BUY'}</button></div>
        <div className="box" style={{ marginTop: 14 }}><h4>Recommended offers</h4>{offs.map(f => <div className="of" key={f.offerId}><div className="av">{f.seller.name[0]}</div>
          <div style={{ flex: 1 }}><b>{f.seller.name}</b> {f.seller.tag && <span className="pill">{f.seller.tag}</span>}<div style={{ fontSize: 12, color: 'var(--mu)' }}>★ {f.seller.pct}% positive · ⚡ instant delivery · 🛡️ verified</div></div>
          <b>{eur(f.price)}</b><button className="btn" disabled={!!busy} onClick={() => buy(f.offerId)}>{busy === f.offerId ? '⏳' : 'BUY'}</button></div>)}</div>
        <p className="ok" style={{ marginTop: 12 }}>🛡️ Buyer protection included — Shop safely with Eneba guarantee.</p></>}</Async></aside></div></> }}</Async></main>
}

// ---------- Cart ----------
function CartPage() {
  const r = useApi('/cart'); const nav = useNavigate(); const { refresh, user } = useC()
  const [em, setEm] = useState(''); const [ee, setEe] = useState(''); const [pr, setPr] = useState(false); const [code, setCode] = useState(''); const [ce, setCe] = useState('')
  useEffect(() => { if (r.d) setEm(x => x || r.d.email || user?.email || '') }, [r.d, user])
  const rm = (id: string) => api('/cart/items/' + encodeURIComponent(id), { method: 'DELETE' }).then(() => { r.reload(); refresh() })
  const promo = () => api('/cart/promo', { method: 'POST', body: { code } }).then(() => { setCe(''); r.reload() }, e => setCe(e.message))
  const go = () => api('/cart/email', { method: 'PUT', body: { email: em } }).then(() => nav('/checkout/payment'), e => setEe(e.message))
  return <main className="wrap"><Async r={r} err="Unable to load your cart" skel={<div className="skel" style={{ height: 300, marginTop: 28 }} />}>{(c: any) => c.count === 0 ?
    <div className="empty"><h2>Your cart is empty</h2><p>Find your next game and add it to the cart.</p><Link className="btn pu" to="/catalog">Explore Games</Link></div> :
    <div className="ck"><div><h2 style={{ marginBottom: 12 }}>My cart - {c.count} item{c.count > 1 ? 's' : ''}</h2>
      {c.lines.map((l: any) => <div className="box row" key={l.offerId} style={{ marginBottom: 12 }}><div style={{ width: 70, height: 90, borderRadius: 8, background: l.product.img }} />
        <div className="sp"><small>Sold by {l.seller.name} ★ {l.seller.pct}%</small><div><span className="pill">⚡</span><span className="pill">{l.product.platform.toUpperCase()}</span><span className="pill">{l.product.region.toUpperCase()}</span></div><b>{l.product.title}</b><div style={{ color: 'var(--mu)' }}>Digital product × {l.qty}</div></div>
        <b>{eur(l.price * l.qty)}</b><button className="btn" onClick={() => rm(l.offerId)}>✕</button></div>)}
      <div className="box"><h3>Where to deliver the order?</h3><p style={{ color: 'var(--mu)' }}>Your game key and receipt will be sent here.</p>
        <input className={'inp' + (ee ? ' bad' : '')} placeholder="you@example.com" value={em} onChange={e => { setEm(e.target.value); setEe('') }} />{ee && <div className="help">{ee}</div>}
        <label className="chk"><input type="checkbox" /> Remember this email <small style={{ color: 'var(--mu)' }}>We'll only use this for your order.</small></label></div></div>
      <div className="box sum"><h3>Order summary</h3><div><span>Item price</span><span>{eur(c.sub)}</span></div>{c.discount > 0 && <div className="ok"><span>Discount</span><span>-{eur(c.discount)}</span></div>}
        <div><span>Service fee</span><span>{eur(c.fee)}</span></div><div className="tot"><span>Total</span><span>{eur(c.total)}</span></div>
        <button className="btn or full" onClick={go}>Proceed to checkout ›</button>
        <label className="chk"><input type="checkbox" /> Send me game deals and special offers</label><label className="chk"><input type="checkbox" /> I agree to receive a review invitation</label>
        <p style={{ marginTop: 14 }}><a href="#" style={{ color: 'var(--p)', fontWeight: 600 }} onClick={e => { e.preventDefault(); setPr(!pr) }}>Got a discount code? {pr ? '−' : '+'}</a></p>
        {pr && <><div className="row"><input className="inp" placeholder="WELCOME10" value={code} onChange={e => setCode(e.target.value)} /><button className="btn pu" onClick={promo}>Apply</button></div>{ce && <div className="help">{ce}</div>}</>}</div></div>}</Async></main>
}

// ---------- Payment (simulated: card ending 0002 is declined) ----------
function Pay() {
  const nav = useNavigate(); const { refresh } = useC(); const [m, setM] = useState(''); const r = useApi('/cart?method=' + m)
  const [card, setCard] = useState({ n: '4242 4242 4242 4242', e: '12/30', c: '123' }); const [err, setErr] = useState(''); const [proc, setProc] = useState(false)
  const qty = (id: string, q: number) => api('/cart/items/' + encodeURIComponent(id), { method: 'PATCH', body: { qty: q } }).then(r.reload)
  const pay = async () => { if (!m) return setErr('Please select a payment method to continue.'); setErr(''); setProc(true)
    try { const o = await api('/checkout', { method: 'POST', body: { method: m, card: card.n } }); refresh(); nav('/checkout/done', { state: o }) } catch (e: any) { setErr(e.message); setProc(false) } }
  return <main className="wrap"><Async r={r} err="Unable to load your order" skel={<div className="skel" style={{ height: 300, marginTop: 28 }} />}>{(c: any) => c.count === 0 ? <div className="empty"><h2>Your cart is empty</h2><Link className="btn pu" to="/catalog">Explore Games</Link></div> :
    <div className="ck"><div>{err && <div className="err">{err}</div>}<h2 style={{ marginBottom: 12 }}>Choose payment method</h2>
      {c.methods.main.map((x: any) => { const dis = x.id === 'wallet' && c.wallet < c.total; return <div key={x.id} className={'pm' + (m === x.id ? ' on' : '') + (dis ? ' dis' : '')} onClick={() => !dis && setM(x.id)}>
        <b className="c">{x.code}</b><div className="sp"><b>{x.name}</b>{x.id === 'wallet' && <div style={{ color: 'var(--mu)' }}>Balance: {eur(c.wallet)}{dis && ' — top up to use'}</div>}</div>
        {m === x.id && x.id === 'card' && <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 8 }}><input className="inp" style={{ width: 190 }} value={card.n} onChange={e => setCard({ ...card, n: e.target.value })} /><input className="inp" style={{ width: 70 }} value={card.e} onChange={e => setCard({ ...card, e: e.target.value })} /><input className="inp" style={{ width: 60 }} value={card.c} onChange={e => setCard({ ...card, c: e.target.value })} /></div>}</div> })}
      <h4 style={{ margin: '16px 0 10px' }}>Online banking</h4><div className="banks">{c.methods.banks.map((x: any) => <div key={x.id} className={'pm' + (m === x.id ? ' on' : '')} onClick={() => setM(x.id)}><b className="c">{x.code}</b>{x.name}</div>)}</div>
      <p style={{ color: 'var(--mu)', fontSize: 13 }}>Test mode: no real money. Card numbers ending in 0002 are declined.</p></div>
      <div className="box sum"><h3>Your order</h3>{c.lines.map((l: any) => <div key={l.offerId}><span><b>{l.product.title}</b><br /><small>{l.seller.name} {l.seller.pct}% · {eur(l.price)}</small></span>
        <span className="qty"><button onClick={() => qty(l.offerId, l.qty - 1)}>−</button>{l.qty}<button onClick={() => qty(l.offerId, l.qty + 1)}>+</button></span></div>)}
        <div style={{ opacity: r.l ? .5 : 1 }}><span>Sub-total</span><span>{eur(c.sub)}</span></div><div><span>Service fee</span><span>{eur(c.fee)}</span></div><div><span>Delivery to: {c.email}</span><Link to="/checkout/cart" style={{ color: 'var(--p)' }}>Edit</Link></div>
        <div className="tot"><span>Total</span><span>{eur(c.total)}</span></div><div className="ok"><span>Cashback</span><span>+ {eur(c.cashback)}</span></div>
        <button className="btn or full" disabled={proc} onClick={pay}>{proc ? 'Processing your payment...' : 'Continue ›'}</button>
        <p style={{ fontSize: 12, color: 'var(--mu)' }}>By continuing you accept the Terms & Conditions, Privacy Policy and Refund Policy.</p></div></div>}</Async></main>
}
function Done() {
  const { state } = useLocation() as any
  if (!state) return <Navigate to="/" />
  return <main className="wrap"><div className="box" style={{ margin: '36px auto', maxWidth: 640 }}><h2>🎉 Thank you! Get your product</h2><p>Order {state.id} — keys also sent to {state.email}.</p>
    {state.items.map((i: any, k: number) => <div className="kv" key={k}><span>{i.title}</span><span className="key">{i.key}</span></div>)}<Link to="/account/orders" className="btn pu" style={{ marginTop: 16 }}>View order history</Link></div></main>
}

// ---------- Account ----------
function Account({ sub }: { sub: 'o' | 'h' }) {
  const { setAuth, refresh, user } = useC(); const nav = useNavigate(); const r = useApi('/me'); const ord = useApi('/orders'); const [ed, setEd] = useState(false); const [f, setF] = useState<any>({})
  useEffect(() => { if (!localStorage.tok) { setAuth('in'); nav('/') } }, [])
  const out = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => 0); delete localStorage.tok; refresh(); nav('/') }
  const save = () => api('/me', { method: 'PATCH', body: f }).then(() => { setEd(false); r.reload(); refresh() })
  return <main className="wrap"><Async r={r} err="Failed to load profile details. Refresh to retry." skel={<div className="skel" style={{ height: 160, margin: '24px 0' }} />}>{(u: any) => { const nm = u.name || u.email.split('@')[0]; return <>
    <div className="acc"><div className="ava">{nm.slice(0, 2).toUpperCase()}</div><div className="sp"><small>WELCOME BACK</small><h2>{nm}</h2>{u.email}</div><div className="wal"><small>ENEBA WALLET</small><b>{eur(u.wallet)}</b></div></div>
    <div className="cols"><nav className="nav"><Link to="/account" className={sub === 'o' ? 'on' : ''}>Account overview <span>›</span></Link><Link to="/account/orders" className={sub === 'h' ? 'on' : ''}>Order history <span>›</span></Link><Link to="/checkout/cart">My cart <span>›</span></Link><button className="out" onClick={out}>Log out</button></nav>
      <section>{sub === 'o' ? <><div className="row"><div><span className="eyebrow">YOUR ACCOUNT</span><h2>Account overview</h2></div><span className="sp" /><a href="#" style={{ color: 'var(--p)', fontWeight: 700 }} onClick={e => { e.preventDefault(); setF({ name: u.name, region: u.region }); setEd(!ed) }}>Edit profile</a></div>
        <div className="stats"><div className="box">🧾 Total orders<h2>{u.totalOrders}</h2></div><div className="box">🎮 Games purchased<h2>{u.games}</h2></div></div>
        <div className="box"><small style={{ color: 'var(--mu)' }}>Prototype account stored on the server (in memory).</small>
          {ed ? <><input className="inp" style={{ margin: '10px 0' }} placeholder="Full name" value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} /><select className="inp" value={f.region} onChange={e => setF({ ...f, region: e.target.value })}>{u.regions.map((x: string) => <option key={x}>{x}</option>)}</select>
            <div className="row" style={{ marginTop: 12 }}><button className="btn pu" onClick={save}>Save</button><button className="btn" onClick={() => setEd(false)}>Cancel</button></div></> :
            [['Full name', u.name || 'Not set'], ['Email address', u.email], ['Region & currency', u.region]].map(([k, v]) => <div className="kv" key={k}><span>{k}</span><b>{v}</b></div>)}</div>
        <p><Link to="/account/orders" style={{ color: 'var(--p)', fontWeight: 700 }}>View order history ›</Link></p></> :
        <><h2>Order history</h2><Async r={ord} err="Unable to load orders">{(os: any[]) => os.length ? os.map(o => <div className="box" key={o.id} style={{ margin: '12px 0' }}><b>{o.id}</b> · {o.date} · {eur(o.total)}{o.items.map((i: any, k: number) => <div className="kv" key={k}><span>{i.title}</span><span className="key">{i.key}</span></div>)}</div>) : <div className="empty">No orders yet.</div>}</Async></>}</section></div></> }}</Async></main>
}

// ---------- App shell ----------
function App() {
  const [user, setUser] = useState<any>(null); const [count, setCount] = useState(0); const [auth, setAuth] = useState<any>(null); const [search, setSearch] = useState(false); const [layout, setLayout] = useState<any>(null); const loc = useLocation()
  const refresh = useCallback(() => { api('/cart').then(c => setCount(c.count)).catch(() => 0)
    localStorage.tok ? api('/me').then(setUser).catch(() => { delete localStorage.tok; setUser(null) }) : setUser(null) }, [])
  useEffect(() => { refresh(); api('/layout').then(setLayout).catch(() => 0) }, [])
  useEffect(() => window.scrollTo(0, 0), [loc.pathname])
  const co = loc.pathname.startsWith('/checkout'); const step = loc.pathname.endsWith('payment') ? 1 : loc.pathname.endsWith('done') ? 2 : 0
  return <C.Provider value={{ user, count, auth, setAuth, setSearch, layout, refresh }}>
    {co ? <CheckoutHeader step={step} /> : <Header />}
    <Routes><Route path="/" element={<Home />} /><Route path="/catalog" element={<Catalog />} /><Route path="/p/:id" element={<Product />} />
      <Route path="/checkout/cart" element={<CartPage />} /><Route path="/checkout/payment" element={<Pay />} /><Route path="/checkout/done" element={<Done />} />
      <Route path="/account" element={<Account sub="o" />} /><Route path="/account/orders" element={<Account sub="h" />} /><Route path="*" element={<Navigate to="/" />} /></Routes>
    {!co && <Footer />}{search && <Search />}{auth && <Auth />}</C.Provider>
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>)
