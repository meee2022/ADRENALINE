import sys, json, re

with open("meals_raw.json", encoding="utf-8-sig") as f:
    data = json.load(f)

def norm(s): return re.sub(r"[^a-z0-9]", "", s.lower()) if s else ""

def similar(a, b):
    na, nb = norm(a), norm(b)
    if not na or not nb: return 0
    if na == nb: return 1.0
    shorter, longer = (na,nb) if len(na)<=len(nb) else (nb,na)
    if shorter in longer: return 0.9
    def tg(s): return set(s[i:i+3] for i in range(len(s)-2))
    ta,tb = tg(na), tg(nb)
    if not ta or not tb: return 0
    return len(ta&tb)/len(ta|tb)

SCHEDULE = [
  ("Halloumi Sandwich",[1],["saturday"],"breakfast"),
  ("Egg With Zaater",[1],["saturday"],"breakfast"),
  ("Beetroot Salad",[1,2,4],["saturday","sunday"],"snack"),
  ("Sweet Potato Energy Booster",[1],["saturday"],"snack"),
  ("Garlic Butter Chicken",[1],["saturday"],"lunch"),
  ("Chicken Teriyaki Bowl",[1],["saturday"],"lunch"),
  ("Chicken Soup",[1],["saturday"],"snack"),
  ("Beef Kofta Wrap",[1],["saturday"],"dinner"),
  ("Honey Glaze Salmon",[1],["saturday"],"dinner"),
  ("Hummus",[1],["sunday"],"breakfast"),
  ("Mix Vege Omelette",[1],["sunday"],"breakfast"),
  ("Brownies",[1],["sunday"],"snack"),
  ("Caesar Salad",[1,2,3,4],["saturday","sunday","wednesday"],"snack"),
  ("Chicken Curry",[1],["sunday"],"lunch"),
  ("Beef Balls With Rice",[1],["sunday"],"lunch"),
  ("Cinnamon Apple Yogurt",[1,2,4],["sunday"],"snack"),
  ("Spaghetti Bolognese",[1],["sunday"],"dinner"),
  ("Shrimp Tacos",[1],["sunday"],"dinner"),
  ("Normal Pancake",[1],["monday"],"breakfast"),
  ("Egg Croissant",[1],["monday"],"breakfast"),
  ("Lentil Soup",[1,2,3,4],["monday","tuesday"],"snack"),
  ("Pistachio Salad",[1,3],["monday","sunday"],"snack"),
  ("Healthy Chicken Majbous",[1],["monday"],"lunch"),
  ("Beef Alfredo",[1],["monday"],"lunch"),
  ("Umm Ali",[1],["monday"],"snack"),
  ("Chicken Shawarma",[1],["monday"],"dinner"),
  ("Chicken Parmesan",[1],["monday"],"dinner"),
  ("Sunny Side Egg With Brown Bread",[1,3],["tuesday"],"breakfast"),
  ("Egg Burrito",[1],["tuesday"],"breakfast"),
  ("Bahamas Lava Cake",[1,3],["saturday","tuesday"],"snack"),
  ("Crab Salad",[1,3],["tuesday"],"snack"),
  ("Beef Stroganoff",[1],["tuesday"],"lunch"),
  ("Crispy Chicken Cutlets",[1],["tuesday"],"lunch"),
  ("Vegetables Soup",[1,2,3,4],["thursday","tuesday","wednesday"],"snack"),
  ("Beef Lasagna",[1],["tuesday"],"dinner"),
  ("Southwest Chicken Wrap",[1],["tuesday"],"dinner"),
  ("Croissant Cheese",[1],["wednesday"],"breakfast"),
  ("Omelette Pizza",[1,3],["monday","wednesday"],"breakfast"),
  ("Date Balls",[1],["wednesday"],"snack"),
  ("Waldorf Salad",[1,3],["saturday","wednesday"],"snack"),
  ("Dynamite Shrimp",[1],["wednesday"],"lunch"),
  ("Shish Tawook & Rice",[1],["wednesday"],"lunch"),
  ("Greek Infusion",[1,3],["wednesday"],"snack"),
  ("Chicken Fajita Sandwich",[1],["wednesday"],"dinner"),
  ("Beef Kofta Delight",[1],["wednesday"],"dinner"),
  ("Berry Oatmeal Bowl",[1],["thursday"],"breakfast"),
  ("Turkey Cheese Wrap",[1],["thursday"],"breakfast"),
  ("Tiramisu",[1,3],["thursday","tuesday"],"snack"),
  ("Fruit Salad",[1,2,3,4],["sunday","thursday"],"snack"),
  ("Creamy Garlic Chicken",[1],["thursday"],"lunch"),
  ("New Greek Chicken",[1],["thursday"],"lunch"),
  ("Mediterranean Feta Salad",[1,2,3,4],["thursday"],"snack"),
  ("Beef Shawarma With Beetroot Rice",[1],["thursday"],"dinner"),
  ("Salmon Pesto Pasta",[1],["thursday"],"dinner"),
  ("Chocolate Pancakes",[2,3,4],["saturday","tuesday"],"breakfast"),
  ("Oriental Breakfast",[2,4],["saturday"],"breakfast"),
  ("Talbina",[2,4],["saturday"],"snack"),
  ("Chicken Tacos",[2,4],["saturday"],"lunch"),
  ("Iranian Chicken",[2,4],["saturday"],"lunch"),
  ("Broccoli Soup",[2,3,4],["saturday"],"snack"),
  ("Salmon No Carb",[2,4],["saturday"],"dinner"),
  ("Steak Sandwich",[2,4],["saturday"],"dinner"),
  ("Croissant Zaatar",[2,4],["sunday"],"breakfast"),
  ("New Egg Sandwich",[2,4],["sunday"],"breakfast"),
  ("Cordon Bleu",[2,4],["sunday"],"lunch"),
  ("Fish Sayadieh",[2,4],["sunday"],"lunch"),
  ("Garlic Butter Steak & Potatoes",[2],["sunday"],"dinner"),
  ("Chicken Herbs",[2,4],["sunday"],"dinner"),
  ("Sweet Potato Delight",[2,4],["monday"],"breakfast"),
  ("Mexican Omelette",[2,4],["monday"],"breakfast"),
  ("Mushroom Soup",[2,3,4],["monday","sunday"],"snack"),
  ("Cookies",[2,4],["monday"],"snack"),
  ("Cajun Chicken Pasta",[2],["monday"],"lunch"),
  ("Chicken Vegetables",[2,4],["monday"],"lunch"),
  ("Fattoush",[2,4],["monday"],"snack"),
  ("Dawoud Basha",[2,4],["monday"],"dinner"),
  ("Buffalo Chicken Wrap",[2,4],["monday"],"dinner"),
  ("Foul",[2,4],["tuesday"],"breakfast"),
  ("New Egg Shakshouka",[2,3,4],["tuesday","wednesday"],"breakfast"),
  ("Chia Seeds Pudding",[2,4],["tuesday"],"snack"),
  ("Lemon Chicken",[2,4],["tuesday"],"lunch"),
  ("Shrimp Curry",[2],["tuesday"],"lunch"),
  ("Energy Balls",[2,4],["tuesday"],"snack"),
  ("Beef Shawarma Sandwich",[2,4],["tuesday"],"dinner"),
  ("Iranian Kofta",[2,4],["tuesday"],"dinner"),
  ("Chocolate Peanut Butter",[2,4],["wednesday"],"breakfast"),
  ("Egg Avocado Toast",[2,4],["wednesday"],"breakfast"),
  ("Passion Fruit Quinoa Salad",[2,3,4],["monday","wednesday"],"snack"),
  ("Corn Soup",[2,3,4],["tuesday","wednesday"],"snack"),
  ("Beef Vindalo & Rice",[2,4],["wednesday"],"lunch"),
  ("Jamaican Jerk Salmon",[2],["wednesday"],"lunch"),
  ("Matcha Smoothie Shake",[2,4],["wednesday"],"snack"),
  ("Beef Pastrami Sandwich",[2,4],["wednesday"],"dinner"),
  ("Chicken Majbous",[2,4],["wednesday"],"dinner"),
  ("Falafel Wrap",[2,4],["thursday"],"breakfast"),
  ("Lebanese Traditional Muffin",[2,4],["thursday"],"breakfast"),
  ("Rice Pudding",[2,4],["thursday"],"snack"),
  ("Sweet Chili Chicken",[2,4],["thursday"],"lunch"),
  ("Beef Noodles",[2,4],["thursday"],"lunch"),
  ("Beef Burger",[2,4],["thursday"],"dinner"),
  ("Chicken Avocado Sandwich",[2,4],["thursday"],"dinner"),
  ("Egg Muffin",[3],["saturday"],"breakfast"),
  ("Normal Pancakes",[3],["saturday"],"breakfast"),
  ("Penne Chicken Pasta",[3],["saturday"],"lunch"),
  ("Beef Kofta With Saffron Rice",[3],["saturday"],"lunch"),
  ("Crispy Strips",[3],["saturday"],"dinner"),
  ("Lemon Shrimp",[3],["saturday"],"dinner"),
  ("Halloumi Muffin",[3],["sunday"],"breakfast"),
  ("Croissant Turkey",[3],["sunday"],"breakfast"),
  ("Chicken Biryani",[3],["sunday"],"lunch"),
  ("Salmon With Salsa",[3],["sunday"],"lunch"),
  ("Muffin",[3],["sunday"],"snack"),
  ("Stuffed Peppers",[3],["sunday"],"dinner"),
  ("Chicken Musakhan",[3],["sunday"],"dinner"),
  ("Croissant Egg Ring",[3],["monday"],"breakfast"),
  ("New Roasted Beef Sandwich",[3],["monday"],"lunch"),
  ("Cajun Shrimp Pasta",[3,4],["monday"],"lunch"),
  ("Lazy Cake",[3],["monday"],"snack"),
  ("Chicken Fattah",[3],["monday"],"dinner"),
  ("Beef Rolls Sweet Potatoes",[3],["monday"],"dinner"),
  ("Peri Peri Chicken & Rice",[3],["tuesday"],"lunch"),
  ("Spaghetti Beef Balls",[3],["tuesday"],"lunch"),
  ("Turkey Sandwich",[3],["tuesday"],"dinner"),
  ("Shish Tawook Wrap",[3],["tuesday"],"dinner"),
  ("Turkey English Muffin",[3],["wednesday"],"breakfast"),
  ("Shrimp Majbous",[3],["wednesday"],"lunch"),
  ("Chicken Stroganoff",[3],["wednesday"],"lunch"),
  ("Fajita Beef Sandwich",[3],["wednesday"],"dinner"),
  ("Steak With Mashed Potatoes",[3],["wednesday"],"dinner"),
  ("Peanut Butter Oatmeal",[3],["thursday"],"breakfast"),
  ("Egg Quesadillas",[3],["thursday"],"breakfast"),
  ("Raspberry Rice Pudding",[3],["thursday"],"snack"),
  ("Mongolian Noodles",[3],["thursday"],"lunch"),
  ("Chicken Alfredo",[3],["thursday"],"lunch"),
  ("Chicken Tajine",[3],["thursday"],"dinner"),
  ("Grilled Chicken Burger",[3],["thursday"],"dinner"),
  ("Creamy Zucchini Chicken Pasta",[4],["sunday"],"dinner"),
  ("Salmon Curry",[4],["tuesday"],"lunch"),
  ("Chicken Risotto",[4],["wednesday"],"lunch"),
]

merged = {}
for (name, weeks, days, cat) in SCHEDULE:
    k = norm(name)
    if k not in merged:
        merged[k] = {"nameEn": name, "weeks": set(weeks), "days": set(days), "cat": cat}
    else:
        merged[k]["weeks"].update(weeks)
        merged[k]["days"].update(days)
merged_list = [{"nameEn": v["nameEn"], "weeks": sorted(v["weeks"]), "days": sorted(v["days"]), "cat": v["cat"]} for v in merged.values()]

used_ids = set()
assigned = {}
for s in sorted(merged_list, key=lambda x: -len(norm(x["nameEn"]))):
    best_score, best_id = 0, None
    for m in data:
        if m["_id"] in used_ids: continue
        sc = similar(s["nameEn"], m.get("nameEn",""))
        if sc > best_score:
            best_score, best_id = sc, m["_id"]
    if best_id and best_score >= 0.4:
        used_ids.add(best_id)
        assigned[best_id] = s

updates = []
for m in data:
    s = assigned.get(m["_id"])
    if not s: continue
    cur_w = sorted(m.get("weeks") or [])
    cur_d = sorted(m.get("days") or [])
    if cur_w != s["weeks"] or cur_d != s["days"]:
        updates.append({"id": m["_id"], "weeks": s["weeks"], "days": s["days"], "category": s["cat"]})

with open("update_payload.json", "w", encoding="utf-8") as f:
    json.dump(updates, f)
print(f"Updates needed: {len(updates)}")
