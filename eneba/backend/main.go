package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type P struct {
	ID       string  `json:"id"`
	Title    string  `json:"title"`
	Platform string  `json:"platform"`
	Region   string  `json:"region"`
	Genre    string  `json:"genre"`
	Price    float64 `json:"price"`
	Base     float64 `json:"base"`
	Rating   float64 `json:"rating"`
	Sold     int     `json:"sold"`
	Year     int     `json:"year"`
	Dev      string  `json:"dev"`
	Desc     string  `json:"desc"`
	Img      string  `json:"img"`
	Stock    int     `json:"stock"`
}
type Seller struct {
	ID    int     `json:"id"`
	Name  string  `json:"name"`
	Pct   float64 `json:"pct"`
	Extra float64 `json:"-"`
	Tag   string  `json:"tag,omitempty"`
}
type CL struct {
	Offer string
	Qty   int
}
type Cart struct {
	Lines        []CL
	Promo, Email string
}
type U struct {
	Email, Name, Region, Hash string
	Wallet                    float64
}

func mk(id, t, pl, rg, g string, pr, bs, rt float64, sold, yr int, dev, d string, hue int) P {
	return P{id, t, pl, rg, g, pr, bs, rt, sold, yr, dev, d,
		fmt.Sprintf("linear-gradient(135deg,hsl(%d 75%% 50%%),hsl(%d 70%% 18%%))", hue, (hue+50)%360), 9}
}

var prods = []P{
	mk("cyberpunk-2077-ultimate", "Cyberpunk 2077: Ultimate Edition", "Steam", "Global", "RPG", 24.79, 59.99, 4.8, 9800, 2020, "CD PROJEKT RED", "Become a cyberpunk, an urban mercenary outlaw, and chase the one thing that matters: immortality. Includes the base game and Phantom Liberty.", 50),
	mk("elden-ring", "Elden Ring", "Steam", "Global", "RPG", 34.99, 59.99, 4.9, 9100, 2022, "FromSoftware", "Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring.", 30),
	mk("rdr2", "Red Dead Redemption 2", "Steam", "Global", "Action", 19.49, 59.99, 4.8, 8700, 2019, "Rockstar Games", "America, 1899. Arthur Morgan and the Van der Linde gang are on the run.", 15),
	mk("forza-horizon-5", "Forza Horizon 5", "Xbox Live", "Europe", "Action", 21.30, 59.99, 4.6, 5200, 2021, "Playground Games", "Explore the vibrant open world landscapes of Mexico with limitless, fun driving action.", 150),
	mk("witcher-3-goty", "The Witcher 3: Wild Hunt GOTY", "Steam", "Global", "RPG", 7.99, 39.99, 4.9, 9900, 2015, "CD PROJEKT RED", "Play as a monster hunter for hire in an open world full of choices and consequences.", 200),
	mk("god-of-war-ragnarok", "God of War Ragnarök", "PlayStation", "Europe", "Action", 39.99, 69.99, 4.8, 4300, 2022, "Santa Monica Studio", "Kratos and Atreus must journey to each of the Nine Realms.", 5),
	mk("hades", "Hades", "Steam", "Global", "Indie", 9.49, 24.99, 4.9, 6100, 2020, "Supergiant Games", "Defy the god of the dead as you hack and slash out of the Underworld.", 340),
	mk("zelda-totk", "The Legend of Zelda: Tears of the Kingdom", "Nintendo", "Europe", "Adventure", 49.99, 69.99, 4.9, 4800, 2023, "Nintendo", "An epic adventure across the land and skies of Hyrule.", 120),
	mk("hollow-knight", "Hollow Knight", "Steam", "Global", "Indie", 4.99, 14.99, 4.8, 5600, 2017, "Team Cherry", "Brave the depths of a forgotten kingdom of insects and heroes.", 260),
	mk("halo-infinite", "Halo Infinite", "Xbox Live", "United States", "Action", 12.99, 59.99, 4.1, 3900, 2021, "343 Industries", "Master Chief returns in the most expansive Halo campaign yet.", 100),
	mk("stardew-valley", "Stardew Valley", "Steam", "Global", "Indie", 8.99, 13.99, 4.9, 7400, 2016, "ConcernedApe", "Inherit your grandfather's old farm plot and build a new life.", 90),
	mk("cyberpunk-phantom-liberty", "Cyberpunk 2077: Phantom Liberty", "Steam", "Global", "RPG", 19.99, 29.99, 4.7, 5100, 2023, "CD PROJEKT RED", "A spy-thriller expansion set in Dogtown.", 300),
	mk("starfield", "Starfield", "Xbox Live", "Global", "RPG", 29.99, 69.99, 4.0, 2100, 2023, "Bethesda", "Create any character and explore with unparalleled freedom.", 220),
}
var sellers = []Seller{{0, "GameKeys Pro", 99.8, 0, "BEST OFFER"}, {1, "Digital Zone", 99.1, 0.33, ""}, {2, "Key Hub", 98.4, 1.29, ""}}
var guides = map[string][]string{
	"Steam":       {"Open the Steam client and log in.", "Click Games > Activate a Product on Steam.", "Enter your key and follow the prompts.", "Find the game in your Library and install."},
	"Xbox Live":   {"Sign in at redeem.microsoft.com.", "Enter the 25-character code.", "Confirm and download from your Xbox library."},
	"PlayStation": {"Open PlayStation Store > Redeem Codes.", "Enter the code.", "Download from your Library."},
	"Nintendo":    {"Open Nintendo eShop.", "Select Redeem Code.", "Enter the code and download."},
}
var (
	mu     sync.Mutex
	users  = map[string]*U{}
	sess   = map[string]string{}
	carts  = map[string]*Cart{}
	orders = map[string][]map[string]any{}
)

func rd(f float64) float64 { return math.Round(f*100) / 100 }
func j(w http.ResponseWriter, c int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(c)
	json.NewEncoder(w).Encode(v)
}
func er(w http.ResponseWriter, c int, m string) { j(w, c, map[string]string{"error": m}) }
func body(r *http.Request) map[string]any {
	m := map[string]any{}
	json.NewDecoder(r.Body).Decode(&m)
	return m
}
func s(m map[string]any, k string) string { v, _ := m[k].(string); return strings.TrimSpace(v) }
func rnd(n int) string { b := make([]byte, n); rand.Read(b); return hex.EncodeToString(b) }
func hash(p string) string { h := sha256.Sum256([]byte("eneba" + p)); return hex.EncodeToString(h[:]) }
func validEmail(e string) bool {
	return len(e) > 4 && strings.Contains(e, "@") && strings.Contains(e[strings.Index(e, "@"):], ".") && !strings.Contains(e, " ")
}
func in(l []string, v string) bool {
	if len(l) == 0 {
		return true
	}
	for _, x := range l {
		if x == v {
			return true
		}
	}
	return false
}
func fld(p P, g string) string {
	switch g {
	case "platform":
		return p.Platform
	case "region":
		return p.Region
	}
	return p.Genre
}
func filt(q url.Values, skip string) []P {
	var out []P
	kw := strings.ToLower(q.Get("q"))
	lo, _ := strconv.ParseFloat(q.Get("min"), 64)
	hi, err := strconv.ParseFloat(q.Get("max"), 64)
	if err != nil {
		hi = 1e9
	}
	for _, p := range prods {
		if kw != "" && !strings.Contains(strings.ToLower(p.Title), kw) {
			continue
		}
		ok := p.Price >= lo && p.Price <= hi
		for _, g := range []string{"platform", "region", "genre"} {
			if g != skip && !in(q[g], fld(p, g)) {
				ok = false
			}
		}
		if ok {
			out = append(out, p)
		}
	}
	return out
}
func sortP(l []P, by string) {
	sort.SliceStable(l, func(a, b int) bool {
		x, y := l[a], l[b]
		switch by {
		case "price_desc":
			return x.Price > y.Price
		case "best":
			return x.Sold > y.Sold
		case "rating":
			return x.Rating > y.Rating
		case "newest":
			return x.Year > y.Year
		case "discount":
			return x.Price/x.Base < y.Price/y.Base
		}
		return x.Price < y.Price
	})
}
func find(id string) *P {
	for i := range prods {
		if prods[i].ID == id {
			return &prods[i]
		}
	}
	return nil
}
func offer(id string) (P, Seller, float64, bool) {
	a := strings.SplitN(id, ":", 2)
	p := find(a[0])
	if p == nil || len(a) < 2 {
		return P{}, Seller{}, 0, false
	}
	i, _ := strconv.Atoi(a[1])
	if i < 0 || i >= len(sellers) {
		return P{}, Seller{}, 0, false
	}
	return *p, sellers[i], rd(p.Price + sellers[i].Extra), true
}
func getCart(r *http.Request) *Cart {
	id := r.Header.Get("X-Client")
	if carts[id] == nil {
		carts[id] = &Cart{}
	}
	return carts[id]
}
func user(r *http.Request) *U { return users[sess[strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")]] }
func view(c *Cart, m string, u *U) map[string]any {
	ls := []map[string]any{}
	sub, n := 0.0, 0
	for _, l := range c.Lines {
		p, sl, pr, ok := offer(l.Offer)
		if !ok {
			continue
		}
		sub += pr * float64(l.Qty)
		n += l.Qty
		ls = append(ls, map[string]any{"offerId": l.Offer, "product": p, "seller": sl, "price": pr, "qty": l.Qty, "max": p.Stock})
	}
	disc, fee := 0.0, 0.0
	if c.Promo != "" {
		disc = rd(sub * 0.1)
	}
	if sub > 0 {
		fee = 1.49
		if m == "paypal" {
			fee = 1.79
		}
	}
	wal := 0.0
	if u != nil {
		wal = u.Wallet
	}
	return map[string]any{"lines": ls, "count": n, "sub": rd(sub), "discount": disc, "fee": fee, "total": rd(sub - disc + fee), "cashback": rd(sub * 0.02), "promo": c.Promo, "email": c.Email, "wallet": wal,
		"methods": map[string]any{
			"main":  []map[string]string{{"id": "wallet", "code": "EN", "name": "Eneba Wallet"}, {"id": "card", "code": "CR", "name": "Credit or debit card"}, {"id": "paypal", "code": "PA", "name": "PayPal"}},
			"banks": []map[string]string{{"id": "bank-swedbank", "code": "SW", "name": "Swedbank"}, {"id": "bank-seb", "code": "SE", "name": "SEB"}, {"id": "bank-luminor", "code": "LU", "name": "Luminor"}, {"id": "bank-revolut", "code": "RE", "name": "Revolut"}, {"id": "bank-artea", "code": "AR", "name": "Artea"}, {"id": "bank-lku", "code": "LK", "name": "LKU"}}}}
}
func meView(u *U) map[string]any {
	n := 0
	os := orders[u.Email]
	for _, o := range os {
		n += len(o["items"].([]map[string]any))
	}
	return map[string]any{"email": u.Email, "name": u.Name, "region": u.Region, "wallet": u.Wallet, "totalOrders": len(os), "games": n, "regions": []string{"Europe • EUR", "United States • USD"}}
}

func main() {
	mux := http.NewServeMux()
	h := func(f http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) { mu.Lock(); defer mu.Unlock(); f(w, r) }
	}
	mux.HandleFunc("GET /api/layout", h(func(w http.ResponseWriter, r *http.Request) {
		cat := []map[string]string{{"label": "All products", "to": "/catalog"}}
		for _, p := range []string{"Steam", "Xbox Live", "PlayStation", "Nintendo"} {
			cat = append(cat, map[string]string{"label": p + " games", "to": "/catalog?platform=" + url.QueryEscape(p)})
		}
		j(w, 200, map[string]any{"catalog": cat, "locale": "EN/EUR",
			"valueProps": []map[string]string{{"icon": "⚡", "title": "Instant delivery", "sub": "Keys land in your inbox in seconds"}, {"icon": "🛡️", "title": "Safe & secure", "sub": "Trusted by 12M+ gamers"}, {"icon": "🌍", "title": "Global marketplace", "sub": "Thousands of verified sellers"}},
			"footer": map[string]any{"tagline": "Play more. Pay less.", "copy": fmt.Sprintf("© %d Eneba prototype. No real money involved.", time.Now().Year()), "links": []string{"Support", "Terms & Conditions", "Privacy policy"}}})
	}))
	mux.HandleFunc("GET /api/hero", h(func(w http.ResponseWriter, r *http.Request) {
		j(w, 200, []map[string]any{
			{"tag": "WEEKEND SPOTLIGHT", "headline": "Own the night. Rule the city.", "sub": "Night City is calling — grab the Ultimate Edition at a record low.", "cta": "SHOP THE COLLECTION", "to": "/p/cyberpunk-2077-ultimate", "off": 59, "from": 24.79, "bg": "linear-gradient(120deg,#2a1766,#7a2fd0 60%,#ff7a1a)"},
			{"tag": "HOT RIGHT NOW", "headline": "Rise, Tarnished.", "sub": "Elden Ring keys from verified sellers.", "cta": "SHOP NOW", "to": "/p/elden-ring", "off": 42, "from": 34.99, "bg": "linear-gradient(120deg,#1d1b2b,#5a2fd0 70%,#c9a227)"},
			{"tag": "PRICES DROPPED", "headline": "Indie gems, tiny prices.", "sub": "Hades, Hollow Knight, Stardew Valley and more.", "cta": "EXPLORE DEALS", "to": "/catalog?genre=Indie", "off": 64, "from": 4.99, "bg": "linear-gradient(120deg,#12324d,#2f7ad0 60%,#5a2fd0)"}})
	}))
	mux.HandleFunc("GET /api/shelves", h(func(w http.ResponseWriter, r *http.Request) {
		shelf := func(by string) []P {
			l := append([]P{}, prods...)
			sortP(l, by)
			return l[:3]
		}
		j(w, 200, []map[string]any{
			{"id": "best", "pre": "MOST WANTED", "title": "Best sellers", "link": map[string]string{"label": "View all", "to": "/catalog?sort=best"}, "items": shelf("best")},
			{"id": "deals", "pre": "PRICES DROPPED", "title": "Hot deals", "link": map[string]string{"label": "Explore deals", "to": "/catalog?sort=discount"}, "items": shelf("discount")}})
	}))
	mux.HandleFunc("GET /api/products", h(func(w http.ResponseWriter, r *http.Request) {
		l := filt(r.URL.Query(), "")
		sortP(l, r.URL.Query().Get("sort"))
		if l == nil {
			l = []P{}
		}
		j(w, 200, map[string]any{"total": len(l), "items": l})
	}))
	mux.HandleFunc("GET /api/facets", h(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		out := map[string]any{"price": map[string]int{"min": 0, "max": 100}}
		for _, g := range []string{"platform", "region", "genre"} {
			cnt, seen := map[string]int{}, map[string]bool{}
			for _, p := range filt(q, g) {
				cnt[fld(p, g)]++
			}
			var keys []string
			for _, p := range prods {
				if v := fld(p, g); !seen[v] {
					seen[v] = true
					keys = append(keys, v)
				}
			}
			sort.Strings(keys)
			o := []map[string]any{}
			for _, k := range keys {
				o = append(o, map[string]any{"v": k, "n": cnt[k], "off": cnt[k] == 0 && !in(q[g], k) || (len(q[g]) > 0 && !in(q[g], k) && cnt[k] == 0)})
			}
			out[g] = o
		}
		j(w, 200, out)
	}))
	mux.HandleFunc("GET /api/search", h(func(w http.ResponseWriter, r *http.Request) {
		q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
		l, sug := []P{}, []string{}
		trending := len(q) < 2
		if trending {
			l = append(l, prods...)
			sortP(l, "best")
		} else {
			l = filt(url.Values{"q": {q}}, "")
			sortP(l, "best")
		}
		total := len(l)
		if len(l) > 4 {
			l = l[:4]
		}
		for _, p := range l {
			if len(sug) < 5 {
				sug = append(sug, strings.ToLower(p.Title))
			}
		}
		j(w, 200, map[string]any{"trending": trending, "suggestions": sug, "products": l, "total": total})
	}))
	mux.HandleFunc("GET /api/products/{id}", h(func(w http.ResponseWriter, r *http.Request) {
		p := find(r.PathValue("id"))
		if p == nil {
			er(w, 404, "Not found")
			return
		}
		j(w, 200, map[string]any{"product": p, "ratingCount": 75 + p.Sold/100, "guide": guides[p.Platform]})
	}))
	mux.HandleFunc("GET /api/products/{id}/offers", h(func(w http.ResponseWriter, r *http.Request) {
		p := find(r.PathValue("id"))
		if p == nil {
			er(w, 404, "Not found")
			return
		}
		o := []map[string]any{}
		if p.Stock > 0 {
			for _, sl := range sellers {
				o = append(o, map[string]any{"offerId": p.ID + ":" + strconv.Itoa(sl.ID), "seller": sl, "price": rd(p.Price + sl.Extra)})
			}
		}
		j(w, 200, o)
	}))
	mux.HandleFunc("POST /api/notify", h(func(w http.ResponseWriter, r *http.Request) { j(w, 200, map[string]bool{"ok": true}) }))
	// auth
	login := func(w http.ResponseWriter, u *U) {
		t := rnd(16)
		sess[t] = u.Email
		j(w, 200, map[string]any{"token": t})
	}
	mux.HandleFunc("POST /api/auth/register", h(func(w http.ResponseWriter, r *http.Request) {
		b := body(r)
		e := strings.ToLower(s(b, "email"))
		if !validEmail(e) || len(s(b, "password")) < 8 {
			er(w, 400, "Invalid email or password")
			return
		}
		if users[e] != nil {
			er(w, 409, "An account with this email already exists. Try signing in.")
			return
		}
		users[e] = &U{Email: e, Region: "Europe • EUR", Hash: hash(s(b, "password"))}
		login(w, users[e])
	}))
	mux.HandleFunc("POST /api/auth/login", h(func(w http.ResponseWriter, r *http.Request) {
		b := body(r)
		u := users[strings.ToLower(s(b, "email"))]
		if u == nil || u.Hash != hash(s(b, "password")) {
			er(w, 401, "Incorrect email or password.")
			return
		}
		login(w, u)
	}))
	mux.HandleFunc("POST /api/auth/google", h(func(w http.ResponseWriter, r *http.Request) {
		e := "alex.gamer@example.com"
		if users[e] == nil {
			users[e] = &U{Email: e, Name: "Alex Gamer", Region: "Europe • EUR", Wallet: 0.52}
		}
		login(w, users[e])
	}))
	mux.HandleFunc("POST /api/auth/reset", h(func(w http.ResponseWriter, r *http.Request) { j(w, 200, map[string]bool{"ok": true}) }))
	mux.HandleFunc("POST /api/auth/logout", h(func(w http.ResponseWriter, r *http.Request) {
		delete(sess, strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		j(w, 200, map[string]bool{"ok": true})
	}))
	mux.HandleFunc("GET /api/me", h(func(w http.ResponseWriter, r *http.Request) {
		if u := user(r); u != nil {
			j(w, 200, meView(u))
			return
		}
		er(w, 401, "Not signed in")
	}))
	mux.HandleFunc("PATCH /api/me", h(func(w http.ResponseWriter, r *http.Request) {
		u := user(r)
		if u == nil {
			er(w, 401, "Not signed in")
			return
		}
		b := body(r)
		u.Name = s(b, "name")
		if rg := s(b, "region"); rg != "" {
			u.Region = rg
		}
		j(w, 200, meView(u))
	}))
	mux.HandleFunc("GET /api/orders", h(func(w http.ResponseWriter, r *http.Request) {
		u := user(r)
		if u == nil {
			er(w, 401, "Not signed in")
			return
		}
		o := orders[u.Email]
		if o == nil {
			o = []map[string]any{}
		}
		j(w, 200, o)
	}))
	// cart
	mux.HandleFunc("GET /api/cart", h(func(w http.ResponseWriter, r *http.Request) {
		j(w, 200, view(getCart(r), r.URL.Query().Get("method"), user(r)))
	}))
	mux.HandleFunc("POST /api/cart/items", h(func(w http.ResponseWriter, r *http.Request) {
		id := s(body(r), "offerId")
		p, _, _, ok := offer(id)
		if !ok || p.Stock == 0 {
			er(w, 400, "Offer unavailable")
			return
		}
		c := getCart(r)
		for i := range c.Lines {
			if c.Lines[i].Offer == id {
				j(w, 200, view(c, "", user(r)))
				return
			}
		}
		c.Lines = append(c.Lines, CL{id, 1})
		j(w, 200, view(c, "", user(r)))
	}))
	mux.HandleFunc("PATCH /api/cart/items/{oid}", h(func(w http.ResponseWriter, r *http.Request) {
		c := getCart(r)
		q, _ := body(r)["qty"].(float64)
		for i := range c.Lines {
			if c.Lines[i].Offer == r.PathValue("oid") {
				p, _, _, _ := offer(c.Lines[i].Offer)
				c.Lines[i].Qty = int(math.Max(1, math.Min(float64(p.Stock), q)))
			}
		}
		j(w, 200, view(c, "", user(r)))
	}))
	mux.HandleFunc("DELETE /api/cart/items/{oid}", h(func(w http.ResponseWriter, r *http.Request) {
		c := getCart(r)
		var n []CL
		for _, l := range c.Lines {
			if l.Offer != r.PathValue("oid") {
				n = append(n, l)
			}
		}
		c.Lines = n
		j(w, 200, view(c, "", user(r)))
	}))
	mux.HandleFunc("POST /api/cart/promo", h(func(w http.ResponseWriter, r *http.Request) {
		if strings.ToUpper(s(body(r), "code")) != "WELCOME10" {
			er(w, 400, "Discount code is invalid or expired.")
			return
		}
		getCart(r).Promo = "WELCOME10"
		j(w, 200, view(getCart(r), "", user(r)))
	}))
	mux.HandleFunc("PUT /api/cart/email", h(func(w http.ResponseWriter, r *http.Request) {
		e := s(body(r), "email")
		if !validEmail(e) {
			er(w, 400, "A valid delivery email is required to receive your game key")
			return
		}
		getCart(r).Email = e
		j(w, 200, map[string]bool{"ok": true})
	}))
	// checkout (simulated payment: card numbers ending 0002 are declined)
	mux.HandleFunc("POST /api/checkout", h(func(w http.ResponseWriter, r *http.Request) {
		b := body(r)
		c, u, m := getCart(r), user(r), s(b, "method")
		v := view(c, m, u)
		if v["count"].(int) == 0 {
			er(w, 400, "Your cart is empty")
			return
		}
		em := c.Email
		if e := s(b, "email"); e != "" {
			em = e
		}
		if !validEmail(em) {
			er(w, 400, "A valid delivery email is required to receive your game key")
			return
		}
		total := v["total"].(float64)
		declined := "Payment could not be completed. Please try another payment method."
		switch {
		case m == "card":
			n := strings.ReplaceAll(s(b, "card"), " ", "")
			if len(n) != 16 || strings.HasSuffix(n, "0002") {
				er(w, 402, declined)
				return
			}
		case m == "wallet":
			if u == nil || u.Wallet < total {
				er(w, 402, "Eneba Wallet balance is insufficient.")
				return
			}
			u.Wallet = rd(u.Wallet - total)
		case m == "paypal" || strings.HasPrefix(m, "bank"):
		default:
			er(w, 400, "Please select a payment method to continue.")
			return
		}
		time.Sleep(900 * time.Millisecond)
		items := []map[string]any{}
		for _, l := range v["lines"].([]map[string]any) {
			for i := 0; i < l["qty"].(int); i++ {
				k := strings.ToUpper(rnd(8))
				items = append(items, map[string]any{"title": l["product"].(P).Title, "seller": l["seller"].(Seller).Name, "price": l["price"], "key": k[:5] + "-" + k[5:10] + "-" + k[10:15]})
			}
		}
		o := map[string]any{"id": "EN-" + strings.ToUpper(rnd(4)), "date": time.Now().Format("2006-01-02 15:04"), "email": em, "method": m, "total": total, "items": items}
		owner := r.Header.Get("X-Client")
		if u != nil {
			owner = u.Email
			u.Wallet = rd(u.Wallet + v["cashback"].(float64))
		}
		orders[owner] = append([]map[string]any{o}, orders[owner]...)
		carts[r.Header.Get("X-Client")] = &Cart{Email: em}
		j(w, 200, o)
	}))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		f := filepath.Join("static", filepath.Clean("/"+r.URL.Path))
		if st, err := os.Stat(f); err == nil && !st.IsDir() {
			http.ServeFile(w, r, f)
			return
		}
		http.ServeFile(w, r, "static/index.html")
	})
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	http.ListenAndServe(":"+port, mux)
}
